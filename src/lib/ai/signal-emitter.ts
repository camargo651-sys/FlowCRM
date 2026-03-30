import { SupabaseClient } from '@supabase/supabase-js'

type SignalType =
  | 'email_opened' | 'email_replied' | 'email_sent' | 'email_received'
  | 'whatsapp_received' | 'whatsapp_sent' | 'whatsapp_read'
  | 'call_completed' | 'call_positive' | 'call_negative'
  | 'quote_viewed' | 'quote_sent' | 'quote_accepted' | 'quote_rejected'
  | 'deal_stage_changed' | 'deal_created' | 'deal_stale'
  | 'meeting_scheduled' | 'meeting_completed'
  | 'linkedin_connected' | 'contact_created'

// Signal strength weights — higher = more buying intent
const SIGNAL_WEIGHTS: Record<SignalType, number> = {
  email_opened: 2,
  email_replied: 5,
  email_sent: 1,
  email_received: 3,
  whatsapp_received: 4,
  whatsapp_sent: 1,
  whatsapp_read: 2,
  call_completed: 5,
  call_positive: 8,
  call_negative: -3,
  quote_viewed: 6,
  quote_sent: 3,
  quote_accepted: 10,
  quote_rejected: -5,
  deal_stage_changed: 4,
  deal_created: 3,
  deal_stale: -4,
  meeting_scheduled: 6,
  meeting_completed: 7,
  linkedin_connected: 2,
  contact_created: 1,
}

/**
 * Emit an engagement signal and update contact scores.
 */
export async function emitSignal(
  supabase: SupabaseClient,
  params: {
    workspaceId: string
    contactId?: string | null
    dealId?: string | null
    signalType: SignalType
    source?: string
    metadata?: Record<string, any>
  },
) {
  const strength = SIGNAL_WEIGHTS[params.signalType] || 1

  // Store signal
  await supabase.from('engagement_signals').insert({
    workspace_id: params.workspaceId,
    contact_id: params.contactId || null,
    deal_id: params.dealId || null,
    signal_type: params.signalType,
    strength: Math.abs(strength),
    source: params.source || null,
    metadata: params.metadata || {},
  })

  // Update contact score if contact exists
  if (params.contactId) {
    await recalculateContactScore(supabase, params.contactId)
  }

  // Update deal score if deal exists
  if (params.dealId) {
    await recalculateDealScore(supabase, params.dealId)
  }
}

/**
 * Recalculate engagement score for a contact based on last 30 days of signals.
 */
async function recalculateContactScore(supabase: SupabaseClient, contactId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: signals } = await supabase
    .from('engagement_signals')
    .select('signal_type, strength, created_at')
    .eq('contact_id', contactId)
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: false })

  if (!signals?.length) {
    await supabase.from('contacts').update({
      engagement_score: 0,
      score_label: 'inactive',
    }).eq('id', contactId)
    return
  }

  // Time-weighted scoring: recent signals count more
  let totalScore = 0
  const now = Date.now()
  for (const signal of signals) {
    const ageInDays = (now - new Date(signal.created_at).getTime()) / (1000 * 60 * 60 * 24)
    const decay = Math.max(0.2, 1 - (ageInDays / 30)) // Linear decay over 30 days, min 0.2
    const weight = SIGNAL_WEIGHTS[signal.signal_type as SignalType] || 1
    totalScore += weight * decay
  }

  // Normalize to 0-100 scale
  const score = Math.min(100, Math.max(0, Math.round(totalScore)))

  // Determine label
  let label: string
  if (score >= 70) label = 'hot'
  else if (score >= 35) label = 'warm'
  else if (score > 0) label = 'cold'
  else label = 'inactive'

  const lastInteraction = signals[0]?.created_at || null

  await supabase.from('contacts').update({
    engagement_score: score,
    score_label: label,
    last_interaction_at: lastInteraction,
    interaction_count: signals.length,
  }).eq('id', contactId)
}

/**
 * Recalculate AI score and risk level for a deal.
 */
async function recalculateDealScore(supabase: SupabaseClient, dealId: string) {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const { data: signals } = await supabase
    .from('engagement_signals')
    .select('signal_type, strength, created_at')
    .eq('deal_id', dealId)
    .gte('created_at', fourteenDaysAgo)
    .order('created_at', { ascending: false })

  const { data: deal } = await supabase
    .from('deals')
    .select('updated_at, expected_close_date, status')
    .eq('id', dealId)
    .single()

  if (!deal || deal.status !== 'open') return

  let score = 50 // Base score
  const now = Date.now()

  // Boost from signals
  for (const signal of signals || []) {
    const weight = SIGNAL_WEIGHTS[signal.signal_type as SignalType] || 0
    score += weight
  }

  // Penalty for staleness
  const daysSinceUpdate = (now - new Date(deal.updated_at).getTime()) / (1000 * 60 * 60 * 24)
  if (daysSinceUpdate > 7) score -= Math.min(30, (daysSinceUpdate - 7) * 2)

  // Close date pressure
  if (deal.expected_close_date) {
    const daysToClose = (new Date(deal.expected_close_date).getTime() - now) / (1000 * 60 * 60 * 24)
    if (daysToClose < 0) score -= 20 // Overdue
    else if (daysToClose < 3) score += 5 // Urgency boost
  }

  score = Math.min(100, Math.max(0, Math.round(score)))

  let risk: string
  if (score >= 65) risk = 'on_track'
  else if (score >= 35) risk = 'at_risk'
  else risk = 'critical'

  await supabase.from('deals').update({
    ai_score: score,
    ai_risk: risk,
  }).eq('id', dealId)
}
