'use client'
import { DbRow } from '@/types'
import { useI18n } from '@/lib/i18n/context'
import { toast } from 'sonner'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Receipt, X, CheckCircle2, XCircle, Clock, Upload, DollarSign } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { getActiveWorkspace } from '@/lib/get-active-workspace'

const CATEGORIES = ['Travel', 'Meals', 'Office Supplies', 'Software', 'Transportation', 'Lodging', 'Training', 'Marketing', 'Utilities', 'Other']

export default function ExpensesPage() {
  const supabase = createClient()
  const { t } = useI18n()
  interface ExpenseItem { description: string; amount: string; date: string; category: string }
  const [reports, setReports] = useState<DbRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [workspaceId, setWorkspaceId] = useState('')
  const [title, setTitle] = useState('')
  const [items, setItems] = useState<ExpenseItem[]>([])
  const [saving, setSaving] = useState(false)

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
        }))
      )
    }

    setTitle(''); setItems([]); setShowNew(false); setSaving(false)
    load()
  }

  const STATUS_STYLES: Record<string, string> = {
    draft: 'badge-gray', submitted: 'badge-blue', approved: 'badge-green', rejected: 'badge-red', reimbursed: 'badge-green',
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  const totalPending = reports.filter(r => r.status === 'submitted').reduce((s: number, r: DbRow) => s + (r.total || 0), 0)
  const totalApproved = reports.filter(r => r.status === 'approved').reduce((s: number, r: DbRow) => s + (r.total || 0), 0)

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">{t('nav.expenses')}</h1><p className="text-sm text-surface-500 mt-0.5">{reports.length} reports</p></div>
        <button onClick={() => setShowNew(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New Report</button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
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
          <div><p className="text-lg font-bold">{reports.length}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Total</p></div>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="card text-center py-16"><Receipt className="w-10 h-10 text-surface-300 mx-auto mb-3" /><p className="text-surface-500">No expense reports yet</p></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead><tr className="border-b border-surface-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Report</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden md:table-cell">Employee</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Amount</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden lg:table-cell">Date</th>
            </tr></thead>
            <tbody>
              {reports.map(r => (
                <tr key={r.id} className="border-b border-surface-50 hover:bg-surface-50">
                  <td className="px-4 py-3"><p className="text-sm font-semibold text-surface-800">{r.title}</p><p className="text-[10px] text-surface-400 font-mono">{r.report_number}</p></td>
                  <td className="px-4 py-3 text-sm text-surface-600 hidden md:table-cell">{r.employees ? `${r.employees.first_name} ${r.employees.last_name}` : '—'}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-surface-900">{formatCurrency(r.total)}</td>
                  <td className="px-4 py-3"><span className={cn('badge text-[10px]', STATUS_STYLES[r.status])}>{r.status}</span></td>
                  <td className="px-4 py-3 text-xs text-surface-500 hidden lg:table-cell">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
                  <div key={i} className="flex gap-2 items-center mb-2">
                    <input type="date" className="input w-32 text-xs" value={item.date} onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, date: e.target.value } : it))} />
                    <select className="input w-32 text-xs" value={item.category} onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, category: e.target.value } : it))}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input className="input flex-1 text-xs" placeholder="Description" value={item.description} onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, description: e.target.value } : it))} />
                    <input className="input w-24 text-xs text-right" type="number" placeholder="Amount" value={item.amount} onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, amount: e.target.value } : it))} />
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
