'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { TrendingUp, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface Pipeline { id: string; name: string }
interface Stage { id: string; name: string; pipeline_id: string; probability: number | null }
interface Deal {
  id: string
  title: string
  value: number | null
  stage_id: string | null
  pipeline_id: string | null
  owner_id: string | null
  expected_close_date: string | null
  probability: number | null
  status: string | null
}
interface Owner { id: string; name: string }

const DEFAULT_STAGE_PROBABILITY = 50

export default function ForecastPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [stages, setStages] = useState<Stage[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [owners, setOwners] = useState<Owner[]>([])

  // Filters
  const [pipelineId, setPipelineId] = useState<string>('')
  const [ownerId, setOwnerId] = useState<string>('')
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: ws } = await supabase
        .from('workspaces').select('id').eq('owner_id', user.id).single()
      if (!ws) { setLoading(false); return }
      const wsId = ws.id

      const [pRes, sRes, dRes, profRes] = await Promise.all([
        supabase.from('pipelines').select('id, name').eq('workspace_id', wsId),
        supabase.from('pipeline_stages').select('id, name, pipeline_id, probability').eq('workspace_id', wsId).order('order_index'),
        supabase
          .from('deals')
          .select('id, title, value, stage_id, pipeline_id, owner_id, expected_close_date, probability, status')
          .eq('workspace_id', wsId)
          .eq('status', 'open'),
        supabase.from('profiles').select('id, full_name, email').eq('workspace_id', wsId),
      ])

      if (cancelled) return
      setPipelines((pRes.data || []) as Pipeline[])
      setStages((sRes.data || []) as Stage[])
      setDeals((dRes.data || []) as Deal[])
      setOwners(((profRes.data || []) as { id: string; full_name: string | null; email: string | null }[])
        .map(p => ({ id: p.id, name: p.full_name || p.email || 'Unknown' })))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [supabase])

  const stageMap = useMemo(() => {
    const m = new Map<string, Stage>()
    for (const s of stages) m.set(s.id, s)
    return m
  }, [stages])

  const filteredDeals = useMemo(() => {
    return deals.filter(d => {
      if (pipelineId && d.pipeline_id !== pipelineId) return false
      if (ownerId && d.owner_id !== ownerId) return false
      if (from && (!d.expected_close_date || d.expected_close_date < from)) return false
      if (to && (!d.expected_close_date || d.expected_close_date > to)) return false
      return true
    })
  }, [deals, pipelineId, ownerId, from, to])

  const stageProbabilityFor = (deal: Deal): number => {
    if (deal.stage_id) {
      const s = stageMap.get(deal.stage_id)
      if (s && typeof s.probability === 'number') return s.probability
    }
    if (typeof deal.probability === 'number' && deal.probability > 0) return deal.probability
    return DEFAULT_STAGE_PROBABILITY
  }

  const kpis = useMemo(() => {
    let total = 0, weighted = 0, best = 0, worst = 0
    for (const d of filteredDeals) {
      const v = Number(d.value) || 0
      const prob = stageProbabilityFor(d)
      total += v
      weighted += v * (prob / 100)
      if (prob >= 70) best += v
      if (prob >= 90) worst += v
    }
    return { total, weighted, best, worst }
  }, [filteredDeals, stageMap]) // eslint-disable-line react-hooks/exhaustive-deps

  const monthData = useMemo(() => {
    const buckets = new Map<string, number>()
    for (const d of filteredDeals) {
      if (!d.expected_close_date) continue
      const key = d.expected_close_date.slice(0, 7) // YYYY-MM
      const v = (Number(d.value) || 0) * (stageProbabilityFor(d) / 100)
      buckets.set(key, (buckets.get(key) || 0) + v)
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, value]) => ({
        month: new Date(month + '-01').toLocaleDateString('en', { month: 'short', year: '2-digit' }),
        value: Math.round(value),
      }))
  }, [filteredDeals, stageMap]) // eslint-disable-line react-hooks/exhaustive-deps

  const stageRows = useMemo(() => {
    const grouped = new Map<string, { stage: Stage | null; deals: Deal[] }>()
    for (const d of filteredDeals) {
      const key = d.stage_id || 'unknown'
      if (!grouped.has(key)) grouped.set(key, { stage: d.stage_id ? stageMap.get(d.stage_id) || null : null, deals: [] })
      grouped.get(key)!.deals.push(d)
    }
    const rows = Array.from(grouped.values()).map(({ stage, deals: ds }) => {
      const total = ds.reduce((s, d) => s + (Number(d.value) || 0), 0)
      const prob = stage && typeof stage.probability === 'number' ? stage.probability : DEFAULT_STAGE_PROBABILITY
      return {
        stageId: stage?.id || 'unknown',
        stageName: stage?.name || 'No stage',
        count: ds.length,
        total,
        probability: prob,
        weighted: total * (prob / 100),
      }
    })
    rows.sort((a, b) => b.weighted - a.weighted)
    return rows
  }, [filteredDeals, stageMap])

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <Link href="/reports" className="text-xs text-surface-500 hover:text-surface-700 flex items-center gap-1 mb-2">
          <ArrowLeft className="w-3 h-3" /> Reports
        </Link>
        <h1 className="text-xl font-bold text-surface-900 dark:text-surface-50 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-600" /> Forecast
        </h1>
        <p className="text-xs text-surface-500 mt-1">Weighted pipeline forecast based on stage probabilities.</p>
      </div>

      {/* Filters */}
      <div className="card p-3 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] font-semibold uppercase text-surface-500">Pipeline</label>
            <select className="input text-sm mt-1" value={pipelineId} onChange={e => setPipelineId(e.target.value)}>
              <option value="">All pipelines</option>
              {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase text-surface-500">Owner</label>
            <select className="input text-sm mt-1" value={ownerId} onChange={e => setOwnerId(e.target.value)}>
              <option value="">All owners</option>
              {owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase text-surface-500">From</label>
            <input type="date" className="input text-sm mt-1" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase text-surface-500">To</label>
            <input type="date" className="input text-sm mt-1" value={to} onChange={e => setTo(e.target.value)} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card p-6">
          <p className="text-xs text-surface-400">Loading forecast...</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="card p-4">
              <p className="text-[10px] text-surface-500 font-semibold uppercase">Open Pipeline</p>
              <p className="text-lg font-bold text-surface-900 dark:text-surface-50 mt-1">{formatCurrency(kpis.total)}</p>
              <p className="text-[10px] text-surface-400 mt-0.5">{filteredDeals.length} deals</p>
            </div>
            <div className="card p-4">
              <p className="text-[10px] text-surface-500 font-semibold uppercase">Weighted Forecast</p>
              <p className="text-lg font-bold text-emerald-600 mt-1">{formatCurrency(kpis.weighted)}</p>
              <p className="text-[10px] text-surface-400 mt-0.5">stage-weighted</p>
            </div>
            <div className="card p-4">
              <p className="text-[10px] text-surface-500 font-semibold uppercase">Best Case</p>
              <p className="text-lg font-bold text-blue-600 mt-1">{formatCurrency(kpis.best)}</p>
              <p className="text-[10px] text-surface-400 mt-0.5">prob &gt;= 70%</p>
            </div>
            <div className="card p-4">
              <p className="text-[10px] text-surface-500 font-semibold uppercase">Worst Case</p>
              <p className="text-lg font-bold text-amber-600 mt-1">{formatCurrency(kpis.worst)}</p>
              <p className="text-[10px] text-surface-400 mt-0.5">prob &gt;= 90%</p>
            </div>
          </div>

          {/* Bar chart */}
          <div className="card p-4 mb-6">
            <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-3">Weighted forecast by month</h3>
            {monthData.length === 0 ? (
              <p className="text-xs text-surface-400">No deals with expected close dates in range.</p>
            ) : (
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatCurrency(v)} width={80} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Stage table */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-3">By stage</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase text-surface-500 border-b border-surface-100 dark:border-surface-800">
                    <th className="py-2 pr-3">Stage</th>
                    <th className="py-2 pr-3">Deals</th>
                    <th className="py-2 pr-3">Total</th>
                    <th className="py-2 pr-3">Prob</th>
                    <th className="py-2 pr-3">Weighted</th>
                  </tr>
                </thead>
                <tbody>
                  {stageRows.map(r => (
                    <tr key={r.stageId} className="border-b border-surface-50 dark:border-surface-800/40">
                      <td className="py-2 pr-3 font-medium">{r.stageName}</td>
                      <td className="py-2 pr-3">{r.count}</td>
                      <td className="py-2 pr-3">{formatCurrency(r.total)}</td>
                      <td className="py-2 pr-3">{r.probability}%</td>
                      <td className="py-2 pr-3 font-semibold text-emerald-600">{formatCurrency(r.weighted)}</td>
                    </tr>
                  ))}
                  {stageRows.length === 0 && (
                    <tr><td colSpan={5} className="py-3 text-xs text-surface-400">No deals match filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
