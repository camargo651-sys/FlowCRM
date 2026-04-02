'use client'
import { useI18n } from '@/lib/i18n/context'
import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { FileText, TrendingUp, TrendingDown, DollarSign, Download, Calendar } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'

export default function ReportsPage() {
  const { t } = useI18n()
  const [tab, setTab] = useState<'pnl'|'balance'|'cashflow'>('pnl')
  const [pnl, setPnl] = useState<any>(null)
  const [balance, setBalance] = useState<any>(null)
  const [cashflow, setCashflow] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])

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

  useEffect(() => { loadReports() }, [startDate, endDate])

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">{t('reports.title')}</h1><p className="text-sm text-surface-500 mt-0.5">Real-time financial overview</p></div>
        <div className="flex items-center gap-2">
          <input type="date" className="input text-xs" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <span className="text-surface-400 text-xs">to</span>
          <input type="date" className="input text-xs" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
      </div>

      <div className="flex gap-1 mb-6 p-1 bg-surface-100 rounded-xl w-fit">
        {[{ id: 'pnl', label: 'Profit & Loss' }, { id: 'balance', label: 'Balance Sheet' }, { id: 'cashflow', label: 'Cash Flow' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
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
                  {pnl.revenue.accounts.map((a: any) => (
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
                  {pnl.expenses.accounts.map((a: any) => (
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
                  {(section.data?.accounts || []).map((a: any) => (
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
          <div className="grid grid-cols-3 gap-3">
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
                  <YAxis tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} tickFormatter={(v: any) => `$${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e4e7f0', fontSize: 12 }} formatter={(v: any) => [formatCurrency(v)]} />
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
                  <defs><linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6172f3" stopOpacity={0.2}/><stop offset="95%" stopColor="#6172f3" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} tickFormatter={(v: any) => `$${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v: any) => [formatCurrency(v), 'Net']} />
                  <Area type="monotone" dataKey="net" stroke="#6172f3" strokeWidth={2.5} fill="url(#netGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
