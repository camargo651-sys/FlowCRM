'use client'
import { usePlan } from '@/lib/pricing/use-plan'
import UpgradePrompt from './UpgradePrompt'

interface PlanGateProps {
  module: string
  feature: string
  children: React.ReactNode
}

/**
 * Wrap a page/section with PlanGate to enforce plan-based access.
 * If the module is locked, shows an upgrade prompt instead of children.
 */
export default function PlanGate({ module, feature, children }: PlanGateProps) {
  const { canAccess, plan } = usePlan()

  if (!canAccess(module)) {
    // Find the cheapest plan that includes this module
    const requiredPlan = ['Starter', 'Growth', 'Scale'].find((_, i) => {
      const plans = [
        ['crm', 'invoicing', 'automations'],
        ['crm', 'invoicing', 'inventory', 'pos', 'automations', 'ecommerce'],
        ['crm', 'invoicing', 'inventory', 'pos', 'automations', 'ecommerce', 'accounting', 'hr', 'expenses', 'manufacturing', 'purchasing'],
      ]
      return plans[i]?.includes(module)
    }) || 'Growth'

    return <UpgradePrompt feature={feature} currentPlan={plan.name} requiredPlan={requiredPlan} />
  }

  return <>{children}</>
}
