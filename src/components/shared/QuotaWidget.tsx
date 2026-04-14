'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { Target } from 'lucide-react'
import Link from 'next/link'

interface Quota {
  id: string
  user_id: string | null
  period: 'monthly' | 'quarterly' | 'yearly'
  target_amount: number
  start_date: string
  end_date: string
  metric: 'won_value' | 'deal_count' | 'calls_count'
}

interface Props {
  workspaceId: string
}

export default function QuotaWidget({ workspaceId }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [quota, setQuota] = useState<Quota | null>(null)
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (!workspaceId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const today = new Date().toISOString().slice(0, 10)
      const { data: quotas } = await supabase
        .from('sales_quotas')
        .select('id, user_id, period, target_amount, start_date, end_date, metric')
        .eq('workspace_id', workspaceId)
        .lte('start_date', today)
        .gte('end_date', today)

      if (cancelled) return
      // Prefer current user quota, fall back to workspace-wide
      const list = (quotas || []) as Quota[]
      const mine = list.find(q => q.user_id === user.id) || list.find(q => !q.user_id)
      if (!mine) { setQuota(null); setLoading(false); return }
      setQuota(mine)

      // Compute current progress
      if (mine.metric === 'won_value' || mine.metric === 'deal_count') {
        let q = supabase
          .from('deals')
          .select('id, value, owner_id, updated_at, status')
          .eq('workspace_id', workspaceId)
          .eq('status', 'won')
          .gte('updated_at', mine.start_date)
          .lte('updated_at', mine.end_date + 'T23:59:59')
        if (mine.user_id) q = q.eq('owner_id', mine.user_id)
        const { data: deals } = await q
        const rows = (deals || []) as { value: number | null }[]
        if (mine.metric === 'won_value') {
          setCurrent(rows.reduce((s, d) => s + (Number(d.value) || 0), 0))
        } else {
          setCurrent(rows.length)
        }
      } else if (mine.metric === 'calls_count') {
        let q = supabase
          .from('call_logs')
          .select('id, user_id, started_at')
          .eq('workspace_id', workspaceId)
          .gte('started_at', mine.start_date)
          .lte('started_at', mine.end_date + 'T23:59:59')
        if (mine.user_id) q = q.eq('user_id', mine.user_id)
        const { data } = await q
        setCurrent((data || []).length)
      }

      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [workspaceId, supabase])

  if (loading) {
    return (
      <div className="card p-4 mb-6">
        <div className="h-4 w-32 bg-surface-100 rounded animate-pulse mb-3" />
        <div className="h-12 bg-surface-100 rounded animate-pulse" />
      </div>
    )
  }

  if (!quota) {
    return (
      <div className="card p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wide flex items-center gap-1">
            <Target className="w-3.5 h-3.5 text-violet-600" /> Sales Quota
          </h3>
          <Link href="/settings/quotas" className="text-[11px] text-brand-600 hover:underline">Set quota</Link>
        </div>
        <p className="text-xs text-surface-400">No active quota. Create one in settings.</p>
      </div>
    )
  }

  const pct = quota.target_amount > 0 ? Math.min(100, Math.round((current / quota.target_amount) * 100)) : 0
  const daysLeft = Math.max(0, Math.ceil((new Date(quota.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
  const isCurrency = quota.metric === 'won_value'
  const fmt = (v: number) => isCurrency ? formatCurrency(v) : `${v}`
  const barColor = pct >= 100 ? 'bg-emerald-500' : pct >= 70 ? 'bg-blue-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="card p-4 mb-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wide flex items-center gap-1">
          <Target className="w-3.5 h-3.5 text-violet-600" /> Sales Quota ({quota.period})
        </h3>
        <Link href="/insights/quotas" className="text-[11px] text-brand-600 hover:underline">View team</Link>
      </div>
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-lg font-bold text-surface-900 dark:text-surface-50">
          {fmt(current)} <span className="text-xs text-surface-400 font-normal">of {fmt(quota.target_amount)}</span>
        </p>
        <span className="text-xs font-semibold text-surface-600">{pct}%</span>
      </div>
      <div className="w-full h-2 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-surface-400 mt-2">{daysLeft} days left · ends {new Date(quota.end_date).toLocaleDateString()}</p>
    </div>
  )
}
