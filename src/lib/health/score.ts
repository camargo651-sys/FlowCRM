import type { SupabaseClient } from '@supabase/supabase-js'

export interface HealthResult {
  score: number
  status: 'green' | 'yellow' | 'red'
  signals: string[]
}

const DAY = 24 * 60 * 60 * 1000

function daysAgo(n: number): string {
  return new Date(Date.now() - n * DAY).toISOString()
}

/**
 * Calculate a 0-100 customer health score for a given contact.
 */
export async function calculateHealthScore(
  contactId: string,
  workspaceId: string,
  supabase: SupabaseClient,
): Promise<HealthResult> {
  let score = 50 // baseline
  const signals: string[] = []

  // Recent activity
  const { data: recentAct } = await supabase
    .from('activities')
    .select('id, created_at')
    .eq('workspace_id', workspaceId)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (recentAct?.created_at) {
    const ageMs = Date.now() - new Date(recentAct.created_at).getTime()
    const days = ageMs / DAY
    if (days < 7) {
      score += 30
      signals.push('Active in last 7 days (+30)')
    } else if (days < 14) {
      score += 20
      signals.push('Active in last 14 days (+20)')
    } else if (days >= 30) {
      score -= 15
      signals.push('No activity for 30+ days (-15)')
    }
  } else {
    score -= 15
    signals.push('No activity recorded (-15)')
  }

  // Overdue invoices
  const today = new Date().toISOString().slice(0, 10)
  const { count: overdueCount } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('contact_id', contactId)
    .gt('balance_due', 0)
    .lt('due_date', today)

  if ((overdueCount || 0) > 0) {
    score -= 20
    signals.push(`${overdueCount} overdue invoice(s) (-20)`)
  } else {
    score += 20
    signals.push('Payments up to date (+20)')
  }

  // Engagement events (last 30 days)
  const { count: engageCount } = await supabase
    .from('engagement_events')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('contact_id', contactId)
    .gte('occurred_at', daysAgo(30))

  if ((engageCount || 0) > 1) {
    score += 15
    signals.push(`${engageCount} recent engagements (+15)`)
  }

  // Positive call sentiment
  const { count: posCallCount } = await supabase
    .from('call_logs')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('contact_id', contactId)
    .eq('sentiment', 'positive')
    .gte('started_at', daysAgo(60))

  if ((posCallCount || 0) > 0) {
    score += 15
    signals.push('Positive call sentiment (+15)')
  }

  // Open urgent tickets
  const { count: urgentTickets } = await supabase
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('contact_id', contactId)
    .eq('priority', 'urgent')
    .neq('status', 'closed')

  if ((urgentTickets || 0) > 0) {
    score -= 10
    signals.push(`${urgentTickets} open urgent ticket(s) (-10)`)
  }

  // Clamp
  score = Math.max(0, Math.min(100, score))
  const status: HealthResult['status'] = score >= 70 ? 'green' : score >= 40 ? 'yellow' : 'red'

  return { score, status, signals }
}
