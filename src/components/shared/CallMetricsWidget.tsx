'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Phone, ArrowDownLeft, ArrowUpRight, Clock } from 'lucide-react'
import Link from 'next/link'

interface CallRow {
  id: string
  direction: string | null
  duration_seconds: number | null
  started_at: string
  sentiment: string | null
  contact_id: string | null
}

interface Props {
  workspaceId: string
}

export default function CallMetricsWidget({ workspaceId }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<CallRow[]>([])
  const [topContacts, setTopContacts] = useState<{ id: string; name: string; count: number }[]>([])

  useEffect(() => {
    if (!workspaceId) return
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('call_logs')
        .select('id, direction, duration_seconds, started_at, sentiment, contact_id')
        .eq('workspace_id', workspaceId)
        .gte('started_at', since)
        .order('started_at', { ascending: false })
      if (cancelled) return
      const calls = (data || []) as CallRow[]
      setRows(calls)

      // Top contacts by count
      const counts = new Map<string, number>()
      for (const c of calls) {
        if (!c.contact_id) continue
        counts.set(c.contact_id, (counts.get(c.contact_id) || 0) + 1)
      }
      const topIds = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
      if (topIds.length > 0) {
        const { data: cs } = await supabase
          .from('contacts')
          .select('id, name')
          .in('id', topIds.map(([id]) => id))
        const nameMap = new Map<string, string>()
        for (const row of (cs || []) as { id: string; name: string }[]) nameMap.set(row.id, row.name)
        if (!cancelled) {
          setTopContacts(topIds.map(([id, count]) => ({ id, name: nameMap.get(id) || 'Unknown', count })))
        }
      }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [workspaceId, supabase])

  const total = rows.length
  const totalDurationMin = Math.round(rows.reduce((s, r) => s + (r.duration_seconds || 0), 0) / 60)
  const avgDurationSec = total > 0 ? Math.round(rows.reduce((s, r) => s + (r.duration_seconds || 0), 0) / total) : 0
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const callsToday = rows.filter(r => new Date(r.started_at) >= todayStart).length
  const inbound = rows.filter(r => r.direction === 'inbound').length
  const outbound = rows.filter(r => r.direction === 'outbound').length

  if (loading) {
    return (
      <div className="card p-4 mb-6">
        <div className="h-4 w-32 bg-surface-100 rounded animate-pulse mb-3" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map(i => <div key={i} className="h-16 bg-surface-100 rounded animate-pulse" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="card p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wide flex items-center gap-1">
          <Phone className="w-3.5 h-3.5 text-emerald-600" /> Calls (last 30 days)
        </h3>
        <Link href="/reports/calls" className="text-[11px] text-brand-600 hover:underline">View all</Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3">
          <p className="text-[10px] text-surface-500 font-semibold uppercase">Total Calls</p>
          <p className="text-lg font-bold text-surface-900 mt-1">{total}</p>
          <p className="text-[10px] text-surface-400 mt-0.5">
            <ArrowDownLeft className="w-2.5 h-2.5 inline text-blue-500" /> {inbound}
            {' · '}
            <ArrowUpRight className="w-2.5 h-2.5 inline text-emerald-500" /> {outbound}
          </p>
        </div>
        <div className="card p-3">
          <p className="text-[10px] text-surface-500 font-semibold uppercase">Avg Duration</p>
          <p className="text-lg font-bold text-surface-900 mt-1">
            {Math.floor(avgDurationSec / 60)}:{(avgDurationSec % 60).toString().padStart(2, '0')}
          </p>
          <p className="text-[10px] text-surface-400 mt-0.5"><Clock className="w-2.5 h-2.5 inline" /> {totalDurationMin} min total</p>
        </div>
        <div className="card p-3">
          <p className="text-[10px] text-surface-500 font-semibold uppercase">Calls Today</p>
          <p className="text-lg font-bold text-surface-900 mt-1">{callsToday}</p>
        </div>
        <div className="card p-3">
          <p className="text-[10px] text-surface-500 font-semibold uppercase">Pending Follow-ups</p>
          {/* TODO: wire to next_actions aggregation */}
          <p className="text-lg font-bold text-surface-900 mt-1">—</p>
        </div>
      </div>
      {topContacts.length > 0 && (
        <div className="mt-4 pt-3 border-t border-surface-100">
          <p className="text-[10px] text-surface-500 font-semibold uppercase mb-2">Top contacts called</p>
          <div className="space-y-1">
            {topContacts.map(c => (
              <Link key={c.id} href={`/contacts/${c.id}`} className="flex items-center justify-between text-xs text-surface-700 hover:text-brand-600">
                <span className="truncate">{c.name}</span>
                <span className="text-[10px] text-surface-400">{c.count} calls</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
