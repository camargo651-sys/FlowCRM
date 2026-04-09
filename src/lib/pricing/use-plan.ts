'use client'
import { useWorkspace } from '@/lib/workspace-context'
import { createPlanGate } from './gate'
import type { PlanGate } from './gate'

export function usePlan(): PlanGate {
  const { plan } = useWorkspace()
  return createPlanGate(plan || 'free')
}
