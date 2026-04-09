import type { SupabaseClient } from '@supabase/supabase-js'

interface LeadRoutingConfig {
  enabled: boolean
  mode: 'round_robin' | 'least_loaded' | 'manual'
  reps: string[]
  last_assigned_index: number
}

/**
 * Routes a new lead to a rep based on the workspace's lead routing config.
 * Returns the assigned rep's user ID, or null if routing is disabled / not configured.
 */
export async function routeNewLead(
  supabase: SupabaseClient,
  workspaceId: string,
  leadId: string
): Promise<string | null> {
  // Load workspace routing config
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

  let selectedRep: string | null = null

  if (config.mode === 'round_robin') {
    const lastIndex = config.last_assigned_index ?? -1
    const nextIndex = (lastIndex + 1) % config.reps.length
    selectedRep = config.reps[nextIndex]

    // Update last_assigned_index in workspace
    await supabase
      .from('workspaces')
      .update({
        lead_routing_config: { ...config, last_assigned_index: nextIndex },
      })
      .eq('id', workspaceId)
  } else if (config.mode === 'least_loaded') {
    // Count open leads per rep (status not converted or discarded)
    const counts: Record<string, number> = {}
    for (const rep of config.reps) {
      counts[rep] = 0
    }

    const { data: openLeads } = await supabase
      .from('social_leads')
      .select('assigned_to')
      .eq('workspace_id', workspaceId)
      .not('status', 'in', '("converted","discarded")')
      .in('assigned_to', config.reps)

    if (openLeads) {
      for (const lead of openLeads) {
        if (lead.assigned_to && counts[lead.assigned_to] !== undefined) {
          counts[lead.assigned_to]++
        }
      }
    }

    // Pick rep with fewest leads
    let minCount = Infinity
    for (const rep of config.reps) {
      if (counts[rep] < minCount) {
        minCount = counts[rep]
        selectedRep = rep
      }
    }
  } else {
    // mode === 'manual' — no auto-assignment
    return null
  }

  if (!selectedRep) return null

  // Assign lead to selected rep
  await supabase
    .from('social_leads')
    .update({ assigned_to: selectedRep })
    .eq('id', leadId)

  // Get lead name for notification
  const { data: lead } = await supabase
    .from('social_leads')
    .select('author_name')
    .eq('id', leadId)
    .single()

  const leadName = lead?.author_name || 'Unknown'

  // Create notification for the assigned rep
  await supabase.from('notifications').insert({
    workspace_id: workspaceId,
    user_id: selectedRep,
    type: 'system',
    title: `New lead assigned to you: ${leadName}`,
    body: `A new lead has been automatically routed to you.`,
    priority: 'medium',
    action_url: '/leads',
  })

  return selectedRep
}
