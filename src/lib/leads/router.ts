import type { SupabaseClient } from '@supabase/supabase-js'

interface RepConfig {
  id: string
  services?: string[]    // keywords this rep handles (e.g., ['immigration', 'visa'])
  schedule?: { start: number; end: number } // working hours in 24h format (e.g., { start: 9, end: 18 })
}

interface LeadRoutingConfig {
  enabled: boolean
  mode: 'round_robin' | 'least_loaded' | 'smart' | 'manual'
  reps: string[]
  rep_configs?: RepConfig[]
  last_assigned_index: number
  fallback_rep?: string // rep to use when no rules match or outside hours
}

/**
 * Routes a new lead to a rep based on the workspace's lead routing config.
 * Supports: round_robin, least_loaded, smart (service+schedule+workload).
 */
export async function routeNewLead(
  supabase: SupabaseClient,
  workspaceId: string,
  leadId: string
): Promise<string | null> {
  const { data: ws } = await supabase
    .from('workspaces')
    .select('lead_routing_config')
    .eq('id', workspaceId)
    .single()

  if (!ws) return null

  const config = ws.lead_routing_config as LeadRoutingConfig | null
  if (!config || !config.enabled || !config.reps || config.reps.length === 0) {
    return null
  }

  // Load lead info for smart routing
  const { data: lead } = await supabase
    .from('social_leads')
    .select('author_name, message, metadata, platform, source_type')
    .eq('id', leadId)
    .single()

  let selectedRep: string | null = null

  if (config.mode === 'smart' && config.rep_configs?.length) {
    selectedRep = await smartRoute(supabase, config, workspaceId, lead)
  } else if (config.mode === 'round_robin') {
    const lastIndex = config.last_assigned_index ?? -1
    const nextIndex = (lastIndex + 1) % config.reps.length
    selectedRep = config.reps[nextIndex]

    await supabase
      .from('workspaces')
      .update({ lead_routing_config: { ...config, last_assigned_index: nextIndex } })
      .eq('id', workspaceId)
  } else if (config.mode === 'least_loaded') {
    selectedRep = await leastLoadedRoute(supabase, config, workspaceId)
  } else {
    return null
  }

  if (!selectedRep) {
    // Fallback rep
    selectedRep = config.fallback_rep || config.reps[0] || null
  }

  if (!selectedRep) return null

  // Assign lead
  await supabase
    .from('social_leads')
    .update({ assigned_to: selectedRep })
    .eq('id', leadId)

  const leadName = lead?.author_name || 'Unknown'

  // Notify assigned rep
  await supabase.from('notifications').insert({
    workspace_id: workspaceId,
    user_id: selectedRep,
    type: 'system',
    title: `New lead assigned to you: ${leadName}`,
    body: 'A new lead has been automatically routed to you.',
    priority: 'medium',
    action_url: '/leads',
  })

  return selectedRep
}

/**
 * Smart routing: match by service keywords + respect schedule + balance workload.
 */
async function smartRoute(
  supabase: SupabaseClient,
  config: LeadRoutingConfig,
  workspaceId: string,
  lead: { message?: string; metadata?: Record<string, unknown>; platform?: string } | null,
): Promise<string | null> {
  const repConfigs = config.rep_configs || []
  const now = new Date()
  const currentHour = now.getHours()

  // Step 1: Filter by schedule (only available reps)
  const availableReps = repConfigs.filter(rc => {
    if (!rc.schedule) return true // no schedule = always available
    return currentHour >= rc.schedule.start && currentHour < rc.schedule.end
  })

  if (availableReps.length === 0) {
    // Outside all schedules — use fallback
    return config.fallback_rep || null
  }

  // Step 2: Match by service keywords
  const leadText = ((lead?.message || '') + ' ' + JSON.stringify(lead?.metadata || {})).toLowerCase()
  const keywordMatched = availableReps.filter(rc => {
    if (!rc.services || rc.services.length === 0) return false
    return rc.services.some(kw => leadText.includes(kw.toLowerCase()))
  })

  const candidates = keywordMatched.length > 0 ? keywordMatched : availableReps

  // Step 3: Pick least loaded among candidates
  const candidateIds = candidates.map(c => c.id)
  const counts: Record<string, number> = {}
  for (const id of candidateIds) counts[id] = 0

  const { data: openLeads } = await supabase
    .from('social_leads')
    .select('assigned_to')
    .eq('workspace_id', workspaceId)
    .in('status', ['new', 'contacted', 'qualified'])
    .in('assigned_to', candidateIds)

  if (openLeads) {
    for (const l of openLeads) {
      if (l.assigned_to && counts[l.assigned_to] !== undefined) {
        counts[l.assigned_to]++
      }
    }
  }

  let minCount = Infinity
  let bestRep: string | null = null
  for (const id of candidateIds) {
    if (counts[id] < minCount) {
      minCount = counts[id]
      bestRep = id
    }
  }

  return bestRep
}

/**
 * Least loaded: pick rep with fewest open leads.
 */
async function leastLoadedRoute(
  supabase: SupabaseClient,
  config: LeadRoutingConfig,
  workspaceId: string,
): Promise<string | null> {
  const counts: Record<string, number> = {}
  for (const rep of config.reps) counts[rep] = 0

  const { data: openLeads } = await supabase
    .from('social_leads')
    .select('assigned_to')
    .eq('workspace_id', workspaceId)
    .in('status', ['new', 'contacted', 'qualified'])
    .in('assigned_to', config.reps)

  if (openLeads) {
    for (const l of openLeads) {
      if (l.assigned_to && counts[l.assigned_to] !== undefined) {
        counts[l.assigned_to]++
      }
    }
  }

  let minCount = Infinity
  let bestRep: string | null = null
  for (const rep of config.reps) {
    if (counts[rep] < minCount) {
      minCount = counts[rep]
      bestRep = rep
    }
  }
  return bestRep
}
