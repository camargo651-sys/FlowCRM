'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TrendingDown } from 'lucide-react'
import Link from 'next/link'

interface Props { workspaceId: string }

interface Row {
  label: string
  color: string
  count: number
}

export default function LossReasonsWidget({ workspaceId }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (!workspaceId) return
    let cancelled = false
    ;(async () => {
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      const { data: deals } = await supabase
        .from('deals')
        .select('id, lost_reason_id, lost_reason')
        .eq('workspace_id', workspaceId)
        .eq('status', 'lost')
        .gte('updated_at', since)

      const { data: reasons } = await supabase
        .from('loss_reasons')
        .select('id, label, color')
        .eq('workspace_id', workspaceId)

      if (cancelled) return
      const reasonMap: Record<string, { label: string; color: string }> = {}
      for (const r of (reasons || []) as { id: string; label: string; color: string }[]) {
        reasonMap[r.id] = { label: r.label, color: r.color }
      }

      const buckets: Record<string, Row> = {}
      for (const d of (deals || []) as { lost_reason_id: string | null; lost_reason: string | null }[]) {
        const key = d.lost_reason_id || d.lost_reason || 'Unspecified'
        const info = d.lost_reason_id ? reasonMap[d.lost_reason_id] : null
        const label = info?.label || d.lost_reason || 'Unspecified'
        const color = info?.color || '#94a3b8'
        if (!buckets[key]) buckets[key] = { label, color, count: 0 }
        buckets[key].count++
      }
      const sorted = Object.values(buckets).sort((a, b) => b.count - a.count).slice(0, 3)
      setRows(sorted)
      setTotal((deals || []).length)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [supabase, workspaceId])

  const max = Math.max(1, ...rows.map(r => r.count))

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-red-500" />
          <p className="text-sm font-semibold text-surface-800">Top Loss Reasons</p>
          <span className="text-[10px] text-surface-400">(last 90d)</span>
        </div>
        <Link href="/reports/lost-deals" className="text-[11px] text-brand-600 hover:underline">View report</Link>
      </div>
      {loading ? (
        <p className="text-xs text-surface-400">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-surface-400">No lost deals yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.label} className="flex items-center gap-2">
              <div className="w-24 truncate text-xs text-surface-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                <span className="truncate">{r.label}</span>
              </div>
              <div className="flex-1 h-2 bg-surface-100 rounded-full overflow-hidden">
                <div className="h-full" style={{ width: `${(r.count / max) * 100}%`, backgroundColor: r.color }} />
              </div>
              <div className="w-8 text-[11px] text-right text-surface-600">{r.count}</div>
            </div>
          ))}
          <p className="text-[10px] text-surface-400 pt-1">{total} total lost in window</p>
        </div>
      )}
    </div>
  )
}
