'use client'
import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useWorkspace } from '@/lib/workspace-context'
import { useI18n } from '@/lib/i18n/context'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Play, Download, FileText, BarChart2 } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import type { DbRow } from '@/types'
import { getActiveWorkspace } from '@/lib/get-active-workspace'

type Entity = 'contacts' | 'deals' | 'invoices' | 'activities' | 'social_leads'
type Metric = 'count' | 'sum' | 'avg'
type DateRange = '7' | '30' | '90' | 'custom'

const ENTITY_OPTIONS: { value: Entity; label: string }[] = [
  { value: 'contacts', label: 'Contacts' },
  { value: 'deals', label: 'Deals' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'activities', label: 'Activities' },
  { value: 'social_leads', label: 'Leads' },
]

const ENTITY_FIELDS: Record<Entity, { value: string; label: string; numeric?: boolean }[]> = {
  contacts: [
    { value: 'type', label: 'Type' },
    { value: 'company_name', label: 'Company' },
    { value: 'score_label', label: 'Score Label' },
  ],
  deals: [
    { value: 'status', label: 'Status' },
    { value: 'stage', label: 'Stage' },
    { value: 'owner_id', label: 'Owner' },
    { value: 'value', label: 'Value', numeric: true },
  ],
  invoices: [
    { value: 'status', label: 'Status' },
    { value: 'contact_id', label: 'Contact' },
    { value: 'total', label: 'Total', numeric: true },
  ],
  activities: [
    { value: 'type', label: 'Type' },
    { value: 'user_id', label: 'Rep' },
    { value: 'contact_id', label: 'Contact' },
  ],
  social_leads: [
    { value: 'platform', label: 'Platform' },
    { value: 'status', label: 'Status' },
    { value: 'source', label: 'Source' },
  ],
}

const NUMERIC_FIELDS: Record<Entity, string> = {
  contacts: '',
  deals: 'value',
  invoices: 'total',
  activities: '',
  social_leads: '',
}

interface Template {
  name: string
  entity: Entity
  metric: Metric
  groupBy: string
  dateRange: DateRange
}

const TEMPLATES: Template[] = [
  { name: 'Deals by Stage', entity: 'deals', metric: 'count', groupBy: 'stage', dateRange: '30' },
  { name: 'Leads by Source', entity: 'social_leads', metric: 'count', groupBy: 'platform', dateRange: '30' },
  { name: 'Revenue by Month', entity: 'deals', metric: 'sum', groupBy: 'status', dateRange: '90' },
  { name: 'Activities by Rep', entity: 'activities', metric: 'count', groupBy: 'type', dateRange: '30' },
]

export default function CustomReportsPage() {
  const supabase = createClient()
  const { t } = useI18n()
  const [entity, setEntity] = useState<Entity>('deals')
  const [metric, setMetric] = useState<Metric>('count')
  const [groupBy, setGroupBy] = useState('status')
  const [dateRange, setDateRange] = useState<DateRange>('30')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [results, setResults] = useState<{ label: string; value: number }[]>([])
  const [rawRows, setRawRows] = useState<DbRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const runReport = useCallback(async () => {
    setLoading(true)
    setError('')
    setResults([])
    setRawRows([])

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Not authenticated'); setLoading(false); return }
      const ws = await getActiveWorkspace(supabase, user.id, 'id')
      if (!ws) { setError('No workspace'); setLoading(false); return }

      // Build date filter
      let startDate: string | null = null
      if (dateRange === 'custom') {
        startDate = customStart || null
      } else {
        const d = new Date()
        d.setDate(d.getDate() - parseInt(dateRange))
        startDate = d.toISOString()
      }

      let query = supabase
        .from(entity)
        .select('*')
        .eq('workspace_id', ws.id)

      if (startDate) {
        query = query.gte('created_at', startDate)
      }
      if (dateRange === 'custom' && customEnd) {
        query = query.lte('created_at', customEnd)
      }

      const { data, error: qErr } = await query.limit(5000)
      if (qErr) { setError(qErr.message); setLoading(false); return }
      if (!data || data.length === 0) { setResults([]); setRawRows([]); setLoading(false); return }

      setRawRows(data)

      // Group by field
      const groups: Record<string, number[]> = {}
      const numericField = NUMERIC_FIELDS[entity]

      for (const row of data) {
        const key = String(row[groupBy] ?? 'N/A')
        if (!groups[key]) groups[key] = []
        if (numericField && row[numericField] != null) {
          groups[key].push(Number(row[numericField]) || 0)
        } else {
          groups[key].push(1)
        }
      }

      const aggregated = Object.entries(groups).map(([label, values]) => {
        let value = 0
        if (metric === 'count') {
          value = values.length
        } else if (metric === 'sum') {
          value = values.reduce((a, b) => a + b, 0)
        } else if (metric === 'avg') {
          value = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
        }
        return { label, value: Math.round(value * 100) / 100 }
      })

      aggregated.sort((a, b) => b.value - a.value)
      setResults(aggregated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }

    setLoading(false)
  }, [entity, metric, groupBy, dateRange, customStart, customEnd, supabase])

  const applyTemplate = (tpl: Template) => {
    setEntity(tpl.entity)
    setMetric(tpl.metric)
    setGroupBy(tpl.groupBy)
    setDateRange(tpl.dateRange)
  }

  const exportCSV = () => {
    if (results.length === 0) return
    const header = 'Group,Value\n'
    const rows = results.map(r => `"${r.label}",${r.value}`).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report_${entity}_${groupBy}_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const fields = ENTITY_FIELDS[entity] || []
  const hasNumeric = !!NUMERIC_FIELDS[entity]

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav.custom_reports')}</h1>
          <p className="page-subtitle">Build and run custom reports on your data</p>
        </div>
      </div>

      {/* Templates */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-2">Quick Templates</p>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map(tpl => (
            <button key={tpl.name} onClick={() => applyTemplate(tpl)}
              className="btn-ghost btn-sm text-xs">
              <FileText className="w-3 h-3" /> {tpl.name}
            </button>
          ))}
        </div>
      </div>

      {/* Builder */}
      <div className="card p-5 mb-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Entity */}
          <div>
            <label className="label">Entity</label>
            <select className="input" value={entity}
              onChange={e => {
                const v = e.target.value as Entity
                setEntity(v)
                setGroupBy(ENTITY_FIELDS[v]?.[0]?.value || '')
              }}>
              {ENTITY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Metric */}
          <div>
            <label className="label">Metric</label>
            <select className="input" value={metric} onChange={e => setMetric(e.target.value as Metric)}>
              <option value="count">Count</option>
              {hasNumeric && <option value="sum">Sum</option>}
              {hasNumeric && <option value="avg">Average</option>}
            </select>
          </div>

          {/* Group By */}
          <div>
            <label className="label">Group By</label>
            <select className="input" value={groupBy} onChange={e => setGroupBy(e.target.value)}>
              {fields.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div>
            <label className="label">Date Range</label>
            <select className="input" value={dateRange} onChange={e => setDateRange(e.target.value as DateRange)}>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {/* Run */}
          <div className="flex items-end">
            <button onClick={runReport} disabled={loading} className="btn-primary w-full">
              <Play className="w-3.5 h-3.5" /> {loading ? 'Running...' : 'Run Report'}
            </button>
          </div>
        </div>

        {dateRange === 'custom' && (
          <div className="flex gap-3 mt-3">
            <div>
              <label className="label">Start</label>
              <input type="date" className="input text-xs" value={customStart} onChange={e => setCustomStart(e.target.value)} />
            </div>
            <div>
              <label className="label">End</label>
              <input type="date" className="input text-xs" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-6">
          {/* Chart */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-surface-900 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-brand-600" /> Results
                <span className="text-xs text-surface-400 font-normal ml-2">({rawRows.length} records)</span>
              </h3>
              <button onClick={exportCSV} className="btn-ghost btn-sm text-xs">
                <Download className="w-3 h-3" /> Export CSV
              </button>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={results.slice(0, 20)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} angle={-30} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => metric === 'count' ? String(v) : formatCurrency(v)} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e4e7f0', fontSize: 12 }}
                  formatter={(v: number) => [metric === 'count' ? v : formatCurrency(v)]} />
                <Bar dataKey="value" fill="#0891B2" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide">{groupBy}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide">
                    {metric === 'count' ? 'Count' : metric === 'sum' ? 'Sum' : 'Average'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={r.label} className="border-b border-surface-50 last:border-0 hover:bg-surface-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-surface-800">{r.label}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-surface-700">
                      {metric === 'count' ? r.value : formatCurrency(r.value)}
                    </td>
                  </tr>
                ))}
                {/* Total row */}
                <tr className="bg-surface-50 font-bold">
                  <td className="px-4 py-3 text-sm text-surface-900">Total</td>
                  <td className="px-4 py-3 text-sm text-right text-surface-900">
                    {metric === 'count'
                      ? results.reduce((a, b) => a + b.value, 0)
                      : formatCurrency(results.reduce((a, b) => a + b.value, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {results.length === 0 && !loading && !error && (
        <div className="empty-state">
          <div className="empty-state-icon">
            <BarChart2 className="w-7 h-7 text-surface-300" />
          </div>
          <p className="empty-state-title">No results yet</p>
          <p className="empty-state-desc">Configure your report above and click Run</p>
        </div>
      )}
    </div>
  )
}
