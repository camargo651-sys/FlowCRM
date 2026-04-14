'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CreditCard, Users, Package, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useWorkspace } from '@/lib/workspace-context'
import { getPlan } from '@/lib/pricing/plans'
import { getActiveWorkspace } from '@/lib/get-active-workspace'
import { cn } from '@/lib/utils'

interface Props {
  variant?: 'full' | 'compact'
  className?: string
}

export default function CostVisibilityWidget({ variant = 'full', className }: Props) {
  const supabase = createClient()
  const { plan: planKey, enabledModules } = useWorkspace()
  const [userCount, setUserCount] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const ws = await getActiveWorkspace(supabase, user.id, 'id')
      if (!ws) return
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', ws.id)
      if (!cancelled) setUserCount(count ?? 0)
    })()
    return () => { cancelled = true }
  }, [supabase])

  const plan = getPlan(planKey || 'free')
  const moduleCount = Object.values(enabledModules || {}).filter(Boolean).length
  const planPrice = plan.price
  const extras = 0 // all-in pricing: no per-seat charges on top of plan
  const total = planPrice + extras
  const isFree = total === 0 || plan.limits.modules.includes('*') && plan.key === 'free'
  const isUnlimited = plan.limits.modules.includes('*')

  if (variant === 'compact') {
    return (
      <div className={cn('card p-4', className)}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center flex-shrink-0">
            <CreditCard className="w-4 h-4 text-brand-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold text-surface-900 dark:text-surface-50 leading-tight">{plan.name}</p>
              {isFree && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">FREE</span>}
            </div>
            <p className="text-[10px] text-surface-500 font-semibold uppercase truncate">
              ${total}/mo &middot; {userCount ?? '—'} user{userCount === 1 ? '' : 's'}
            </p>
          </div>
          <Link href="/billing" className="text-[10px] font-medium text-brand-600 hover:text-brand-700 whitespace-nowrap">
            Change
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('card p-5', className)}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-surface-900 dark:text-surface-50">Your plan: {plan.name}</h3>
              {isFree && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  <Sparkles className="w-3 h-3" /> Free forever
                </span>
              )}
              {isUnlimited && !isFree && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">Unlimited</span>
              )}
            </div>
            <p className="text-xs text-surface-500 mt-0.5">
              Transparent pricing, no hidden fees
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-lg bg-surface-50 dark:bg-surface-800 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Users className="w-3 h-3 text-surface-400" />
            <span className="text-[10px] font-semibold text-surface-500 uppercase">Users</span>
          </div>
          <p className="text-base font-bold text-surface-900 dark:text-surface-50">{userCount ?? '—'}</p>
        </div>
        <div className="rounded-lg bg-surface-50 dark:bg-surface-800 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Package className="w-3 h-3 text-surface-400" />
            <span className="text-[10px] font-semibold text-surface-500 uppercase">Modules</span>
          </div>
          <p className="text-base font-bold text-surface-900 dark:text-surface-50">{moduleCount}</p>
        </div>
        <div className="rounded-lg bg-surface-50 dark:bg-surface-800 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <CreditCard className="w-3 h-3 text-surface-400" />
            <span className="text-[10px] font-semibold text-surface-500 uppercase">Monthly</span>
          </div>
          <p className="text-base font-bold text-surface-900 dark:text-surface-50">${total}</p>
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-surface-200 dark:border-surface-700 p-3 mb-3">
        <p className="text-[11px] font-semibold text-surface-500 uppercase mb-1">Breakdown</p>
        <div className="flex items-center justify-between text-xs">
          <span className="text-surface-600 dark:text-surface-300">${planPrice} plan + ${extras} extras</span>
          <span className="font-bold text-surface-900 dark:text-surface-50">= ${total}/month</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-surface-500">
          {isFree ? 'You pay nothing. Ever.' : 'Billed monthly. Cancel anytime.'}
        </p>
        <Link href="/billing" className="text-xs font-medium text-brand-600 hover:text-brand-700">
          Change plan →
        </Link>
      </div>
    </div>
  )
}
