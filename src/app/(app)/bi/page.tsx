'use client'
import { useI18n } from '@/lib/i18n/context'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts'
import {
  Plus, X, GripVertical, Settings2, Save, Trash2, BarChart2, TrendingUp,
  PieChart as PieChartIcon, Table as TableIcon, Activity, Target, Rss,
  Filter, ChevronDown, Layout, Copy, Edit3, Check
} from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import type { DbRow } from '@/types'
import { getActiveWorkspace } from '@/lib/get-active-workspace'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WidgetType = 'kpi' | 'bar' | 'line' | 'pie' | 'funnel' | 'table' | 'gauge' | 'feed'
type Entity = 'deals' | 'contacts' | 'invoices' | 'social_leads' | 'activities'
type Metric = 'count' | 'sum' | 'avg'
type DateRangePreset = '7d' | '30d' | '90d' | 'this_month' | 'this_year' | 'custom'

interface WidgetConfig {
  entity?: Entity
  metric?: Metric
  field?: string
  groupBy?: string
  dateRange?: DateRangePreset
  granularity?: 'day' | 'week' | 'month'
  columns?: string[]
  sortBy?: string
  limit?: number
  target?: number
  stages?: { label: string; entity: Entity; filter?: Record<string, string> }[]
  feedEntities?: Entity[]
  comparison?: boolean
  filter?: Record<string, string>
}

interface Widget {
  id: string
  type: WidgetType
  title: string
  config: WidgetConfig
  colSpan: number
  rowSpan: number
}

interface Dashboard {
  id: string
  name: string
  widgets: Widget[]
}

interface GlobalFilters {
  dateRange: DateRangePreset
  customStart: string
  customEnd: string
  entityFilter: Entity | 'all'
  pipelineFilter: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLORS = ['#0891B2', '#34d399', '#f59e0b', '#f87171', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']

const WIDGET_TYPE_META: { type: WidgetType; label: string; icon: typeof BarChart2; description: string }[] = [
  { type: 'kpi', label: 'KPI Card', icon: TrendingUp, description: 'Single metric with trend' },
  { type: 'bar', label: 'Bar Chart', icon: BarChart2, description: 'Compare values across categories' },
  { type: 'line', label: 'Line Chart', icon: Activity, description: 'Trends over time' },
  { type: 'pie', label: 'Pie / Donut', icon: PieChartIcon, description: 'Distribution breakdown' },
  { type: 'funnel', label: 'Funnel', icon: Filter, description: 'Conversion pipeline' },
  { type: 'table', label: 'Table', icon: TableIcon, description: 'Tabular data view' },
  { type: 'gauge', label: 'Gauge', icon: Target, description: 'Progress toward a target' },
  { type: 'feed', label: 'Activity Feed', icon: Rss, description: 'Recent activity stream' },
]

const ENTITY_OPTIONS: { value: Entity; label: string }[] = [
  { value: 'deals', label: 'Deals' },
  { value: 'contacts', label: 'Contacts' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'social_leads', label: 'Leads' },
  { value: 'activities', label: 'Activities' },
]

const ENTITY_GROUP_FIELDS: Record<Entity, { value: string; label: string }[]> = {
  deals: [
    { value: 'status', label: 'Status' },
    { value: 'stage_id', label: 'Stage' },
    { value: 'owner_id', label: 'Owner' },
  ],
  contacts: [
    { value: 'type', label: 'Type' },
    { value: 'score_label', label: 'Score' },
  ],
  invoices: [
    { value: 'status', label: 'Status' },
  ],
  social_leads: [
    { value: 'platform', label: 'Platform' },
    { value: 'status', label: 'Status' },
    { value: 'source', label: 'Source' },
  ],
  activities: [
    { value: 'type', label: 'Type' },
    { value: 'done', label: 'Done' },
  ],
}

const NUMERIC_FIELDS: Record<Entity, string | null> = {
  deals: 'value',
  contacts: null,
  invoices: 'total',
  social_leads: null,
  activities: null,
}

const ENTITY_DISPLAY_COLUMNS: Record<Entity, { key: string; label: string }[]> = {
  deals: [
    { key: 'title', label: 'Title' },
    { key: 'value', label: 'Value' },
    { key: 'status', label: 'Status' },
  ],
  contacts: [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'type', label: 'Type' },
  ],
  invoices: [
    { key: 'number', label: 'Number' },
    { key: 'total', label: 'Total' },
    { key: 'status', label: 'Status' },
  ],
  social_leads: [
    { key: 'name', label: 'Name' },
    { key: 'platform', label: 'Platform' },
    { key: 'status', label: 'Status' },
  ],
  activities: [
    { key: 'type', label: 'Type' },
    { key: 'notes', label: 'Notes' },
    { key: 'done', label: 'Done' },
  ],
}

// ---------------------------------------------------------------------------
// Default dashboard
// ---------------------------------------------------------------------------

function makeDefaultDashboard(): Dashboard {
  return {
    id: 'default',
    name: 'Default Dashboard',
    widgets: [
      { id: 'w1', type: 'kpi', title: 'Total Contacts', config: { entity: 'contacts', metric: 'count' }, colSpan: 1, rowSpan: 1 },
      { id: 'w2', type: 'kpi', title: 'Open Deals Value', config: { entity: 'deals', metric: 'sum', field: 'value', filter: { status: 'open' } }, colSpan: 1, rowSpan: 1 },
      { id: 'w3', type: 'kpi', title: 'Won This Month', config: { entity: 'deals', metric: 'count', filter: { status: 'won' }, comparison: true }, colSpan: 1, rowSpan: 1 },
      { id: 'w4', type: 'kpi', title: 'Outstanding Invoices', config: { entity: 'invoices', metric: 'count', filter: { status: 'sent' } }, colSpan: 1, rowSpan: 1 },
      { id: 'w5', type: 'bar', title: 'Deals by Stage', config: { entity: 'deals', groupBy: 'stage_id', metric: 'count' }, colSpan: 2, rowSpan: 1 },
      { id: 'w6', type: 'line', title: 'Leads Over Time', config: { entity: 'social_leads', metric: 'count', granularity: 'month' }, colSpan: 2, rowSpan: 1 },
      { id: 'w7', type: 'pie', title: 'Leads by Platform', config: { entity: 'social_leads', groupBy: 'platform', metric: 'count' }, colSpan: 2, rowSpan: 1 },
      {
        id: 'w8', type: 'funnel', title: 'Lead to Won Funnel',
        config: {
          stages: [
            { label: 'Leads', entity: 'social_leads' },
            { label: 'Qualified', entity: 'social_leads', filter: { status: 'qualified' } },
            { label: 'Deals', entity: 'deals' },
            { label: 'Won', entity: 'deals', filter: { status: 'won' } },
          ],
        },
        colSpan: 2, rowSpan: 1,
      },
      { id: 'w9', type: 'table', title: 'Top 5 Deals by Value', config: { entity: 'deals', sortBy: 'value', limit: 5 }, colSpan: 2, rowSpan: 1 },
      { id: 'w10', type: 'gauge', title: 'Monthly Revenue', config: { entity: 'deals', metric: 'sum', field: 'value', filter: { status: 'won' }, target: 100000 }, colSpan: 1, rowSpan: 1 },
      { id: 'w11', type: 'feed', title: 'Recent Activity', config: { feedEntities: ['activities'], limit: 8 }, colSpan: 1, rowSpan: 1 },
    ],
  }
}

// ---------------------------------------------------------------------------
// Data Query Engine
// ---------------------------------------------------------------------------

interface QueryResult {
  raw: DbRow[]
  aggregated: { label: string; value: number }[]
  total: number
  previousTotal?: number
}

function getDateFilterRange(preset: DateRangePreset, customStart?: string, customEnd?: string): { start: string | null; end: string | null } {
  const now = new Date()
  let start: string | null = null
  let end: string | null = null

  switch (preset) {
    case '7d': { const d = new Date(now); d.setDate(d.getDate() - 7); start = d.toISOString(); break }
    case '30d': { const d = new Date(now); d.setDate(d.getDate() - 30); start = d.toISOString(); break }
    case '90d': { const d = new Date(now); d.setDate(d.getDate() - 90); start = d.toISOString(); break }
    case 'this_month': { start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString(); break }
    case 'this_year': { start = new Date(now.getFullYear(), 0, 1).toISOString(); break }
    case 'custom': { start = customStart || null; end = customEnd || null; break }
  }
  return { start, end }
}

async function queryWidgetData(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  config: WidgetConfig,
  globalFilters: GlobalFilters,
  stageMap: Record<string, string>,
): Promise<QueryResult> {
  const entity = config.entity || 'deals'
  let query = supabase.from(entity).select('*').eq('workspace_id', workspaceId)

  // Apply global date filter
  const { start, end } = getDateFilterRange(globalFilters.dateRange, globalFilters.customStart, globalFilters.customEnd)
  if (start) query = query.gte('created_at', start)
  if (end) query = query.lte('created_at', end)

  // Apply widget-level filters
  if (config.filter) {
    for (const [key, val] of Object.entries(config.filter)) {
      query = query.eq(key, val)
    }
  }

  // Apply entity filter from global
  if (globalFilters.entityFilter !== 'all' && globalFilters.entityFilter !== entity) {
    return { raw: [], aggregated: [], total: 0 }
  }

  // Sort + limit for table type
  if (config.sortBy) {
    query = query.order(config.sortBy, { ascending: false })
  }
  if (config.limit) {
    query = query.limit(config.limit)
  } else {
    query = query.limit(5000)
  }

  const { data, error } = await query
  if (error || !data) return { raw: [], aggregated: [], total: 0 }

  const numericField = config.field || NUMERIC_FIELDS[entity]
  const metric = config.metric || 'count'

  // Calculate total
  let total = 0
  if (metric === 'count') {
    total = data.length
  } else if (metric === 'sum' && numericField) {
    total = data.reduce((s: number, r: DbRow) => s + (Number(r[numericField]) || 0), 0)
  } else if (metric === 'avg' && numericField) {
    const sum = data.reduce((s: number, r: DbRow) => s + (Number(r[numericField]) || 0), 0)
    total = data.length > 0 ? sum / data.length : 0
  }

  // Previous period comparison
  let previousTotal: number | undefined = undefined
  if (config.comparison && start) {
    const startDate = new Date(start)
    const now = new Date()
    const diff = now.getTime() - startDate.getTime()
    const prevStart = new Date(startDate.getTime() - diff).toISOString()
    const prevEnd = start

    let prevQuery = supabase.from(entity).select('*').eq('workspace_id', workspaceId)
      .gte('created_at', prevStart).lte('created_at', prevEnd)
    if (config.filter) {
      for (const [key, val] of Object.entries(config.filter)) {
        prevQuery = prevQuery.eq(key, val)
      }
    }
    const { data: prevData } = await prevQuery.limit(5000)
    if (prevData) {
      if (metric === 'count') previousTotal = prevData.length
      else if (metric === 'sum' && numericField) previousTotal = prevData.reduce((s: number, r: DbRow) => s + (Number(r[numericField]) || 0), 0)
      else if (metric === 'avg' && numericField) {
        const psum = prevData.reduce((s: number, r: DbRow) => s + (Number(r[numericField]) || 0), 0)
        previousTotal = prevData.length > 0 ? psum / prevData.length : 0
      }
    }
  }

  // Grouping
  let aggregated: { label: string; value: number }[] = []
  const groupBy = config.groupBy
  if (groupBy) {
    const groups: Record<string, number[]> = {}
    for (const row of data) {
      let key = String(row[groupBy] ?? 'N/A')
      if (groupBy === 'stage_id' && stageMap[key]) key = stageMap[key]
      if (!groups[key]) groups[key] = []
      if (numericField && (metric === 'sum' || metric === 'avg')) {
        groups[key].push(Number(row[numericField]) || 0)
      } else {
        groups[key].push(1)
      }
    }
    aggregated = Object.entries(groups).map(([label, values]) => {
      let value = 0
      if (metric === 'count') value = values.length
      else if (metric === 'sum') value = values.reduce((a, b) => a + b, 0)
      else if (metric === 'avg') value = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
      return { label, value: Math.round(value * 100) / 100 }
    }).sort((a, b) => b.value - a.value)
  }

  // Time-series for line chart
  if (!groupBy && config.granularity) {
    const gran = config.granularity
    const buckets: Record<string, number> = {}
    for (const row of data) {
      const d = new Date(row.created_at)
      let key: string
      if (gran === 'day') key = d.toISOString().slice(0, 10)
      else if (gran === 'week') {
        const start = new Date(d)
        start.setDate(d.getDate() - d.getDay())
        key = start.toISOString().slice(0, 10)
      } else {
        key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      }
      buckets[key] = (buckets[key] || 0) + 1
    }
    aggregated = Object.entries(buckets)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, value]) => ({ label, value }))
  }

  return { raw: data, aggregated, total, previousTotal }
}

async function queryFunnelData(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  stages: NonNullable<WidgetConfig['stages']>,
  globalFilters: GlobalFilters,
): Promise<{ label: string; value: number }[]> {
  const results: { label: string; value: number }[] = []
  const { start, end } = getDateFilterRange(globalFilters.dateRange, globalFilters.customStart, globalFilters.customEnd)

  for (const stage of stages) {
    let query = supabase.from(stage.entity).select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId)
    if (start) query = query.gte('created_at', start)
    if (end) query = query.lte('created_at', end)
    if (stage.filter) {
      for (const [key, val] of Object.entries(stage.filter)) {
        query = query.eq(key, val)
      }
    }
    const { count } = await query
    results.push({ label: stage.label, value: count || 0 })
  }
  return results
}

async function queryFeedData(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  config: WidgetConfig,
  globalFilters: GlobalFilters,
): Promise<DbRow[]> {
  const entities = config.feedEntities || ['activities']
  const limit = config.limit || 10
  const allRows: DbRow[] = []

  for (const entity of entities) {
    const { data } = await supabase.from(entity).select('*').eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false }).limit(limit)
    if (data) allRows.push(...data)
  }

  return allRows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, limit)
}

// ---------------------------------------------------------------------------
// Widget Renderers
// ---------------------------------------------------------------------------

function KPIRenderer({ result }: { result: QueryResult }) {
  const { total, previousTotal } = result
  const isCurrency = total > 100
  const displayValue = isCurrency ? formatCurrency(total) : total.toLocaleString()

  let trendPct: number | null = null
  let trendUp = true
  if (previousTotal !== undefined && previousTotal > 0) {
    trendPct = Math.round(((total - previousTotal) / previousTotal) * 100)
    trendUp = trendPct >= 0
  }

  return (
    <div className="flex flex-col items-center justify-center h-full py-4">
      <p className="text-3xl font-bold text-surface-900">{displayValue}</p>
      {trendPct !== null && (
        <p className={cn('text-sm font-semibold mt-1', trendUp ? 'text-green-600' : 'text-red-500')}>
          {trendUp ? '↑' : '↓'} {Math.abs(trendPct)}% vs prev period
        </p>
      )}
    </div>
  )
}

function BarRenderer({ result }: { result: QueryResult }) {
  if (result.aggregated.length === 0) return <EmptyWidget />
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={result.aggregated.slice(0, 15)}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
        <Bar dataKey="value" fill="#0891B2" radius={[4, 4, 0, 0]}>
          {result.aggregated.slice(0, 15).map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function LineRenderer({ result }: { result: QueryResult }) {
  if (result.aggregated.length === 0) return <EmptyWidget />
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={result.aggregated}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
        <Line type="monotone" dataKey="value" stroke="#0891B2" strokeWidth={2.5} dot={{ r: 3, fill: '#0891B2' }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function PieRenderer({ result }: { result: QueryResult }) {
  if (result.aggregated.length === 0) return <EmptyWidget />
  const renderLabel = ({ name, percent }: { name: string; percent: number }) => {
    if (percent < 0.05) return null
    return `${name} ${(percent * 100).toFixed(0)}%`
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={result.aggregated} cx="50%" cy="50%" innerRadius="35%" outerRadius="65%"
          labelLine={false} label={renderLabel} dataKey="value" nameKey="label">
          {result.aggregated.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

function FunnelRenderer({ data }: { data: { label: string; value: number }[] }) {
  if (data.length === 0) return <EmptyWidget />
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="flex flex-col justify-center h-full gap-2 px-2 py-3">
      {data.map((stage, i) => {
        const widthPct = Math.max((stage.value / max) * 100, 15)
        const convRate = i > 0 && data[i - 1].value > 0
          ? ((stage.value / data[i - 1].value) * 100).toFixed(0)
          : null
        return (
          <div key={stage.label} className="flex items-center gap-2">
            <div className="w-20 text-right text-xs text-surface-500 font-medium truncate">{stage.label}</div>
            <div className="flex-1 relative">
              <div
                className="h-7 rounded-md flex items-center justify-end pr-2 text-xs font-bold text-white transition-all"
                style={{ width: `${widthPct}%`, backgroundColor: COLORS[i % COLORS.length] }}
              >
                {stage.value}
              </div>
            </div>
            {convRate && <span className="text-[10px] text-surface-400 w-10">{convRate}%</span>}
          </div>
        )
      })}
    </div>
  )
}

function TableRenderer({ result, config }: { result: QueryResult; config: WidgetConfig }) {
  const entity = config.entity || 'deals'
  const cols = ENTITY_DISPLAY_COLUMNS[entity] || []
  const rows = result.raw.slice(0, config.limit || 10)

  if (rows.length === 0) return <EmptyWidget />
  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-surface-100">
            {cols.map(c => (
              <th key={c.key} className="text-left px-2 py-1.5 text-[10px] font-semibold text-surface-400 uppercase tracking-wide">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row: DbRow, i: number) => (
            <tr key={row.id || i} className="border-b border-surface-50 last:border-0">
              {cols.map(c => (
                <td key={c.key} className="px-2 py-1.5 text-surface-700 truncate max-w-[150px]">
                  {c.key === 'value' || c.key === 'total' ? formatCurrency(Number(row[c.key]) || 0) : String(row[c.key] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GaugeRenderer({ result, config }: { result: QueryResult; config: WidgetConfig }) {
  const target = config.target || 100000
  const value = result.total
  const pct = Math.min((value / target) * 100, 100)
  const rotation = (pct / 100) * 180

  return (
    <div className="flex flex-col items-center justify-center h-full py-2">
      <div className="relative w-32 h-16 overflow-hidden">
        {/* Background arc */}
        <div className="absolute inset-0 rounded-t-full border-[10px] border-surface-100 border-b-0" />
        {/* Value arc */}
        <div
          className="absolute inset-0 rounded-t-full border-[10px] border-b-0 transition-all duration-700"
          style={{
            borderColor: pct >= 75 ? '#34d399' : pct >= 50 ? '#f59e0b' : '#f87171',
            clipPath: `polygon(0 100%, 0 0, ${50 + 50 * Math.cos((Math.PI * (180 - rotation)) / 180)}% ${100 - 100 * Math.sin((Math.PI * (180 - rotation)) / 180)}%, 50% 100%)`,
          }}
        />
      </div>
      <p className="text-lg font-bold text-surface-900 mt-1">{formatCurrency(value)}</p>
      <p className="text-[10px] text-surface-400">of {formatCurrency(target)} target ({pct.toFixed(0)}%)</p>
    </div>
  )
}

function FeedRenderer({ data }: { data: DbRow[] }) {
  if (data.length === 0) return <EmptyWidget />
  return (
    <div className="overflow-auto h-full space-y-1 py-1">
      {data.map((item: DbRow, i: number) => (
        <div key={item.id || i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-50 transition-colors">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-surface-700 truncate">
              {item.type ? `${String(item.type).charAt(0).toUpperCase()}${String(item.type).slice(1)}` : 'Activity'}
              {item.notes ? `: ${item.notes}` : ''}
            </p>
            <p className="text-[10px] text-surface-400">
              {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyWidget() {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-xs text-surface-300">No data</p>
    </div>
  )
}

function WidgetLoading() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-5 h-5 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Widget Configuration Modal
// ---------------------------------------------------------------------------

function WidgetConfigModal({
  widget,
  onSave,
  onClose,
}: {
  widget: Widget | null
  onSave: (w: Widget) => void
  onClose: () => void
}) {
  const isNew = !widget
  const [type, setType] = useState<WidgetType>(widget?.type || 'kpi')
  const [title, setTitle] = useState(widget?.title || '')
  const [colSpan, setColSpan] = useState(widget?.colSpan || 1)
  const [rowSpan, setRowSpan] = useState(widget?.rowSpan || 1)
  const [config, setConfig] = useState<WidgetConfig>(widget?.config || { entity: 'deals', metric: 'count' })

  const updateConfig = (patch: Partial<WidgetConfig>) => setConfig(prev => ({ ...prev, ...patch }))

  const handleSave = () => {
    const id = widget?.id || `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    onSave({ id, type, title: title || WIDGET_TYPE_META.find(m => m.type === type)?.label || 'Widget', config, colSpan, rowSpan })
  }

  const entity = config.entity || 'deals'
  const groupFields = ENTITY_GROUP_FIELDS[entity] || []

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-float w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
          <h2 className="font-semibold text-surface-900">{isNew ? 'Add Widget' : 'Edit Widget'}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-100 transition-colors"><X className="w-4 h-4 text-surface-400" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Type selector */}
          {isNew && (
            <div>
              <label className="label mb-2">Widget Type</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {WIDGET_TYPE_META.map(meta => (
                  <button key={meta.type} onClick={() => setType(meta.type)}
                    className={cn('flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-center',
                      type === meta.type ? 'border-brand-500 bg-brand-50' : 'border-surface-100 hover:border-surface-200')}>
                    <meta.icon className={cn('w-5 h-5', type === meta.type ? 'text-brand-600' : 'text-surface-400')} />
                    <span className="text-[10px] font-semibold leading-tight">{meta.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="label">Title</label>
            <input type="text" className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Widget title" />
          </div>

          {/* Size */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Width (columns)</label>
              <select className="input" value={colSpan} onChange={e => setColSpan(Number(e.target.value))}>
                <option value={1}>1 col</option>
                <option value={2}>2 cols</option>
                <option value={3}>3 cols</option>
                <option value={4}>4 cols (full)</option>
              </select>
            </div>
            <div>
              <label className="label">Height (rows)</label>
              <select className="input" value={rowSpan} onChange={e => setRowSpan(Number(e.target.value))}>
                <option value={1}>1 row</option>
                <option value={2}>2 rows</option>
              </select>
            </div>
          </div>

          {/* Type-specific config */}
          {(type === 'kpi' || type === 'bar' || type === 'line' || type === 'pie' || type === 'table' || type === 'gauge') && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Entity</label>
                  <select className="input" value={entity}
                    onChange={e => updateConfig({ entity: e.target.value as Entity, groupBy: ENTITY_GROUP_FIELDS[e.target.value as Entity]?.[0]?.value })}>
                    {ENTITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Metric</label>
                  <select className="input" value={config.metric || 'count'} onChange={e => updateConfig({ metric: e.target.value as Metric })}>
                    <option value="count">Count</option>
                    {NUMERIC_FIELDS[entity] && <option value="sum">Sum</option>}
                    {NUMERIC_FIELDS[entity] && <option value="avg">Average</option>}
                  </select>
                </div>
              </div>

              {(type === 'bar' || type === 'pie') && (
                <div>
                  <label className="label">Group By</label>
                  <select className="input" value={config.groupBy || ''} onChange={e => updateConfig({ groupBy: e.target.value })}>
                    {groupFields.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
              )}

              {type === 'line' && (
                <div>
                  <label className="label">Granularity</label>
                  <select className="input" value={config.granularity || 'month'} onChange={e => updateConfig({ granularity: e.target.value as 'day' | 'week' | 'month' })}>
                    <option value="day">Day</option>
                    <option value="week">Week</option>
                    <option value="month">Month</option>
                  </select>
                </div>
              )}

              {type === 'table' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Sort By</label>
                    <select className="input" value={config.sortBy || 'created_at'} onChange={e => updateConfig({ sortBy: e.target.value })}>
                      <option value="created_at">Created At</option>
                      {NUMERIC_FIELDS[entity] && <option value={NUMERIC_FIELDS[entity]!}>{NUMERIC_FIELDS[entity]}</option>}
                    </select>
                  </div>
                  <div>
                    <label className="label">Limit</label>
                    <input type="number" className="input" value={config.limit || 10} min={1} max={50}
                      onChange={e => updateConfig({ limit: Number(e.target.value) })} />
                  </div>
                </div>
              )}

              {type === 'gauge' && (
                <div>
                  <label className="label">Target Value</label>
                  <input type="number" className="input" value={config.target || 100000}
                    onChange={e => updateConfig({ target: Number(e.target.value) })} />
                </div>
              )}

              {type === 'kpi' && (
                <label className="flex items-center gap-2 text-sm text-surface-600">
                  <input type="checkbox" checked={config.comparison || false}
                    onChange={e => updateConfig({ comparison: e.target.checked })}
                    className="rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
                  Compare with previous period
                </label>
              )}
            </>
          )}

          {type === 'funnel' && (
            <div>
              <label className="label mb-2">Funnel Stages</label>
              <p className="text-xs text-surface-400 mb-2">Configure stages in the default order. Each stage queries an entity with optional filter.</p>
              {(config.stages || []).map((stage, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <input type="text" className="input flex-1 text-xs" value={stage.label}
                    onChange={e => {
                      const stages = [...(config.stages || [])]
                      stages[i] = { ...stages[i], label: e.target.value }
                      updateConfig({ stages })
                    }} placeholder="Stage label" />
                  <select className="input w-28 text-xs" value={stage.entity}
                    onChange={e => {
                      const stages = [...(config.stages || [])]
                      stages[i] = { ...stages[i], entity: e.target.value as Entity }
                      updateConfig({ stages })
                    }}>
                    {ENTITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <button onClick={() => {
                    const stages = (config.stages || []).filter((_, j) => j !== i)
                    updateConfig({ stages })
                  }} className="p-1 text-surface-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <button onClick={() => {
                const stages = [...(config.stages || []), { label: '', entity: 'deals' as Entity }]
                updateConfig({ stages })
              }} className="btn-ghost btn-sm text-xs mt-1"><Plus className="w-3 h-3" /> Add Stage</button>
            </div>
          )}

          {type === 'feed' && (
            <div>
              <label className="label">Feed Entities</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {ENTITY_OPTIONS.map(o => {
                  const selected = (config.feedEntities || []).includes(o.value)
                  return (
                    <button key={o.value} onClick={() => {
                      const current = config.feedEntities || []
                      updateConfig({ feedEntities: selected ? current.filter(e => e !== o.value) : [...current, o.value] })
                    }}
                      className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                        selected ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-surface-200 text-surface-500')}>
                      {o.label}
                    </button>
                  )
                })}
              </div>
              <div className="mt-3">
                <label className="label">Limit</label>
                <input type="number" className="input" value={config.limit || 10} min={1} max={50}
                  onChange={e => updateConfig({ limit: Number(e.target.value) })} />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-surface-100">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={handleSave} className="btn-primary"><Check className="w-3.5 h-3.5" /> {isNew ? 'Add' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// BI Widget Card
// ---------------------------------------------------------------------------

function WidgetCard({
  widget,
  widgetData,
  funnelData,
  feedData,
  loading,
  onEdit,
  onDelete,
}: {
  widget: Widget
  widgetData: QueryResult | null
  funnelData: { label: string; value: number }[] | null
  feedData: DbRow[] | null
  loading: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const heightMap: Record<number, string> = { 1: 'h-52', 2: 'h-[26rem]' }

  return (
    <div
      className={cn('card overflow-hidden group', heightMap[widget.rowSpan] || 'h-52',
        widget.colSpan >= 2 ? 'col-span-1 sm:col-span-2' : '',
        widget.colSpan >= 3 ? 'lg:col-span-3' : '',
        widget.colSpan >= 4 ? 'lg:col-span-4' : '',
      )}
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-50">
        <div className="flex items-center gap-2 min-w-0">
          <GripVertical className="w-3.5 h-3.5 text-surface-300 flex-shrink-0 cursor-grab" />
          <h3 className="text-xs font-semibold text-surface-700 truncate">{widget.title}</h3>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="p-1 rounded hover:bg-surface-100 transition-colors">
            <Edit3 className="w-3 h-3 text-surface-400" />
          </button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-red-50 transition-colors">
            <Trash2 className="w-3 h-3 text-surface-400 hover:text-red-500" />
          </button>
        </div>
      </div>
      <div className="flex-1 px-3 pb-3 overflow-hidden" style={{ height: 'calc(100% - 42px)' }}>
        {loading ? <WidgetLoading /> : (
          <>
            {widget.type === 'kpi' && widgetData && <KPIRenderer result={widgetData} />}
            {widget.type === 'bar' && widgetData && <BarRenderer result={widgetData} />}
            {widget.type === 'line' && widgetData && <LineRenderer result={widgetData} />}
            {widget.type === 'pie' && widgetData && <PieRenderer result={widgetData} />}
            {widget.type === 'funnel' && funnelData && <FunnelRenderer data={funnelData} />}
            {widget.type === 'table' && widgetData && <TableRenderer result={widgetData} config={widget.config} />}
            {widget.type === 'gauge' && widgetData && <GaugeRenderer result={widgetData} config={widget.config} />}
            {widget.type === 'feed' && feedData && <FeedRenderer data={feedData} />}
            {!widgetData && !funnelData && !feedData && <EmptyWidget />}
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main BI Page
// ---------------------------------------------------------------------------

export default function BIDashboardPage() {
  const { t } = useI18n()
  const supabase = createClient()

  // State
  const [dashboards, setDashboards] = useState<Dashboard[]>([])
  const [activeDashboardId, setActiveDashboardId] = useState('default')
  const [loading, setLoading] = useState(true)
  const [widgetDataMap, setWidgetDataMap] = useState<Record<string, QueryResult>>({})
  const [funnelDataMap, setFunnelDataMap] = useState<Record<string, { label: string; value: number }[]>>({})
  const [feedDataMap, setFeedDataMap] = useState<Record<string, DbRow[]>>({})
  const [widgetLoading, setWidgetLoading] = useState<Record<string, boolean>>({})
  const [stageMap, setStageMap] = useState<Record<string, string>>({})
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [configModal, setConfigModal] = useState<{ open: boolean; widget: Widget | null }>({ open: false, widget: null })
  const [showDashboardPicker, setShowDashboardPicker] = useState(false)
  const [newDashboardName, setNewDashboardName] = useState('')
  const [saving, setSaving] = useState(false)

  const [globalFilters, setGlobalFilters] = useState<GlobalFilters>({
    dateRange: 'this_year',
    customStart: '',
    customEnd: '',
    entityFilter: 'all',
    pipelineFilter: '',
  })

  const activeDashboard = useMemo(
    () => dashboards.find(d => d.id === activeDashboardId) || dashboards[0] || makeDefaultDashboard(),
    [dashboards, activeDashboardId]
  )

  // Load dashboards from workspace
  const loadDashboards = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const ws = await getActiveWorkspace(supabase, user.id, 'id, bi_dashboards')
    if (!ws) { setLoading(false); return }

    setWorkspaceId(ws.id)

    // Load stages
    const { data: stages } = await supabase.from('pipeline_stages').select('id, name').eq('workspace_id', ws.id)
    const sm: Record<string, string> = {}
    ;(stages || []).forEach((s: DbRow) => { sm[s.id] = s.name })
    setStageMap(sm)

    // Load saved dashboards
    const saved = (ws.bi_dashboards as Dashboard[] | null) || []
    if (saved.length > 0) {
      setDashboards(saved)
      setActiveDashboardId(saved[0].id)
    } else {
      const def = makeDefaultDashboard()
      setDashboards([def])
      setActiveDashboardId(def.id)
    }

    setLoading(false)
  }, [supabase])

  // Load widget data
  const loadWidgetData = useCallback(async (widgets: Widget[]) => {
    if (!workspaceId) return

    const loadingState: Record<string, boolean> = {}
    widgets.forEach(w => { loadingState[w.id] = true })
    setWidgetLoading(loadingState)

    const dataMap: Record<string, QueryResult> = {}
    const fDataMap: Record<string, { label: string; value: number }[]> = {}
    const feedMap: Record<string, DbRow[]> = {}

    await Promise.all(widgets.map(async (w) => {
      try {
        if (w.type === 'funnel' && w.config.stages) {
          fDataMap[w.id] = await queryFunnelData(supabase, workspaceId, w.config.stages, globalFilters)
        } else if (w.type === 'feed') {
          feedMap[w.id] = await queryFeedData(supabase, workspaceId, w.config, globalFilters)
        } else {
          dataMap[w.id] = await queryWidgetData(supabase, workspaceId, w.config, globalFilters, stageMap)
        }
      } catch {
        // skip widget on error
      }
    }))

    setWidgetDataMap(dataMap)
    setFunnelDataMap(fDataMap)
    setFeedDataMap(feedMap)
    setWidgetLoading({})
  }, [workspaceId, globalFilters, stageMap, supabase])

  // Initial load
  useEffect(() => { loadDashboards() }, [loadDashboards])

  // Load data when dashboard or filters change
  useEffect(() => {
    if (workspaceId && activeDashboard.widgets.length > 0) {
      loadWidgetData(activeDashboard.widgets)
    }
  }, [activeDashboard.widgets, workspaceId, globalFilters, loadWidgetData])

  // Dashboard mutations
  const updateDashboardWidgets = (widgets: Widget[]) => {
    setDashboards(prev => prev.map(d => d.id === activeDashboardId ? { ...d, widgets } : d))
  }

  const addWidget = (w: Widget) => {
    updateDashboardWidgets([...activeDashboard.widgets, w])
    setConfigModal({ open: false, widget: null })
  }

  const editWidget = (w: Widget) => {
    updateDashboardWidgets(activeDashboard.widgets.map(existing => existing.id === w.id ? w : existing))
    setConfigModal({ open: false, widget: null })
  }

  const deleteWidget = (id: string) => {
    updateDashboardWidgets(activeDashboard.widgets.filter(w => w.id !== id))
  }

  const saveDashboard = async () => {
    if (!workspaceId) return
    setSaving(true)
    await supabase.from('workspaces').update({ bi_dashboards: dashboards }).eq('id', workspaceId)
    setSaving(false)
  }

  const createDashboard = () => {
    if (!newDashboardName.trim()) return
    const newD: Dashboard = {
      id: `dash_${Date.now()}`,
      name: newDashboardName.trim(),
      widgets: [],
    }
    setDashboards(prev => [...prev, newD])
    setActiveDashboardId(newD.id)
    setNewDashboardName('')
    setShowDashboardPicker(false)
  }

  const deleteDashboard = (id: string) => {
    if (dashboards.length <= 1) return
    const next = dashboards.filter(d => d.id !== id)
    setDashboards(next)
    if (activeDashboardId === id) setActiveDashboardId(next[0].id)
  }

  const duplicateWidget = (w: Widget) => {
    const copy: Widget = { ...w, id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, title: `${w.title} (copy)` }
    updateDashboardWidgets([...activeDashboard.widgets, copy])
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header flex-col md:flex-row gap-3 md:gap-0">
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <h1 className="page-title">{t('nav.bi')}</h1>
            <p className="text-sm text-surface-500 mt-0.5">Custom dashboards with drag-and-drop widgets</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setConfigModal({ open: true, widget: null })} className="btn-primary btn-sm">
            <Plus className="w-3.5 h-3.5" /> Add Widget
          </button>
          <button onClick={saveDashboard} disabled={saving} className="btn-ghost btn-sm">
            <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Dashboard Tabs */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto">
        {dashboards.map(d => (
          <button key={d.id} onClick={() => setActiveDashboardId(d.id)}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5',
              activeDashboardId === d.id ? 'bg-brand-50 text-brand-700 shadow-sm' : 'text-surface-500 hover:bg-surface-50')}>
            <Layout className="w-3 h-3" />
            {d.name}
            {dashboards.length > 1 && activeDashboardId === d.id && (
              <button onClick={e => { e.stopPropagation(); deleteDashboard(d.id) }}
                className="ml-1 p-0.5 rounded hover:bg-red-100 transition-colors">
                <X className="w-2.5 h-2.5 text-surface-400 hover:text-red-500" />
              </button>
            )}
          </button>
        ))}
        <div className="relative">
          <button onClick={() => setShowDashboardPicker(!showDashboardPicker)}
            className="p-1.5 rounded-lg text-surface-400 hover:bg-surface-50 transition-colors">
            <Plus className="w-3.5 h-3.5" />
          </button>
          {showDashboardPicker && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-surface-100 rounded-xl shadow-float p-3 z-20 w-56">
              <input type="text" className="input text-xs mb-2" placeholder="Dashboard name"
                value={newDashboardName} onChange={e => setNewDashboardName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createDashboard()} />
              <button onClick={createDashboard} className="btn-primary btn-sm w-full text-xs">Create Dashboard</button>
            </div>
          )}
        </div>
      </div>

      {/* Global Filters */}
      <div className="card p-3 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-surface-500 font-semibold">
            <Filter className="w-3.5 h-3.5" /> Filters
          </div>

          <select className="input input-sm text-xs w-auto"
            value={globalFilters.dateRange}
            onChange={e => setGlobalFilters(prev => ({ ...prev, dateRange: e.target.value as DateRangePreset }))}>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="this_month">This month</option>
            <option value="this_year">This year</option>
            <option value="custom">Custom range</option>
          </select>

          {globalFilters.dateRange === 'custom' && (
            <>
              <input type="date" className="input input-sm text-xs w-auto" value={globalFilters.customStart}
                onChange={e => setGlobalFilters(prev => ({ ...prev, customStart: e.target.value }))} />
              <span className="text-xs text-surface-400">to</span>
              <input type="date" className="input input-sm text-xs w-auto" value={globalFilters.customEnd}
                onChange={e => setGlobalFilters(prev => ({ ...prev, customEnd: e.target.value }))} />
            </>
          )}

          <select className="input input-sm text-xs w-auto"
            value={globalFilters.entityFilter}
            onChange={e => setGlobalFilters(prev => ({ ...prev, entityFilter: e.target.value as Entity | 'all' }))}>
            <option value="all">All entities</option>
            {ENTITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <button onClick={() => loadWidgetData(activeDashboard.widgets)}
            className="btn-primary btn-sm text-xs ml-auto">
            Apply
          </button>
        </div>
      </div>

      {/* Widget Grid */}
      {activeDashboard.widgets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <BarChart2 className="w-7 h-7 text-surface-300" />
          </div>
          <p className="empty-state-title">No widgets yet</p>
          <p className="empty-state-desc">Add your first widget to start building your dashboard</p>
          <button onClick={() => setConfigModal({ open: true, widget: null })} className="btn-primary btn-sm mt-3">
            <Plus className="w-3.5 h-3.5" /> Add Widget
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-auto">
          {activeDashboard.widgets.map(w => (
            <WidgetCard
              key={w.id}
              widget={w}
              widgetData={widgetDataMap[w.id] || null}
              funnelData={funnelDataMap[w.id] || null}
              feedData={feedDataMap[w.id] || null}
              loading={!!widgetLoading[w.id]}
              onEdit={() => setConfigModal({ open: true, widget: w })}
              onDelete={() => deleteWidget(w.id)}
            />
          ))}
        </div>
      )}

      {/* Config Modal */}
      {configModal.open && (
        <WidgetConfigModal
          widget={configModal.widget}
          onSave={configModal.widget ? editWidget : addWidget}
          onClose={() => setConfigModal({ open: false, widget: null })}
        />
      )}
    </div>
  )
}
