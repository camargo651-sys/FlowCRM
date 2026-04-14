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

interface Row {
  quota: Quota
  userName: string
  current: number
  pct: number
  daysLeft: number
}

export default function QuotasInsightsPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }

        // Get workspace
        const { data: ws } = await supabase
          .from('workspaces').select('id').eq('owner_id', user.id).single()
        if (!ws) { setLoading(false); return }
        const wsId = ws.id

        // Active quotas
        const today = new Date().toISOString().slice(0, 10)
        const { data: quotas } = await supabase
          .from('sales_quotas')
          .select('id, user_id, period, target_amount, start_date, end_date, metric')
          .eq('workspace_id', wsId)
          .lte('start_date', today)
          .gte('end_date', today)

        const list = (quotas || []) as Quota[]

        // Profiles
        const { data: profiles } = await supabase
          .from('profiles').select('id, full_name, email').eq('workspace_id', wsId)
        const nameMap = new Map<string, string>()
        for (const p of (profiles || []) as { id: string; full_name: string | null; email: string | null }[]) {
          nameMap.set(p.id, p.full_name || p.email || 'Unknown')
        }

        const result: Row[] = []
        for (const q of list) {
          let current = 0
          if (q.metric === 'won_value' || q.metric === 'deal_count') {
            let dq = supabase
              .from('deals')
              .select('id, value')
              .eq('workspace_id', wsId)
              .eq('status', 'won')
              .gte('updated_at', q.start_date)
              .lte('updated_at', q.end_date + 'T23:59:59')
            if (q.user_id) dq = dq.eq('owner_id', q.user_id)
            const { data: deals } = await dq
            const drows = (deals || []) as { value: number | null }[]
            current = q.metric === 'won_value'
              ? drows.reduce((s, d) => s + (Number(d.value) || 0), 0)
              : drows.length
          } else if (q.metric === 'calls_count') {
            let cq = supabase
              .from('call_logs').select('id')
              .eq('workspace_id', wsId)
              .gte('started_at', q.start_date)
              .lte('started_at', q.end_date + 'T23:59:59')
            if (q.user_id) cq = cq.eq('user_id', q.user_id)
            const { data } = await cq
            current = (data || []).length
          }
          const target = Number(q.target_amount) || 0
          const pct = target > 0 ? Math.round((current / target) * 100) : 0
          const daysLeft = Math.max(0, Math.ceil((new Date(q.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
          result.push({
            quota: q,
            userName: q.user_id ? (nameMap.get(q.user_id) || 'Unknown') : 'Workspace-wide',
            current,
            pct,
            daysLeft,
          })
        }
        if (!cancelled) setRows(result)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [supabase])

  const fmt = (q: Quota, v: number) => q.metric === 'won_value' ? formatCurrency(v) : `${v}`

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-surface-900 dark:text-surface-50 flex items-center gap-2">
            <Target className="w-5 h-5 text-violet-600" /> Quota Tracker
          </h1>
          <p className="text-xs text-surface-500 mt-1">Live progress for all active sales quotas.</p>
        </div>
        <Link href="/settings/quotas" className="btn-secondary text-xs">Manage quotas</Link>
      </div>

      <div className="card p-4">
        {loading ? (
          <p className="text-xs text-surface-400">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-surface-400">No active quotas. <Link href="/settings/quotas" className="text-brand-600 hover:underline">Create one</Link>.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase text-surface-500 border-b border-surface-100 dark:border-surface-800">
                  <th className="py-2 pr-3">Rep</th>
                  <th className="py-2 pr-3">Period</th>
                  <th className="py-2 pr-3">Metric</th>
                  <th className="py-2 pr-3">Target</th>
                  <th className="py-2 pr-3">Current</th>
                  <th className="py-2 pr-3 w-48">Progress</th>
                  <th className="py-2 pr-3">Days left</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const barColor = r.pct >= 100 ? 'bg-emerald-500' : r.pct >= 70 ? 'bg-blue-500' : r.pct >= 40 ? 'bg-amber-500' : 'bg-red-500'
                  return (
                    <tr key={r.quota.id} className="border-b border-surface-50 dark:border-surface-800/40">
                      <td className="py-2 pr-3 font-medium">{r.userName}</td>
                      <td className="py-2 pr-3 capitalize text-xs text-surface-600">{r.quota.period}</td>
                      <td className="py-2 pr-3 text-xs text-surface-600">{r.quota.metric.replace('_', ' ')}</td>
                      <td className="py-2 pr-3">{fmt(r.quota, Number(r.quota.target_amount))}</td>
                      <td className="py-2 pr-3 font-semibold">{fmt(r.quota, r.current)}</td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
                            <div className={`h-full ${barColor}`} style={{ width: `${Math.min(100, r.pct)}%` }} />
                          </div>
                          <span className="text-[11px] font-semibold text-surface-600 w-10 text-right">{r.pct}%</span>
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-xs">{r.daysLeft}d</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
