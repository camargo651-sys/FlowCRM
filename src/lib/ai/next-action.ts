/**
 * Deterministic Next Best Action engine for deals.
 * Pure functions — no LLM, no I/O. Caller passes in deal + related context.
 */

export type NextActionPriority = 'high' | 'medium' | 'low'
export type NextActionType =
  | 'follow_up'
  | 'schedule_meeting'
  | 'quote_reminder'
  | 'update_close_date'
  | 'loop_in_manager'

export interface NextAction {
  id: string
  type: NextActionType
  priority: NextActionPriority
  message: string
  action_url?: string
  icon: string
}

export interface DealLike {
  id: string
  title?: string | null
  value?: number | null
  status?: string | null
  stage_name?: string | null
  last_activity_at?: string | null
  expected_close_date?: string | null
  contact_name?: string | null
  has_pending_task?: boolean
  has_quote_sent?: boolean
  quote_viewed?: boolean
}

export interface NextActionContext {
  /** Average deal value across the workspace, used to detect "big deals". */
  avgDealValue?: number
  /** Now timestamp, injectable for testing. */
  now?: Date
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24))
}

export function getNextActionsForDeal(deal: DealLike, ctx: NextActionContext = {}): NextAction[] {
  if (deal.status && deal.status !== 'open') return []

  const now = ctx.now ?? new Date()
  const actions: NextAction[] = []
  const url = `/pipeline?deal=${deal.id}`
  const who = deal.contact_name || deal.title || 'this deal'

  // 1) Stale: no contact in 7+ days
  if (deal.last_activity_at) {
    const last = new Date(deal.last_activity_at)
    const days = daysBetween(now, last)
    if (days >= 7) {
      actions.push({
        id: `${deal.id}:follow_up`,
        type: 'follow_up',
        priority: 'high',
        message: `Follow up with ${who} — no contact in ${days} days`,
        action_url: url,
        icon: 'clock',
      })
    }
  }

  // 2) Negotiation stage with no pending task
  if ((deal.stage_name || '').toLowerCase().includes('negotiat') && !deal.has_pending_task) {
    actions.push({
      id: `${deal.id}:schedule_meeting`,
      type: 'schedule_meeting',
      priority: 'medium',
      message: `Schedule next meeting for ${who}`,
      action_url: url,
      icon: 'calendar',
    })
  }

  // 3) Quote sent but not viewed
  if (deal.has_quote_sent && !deal.quote_viewed) {
    actions.push({
      id: `${deal.id}:quote_reminder`,
      type: 'quote_reminder',
      priority: 'medium',
      message: `Send reminder about quote for ${who}`,
      action_url: url,
      icon: 'file',
    })
  }

  // 4) Expected close date passed
  if (deal.expected_close_date) {
    const close = new Date(deal.expected_close_date)
    if (close.getTime() < now.getTime()) {
      actions.push({
        id: `${deal.id}:update_close_date`,
        type: 'update_close_date',
        priority: 'high',
        message: `Update close date for ${who} — expected ${close.toLocaleDateString()}`,
        action_url: url,
        icon: 'calendar',
      })
    }
  }

  // 5) Big deal
  if (typeof deal.value === 'number' && typeof ctx.avgDealValue === 'number' && ctx.avgDealValue > 0) {
    if (deal.value > ctx.avgDealValue * 1.5) {
      actions.push({
        id: `${deal.id}:loop_in_manager`,
        type: 'loop_in_manager',
        priority: 'medium',
        message: `Loop in manager — ${who} is a high-value deal`,
        action_url: url,
        icon: 'users',
      })
    }
  }

  return actions
}

export function getNextActionsForUser(deals: DealLike[], ctx: NextActionContext = {}): NextAction[] {
  const all: NextAction[] = []
  for (const d of deals) {
    all.push(...getNextActionsForDeal(d, ctx))
  }
  // Sort by priority
  const order: Record<NextActionPriority, number> = { high: 0, medium: 1, low: 2 }
  all.sort((a, b) => order[a.priority] - order[b.priority])
  return all
}
