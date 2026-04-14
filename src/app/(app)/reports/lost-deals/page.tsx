'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getActiveWorkspace } from '@/lib/get-active-workspace'
import { formatCurrency } from '@/lib/utils'
import { TrendingDown } from 'lucide-react'
import Link from 'next/link'
import type { Profile } from '@/types'

interface DealRow {
  id: string
  value: number | null
  lost_reason_id: string | null
  lost_reason: string | null
  owner_id: string | null
  updated_at: string
}

interface ReasonRow { id: string; label: string; color: string }
interface AggRow {
  key: string
  label: string
  color: string
  count: number
  total: number
}

export default function LostDealsReportPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<DealRow[]>([])
  const [reasons, setReasons] = useState<Record<string, ReasonRow>>({})
  const [owners, setOwners] = useState<Pick<Profile, 'id' | 'full_name'>[]>([])
  const [ownerFilter, setOwnerFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const ws = await getActiveWorkspace(supabase, user.id, 'id')
    if (!ws) { setLoading(false); return }

    let q = supabase
      .from('deals')
      .select('id, value, lost_reason_id, lost_reason, owner_id, updated_at')
      .eq('workspace_id', ws.id)
      .eq('status', 'lost')
    if (from) q = q.gte('updated_at', from)
    if (to) q = q.lte('updated_at', to + 'T23:59:59')
    if (ownerFilter) q = q.eq('owner_id', ownerFilter)

    const { data } = await q
    setRows((data || []) as DealRow[])

    const { data: r } = await supabase.from('loss_reasons').select('id, label, color').eq('workspace_id', ws.id)
    const map: Record<string, ReasonRow> = {}
    for (const row of (r || []) as ReasonRow[]) map[row.id] = row
    setReasons(map)

    const { data: profs } = await supabase.from('profiles').select('id, full_name').eq('workspace_id', ws.id)
    setOwners((profs || []) as Pick<Profile, 'id' | 'full_name'>[])

    setLoading(false)
  }, [supabase, from, to, ownerFilter])

  useEffect(() => { load() }, [load])

  const aggregation: AggRow[] = (() => {
    const buckets: Record<string, AggRow> = {}
    for (const d of rows) {
      const id = d.lost_reason_id || (d.lost_reason ? `text:${d.lost_reason}` : 'unspecified')
      const reason = d.lost_reason_id ? reasons[d.lost_reason_id] : null
      const label = reason?.label || d.lost_reason || 'Unspecified'
      const color = reason?.color || '#94a3b8'
      if (!buckets[id]) buckets[id] = { key: id, label, color, count: 0, total: 0 }
      buckets[id].count++
      buckets[id].total += d.value || 0
    }
    return Object.values(buckets).sort((a, b) => b.count - a.count)
  })()

  const totalCount = rows.length
  const totalLost = rows.reduce((s, d) => s + (d.value || 0), 0)
  const maxCount = Math.max(1, ...aggregation.map(a => a.count))

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><TrendingDown className="w-5 h-5 text-red-500" /> Lost Deals Report</h1>
          <p className="page-subtitle">Why are deals being lost? Review trends by reason and owner.</p>
        </div>
        <Link href="/reports" className="btn-secondary btn-sm">Back to Reports</Link>
      </div>

      {/* Filters */}
      <div className="card p-3 mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">From</label>
          <input type="date" className="input text-sm" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input text-sm" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <div>
          <label className="label">Owner</label>
          <select className="input text-sm" value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}>
            <option value="">All</option>
            {owners.map(o => <option key={o.id} value={o.id}>{o.full_name}</option>)}
          </select>
        </div>
        <button onClick={() => { setFrom(''); setTo(''); setOwnerFilter('') }} className="btn-secondary btn-sm">Reset</button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="card p-4">
          <p className="text-[10px] font-semibold uppercase text-surface-400">Total Lost</p>
          <p className="text-2xl font-extrabold text-red-600">{totalCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-semibold uppercase text-surface-400">Total Value Lost</p>
          <p className="text-2xl font-extrabold text-red-600">{formatCurrency(totalLost)}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-semibold uppercase text-surface-400">Avg Deal Value</p>
          <p className="text-2xl font-extrabold text-surface-800">{formatCurrency(totalCount ? totalLost / totalCount : 0)}</p>
        </div>
      </div>

      {/* Bar chart */}
      <div className="card p-4 mb-4">
        <p className="text-xs font-semibold text-surface-700 mb-3">Breakdown by reason</p>
        {loading ? (
          <p className="text-xs text-surface-400">Loading...</p>
        ) : aggregation.length === 0 ? (
          <p className="text-xs text-surface-400">No lost deals in this range.</p>
        ) : (
          <div className="space-y-2">
            {aggregation.map(a => (
              <div key={a.key} className="flex items-center gap-3">
                <div className="w-36 truncate text-xs font-medium text-surface-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
                  {a.label}
                </div>
                <div className="flex-1 h-5 bg-surface-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(a.count / maxCount) * 100}%`, backgroundColor: a.color }}
                  />
                </div>
                <div className="w-16 text-xs text-right text-surface-600">{a.count}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-50 text-[11px] font-semibold text-surface-500 uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Reason</th>
              <th className="px-3 py-2 text-right">Count</th>
              <th className="px-3 py-2 text-right">Total Lost</th>
              <th className="px-3 py-2 text-right">Avg Value</th>
              <th className="px-3 py-2 text-right">% of Losses</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {aggregation.map(a => (
              <tr key={a.key}>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
                    {a.label}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">{a.count}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(a.total)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(a.count ? a.total / a.count : 0)}</td>
                <td className="px-3 py-2 text-right">{totalCount ? ((a.count / totalCount) * 100).toFixed(0) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
