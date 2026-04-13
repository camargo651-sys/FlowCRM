// Stage transition conditions for pipeline deals.
// Rules are keyed by stage name (case-insensitive) since stage IDs differ per workspace.

export interface StageCondition {
  fromStage: string
  toStage: string
  requiredFields: string[]
  requireApproval?: boolean
  minValue?: number
}

export interface DealLike {
  value?: number | null
  amount?: number | null
  contact_id?: string | null
  expected_close_date?: string | null
  close_date?: string | null
  probability?: number | null
  owner_id?: string | null
  title?: string | null
  [key: string]: unknown
}

export const DEFAULT_STAGE_CONDITIONS: StageCondition[] = [
  {
    fromStage: '*',
    toStage: 'won',
    requiredFields: ['amount', 'close_date', 'contact_id'],
    requireApproval: true,
    minValue: 1,
  },
  {
    fromStage: '*',
    toStage: 'proposal',
    requiredFields: ['amount', 'contact_id'],
    minValue: 1,
  },
  {
    fromStage: '*',
    toStage: 'negotiation',
    requiredFields: ['amount', 'contact_id', 'close_date'],
  },
  {
    fromStage: '*',
    toStage: 'lost',
    requiredFields: [],
    requireApproval: true,
  },
]

const STORAGE_KEY = 'tracktio_stage_conditions'

export function loadStageConditions(): StageCondition[] {
  if (typeof window === 'undefined') return DEFAULT_STAGE_CONDITIONS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STAGE_CONDITIONS
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as StageCondition[]
    return DEFAULT_STAGE_CONDITIONS
  } catch {
    return DEFAULT_STAGE_CONDITIONS
  }
}

export function saveStageConditions(conditions: StageCondition[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conditions))
}

function norm(s: string | undefined | null): string {
  return (s || '').trim().toLowerCase()
}

function matchStage(rule: string, stage: string): boolean {
  if (rule === '*' || rule === '') return true
  return norm(rule) === norm(stage) || norm(stage).includes(norm(rule))
}

function fieldValue(deal: DealLike, field: string): unknown {
  switch (field) {
    case 'amount':
    case 'value':
      return deal.value ?? deal.amount
    case 'close_date':
    case 'expected_close_date':
      return deal.expected_close_date ?? deal.close_date
    default:
      return deal[field]
  }
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'string' && v.trim() === '') return true
  if (typeof v === 'number' && Number.isNaN(v)) return true
  return false
}

export interface ValidationResult {
  allowed: boolean
  missingFields: string[]
  reason?: string
  requireApproval?: boolean
}

export function validateTransition(
  deal: DealLike,
  from: string,
  to: string,
  conditions: StageCondition[] = loadStageConditions(),
): ValidationResult {
  const matching = conditions.filter(c => matchStage(c.fromStage, from) && matchStage(c.toStage, to))
  if (matching.length === 0) {
    return { allowed: true, missingFields: [] }
  }

  const missing = new Set<string>()
  let requireApproval = false
  let reason: string | undefined

  for (const rule of matching) {
    for (const field of rule.requiredFields) {
      if (isEmpty(fieldValue(deal, field))) missing.add(field)
    }
    if (rule.minValue !== undefined) {
      const v = Number(fieldValue(deal, 'amount') ?? 0)
      if (!Number.isFinite(v) || v < rule.minValue) {
        missing.add('amount')
        reason = `Minimum value ${rule.minValue} required`
      }
    }
    if (rule.requireApproval) requireApproval = true
  }

  const missingFields = Array.from(missing)
  if (missingFields.length > 0) {
    return {
      allowed: false,
      missingFields,
      reason: reason || `Missing required fields: ${missingFields.join(', ')}`,
      requireApproval,
    }
  }

  return { allowed: true, missingFields: [], requireApproval }
}
