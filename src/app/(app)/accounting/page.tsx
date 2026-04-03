'use client'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, BookOpen, TrendingUp, TrendingDown, DollarSign, FileText } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  asset: 'text-blue-600 bg-blue-50', liability: 'text-red-600 bg-red-50',
  equity: 'text-violet-600 bg-violet-50', revenue: 'text-emerald-600 bg-emerald-50',
  expense: 'text-amber-600 bg-amber-50',
}

export default function AccountingPage() {
  const supabase = createClient()
  const { t } = useI18n()
  const [accounts, setAccounts] = useState<any[]>([])
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview'|'accounts'|'journal'>('overview')
  const [showNewAccount, setShowNewAccount] = useState(false)
  const [showNewEntry, setShowNewEntry] = useState(false)
  const [workspaceId, setWorkspaceId] = useState('')

  // Forms
  const [accForm, setAccForm] = useState({ code: '', name: '', type: 'asset', subtype: '' })
  const [entryForm, setEntryForm] = useState<any>({ description: '', date: new Date().toISOString().split('T')[0], lines: [] })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)

    const [accRes, entRes] = await Promise.all([
      supabase.from('chart_of_accounts').select('*').eq('workspace_id', ws.id).order('code'),
      supabase.from('journal_entries').select('*, journal_lines(*, chart_of_accounts(code, name))').eq('workspace_id', ws.id).order('date', { ascending: false }).limit(50),
    ])
    setAccounts(accRes.data || [])
    setEntries(entRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const createAccount = async () => {
    if (!accForm.code || !accForm.name) return
    setSaving(true)
    await supabase.from('chart_of_accounts').insert({ workspace_id: workspaceId, ...accForm })
    setAccForm({ code: '', name: '', type: 'asset', subtype: '' })
    setShowNewAccount(false)
    setSaving(false)
    load()
  }

  const createEntry = async () => {
    const lines = entryForm.lines
    if (!lines.length) return
    const totalDebit = lines.reduce((s: number, l: any) => s + (parseFloat(l.debit) || 0), 0)
    const totalCredit = lines.reduce((s: number, l: any) => s + (parseFloat(l.credit) || 0), 0)
    if (Math.abs(totalDebit - totalCredit) > 0.01) { alert('Debits must equal credits'); return }

    setSaving(true)
    const num = entries.length + 1
    const { data: entry } = await supabase.from('journal_entries').insert({
      workspace_id: workspaceId, entry_number: `JE-${String(num).padStart(4, '0')}`,
      date: entryForm.date, description: entryForm.description || null,
      total_debit: totalDebit, total_credit: totalCredit, status: 'posted',
    }).select('id').single()

    if (entry) {
      await supabase.from('journal_lines').insert(
        lines.map((l: any, i: number) => ({
          journal_entry_id: entry.id, account_id: l.account_id,
          description: l.description || null,
          debit: parseFloat(l.debit) || 0, credit: parseFloat(l.credit) || 0, order_index: i,
        }))
      )
      // Update account balances
      for (const line of lines) {
        const acc = accounts.find(a => a.id === line.account_id)
        if (!acc) continue
        const delta = (parseFloat(line.debit) || 0) - (parseFloat(line.credit) || 0)
        const newBalance = ['asset', 'expense'].includes(acc.type) ? acc.balance + delta : acc.balance - delta
        await supabase.from('chart_of_accounts').update({ balance: newBalance }).eq('id', acc.id)
      }
    }
    setEntryForm({ description: '', date: new Date().toISOString().split('T')[0], lines: [] })
    setShowNewEntry(false)
    setSaving(false)
    load()
  }

  // Summaries
  const totalAssets = accounts.filter(a => a.type === 'asset').reduce((s, a) => s + (a.balance || 0), 0)
  const totalLiabilities = accounts.filter(a => a.type === 'liability').reduce((s, a) => s + (a.balance || 0), 0)
  const totalRevenue = accounts.filter(a => a.type === 'revenue').reduce((s, a) => s + (a.balance || 0), 0)
  const totalExpenses = accounts.filter(a => a.type === 'expense').reduce((s, a) => s + (a.balance || 0), 0)
  const netIncome = totalRevenue - totalExpenses

  const typeData = [
    { name: 'Assets', value: totalAssets, color: '#3b82f6' },
    { name: 'Liabilities', value: totalLiabilities, color: '#ef4444' },
    { name: 'Revenue', value: totalRevenue, color: '#10b981' },
    { name: 'Expenses', value: totalExpenses, color: '#f59e0b' },
  ]

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">{t('accounting.title')}</h1><p className="text-sm text-surface-500 mt-0.5">{accounts.length} accounts · {entries.length} entries</p></div>
        <div className="flex gap-2">
          <button onClick={() => setShowNewAccount(true)} className="btn-secondary btn-sm"><Plus className="w-3.5 h-3.5" /> Account</button>
          <button onClick={() => setShowNewEntry(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> Journal Entry</button>
        </div>
      </div>

      <div className="flex gap-1 mb-6 p-1 bg-surface-100 rounded-xl w-fit">
        {[{ id: 'overview', label: 'Overview' }, { id: 'accounts', label: 'Chart of Accounts' }, { id: 'journal', label: 'Journal' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all', tab === t.id ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500')}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            <div className="card p-4"><div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center mb-2"><TrendingUp className="w-4 h-4 text-blue-600" /></div><p className="text-lg font-bold">{formatCurrency(totalAssets)}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Assets</p></div>
            <div className="card p-4"><div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center mb-2"><TrendingDown className="w-4 h-4 text-red-600" /></div><p className="text-lg font-bold">{formatCurrency(totalLiabilities)}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Liabilities</p></div>
            <div className="card p-4"><div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center mb-2"><DollarSign className="w-4 h-4 text-emerald-600" /></div><p className="text-lg font-bold">{formatCurrency(totalRevenue)}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Revenue</p></div>
            <div className="card p-4"><div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center mb-2"><FileText className="w-4 h-4 text-amber-600" /></div><p className="text-lg font-bold">{formatCurrency(totalExpenses)}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Expenses</p></div>
            <div className={cn('card p-4', netIncome >= 0 ? 'border-emerald-200 bg-emerald-50/30' : 'border-red-200 bg-red-50/30')}><div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center mb-2"><span className="text-lg">{netIncome >= 0 ? '📈' : '📉'}</span></div><p className="text-lg font-bold">{formatCurrency(netIncome)}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Net Income</p></div>
          </div>
          {typeData.some(d => d.value > 0) && (
            <div className="card p-5">
              <h3 className="font-semibold text-surface-900 mb-4">Account Balances by Type</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={typeData} barSize={48}><CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} /><Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v: any) => [formatCurrency(v), 'Balance']} /><Bar dataKey="value" radius={[8,8,0,0]}>{typeData.map((e,i) => <rect key={i} fill={e.color} />)}</Bar></BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {tab === 'accounts' && (
        <div className="card overflow-hidden">
          {accounts.length === 0 ? (
            <div className="text-center py-16"><BookOpen className="w-10 h-10 text-surface-300 mx-auto mb-3" /><p className="text-surface-500">No accounts yet</p></div>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-surface-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Code</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Type</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Balance</th>
              </tr></thead>
              <tbody>
                {accounts.map(acc => (
                  <tr key={acc.id} className="border-b border-surface-50">
                    <td className="px-4 py-3 text-sm font-mono font-semibold text-surface-800">{acc.code}</td>
                    <td className="px-4 py-3 text-sm text-surface-700">{acc.name}</td>
                    <td className="px-4 py-3"><span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full capitalize', ACCOUNT_TYPE_COLORS[acc.type])}>{acc.type}</span></td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-surface-900">{formatCurrency(acc.balance || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'journal' && (
        <div className="space-y-3">
          {entries.length === 0 ? (
            <div className="card text-center py-16"><BookOpen className="w-10 h-10 text-surface-300 mx-auto mb-3" /><p className="text-surface-500">No journal entries yet</p></div>
          ) : entries.map(entry => (
            <div key={entry.id} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-sm font-mono font-bold text-surface-800">{entry.entry_number}</span>
                  <span className="text-xs text-surface-400 ml-2">{entry.date}</span>
                  {entry.description && <span className="text-xs text-surface-500 ml-2">— {entry.description}</span>}
                </div>
                <span className={cn('badge text-[10px]', entry.status === 'posted' ? 'badge-green' : 'badge-gray')}>{entry.status}</span>
              </div>
              <table className="w-full text-xs">
                <thead><tr className="text-surface-400"><th className="text-left py-1">Account</th><th className="text-right py-1">Debit</th><th className="text-right py-1">Credit</th></tr></thead>
                <tbody>
                  {(entry.journal_lines || []).map((line: any) => (
                    <tr key={line.id} className="border-t border-surface-50">
                      <td className="py-1.5 text-surface-700">{line.chart_of_accounts?.code} — {line.chart_of_accounts?.name}</td>
                      <td className="py-1.5 text-right font-semibold">{line.debit > 0 ? formatCurrency(line.debit) : ''}</td>
                      <td className="py-1.5 text-right font-semibold">{line.credit > 0 ? formatCurrency(line.credit) : ''}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="border-t-2 border-surface-200 font-bold">
                  <td className="py-1.5">Total</td>
                  <td className="py-1.5 text-right">{formatCurrency(entry.total_debit)}</td>
                  <td className="py-1.5 text-right">{formatCurrency(entry.total_credit)}</td>
                </tr></tfoot>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* New Account Modal */}
      {showNewAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100">
              <h2 className="font-semibold text-surface-900">New Account</h2>
              <button onClick={() => setShowNewAccount(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div><label className="label">Code *</label><input className="input" placeholder="1000" value={accForm.code} onChange={e => setAccForm(f => ({ ...f, code: e.target.value }))} /></div>
                <div className="col-span-2"><label className="label">Name *</label><input className="input" placeholder="Cash" value={accForm.name} onChange={e => setAccForm(f => ({ ...f, name: e.target.value }))} /></div>
              </div>
              <div><label className="label">Type</label>
                <select className="input" value={accForm.type} onChange={e => setAccForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="asset">Asset</option><option value="liability">Liability</option>
                  <option value="equity">Equity</option><option value="revenue">Revenue</option><option value="expense">Expense</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowNewAccount(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={createAccount} disabled={!accForm.code || !accForm.name || saving} className="btn-primary flex-1">Create</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Journal Entry Modal */}
      {showNewEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-2xl max-h-[85vh] flex flex-col animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100 flex-shrink-0">
              <h2 className="font-semibold text-surface-900">New Journal Entry</h2>
              <button onClick={() => setShowNewEntry(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Date</label><input type="date" className="input" value={entryForm.date} onChange={e => setEntryForm((f: any) => ({ ...f, date: e.target.value }))} /></div>
                <div><label className="label">Description</label><input className="input" value={entryForm.description} onChange={e => setEntryForm((f: any) => ({ ...f, description: e.target.value }))} /></div>
              </div>
              <div>
                <label className="label">Lines</label>
                {entryForm.lines.map((line: any, i: number) => (
                  <div key={i} className="flex gap-2 items-center mb-2">
                    <select className="input flex-1 text-xs" value={line.account_id} onChange={e => setEntryForm((f: any) => ({ ...f, lines: f.lines.map((l: any, idx: number) => idx === i ? { ...l, account_id: e.target.value } : l) }))}>
                      <option value="">Select account</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                    </select>
                    <input className="input w-24 text-xs text-right" type="number" placeholder="Debit" value={line.debit || ''} onChange={e => setEntryForm((f: any) => ({ ...f, lines: f.lines.map((l: any, idx: number) => idx === i ? { ...l, debit: e.target.value, credit: '' } : l) }))} />
                    <input className="input w-24 text-xs text-right" type="number" placeholder="Credit" value={line.credit || ''} onChange={e => setEntryForm((f: any) => ({ ...f, lines: f.lines.map((l: any, idx: number) => idx === i ? { ...l, credit: e.target.value, debit: '' } : l) }))} />
                    <button onClick={() => setEntryForm((f: any) => ({ ...f, lines: f.lines.filter((_: any, idx: number) => idx !== i) }))} className="text-surface-300 hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                ))}
                <button onClick={() => setEntryForm((f: any) => ({ ...f, lines: [...f.lines, { account_id: '', debit: '', credit: '', description: '' }] }))} className="btn-ghost btn-sm w-full border border-dashed border-surface-200"><Plus className="w-3.5 h-3.5" /> Add Line</button>
              </div>
              {entryForm.lines.length > 0 && (() => {
                const td = entryForm.lines.reduce((s: number, l: any) => s + (parseFloat(l.debit) || 0), 0)
                const tc = entryForm.lines.reduce((s: number, l: any) => s + (parseFloat(l.credit) || 0), 0)
                const balanced = Math.abs(td - tc) < 0.01
                return (
                  <div className={cn('p-3 rounded-xl text-sm font-semibold flex justify-between', balanced ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
                    <span>Debit: {formatCurrency(td)}</span>
                    <span>Credit: {formatCurrency(tc)}</span>
                    <span>{balanced ? 'Balanced' : 'Unbalanced!'}</span>
                  </div>
                )
              })()}
            </div>
            <div className="flex gap-2 p-5 border-t border-surface-100 flex-shrink-0">
              <button onClick={() => setShowNewEntry(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={createEntry} disabled={!entryForm.lines.length || saving} className="btn-primary flex-1">Post Entry</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
