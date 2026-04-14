import { createClient } from '@supabase/supabase-js'

export type ApprovalEntity = 'quote' | 'expense' | 'invoice' | 'contract' | 'deal'
export type ApprovalOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq'

export interface ApprovalRule {
  id: string
  workspace_id: string
  entity: ApprovalEntity
  field: string
  operator: ApprovalOperator
  value: number
  approver_role: string | null
  approver_user_id: string | null
  active: boolean
}

export interface ApprovalCheckResult {
  requires: boolean
  matchedRules: ApprovalRule[]
}

function compare(actual: number, operator: ApprovalOperator, expected: number): boolean {
  switch (operator) {
    case 'gt': return actual > expected
    case 'gte': return actual >= expected
    case 'lt': return actual < expected
    case 'lte': return actual <= expected
    case 'eq': return actual === expected
    default: return false
  }
}

function getServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

/**
 * Evaluates active approval rules for a given entity & data payload.
 * Returns whether any rule matched and the matching rules.
 *
 * Note: this is infrastructure — callers must wire it into entity create/update
 * flows (quotes, expenses, etc.) and trigger creation of approval_requests.
 */
export async function checkRequiresApproval(
  entity: ApprovalEntity,
  data: Record<string, unknown>,
  workspaceId: string
): Promise<ApprovalCheckResult> {
  const supabase = getServiceClient()
  const { data: rules } = await supabase
    .from('approval_rules')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('entity', entity)
    .eq('active', true)

  const matchedRules: ApprovalRule[] = []
  for (const rule of (rules || []) as ApprovalRule[]) {
    const fieldValue = data[rule.field]
    if (fieldValue === undefined || fieldValue === null) continue
    const num = Number(fieldValue)
    if (Number.isNaN(num)) continue
    if (compare(num, rule.operator, Number(rule.value))) {
      matchedRules.push(rule)
    }
  }

  return { requires: matchedRules.length > 0, matchedRules }
}
