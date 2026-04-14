'use client'
import { DbRow } from '@/types'
import { useI18n } from '@/lib/i18n/context'
import { toast } from 'sonner'
import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Receipt, X, CheckCircle2, XCircle, Clock, Upload, DollarSign, Download, Filter, BarChart3, TrendingUp, TrendingDown } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { getActiveWorkspace } from '@/lib/get-active-workspace'
import { MobileList, MobileListCard, DesktopOnly } from '@/components/shared/MobileListCard'
import BulkActions from '@/components/shared/BulkActions'

const CATEGORIES = ['Travel', 'Meals', 'Office Supplies', 'Software', 'Transportation', 'Lodging', 'Training', 'Marketing', 'Utilities', 'Other']

const CATEGORY_COLORS: Record<string, string> = {
  Travel: '#3b82f6', Meals: '#f59e0b', 'Office Supplies': '#10b981', Software: '#8b5cf6',
  Transportation: '#ec4899', Lodging: '#06b6d4', Training: '#f97316', Marketing: '#14b8a6',
  Utilities: '#6366f1', Other: '#9ca3af',
}

export default function ExpensesPage() {
  const supabase = createClient()
  const { t } = useI18n()
  interface ExpenseItem { description: string; amount: string; date: string; category: string; receipt_url?: string }
  const [reports, setReports] = useState<DbRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [workspaceId, setWorkspaceId] = useState('')
  const [title, setTitle] = useState('')
  const [items, setItems] = useState<ExpenseItem[]>([])
  const [saving, setSaving] = useState(false)

  // Date range filter
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Show category summary
  const [showCategorySummary, setShowCategorySummary] = useState(false)

  // Receipt upload refs
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({})
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const bulkApprove = async () => {
    if (selected.size === 0) return
    const ids = Array.from(selected)
    await supabase.from('expense_reports').update({ status: 'approved', reviewed_at: new Date().toISOString() }).in('id', ids)
    toast.success(`${ids.length} report(s) approved`)
    setSelected(new Set())
    load()
  }

  const bulkDeleteReports = async () => {
    if (selected.size === 0) return
    if (!confirm(`Delete ${selected.size} report(s)?`)) return
    const ids = Array.from(selected)
    await supabase.from('expense_reports').delete().in('id', ids)
    toast.success(`${ids.length} report(s) deleted`)
    setSelected(new Set())
    load()
  }

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const ws = await getActiveWorkspace(supabase, user.id, 'id')
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)

    const { data } = await supabase.from('expense_reports')
      .select('*, employees(first_name, last_name)')
      .eq('workspace_id', ws.id)
      .order('created_at', { ascending: false })
    setReports(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const addItem = () => setItems(prev => [...prev, { date: new Date().toISOString().split('T')[0], category: 'Other', description: '', amount: '' }])

  const createReport = async () => {
    if (!title || !items.length) return
    setSaving(true)
    const total = items.reduce((s: number, i: ExpenseItem) => s + (parseFloat(i.amount) || 0), 0)
    const count = reports.length + 1

    const { data: report } = await supabase.from('expense_reports').insert({
      workspace_id: workspaceId,
      report_number: `EXP-${String(count).padStart(4, '0')}`,
      title, total, status: 'submitted',
      submitted_at: new Date().toISOString(),
    }).select('id').single()

    if (report) {
      await supabase.from('expense_items').insert(
        items.map((item: ExpenseItem, i: number) => ({
          report_id: report.id, date: item.date, category: item.category,
          description: item.description, amount: parseFloat(item.amount) || 0, order_index: i,
          receipt_url: item.receipt_url || null,
        }))
      )
    }

    setTitle(''); setItems([]); setShowNew(false); setSaving(false)
    load()
  }

  // Approve / Reject expense report
  const updateReportStatus = async (id: string, status: string) => {
    await supabase.from('expense_reports').update({ status, reviewed_at: new Date().toISOString() }).eq('id', id)
    toast.success(`Report ${status}`)
    load()
  }

  // Receipt upload
  const handleReceiptUpload = async (index: number, file: File) => {
    setUploadingIndex(index)
    try {
      const ext = file.name.split('.').pop()
      const path = `receipts/${workspaceId}/${Date.now()}_${index}.${ext}`
      const { error } = await supabase.storage.from('receipts').upload(path, file)
      if (error) { toast.error('Upload failed'); setUploadingIndex(null); return }
      const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(path)
      setItems(prev => prev.map((it, idx) => idx === index ? { ...it, receipt_url: urlData.publicUrl } : it))
      toast.success('Receipt uploaded')
    } catch {
      toast.error('Upload failed')
    }
    setUploadingIndex(null)
  }

  // Export expenses as CSV
  const exportCSV = () => {
    const rows = [['Report Number', 'Title', 'Employee', 'Total', 'Status', 'Date']]
    for (const r of filteredReports) {
      rows.push([
        r.report_number || '',
        r.title || '',
        r.employees ? `${r.employees.first_name} ${r.employees.last_name}` : '',
        String(r.total || 0),
        r.status || '',
        r.created_at ? new Date(r.created_at).toLocaleDateString() : '',
      ])
    }
    const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `expenses_${new Date().toISOString().split('T')[0]}.csv`
    a.click(); URL.revokeObjectURL(url)
    toast.success('Exported CSV')
  }

  const STATUS_STYLES: Record<string, string> = {
    draft: 'badge-gray', submitted: 'badge-blue', approved: 'badge-green', rejected: 'badge-red', reimbursed: 'badge-green',
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  // Date filtered reports
  const filteredReports = reports.filter(r => {
    const rd = r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : ''
    if (dateFrom && rd < dateFrom) return false
    if (dateTo && rd > dateTo) return false
    return true
  })

  const totalPending = filteredReports.filter(r => r.status === 'submitted').reduce((s: number, r: DbRow) => s + (r.total || 0), 0)
  const totalApproved = filteredReports.filter(r => r.status === 'approved').reduce((s: number, r: DbRow) => s + (r.total || 0), 0)

  // Monthly comparison
  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]

  const thisMonthTotal = reports.filter(r => {
    const rd = r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : ''
    return rd >= thisMonthStart
  }).reduce((s: number, r: DbRow) => s + (r.total || 0), 0)

  const lastMonthTotal = reports.filter(r => {
    const rd = r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : ''
    return rd >= lastMonthStart && rd <= lastMonthEnd
  }).reduce((s: number, r: DbRow) => s + (r.total || 0), 0)

  const monthDiff = lastMonthTotal > 0 ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal * 100) : 0

  // Category summary data
  const categoryTotals: Record<string, number> = {}
  for (const r of filteredReports) {
    // Approximate: use report total distributed; in real app we'd query expense_items
    // We use title or just bucket all into Other since items aren't loaded per report
    categoryTotals['All'] = (categoryTotals['All'] || 0) + (r.total || 0)
  }
  // For better category breakdown, check if we have items loaded in any expanded state
  // For now we show a simplified chart per status
  const statusChartData = [
    { name: 'Pending', value: totalPending, color: '#3b82f6' },
    { name: 'Approved', value: totalApproved, color: '#10b981' },
    { name: 'Rejected', value: filteredReports.filter(r => r.status === 'rejected').reduce((s: number, r: DbRow) => s + (r.total || 0), 0), color: '#ef4444' },
  ].filter(d => d.value > 0)

  return (
    <div className="animate-fade-in">
      <div className="page-header flex-col md:flex-row gap-3 md:gap-0">
        <div><h1 className="page-title">{t('nav.expenses')}</h1><p className="text-sm text-surface-500 mt-0.5">{reports.length} reports</p></div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportCSV} className="btn-secondary btn-sm"><Download className="w-3.5 h-3.5" /> Export CSV</button>
          <button onClick={() => setShowCategorySummary(!showCategorySummary)} className="btn-secondary btn-sm"><BarChart3 className="w-3.5 h-3.5" /> {showCategorySummary ? 'Hide' : 'Show'} Chart</button>
          <button onClick={() => setShowNew(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New Report</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center"><Clock className="w-4 h-4 text-blue-600" /></div>
          <div><p className="text-lg font-bold">{formatCurrency(totalPending)}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Pending</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></div>
          <div><p className="text-lg font-bold">{formatCurrency(totalApproved)}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Approved</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-50 rounded-xl flex items-center justify-center"><Receipt className="w-4 h-4 text-brand-600" /></div>
          <div><p className="text-lg font-bold">{filteredReports.length}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Total</p></div>
        </div>
        {/* Monthly comparison card */}
        <div className="card p-4 flex items-center gap-3">
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', monthDiff <= 0 ? 'bg-emerald-50' : 'bg-amber-50')}>
            {monthDiff <= 0 ? <TrendingDown className="w-4 h-4 text-emerald-600" /> : <TrendingUp className="w-4 h-4 text-amber-600" />}
          </div>
          <div>
            <p className="text-lg font-bold">{formatCurrency(thisMonthTotal)}</p>
            <p className="text-[10px] text-surface-500 font-semibold uppercase">
              This month {lastMonthTotal > 0 && <span className={cn(monthDiff <= 0 ? 'text-emerald-600' : 'text-red-500')}>({monthDiff > 0 ? '+' : ''}{monthDiff.toFixed(0)}%)</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Category / Status summary chart */}
      {showCategorySummary && statusChartData.length > 0 && (
        <div className="card p-5 mb-6 overflow-x-auto">
          <h3 className="font-semibold text-surface-900 mb-4">Expenses by Status</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={statusChartData} barSize={48}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v: number) => [formatCurrency(v), 'Amount']} />
              <Bar dataKey="value" radius={[8,8,0,0]}>
                {statusChartData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Date range filter */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Filter className="w-4 h-4 text-surface-400" />
        <input type="date" className="input text-sm w-40" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span className="text-xs text-surface-400">to</span>
        <input type="date" className="input text-sm w-40" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo('') }} className="btn-ghost btn-sm text-xs">Clear</button>
        )}
      </div>

      {filteredReports.length === 0 ? (
        <div className="card text-center py-16"><Receipt className="w-10 h-10 text-surface-300 mx-auto mb-3" /><p className="text-surface-500">No expense reports found</p></div>
      ) : (
        <><DesktopOnly><div className="card overflow-hidden">
          <table className="w-full">
            <thead><tr className="border-b border-surface-100">
              <th className="px-4 py-3 w-8"></th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Report</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden md:table-cell">Employee</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Amount</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden lg:table-cell">Date</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Actions</th>
            </tr></thead>
            <tbody>
              {filteredReports.map(r => (
                <tr key={r.id} className={cn('border-b border-surface-50 hover:bg-surface-50', selected.has(r.id) && 'bg-brand-50')}>
                  <td className="px-4 py-3"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} className="rounded border-surface-300" /></td>
                  <td className="px-4 py-3"><p className="text-sm font-semibold text-surface-800">{r.title}</p><p className="text-[10px] text-surface-400 font-mono">{r.report_number}</p></td>
                  <td className="px-4 py-3 text-sm text-surface-600 hidden md:table-cell">{r.employees ? `${r.employees.first_name} ${r.employees.last_name}` : '—'}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-surface-900">{formatCurrency(r.total)}</td>
                  <td className="px-4 py-3"><span className={cn('badge text-[10px]', STATUS_STYLES[r.status])}>{r.status}</span></td>
                  <td className="px-4 py-3 text-xs text-surface-500 hidden lg:table-cell">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    {r.status === 'submitted' && (
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => updateReportStatus(r.id, 'approved')} className="btn-sm bg-emerald-600 text-white text-[10px] rounded-lg px-2 py-1 hover:bg-emerald-700" title="Approve"><CheckCircle2 className="w-3 h-3" /></button>
                        <button onClick={() => updateReportStatus(r.id, 'rejected')} className="btn-sm bg-red-600 text-white text-[10px] rounded-lg px-2 py-1 hover:bg-red-700" title="Reject"><XCircle className="w-3 h-3" /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></DesktopOnly>
        <MobileList>
          {filteredReports.map(r => (
            <MobileListCard
              key={r.id}
              title={r.title}
              subtitle={<span className="font-mono">{r.report_number}</span>}
              badge={<span className={cn('badge text-[10px]', STATUS_STYLES[r.status])}>{r.status}</span>}
              meta={<>
                <span>{r.employees ? `${r.employees.first_name} ${r.employees.last_name}` : '—'}</span>
                <span>{r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}</span>
              </>}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-surface-900">{formatCurrency(r.total)}</span>
                {r.status === 'submitted' && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateReportStatus(r.id, 'approved')} className="bg-emerald-600 text-white text-[10px] rounded-lg px-2 py-1"><CheckCircle2 className="w-3 h-3" /></button>
                    <button onClick={() => updateReportStatus(r.id, 'rejected')} className="bg-red-600 text-white text-[10px] rounded-lg px-2 py-1"><XCircle className="w-3 h-3" /></button>
                  </div>
                )}
              </div>
            </MobileListCard>
          ))}
        </MobileList></>
      )}

      <BulkActions count={selected.size} onClear={() => setSelected(new Set())} onDelete={bulkDeleteReports}>
        <button onClick={bulkApprove} className="flex items-center gap-1.5 text-xs font-medium text-emerald-300 hover:text-emerald-200 transition-colors px-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
        </button>
      </BulkActions>

      {showNew && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-2xl max-h-[85vh] flex flex-col animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100 flex-shrink-0">
              <h2 className="font-semibold text-surface-900">New Expense Report</h2>
              <button onClick={() => setShowNew(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div><label className="label">Title</label><input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Q1 Travel Expenses" /></div>
              <div>
                <label className="label">Items</label>
                {items.map((item: ExpenseItem, i: number) => (
                  <div key={i} className="flex gap-2 items-center mb-2 flex-wrap">
                    <input type="date" className="input w-32 text-xs" value={item.date} onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, date: e.target.value } : it))} />
                    <select className="input w-32 text-xs" value={item.category} onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, category: e.target.value } : it))}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input className="input flex-1 text-xs" placeholder="Description" value={item.description} onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, description: e.target.value } : it))} />
                    <input className="input w-24 text-xs text-right" type="number" placeholder="Amount" value={item.amount} onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, amount: e.target.value } : it))} />
                    {/* Receipt upload */}
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      ref={el => { fileInputRefs.current[i] = el }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleReceiptUpload(i, f) }}
                    />
                    <button
                      onClick={() => fileInputRefs.current[i]?.click()}
                      disabled={uploadingIndex === i}
                      className={cn('btn-ghost btn-sm text-[10px] px-1.5', item.receipt_url ? 'text-emerald-600' : 'text-surface-400')}
                      title={item.receipt_url ? 'Receipt attached' : 'Upload receipt'}
                    >
                      <Upload className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))} className="text-surface-300 hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                ))}
                <button onClick={addItem} className="btn-ghost btn-sm w-full border border-dashed border-surface-200"><Plus className="w-3.5 h-3.5" /> Add Expense</button>
              </div>
              {items.length > 0 && (
                <div className="flex justify-end text-sm font-bold text-brand-600">
                  Total: {formatCurrency(items.reduce((s: number, i: ExpenseItem) => s + (parseFloat(i.amount) || 0), 0))}
                </div>
              )}
            </div>
            <div className="flex gap-2 p-5 border-t border-surface-100 flex-shrink-0">
              <button onClick={() => setShowNew(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={createReport} disabled={!title || !items.length || saving} className="btn-primary flex-1">Submit Report</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
