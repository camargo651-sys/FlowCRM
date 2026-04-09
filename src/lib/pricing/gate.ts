import { getPlan, canAccessModule, checkLimit } from './plans'
import type { Plan } from './plans'

export interface PlanGate {
  plan: Plan
  canAccess: (module: string) => boolean
  checkResourceLimit: (resource: 'contacts' | 'deals' | 'products' | 'invoices' | 'employees' | 'users', current: number) => { allowed: boolean; limit: number; usage: number }
  isLocked: (module: string) => boolean
  planKey: string
}

export function createPlanGate(planKey: string): PlanGate {
  const plan = getPlan(planKey || 'free')

  return {
    plan,
    planKey: plan.key,
    canAccess: (module: string) => canAccessModule(plan, module),
    checkResourceLimit: (resource, current) => checkLimit(plan, resource, current),
    isLocked: (module: string) => !canAccessModule(plan, module),
  }
}

// Map sidebar routes to module keys for gating
export const ROUTE_TO_MODULE: Record<string, string> = {
  '/pipeline': 'crm',
  '/contacts': 'crm',
  '/quotes': 'crm',
  '/invoices': 'invoicing',
  '/pos': 'pos',
  '/store-orders': 'ecommerce',
  '/inventory': 'inventory',
  '/purchasing': 'purchasing',
  '/manufacturing': 'manufacturing',
  '/accounting': 'accounting',
  '/expenses': 'expenses',
  '/reports': 'reports',
  '/hr': 'hr',
  '/automations': 'automations',
}
