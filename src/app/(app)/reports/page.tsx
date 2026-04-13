'use client'
import { useI18n } from '@/lib/i18n/context'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, LineChart, Line } from 'recharts'
import { FileText, TrendingUp, TrendingDown, DollarSign, Download, Calendar, Users, Target, Award } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import type { DbRow } from '@/types'
import { getActiveWorkspace } from '@/lib/get-active-workspace'

export default function ReportsPage() {
  const { t } = useI18n()
  const [tab, setTab] = useState<'pnl'|'balance'|'cashflow'|'sales'>('pnl')
  interface ReportAccount { name: string; total: number; code: string; balance: number }
  interface PnlReport { revenue: { total: number; accounts: ReportAccount[] }; expenses: { total: number; accounts: ReportAccount[] }; net_income: number; gross_margin?: number }
  interface BalanceSection { label: string; data?: { total?: number; accounts?: ReportAccount[] } }
  interface CashflowReport { months?: { month: string; inflow: number; outflow: number; net: number }[]; monthly?: { month: string; inflow: number; outflow: number; net: number }[]; total_inflow?: number; total_outflow?: number; net_cashflow: number }
  const [pnl, setPnl] = useState<PnlReport | null>(null)
  const [balance, setBalance] = useState<{ assets?: { total: number; accounts: ReportAccount[] }; liabilities?: { total: number; accounts: ReportAccount[] }; equity?: { total: number; accounts: ReportAccount[] }; balanced?: boolean } | null>(null)
  const [cashflow, setCashflow] = useState<CashflowReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])

  // Sales data
  const [salesLoading, setSalesLoading] = useState(false)
  const [funnelData, setFunnelData] = useState<{ totalLeads: number; qualifiedLeads: number; dealsCreated: number; dealsWon: number }>({ totalLeads: 0, qualifiedLeads: 0, dealsCreated: 0, dealsWon: 0 })
  const [sourceROI, setSourceROI] = useState<{ platform: string; totalLeads: number; converted: number; dealValue: number; conversionRate: number }[]>([])
  const [repLeaderboard, setRepLeaderboard] = useState<{ name: string; dealCount: number; totalValue: number; winRate: number; avgDealSize: number }[]>([])
  const [monthlyTrend, setMonthlyTrend] = useState<{ month: string; won: number; value: number }[]>([])

  const loadReports = async () => {
    setLoading(true)
    const params = `start=${startDate}&end=${endDate}`
    const [pnlRes, balRes, cfRes] = await Promise.all([
      fetch(`/api/reports?type=pnl&${params}`).then(r => r.json()).catch(() => null),
      fetch(`/api/reports?type=balance_sheet&${params}`).then(r => r.json()).catch(() => null),
      fetch(`/api/reports?type=cashflow&${params}`).then(r => r.json()).catch(() => null),
    ])
    setPnl(pnlRes)
    setBalance(balRes)
    setCashflow(cfRes)
    setLoading(false)
  }

  const loadSalesData = useCallback(async () => {
    setSalesLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSalesLoading(false); return }
    const ws = await getActiveWorkspace(supabase, user.id, 'id')
    if (!ws) { setSalesLoading(false); return }

    const [leadsRes, dealsRes, profilesRes] = await Promise.all([
      supabase.from('social_leads').select('id, platform, status, contact_id, created_at').eq('workspace_id', ws.id),
      supabase.from('deals').select('id, value, status, owner_id, contact_id, created_at, updated_at').eq('workspace_id', ws.id),
      supabase.from('profiles').select('id, full_name, email').eq('workspace_id', ws.id),
    ])

    const leads = leadsRes.data || []
    const deals = dealsRes.data || []
    const profiles = profilesRes.data || []

    // --- Conversion Funnel ---
    const totalLeads = leads.length
    const qualifiedLeads = leads.filter((l: DbRow) => l.status === 'qualified' || l.status === 'converted').length
    const dealsCreated = deals.length
    const dealsWon = deals.filter((d: DbRow) => d.status === 'won').length
    setFunnelData({ totalLeads, qualifiedLeads, dealsCreated, dealsWon })

    // --- Source ROI ---
    // Build set of contact_ids that came from leads, keyed by platform
    const contactPlatformMap: Record<string, string> = {}
    leads.forEach((l: DbRow) => {
      if (l.contact_id) contactPlatformMap[l.contact_id] = l.platform
    })

    const platformSet = Array.from(new Set(leads.map((l: DbRow) => l.platform as string)))
    const sourceData = platformSet.map(platform => {
      const platformLeads = leads.filter((l: DbRow) => l.platform === platform)
      const convertedContactIds = platformLeads.filter((l: DbRow) => l.contact_id).map((l: DbRow) => l.contact_id)
      const platformDeals = deals.filter((d: DbRow) => convertedContactIds.includes(d.contact_id))
      const totalValue = platformDeals.reduce((sum: number, d: DbRow) => sum + ((d.value as number) || 0), 0)
      return {
        platform,
        totalLeads: platformLeads.length,
        converted: platformDeals.length,
        dealValue: totalValue,
        conversionRate: platformLeads.length > 0 ? Math.round((platformDeals.length / platformLeads.length) * 100) : 0,
      }
    })
    setSourceROI(sourceData.sort((a, b) => b.dealValue - a.dealValue))

    // --- Rep Leaderboard ---
    const repMap: Record<string, { name: string; won: number; lost: number; total: number; value: number }> = {}
    profiles.forEach((p: DbRow) => {
      repMap[p.id] = { name: p.full_name || p.email || 'Unknown', won: 0, lost: 0, total: 0, value: 0 }
    })
    deals.forEach((d: DbRow) => {
      const ownerId = d.owner_id
      if (!ownerId || !repMap[ownerId]) return
      repMap[ownerId].total++
      repMap[ownerId].value += (d.value as number) || 0
      if (d.status === 'won') repMap[ownerId].won++
      if (d.status === 'lost') repMap[ownerId].lost++
    })
    const leaderboard = Object.values(repMap)
      .filter(r => r.total > 0)
      .map(r => ({
        name: r.name,
        dealCount: r.total,
        totalValue: r.value,
        winRate: r.total > 0 ? Math.round((r.won / r.total) * 100) : 0,
        avgDealSize: r.total > 0 ? Math.round(r.value / r.total) : 0,
      }))
      .sort((a, b) => b.totalValue - a.totalValue)
    setRepLeaderboard(leaderboard)

    // --- Monthly Trend (last 6 months) ---
    const now = new Date()
    const months: { month: string; won: number; value: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      const year = d.getFullYear()
      const month = d.getMonth()
      const wonInMonth = deals.filter((deal: DbRow) => {
        if (deal.status !== 'won') return false
        const updated = new Date(deal.updated_at)
        return updated.getFullYear() === year && updated.getMonth() === month
      })
      months.push({
        month: label,
        won: wonInMonth.length,
        value: wonInMonth.reduce((s: number, deal: DbRow) => s + ((deal.value as number) || 0), 0),
      })
    }
    setMonthlyTrend(months)
    setSalesLoading(false)
  }, [])

  useEffect(() => { loadReports() }, [startDate, endDate])
  useEffect(() => { if (tab === 'sales') loadSalesData() }, [tab, loadSalesData])

  if (loading && tab !== 'sales') return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  const PLATFORM_ICONS: Record<string, string> = {
    instagram: '📸', facebook: '📘', tiktok: '🎵', linkedin: '💼', twitter: '🐦', youtube: '📺', other: '🌐',
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header flex-col md:flex-row gap-3 md:gap-0">
        <div><h1 className="page-title">{t('reports.title')}</h1><p className="text-sm text-surface-500 mt-0.5">Real-time financial overview</p></div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" className="input text-xs" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <span className="text-surface-400 text-xs">to</span>
          <input type="date" className="input text-xs" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
      </div>

      <div className="segmented-control mb-8 overflow-x-auto">
        {[{ id: 'pnl', label: 'Profit & Loss' }, { id: 'balance', label: 'Balance Sheet' }, { id: 'cashflow', label: 'Cash Flow' }, { id: 'sales', label: 'Sales' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as 'pnl'|'balance'|'cashflow'|'sales')}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all', tab === t.id ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* P&L */}
      {tab === 'pnl' && pnl && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="card p-4"><div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center mb-2"><TrendingUp className="w-4 h-4 text-emerald-600" /></div><p className="text-lg font-bold">{formatCurrency(pnl.revenue?.total || 0)}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Revenue</p></div>
            <div className="card p-4"><div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center mb-2"><TrendingDown className="w-4 h-4 text-red-600" /></div><p className="text-lg font-bold">{formatCurrency(pnl.expenses?.total || 0)}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Expenses</p></div>
            <div className={cn('card p-4', pnl.net_income >= 0 ? 'border-emerald-200' : 'border-red-200')}><div className="w-9 h-9 bg-brand-50 rounded-xl flex items-center justify-center mb-2"><DollarSign className="w-4 h-4 text-brand-600" /></div><p className={cn('text-lg font-bold', pnl.net_income >= 0 ? 'text-emerald-600' : 'text-red-600')}>{formatCurrency(pnl.net_income)}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Net Income</p></div>
            <div className="card p-4"><div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center mb-2"><span className="text-sm">📊</span></div><p className="text-lg font-bold">{pnl.gross_margin}%</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Margin</p></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-5">
              <h3 className="font-semibold text-surface-900 mb-4 text-emerald-700">Revenue</h3>
              {(pnl.revenue?.accounts || []).length > 0 ? (
                <div className="space-y-2">
                  {pnl.revenue.accounts.map((a: ReportAccount) => (
                    <div key={a.code} className="flex items-center justify-between py-1.5 border-b border-surface-50">
                      <span className="text-sm text-surface-700"><span className="text-surface-400 font-mono mr-2">{a.code}</span>{a.name}</span>
                      <span className="text-sm font-semibold text-emerald-600">{formatCurrency(a.balance)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 font-bold text-emerald-700"><span>Total Revenue</span><span>{formatCurrency(pnl.revenue.total)}</span></div>
                </div>
              ) : <p className="text-surface-400 text-sm">No revenue accounts configured</p>}
            </div>

            <div className="card p-5">
              <h3 className="font-semibold text-surface-900 mb-4 text-red-700">Expenses</h3>
              {(pnl.expenses?.accounts || []).length > 0 ? (
                <div className="space-y-2">
                  {pnl.expenses.accounts.map((a: ReportAccount) => (
                    <div key={a.code} className="flex items-center justify-between py-1.5 border-b border-surface-50">
                      <span className="text-sm text-surface-700"><span className="text-surface-400 font-mono mr-2">{a.code}</span>{a.name}</span>
                      <span className="text-sm font-semibold text-red-600">{formatCurrency(a.balance)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 font-bold text-red-700"><span>Total Expenses</span><span>{formatCurrency(pnl.expenses.total)}</span></div>
                </div>
              ) : <p className="text-surface-400 text-sm">No expense accounts configured</p>}
            </div>
          </div>
        </div>
      )}

      {/* Balance Sheet */}
      {tab === 'balance' && balance && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="card p-4"><p className="text-lg font-bold text-blue-600">{formatCurrency(balance.assets?.total || 0)}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Total Assets</p></div>
            <div className="card p-4"><p className="text-lg font-bold text-red-600">{formatCurrency(balance.liabilities?.total || 0)}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Total Liabilities</p></div>
            <div className={cn('card p-4', balance.balanced ? 'border-emerald-200' : 'border-red-200')}>
              <p className="text-lg font-bold">{formatCurrency(balance.equity?.total || 0)}</p>
              <p className="text-[10px] text-surface-500 font-semibold uppercase">Total Equity</p>
              {balance.balanced && <span className="text-[9px] text-emerald-600 font-bold">BALANCED</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[
              { title: 'Assets', data: balance.assets, color: 'text-blue-700' },
              { title: 'Liabilities', data: balance.liabilities, color: 'text-red-700' },
              { title: 'Equity', data: balance.equity, color: 'text-violet-700' },
            ].map(section => (
              <div key={section.title} className="card p-5">
                <h3 className={cn('font-semibold mb-4', section.color)}>{section.title}</h3>
                <div className="space-y-2">
                  {(section.data?.accounts || []).map((a: ReportAccount) => (
                    <div key={a.code} className="flex justify-between py-1.5 border-b border-surface-50">
                      <span className="text-sm text-surface-700"><span className="text-surface-400 font-mono mr-2">{a.code}</span>{a.name}</span>
                      <span className="text-sm font-semibold">{formatCurrency(a.balance)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 font-bold"><span>Total</span><span>{formatCurrency(section.data?.total || 0)}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cash Flow */}
      {tab === 'cashflow' && cashflow && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="card p-4"><p className="text-lg font-bold text-emerald-600">{formatCurrency(cashflow.total_inflow || 0)}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Total Inflow</p></div>
            <div className="card p-4"><p className="text-lg font-bold text-red-600">{formatCurrency(cashflow.total_outflow || 0)}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Total Outflow</p></div>
            <div className={cn('card p-4', cashflow.net_cashflow >= 0 ? 'border-emerald-200' : 'border-red-200')}>
              <p className={cn('text-lg font-bold', cashflow.net_cashflow >= 0 ? 'text-emerald-600' : 'text-red-600')}>{formatCurrency(cashflow.net_cashflow || 0)}</p>
              <p className="text-[10px] text-surface-500 font-semibold uppercase">Net Cash Flow</p>
            </div>
          </div>

          {(cashflow.monthly || []).length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-surface-900 mb-4">Monthly Cash Flow</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={cashflow.monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e4e7f0', fontSize: 12 }} formatter={(v: number) => [formatCurrency(v)]} />
                  <Bar dataKey="inflow" fill="#34d399" radius={[4,4,0,0]} name="Inflow" />
                  <Bar dataKey="outflow" fill="#f87171" radius={[4,4,0,0]} name="Outflow" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {(cashflow.monthly || []).length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-surface-900 mb-4">Net Cash Flow Trend</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={cashflow.monthly}>
                  <defs><linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0891B2" stopOpacity={0.2}/><stop offset="95%" stopColor="#0891B2" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v: number) => [formatCurrency(v), 'Net']} />
                  <Area type="monotone" dataKey="net" stroke="#0891B2" strokeWidth={2.5} fill="url(#netGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Sales */}
      {tab === 'sales' && (
        salesLoading ? (
          <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>
        ) : (
          <div className="space-y-6">
            {/* Conversion Funnel */}
            <div className="card p-5">
              <h3 className="font-semibold text-surface-900 mb-5 flex items-center gap-2"><Target className="w-4 h-4 text-brand-600" /> Conversion Funnel</h3>
              <div className="flex flex-col items-center gap-1">
                {[
                  { label: 'Total Leads', value: funnelData.totalLeads, color: 'bg-blue-500', width: 'w-full' },
                  { label: 'Qualified Leads', value: funnelData.qualifiedLeads, color: 'bg-violet-500', width: 'w-5/6' },
                  { label: 'Deals Created', value: funnelData.dealsCreated, color: 'bg-amber-500', width: 'w-4/6' },
                  { label: 'Deals Won', value: funnelData.dealsWon, color: 'bg-emerald-500', width: 'w-3/6' },
                ].map((stage, i, arr) => {
                  const prevValue = i > 0 ? arr[i - 1].value : 0
                  const conversionPct = i > 0 && prevValue > 0 ? Math.round((stage.value / prevValue) * 100) : null
                  return (
                    <div key={stage.label} className={cn('flex flex-col items-center', stage.width)}>
                      <div className={cn('w-full rounded-lg py-3 px-4 flex items-center justify-between text-white', stage.color)}>
                        <span className="text-sm font-medium">{stage.label}</span>
                        <span className="text-lg font-bold">{stage.value}</span>
                      </div>
                      {conversionPct !== null && (
                        <span className="text-[10px] text-surface-400 font-semibold my-0.5">{conversionPct}% conversion</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Source ROI Table */}
            <div className="card p-5">
              <h3 className="font-semibold text-surface-900 mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-brand-600" /> Source ROI</h3>
              {sourceROI.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-100">
                        <th className="text-left py-2 font-semibold text-surface-500 text-xs uppercase">Platform</th>
                        <th className="text-right py-2 font-semibold text-surface-500 text-xs uppercase">Total Leads</th>
                        <th className="text-right py-2 font-semibold text-surface-500 text-xs uppercase">Converted</th>
                        <th className="text-right py-2 font-semibold text-surface-500 text-xs uppercase">Deal Value</th>
                        <th className="text-right py-2 font-semibold text-surface-500 text-xs uppercase">Conv. Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sourceROI.map(row => (
                        <tr key={row.platform} className="border-b border-surface-50 hover:bg-surface-25">
                          <td className="py-2.5 font-medium text-surface-800">
                            <span className="mr-2">{PLATFORM_ICONS[row.platform] || '🌐'}</span>
                            {row.platform.charAt(0).toUpperCase() + row.platform.slice(1)}
                          </td>
                          <td className="text-right py-2.5 text-surface-600">{row.totalLeads}</td>
                          <td className="text-right py-2.5 text-surface-600">{row.converted}</td>
                          <td className="text-right py-2.5 font-semibold text-emerald-600">{formatCurrency(row.dealValue)}</td>
                          <td className="text-right py-2.5">
                            <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', row.conversionRate >= 20 ? 'bg-emerald-50 text-emerald-700' : row.conversionRate >= 10 ? 'bg-amber-50 text-amber-700' : 'bg-surface-100 text-surface-500')}>
                              {row.conversionRate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="text-surface-400 text-sm">No lead sources found</p>}
            </div>

            {/* Rep Leaderboard */}
            <div className="card p-5">
              <h3 className="font-semibold text-surface-900 mb-4 flex items-center gap-2"><Award className="w-4 h-4 text-brand-600" /> Rep Leaderboard</h3>
              {repLeaderboard.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-100">
                        <th className="text-left py-2 font-semibold text-surface-500 text-xs uppercase">Rep</th>
                        <th className="text-right py-2 font-semibold text-surface-500 text-xs uppercase">Deals</th>
                        <th className="text-right py-2 font-semibold text-surface-500 text-xs uppercase">Total Value</th>
                        <th className="text-right py-2 font-semibold text-surface-500 text-xs uppercase">Win Rate</th>
                        <th className="text-right py-2 font-semibold text-surface-500 text-xs uppercase">Avg Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {repLeaderboard.map((rep, i) => (
                        <tr key={rep.name} className="border-b border-surface-50 hover:bg-surface-25">
                          <td className="py-2.5 font-medium text-surface-800">
                            {i === 0 && <span className="mr-1.5">🥇</span>}
                            {i === 1 && <span className="mr-1.5">🥈</span>}
                            {i === 2 && <span className="mr-1.5">🥉</span>}
                            {rep.name}
                          </td>
                          <td className="text-right py-2.5 text-surface-600">{rep.dealCount}</td>
                          <td className="text-right py-2.5 font-semibold text-emerald-600">{formatCurrency(rep.totalValue)}</td>
                          <td className="text-right py-2.5">
                            <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', rep.winRate >= 50 ? 'bg-emerald-50 text-emerald-700' : rep.winRate >= 25 ? 'bg-amber-50 text-amber-700' : 'bg-surface-100 text-surface-500')}>
                              {rep.winRate}%
                            </span>
                          </td>
                          <td className="text-right py-2.5 text-surface-600">{formatCurrency(rep.avgDealSize)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="text-surface-400 text-sm">No deals assigned to reps yet</p>}
            </div>

            {/* Monthly Trend */}
            <div className="card p-5">
              <h3 className="font-semibold text-surface-900 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-brand-600" /> Deals Won — Last 6 Months</h3>
              {monthlyTrend.some(m => m.won > 0) ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e4e7f0', fontSize: 12 }} formatter={(v: number, name: string) => [name === 'value' ? formatCurrency(v) : v, name === 'value' ? 'Revenue' : 'Deals Won']} />
                    <Bar yAxisId="left" dataKey="won" fill="#0891B2" radius={[4,4,0,0]} name="won" />
                    <Line yAxisId="right" type="monotone" dataKey="value" stroke="#34d399" strokeWidth={2.5} dot={{ r: 4, fill: '#34d399' }} name="value" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-surface-400 text-sm">No deals won in the last 6 months</p>}
            </div>
          </div>
        )
      )}
    </div>
  )
}
