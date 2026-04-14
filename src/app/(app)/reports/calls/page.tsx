'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getActiveWorkspace } from '@/lib/get-active-workspace'
import { Download, Phone, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { MobileList, MobileListCard } from '@/components/shared/MobileListCard'
import Link from 'next/link'

interface CallRow {
  id: string
  direction: string | null
  from_number: string | null
  to_number: string | null
  duration_seconds: number | null
  started_at: string
  sentiment: string | null
  transcript: string | null
  recording_url: string | null
  contact_id: string | null
  owner_id: string | null
  summary: string | null
}

interface ContactLite { id: string; name: string }
interface UserLite { id: string; full_name: string }

function fmtDuration(secs: number | null): string {
  const s = secs || 0
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${mm}:${ss.toString().padStart(2, '0')}`
}

function sentimentEmoji(s: string | null): string {
  if (s === 'positive') return '🙂'
  if (s === 'negative') return '😟'
  if (s) return '😐'
  return ''
}

export default function CallsReportPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<CallRow[]>([])
  const [contactsMap, setContactsMap] = useState<Record<string, string>>({})
  const [ownersMap, setOwnersMap] = useState<Record<string, string>>({})

  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10)
  })
  const [dateTo, setDateTo] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [directionFilter, setDirectionFilter] = useState<string>('')
  const [sentimentFilter, setSentimentFilter] = useState<string>('')
  const [ownerFilter, setOwnerFilter] = useState<string>('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const ws = await getActiveWorkspace(supabase, user.id, 'id')
    if (!ws) { setLoading(false); return }
    const workspaceId = ws.id as string

    let q = supabase.from('call_logs')
      .select('id, direction, from_number, to_number, duration_seconds, started_at, sentiment, transcript, recording_url, contact_id, owner_id, summary')
      .eq('workspace_id', workspaceId)
      .gte('started_at', `${dateFrom}T00:00:00.000Z`)
      .lte('started_at', `${dateTo}T23:59:59.999Z`)
      .order('started_at', { ascending: false })
      .limit(500)

    if (directionFilter) q = q.eq('direction', directionFilter)
    if (sentimentFilter) q = q.eq('sentiment', sentimentFilter)
    if (ownerFilter) q = q.eq('owner_id', ownerFilter)

    const { data } = await q
    const calls = (data || []) as CallRow[]
    setRows(calls)

    const contactIds = Array.from(new Set(calls.map(c => c.contact_id).filter(Boolean) as string[]))
    const ownerIds = Array.from(new Set(calls.map(c => c.owner_id).filter(Boolean) as string[]))
    if (contactIds.length > 0) {
      const { data: cs } = await supabase.from('contacts').select('id, name').in('id', contactIds)
      const map: Record<string, string> = {}
      for (const c of (cs || []) as ContactLite[]) map[c.id] = c.name
      setContactsMap(map)
    }
    if (ownerIds.length > 0) {
      const { data: us } = await supabase.from('profiles').select('id, full_name').in('id', ownerIds)
      const map: Record<string, string> = {}
      for (const u of (us || []) as UserLite[]) map[u.id] = u.full_name
      setOwnersMap(map)
    }
    setLoading(false)
  }, [supabase, dateFrom, dateTo, directionFilter, sentimentFilter, ownerFilter])

  useEffect(() => { load() }, [load])

  const ownerOptions = useMemo(() => {
    const ids = Array.from(new Set(rows.map(r => r.owner_id).filter(Boolean) as string[]))
    return ids.map(id => ({ id, name: ownersMap[id] || id }))
  }, [rows, ownersMap])

  const exportCsv = () => {
    const headers = ['Date', 'Contact', 'Direction', 'From', 'To', 'Duration', 'Sentiment', 'Summary']
    const lines = [headers.join(',')]
    for (const r of rows) {
      const contact = r.contact_id ? contactsMap[r.contact_id] || '' : ''
      const row = [
        new Date(r.started_at).toISOString(),
        contact,
        r.direction || '',
        r.from_number || '',
        r.to_number || '',
        fmtDuration(r.duration_seconds),
        r.sentiment || '',
        (r.summary || '').replace(/"/g, '""'),
      ].map(f => `"${String(f).replace(/"/g, '""')}"`).join(',')
      lines.push(row)
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `calls-${dateFrom}-to-${dateTo}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-surface-900 flex items-center gap-2">
          <Phone className="w-5 h-5 text-emerald-600" /> Call Reports
        </h1>
        <button onClick={exportCsv} className="btn-secondary btn-sm inline-flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      <div className="card p-3 mb-4 grid grid-cols-2 md:grid-cols-5 gap-2">
        <div>
          <label className="text-[10px] text-surface-500 font-semibold uppercase">From</label>
          <input type="date" className="input w-full" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] text-surface-500 font-semibold uppercase">To</label>
          <input type="date" className="input w-full" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] text-surface-500 font-semibold uppercase">Direction</label>
          <select className="input w-full" value={directionFilter} onChange={e => setDirectionFilter(e.target.value)}>
            <option value="">All</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-surface-500 font-semibold uppercase">Sentiment</label>
          <select className="input w-full" value={sentimentFilter} onChange={e => setSentimentFilter(e.target.value)}>
            <option value="">All</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-surface-500 font-semibold uppercase">Owner</label>
          <select className="input w-full" value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}>
            <option value="">All</option>
            {ownerOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
      </div>

      {loading && <p className="text-sm text-surface-500">Loading...</p>}
      {!loading && rows.length === 0 && (
        <div className="card p-10 text-center">
          <Phone className="w-10 h-10 text-surface-300 mx-auto mb-2" />
          <p className="text-sm text-surface-500">No calls found for these filters.</p>
        </div>
      )}

      {/* Desktop table */}
      {!loading && rows.length > 0 && (
        <div className="card overflow-hidden hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-50 text-left">
                <tr className="text-[10px] text-surface-500 font-semibold uppercase">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Contact</th>
                  <th className="px-3 py-2">Direction</th>
                  <th className="px-3 py-2">Duration</th>
                  <th className="px-3 py-2">Sentiment</th>
                  <th className="px-3 py-2">Recording</th>
                  <th className="px-3 py-2">Transcript</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {rows.map(r => (
                  <tr key={r.id} className="hover:bg-surface-50">
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-surface-600">{new Date(r.started_at).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      {r.contact_id ? (
                        <Link href={`/contacts/${r.contact_id}`} className="text-brand-600 hover:underline">
                          {contactsMap[r.contact_id] || 'Contact'}
                        </Link>
                      ) : <span className="text-surface-400">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${r.direction === 'inbound' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {r.direction === 'inbound' ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                        {r.direction}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{fmtDuration(r.duration_seconds)}</td>
                    <td className="px-3 py-2">{sentimentEmoji(r.sentiment)} <span className="text-xs text-surface-500">{r.sentiment || ''}</span></td>
                    <td className="px-3 py-2">
                      {r.recording_url
                        ? <a href={r.recording_url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline">Listen</a>
                        : <span className="text-surface-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2 max-w-xs">
                      {r.transcript
                        ? <p className="text-xs text-surface-500 line-clamp-2">{r.transcript}</p>
                        : <span className="text-surface-300 text-xs">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mobile */}
      {!loading && rows.length > 0 && (
        <MobileList>
          {rows.map(r => (
            <MobileListCard
              key={r.id}
              title={
                <span>
                  {r.contact_id ? (contactsMap[r.contact_id] || 'Contact') : r.to_number || r.from_number || '—'}
                </span>
              }
              subtitle={new Date(r.started_at).toLocaleString()}
              badge={
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${r.direction === 'inbound' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {r.direction}
                </span>
              }
              meta={
                <>
                  <span className="font-mono">{fmtDuration(r.duration_seconds)}</span>
                  {r.sentiment && <span>{sentimentEmoji(r.sentiment)}</span>}
                  {r.recording_url && <a href={r.recording_url} target="_blank" rel="noreferrer" className="text-brand-600">recording</a>}
                </>
              }
            >
              {r.summary && <p className="text-xs text-surface-500 line-clamp-2">{r.summary}</p>}
            </MobileListCard>
          ))}
        </MobileList>
      )}
    </div>
  )
}
