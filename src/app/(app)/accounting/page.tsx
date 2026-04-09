'use client'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, BookOpen, TrendingUp, TrendingDown, DollarSign, FileText, Download, Filter, ChevronLeft, Ban } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { getActiveWorkspace } from '@/lib/get-active-workspace'

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  asset: 'text-blue-600 bg-blue-50', liability: 'text-red-600 bg-red-50',
  equity: 'text-violet-600 bg-violet-50', revenue: 'text-emerald-600 bg-emerald-50',
  expense: 'text-amber-600 bg-amber-50',
}

const STANDARD_CHART_OF_ACCOUNTS = [
  { code: '1000', name: 'Cash', type: 'asset', subtype: 'current' },
  { code: '1100', name: 'Accounts Receivable', type: 'asset', subtype: 'current' },
  { code: '1200', name: 'Inventory', type: 'asset', subtype: 'current' },
  { code: '1300', name: 'Prepaid Expenses', type: 'asset', subtype: 'current' },
  { code: '1500', name: 'Equipment', type: 'asset', subtype: 'fixed' },
  { code: '1510', name: 'Accumulated Depreciation', type: 'asset', subtype: 'fixed' },
  { code: '2000', name: 'Accounts Payable', type: 'liability', subtype: 'current' },
  { code: '2100', name: 'Accrued Liabilities', type: 'liability', subtype: 'current' },
  { code: '2200', name: 'Short-term Loans', type: 'liability', subtype: 'current' },
  { code: '2500', name: 'Long-term Debt', type: 'liability', subtype: 'long_term' },
  { code: '3000', name: 'Owner Equity', type: 'equity', subtype: '' },
  { code: '3100', name: 'Retained Earnings', type: 'equity', subtype: '' },
  { code: '4000', name: 'Sales Revenue', type: 'revenue', subtype: '' },
  { code: '4100', name: 'Service Revenue', type: 'revenue', subtype: '' },
  { code: '4200', name: 'Interest Income', type: 'revenue', subtype: '' },
  { code: '5000', name: 'Cost of Goods Sold', type: 'expense', subtype: '' },
  { code: '5100', name: 'Salaries Expense', type: 'expense', subtype: '' },
  { code: '5200', name: 'Rent Expense', type: 'expense', subtype: '' },
  { code: '5300', name: 'Utilities Expense', type: 'expense', subtype: '' },
  { code: '5400', name: 'Office Supplies', type: 'expense', subtype: '' },
  { code: '5500', name: 'Depreciation Expense', type: 'expense', subtype: '' },
  { code: '5600', name: 'Insurance Expense', type: 'expense', subtype: '' },
]

export default function AccountingPage() {
  const supabase = createClient()
  const { t } = useI18n()
  interface AcctRecord { id: string; code: string; name: string; type: string; subtype: string; balance: number; workspace_id: string; [key: string]: unknown }
  interface JournalLine { account_id: string; debit: string; credit: string; description: string }
  interface EntryForm { description: string; date: string; lines: JournalLine[] }
  const [accounts, setAccounts] = useState<AcctRecord[]>([])
  interface EntryRecord { id: string; entry_number: string; date: string; description: string; status: string; total_debit: number; total_credit: number; journal_lines: { debit: number; credit: number; description?: string; chart_of_accounts: { code: string; name: string } }[]; [key: string]: unknown }
  const [entries, setEntries] = useState<EntryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview'|'accounts'|'journal'|'trial_balance'>('overview')
  const [showNewAccount, setShowNewAccount] = useState(false)
  const [showNewEntry, setShowNewEntry] = useState(false)
  const [workspaceId, setWorkspaceId] = useState('')

  // Date range filter for journal entries
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Account type filter for accounts tab
  const [accountTypeFilter, setAccountTypeFilter] = useState<string>('all')

  // Selected entry detail / void
  const [selectedEntry, setSelectedEntry] = useState<EntryRecord | null>(null)
  const [voiding, setVoiding] = useState(false)

  // Selected account for transaction history
  const [selectedAccount, setSelectedAccount] = useState<AcctRecord | null>(null)
  const [accountLines, setAccountLines] = useState<{ date: string; entry_number: string; description: string; debit: number; credit: number }[]>([])
  const [loadingAccountLines, setLoadingAccountLines] = useState(false)

  // Forms
  const [accForm, setAccForm] = useState({ code: '', name: '', type: 'asset', subtype: '' })
  const [entryForm, setEntryForm] = useState<EntryForm>({ description: '', date: new Date().toISOString().split('T')[0], lines: [] })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const ws = await getActiveWorkspace(supabase, user.id, 'id')
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
    const totalDebit = lines.reduce((s: number, l: JournalLine) => s + (parseFloat(l.debit) || 0), 0)
    const totalCredit = lines.reduce((s: number, l: JournalLine) => s + (parseFloat(l.credit) || 0), 0)
    if (Math.abs(totalDebit - totalCredit) > 0.01) { toast.error('Debits must equal credits'); return }

    setSaving(true)
    const num = entries.length + 1
    const { data: entry } = await supabase.from('journal_entries').insert({
      workspace_id: workspaceId, entry_number: `JE-${String(num).padStart(4, '0')}`,
      date: entryForm.date, description: entryForm.description || null,
      total_debit: totalDebit, total_credit: totalCredit, status: 'posted',
    }).select('id').single()

    if (entry) {
      await supabase.from('journal_lines').insert(
        lines.map((l: JournalLine, i: number) => ({
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

  // Void a posted journal entry (create reversing entry)
  const voidEntry = async (entry: EntryRecord) => {
    if (entry.status !== 'posted') return
    setVoiding(true)
    try {
      // Mark the original entry as voided
      await supabase.from('journal_entries').update({ status: 'voided' }).eq('id', entry.id)

      // Create reversing entry
      const num = entries.length + 1
      const { data: reversing } = await supabase.from('journal_entries').insert({
        workspace_id: workspaceId,
        entry_number: `JE-${String(num).padStart(4, '0')}`,
        date: new Date().toISOString().split('T')[0],
        description: `Reversal of ${entry.entry_number}: ${entry.description || ''}`.trim(),
        total_debit: entry.total_credit,
        total_credit: entry.total_debit,
        status: 'posted',
      }).select('id').single()

      if (reversing && entry.journal_lines) {
        await supabase.from('journal_lines').insert(
          entry.journal_lines.map((l, i) => ({
            journal_entry_id: reversing.id,
            account_id: (l as Record<string, unknown>).account_id as string,
            description: `Reversal: ${l.description || ''}`.trim(),
            debit: l.credit,
            credit: l.debit,
            order_index: i,
          }))
        )
        // Reverse account balances
        for (const line of entry.journal_lines) {
          const accId = (line as Record<string, unknown>).account_id as string
          const acc = accounts.find(a => a.id === accId)
          if (!acc) continue
          const delta = line.credit - line.debit  // reversed
          const newBalance = ['asset', 'expense'].includes(acc.type) ? acc.balance + delta : acc.balance - delta
          await supabase.from('chart_of_accounts').update({ balance: newBalance }).eq('id', acc.id)
        }
      }
      toast.success('Entry voided and reversing entry created')
      setSelectedEntry(null)
      load()
    } catch {
      toast.error('Failed to void entry')
    }
    setVoiding(false)
  }

  // Load journal lines for a specific account
  const loadAccountLines = async (acc: AcctRecord) => {
    setSelectedAccount(acc)
    setLoadingAccountLines(true)
    const { data } = await supabase
      .from('journal_lines')
      .select('debit, credit, description, journal_entries(date, entry_number, description)')
      .eq('account_id', acc.id)
      .order('created_at', { ascending: false })
      .limit(30)
    const lines = (data || []).map((line: Record<string, unknown>) => {
      const je = line.journal_entries as Record<string, unknown> | null
      return {
        date: (je?.date as string) || '',
        entry_number: (je?.entry_number as string) || '',
        description: (line.description as string) || (je?.description as string) || '',
        debit: (line.debit as number) || 0,
        credit: (line.credit as number) || 0,
      }
    })
    setAccountLines(lines)
    setLoadingAccountLines(false)
  }

  // Import standard chart of accounts
  const importChartOfAccounts = async () => {
    if (!workspaceId) return
    setSaving(true)
    const existingCodes = new Set(accounts.map(a => a.code))
    const toInsert = STANDARD_CHART_OF_ACCOUNTS.filter(a => !existingCodes.has(a.code)).map(a => ({
      workspace_id: workspaceId,
      code: a.code,
      name: a.name,
      type: a.type,
      subtype: a.subtype,
      balance: 0,
    }))
    if (toInsert.length === 0) {
      toast.info('All standard accounts already exist')
      setSaving(false)
      return
    }
    const { error } = await supabase.from('chart_of_accounts').insert(toInsert)
    if (error) toast.error('Failed to import')
    else toast.success(`Imported ${toInsert.length} accounts`)
    setSaving(false)
    load()
  }

  // Filtered entries by date range
  const filteredEntries = entries.filter(entry => {
    if (dateFrom && entry.date < dateFrom) return false
    if (dateTo && entry.date > dateTo) return false
    return true
  })

  // Filtered accounts by type
  const filteredAccounts = accountTypeFilter === 'all' ? accounts : accounts.filter(a => a.type === accountTypeFilter)

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

  // Trial balance data
  const trialBalanceData = accounts.map(acc => {
    const entryLines = entries.flatMap(e => (e.journal_lines || []).filter((l: Record<string, unknown>) => (l as Record<string, unknown>).account_id === acc.id))
    const totalDebits = entryLines.reduce((s, l) => s + (l.debit || 0), 0)
    const totalCredits = entryLines.reduce((s, l) => s + (l.credit || 0), 0)
    return { ...acc, totalDebits, totalCredits, net: totalDebits - totalCredits }
  }).filter(a => a.totalDebits > 0 || a.totalCredits > 0 || a.balance !== 0)

  const tbTotalDebits = trialBalanceData.reduce((s, a) => s + a.totalDebits, 0)
  const tbTotalCredits = trialBalanceData.reduce((s, a) => s + a.totalCredits, 0)

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">{t('accounting.title')}</h1><p className="text-sm text-surface-500 mt-0.5">{accounts.length} accounts · {entries.length} entries</p></div>
        <div className="flex gap-2">
          <button onClick={importChartOfAccounts} disabled={saving} className="btn-secondary btn-sm"><Download className="w-3.5 h-3.5" /> Import CoA</button>
          <button onClick={() => setShowNewAccount(true)} className="btn-secondary btn-sm"><Plus className="w-3.5 h-3.5" /> Account</button>
          <button onClick={() => setShowNewEntry(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> Journal Entry</button>
        </div>
      </div>

      <div className="segmented-control mb-8">
        {[{ id: 'overview', label: 'Overview' }, { id: 'accounts', label: 'Chart of Accounts' }, { id: 'journal', label: 'Journal' }, { id: 'trial_balance', label: 'Trial Balance' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
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
                <BarChart data={typeData} barSize={48}><CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} /><Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v: number) => [formatCurrency(v), 'Balance']} /><Bar dataKey="value" radius={[8,8,0,0]}>{typeData.map((e,i) => <rect key={i} fill={e.color} />)}</Bar></BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {tab === 'accounts' && (
        <>
          {/* Account type filter */}
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-surface-400" />
            <select className="input w-48 text-sm" value={accountTypeFilter} onChange={e => { setAccountTypeFilter(e.target.value); setSelectedAccount(null) }}>
              <option value="all">All Types</option>
              <option value="asset">Asset</option>
              <option value="liability">Liability</option>
              <option value="equity">Equity</option>
              <option value="revenue">Revenue</option>
              <option value="expense">Expense</option>
            </select>
          </div>

          {selectedAccount ? (
            <div className="space-y-4">
              <button onClick={() => setSelectedAccount(null)} className="btn-ghost btn-sm text-sm flex items-center gap-1"><ChevronLeft className="w-3.5 h-3.5" /> Back to accounts</button>
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-surface-900">{selectedAccount.code} — {selectedAccount.name}</h3>
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full capitalize', ACCOUNT_TYPE_COLORS[selectedAccount.type])}>{selectedAccount.type}</span>
                    <span className="ml-2 text-sm font-bold text-surface-700">Balance: {formatCurrency(selectedAccount.balance || 0)}</span>
                  </div>
                </div>
                {loadingAccountLines ? (
                  <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>
                ) : accountLines.length === 0 ? (
                  <p className="text-sm text-surface-400 py-4 text-center">No transactions for this account</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-surface-100">
                      <th className="text-left py-2 text-xs font-semibold text-surface-500">Date</th>
                      <th className="text-left py-2 text-xs font-semibold text-surface-500">Entry</th>
                      <th className="text-left py-2 text-xs font-semibold text-surface-500">Description</th>
                      <th className="text-right py-2 text-xs font-semibold text-surface-500">Debit</th>
                      <th className="text-right py-2 text-xs font-semibold text-surface-500">Credit</th>
                    </tr></thead>
                    <tbody>
                      {accountLines.map((line, idx) => (
                        <tr key={idx} className="border-b border-surface-50">
                          <td className="py-2 text-surface-600">{line.date}</td>
                          <td className="py-2 font-mono text-surface-700">{line.entry_number}</td>
                          <td className="py-2 text-surface-600">{line.description || '—'}</td>
                          <td className="py-2 text-right font-semibold">{line.debit > 0 ? formatCurrency(line.debit) : ''}</td>
                          <td className="py-2 text-right font-semibold">{line.credit > 0 ? formatCurrency(line.credit) : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : (
            <div className="card overflow-hidden">
              {filteredAccounts.length === 0 ? (
                <div className="text-center py-16"><BookOpen className="w-10 h-10 text-surface-300 mx-auto mb-3" /><p className="text-surface-500">No accounts found</p></div>
              ) : (
                <table className="w-full">
                  <thead><tr className="border-b border-surface-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Code</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Type</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Balance</th>
                  </tr></thead>
                  <tbody>
                    {filteredAccounts.map(acc => (
                      <tr key={acc.id} className="border-b border-surface-50 hover:bg-surface-50 cursor-pointer" onClick={() => loadAccountLines(acc)}>
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
        </>
      )}

      {tab === 'journal' && (
        <div className="space-y-3">
          {/* Date range filter */}
          <div className="flex items-center gap-3 mb-2">
            <Filter className="w-4 h-4 text-surface-400" />
            <div className="flex items-center gap-2">
              <input type="date" className="input text-sm w-40" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="From" />
              <span className="text-xs text-surface-400">to</span>
              <input type="date" className="input text-sm w-40" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="To" />
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(''); setDateTo('') }} className="btn-ghost btn-sm text-xs">Clear</button>
              )}
            </div>
            <span className="text-xs text-surface-400 ml-auto">{filteredEntries.length} entries</span>
          </div>

          {filteredEntries.length === 0 ? (
            <div className="card text-center py-16"><BookOpen className="w-10 h-10 text-surface-300 mx-auto mb-3" /><p className="text-surface-500">No journal entries found</p></div>
          ) : filteredEntries.map(entry => (
            <div key={entry.id} className="card p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedEntry(entry)}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-sm font-mono font-bold text-surface-800">{entry.entry_number}</span>
                  <span className="text-xs text-surface-400 ml-2">{entry.date}</span>
                  {entry.description && <span className="text-xs text-surface-500 ml-2">— {entry.description}</span>}
                </div>
                <span className={cn('badge text-[10px]', entry.status === 'posted' ? 'badge-green' : entry.status === 'voided' ? 'badge-red' : 'badge-gray')}>{entry.status}</span>
              </div>
              <table className="w-full text-xs">
                <thead><tr className="text-surface-400"><th className="text-left py-1">Account</th><th className="text-right py-1">Debit</th><th className="text-right py-1">Credit</th></tr></thead>
                <tbody>
                  {(entry.journal_lines || []).map((line, idx) => (
                    <tr key={idx} className="border-t border-surface-50">
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

      {tab === 'trial_balance' && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-surface-100">
            <h3 className="font-semibold text-surface-900">Trial Balance</h3>
            <p className="text-xs text-surface-400">All accounts with debit/credit totals from journal entries</p>
          </div>
          {trialBalanceData.length === 0 ? (
            <div className="text-center py-16"><BookOpen className="w-10 h-10 text-surface-300 mx-auto mb-3" /><p className="text-surface-500">No entries to show</p></div>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-surface-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Code</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Account</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Type</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Total Debits</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Total Credits</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Net</th>
              </tr></thead>
              <tbody>
                {trialBalanceData.map(acc => (
                  <tr key={acc.id} className="border-b border-surface-50">
                    <td className="px-4 py-3 text-sm font-mono font-semibold text-surface-800">{acc.code}</td>
                    <td className="px-4 py-3 text-sm text-surface-700">{acc.name}</td>
                    <td className="px-4 py-3"><span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full capitalize', ACCOUNT_TYPE_COLORS[acc.type])}>{acc.type}</span></td>
                    <td className="px-4 py-3 text-right text-sm font-semibold">{formatCurrency(acc.totalDebits)}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold">{formatCurrency(acc.totalCredits)}</td>
                    <td className={cn('px-4 py-3 text-right text-sm font-bold', acc.net > 0 ? 'text-blue-600' : acc.net < 0 ? 'text-red-600' : 'text-surface-500')}>{formatCurrency(acc.net)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-surface-200 font-bold">
                  <td colSpan={3} className="px-4 py-3 text-sm">Totals</td>
                  <td className="px-4 py-3 text-right text-sm">{formatCurrency(tbTotalDebits)}</td>
                  <td className="px-4 py-3 text-right text-sm">{formatCurrency(tbTotalCredits)}</td>
                  <td className={cn('px-4 py-3 text-right text-sm', Math.abs(tbTotalDebits - tbTotalCredits) < 0.01 ? 'text-emerald-600' : 'text-red-600')}>
                    {Math.abs(tbTotalDebits - tbTotalCredits) < 0.01 ? 'Balanced' : formatCurrency(tbTotalDebits - tbTotalCredits)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      {/* Entry Detail / Void Modal */}
      {selectedEntry && (
        <div className="modal-overlay" onClick={() => setSelectedEntry(null)}>
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-surface-100">
              <div>
                <h2 className="font-semibold text-surface-900">{selectedEntry.entry_number}</h2>
                <p className="text-xs text-surface-400">{selectedEntry.date} {selectedEntry.description && `— ${selectedEntry.description}`}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn('badge text-[10px]', selectedEntry.status === 'posted' ? 'badge-green' : selectedEntry.status === 'voided' ? 'badge-red' : 'badge-gray')}>{selectedEntry.status}</span>
                <button onClick={() => setSelectedEntry(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
              </div>
            </div>
            <div className="p-5">
              <table className="w-full text-sm mb-4">
                <thead><tr className="border-b border-surface-100 text-surface-400 text-xs">
                  <th className="text-left py-2">Account</th><th className="text-right py-2">Debit</th><th className="text-right py-2">Credit</th>
                </tr></thead>
                <tbody>
                  {(selectedEntry.journal_lines || []).map((line, idx) => (
                    <tr key={idx} className="border-b border-surface-50">
                      <td className="py-2 text-surface-700">{line.chart_of_accounts?.code} — {line.chart_of_accounts?.name}</td>
                      <td className="py-2 text-right font-semibold">{line.debit > 0 ? formatCurrency(line.debit) : ''}</td>
                      <td className="py-2 text-right font-semibold">{line.credit > 0 ? formatCurrency(line.credit) : ''}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="border-t-2 border-surface-200 font-bold">
                  <td className="py-2">Total</td>
                  <td className="py-2 text-right">{formatCurrency(selectedEntry.total_debit)}</td>
                  <td className="py-2 text-right">{formatCurrency(selectedEntry.total_credit)}</td>
                </tr></tfoot>
              </table>
              {selectedEntry.status === 'posted' && (
                <button onClick={() => voidEntry(selectedEntry)} disabled={voiding} className="btn-sm bg-red-600 text-white rounded-lg px-4 py-2 flex items-center gap-2 hover:bg-red-700 disabled:opacity-50">
                  <Ban className="w-3.5 h-3.5" /> {voiding ? 'Voiding...' : 'Void Entry'}
                </button>
              )}
              {selectedEntry.status === 'voided' && (
                <p className="text-sm text-red-500 font-medium">This entry has been voided.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Account Modal */}
      {showNewAccount && (
        <div className="modal-overlay">
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
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-2xl max-h-[85vh] flex flex-col animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100 flex-shrink-0">
              <h2 className="font-semibold text-surface-900">New Journal Entry</h2>
              <button onClick={() => setShowNewEntry(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Date</label><input type="date" className="input" value={entryForm.date} onChange={e => setEntryForm((f) => ({ ...f, date: e.target.value }))} /></div>
                <div><label className="label">Description</label><input className="input" value={entryForm.description} onChange={e => setEntryForm((f) => ({ ...f, description: e.target.value }))} /></div>
              </div>
              <div>
                <label className="label">Lines</label>
                {entryForm.lines.map((line: JournalLine, i: number) => (
                  <div key={i} className="flex gap-2 items-center mb-2">
                    <select className="input flex-1 text-xs" value={line.account_id} onChange={e => setEntryForm((f) => ({ ...f, lines: f.lines.map((l: JournalLine, idx: number) => idx === i ? { ...l, account_id: e.target.value } : l) }))}>
                      <option value="">Select account</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                    </select>
                    <input className="input w-24 text-xs text-right" type="number" placeholder="Debit" value={line.debit || ''} onChange={e => setEntryForm((f) => ({ ...f, lines: f.lines.map((l: JournalLine, idx: number) => idx === i ? { ...l, debit: e.target.value, credit: '' } : l) }))} />
                    <input className="input w-24 text-xs text-right" type="number" placeholder="Credit" value={line.credit || ''} onChange={e => setEntryForm((f) => ({ ...f, lines: f.lines.map((l: JournalLine, idx: number) => idx === i ? { ...l, credit: e.target.value, debit: '' } : l) }))} />
                    <button onClick={() => setEntryForm((f) => ({ ...f, lines: f.lines.filter((_: JournalLine, idx: number) => idx !== i) }))} className="text-surface-300 hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                ))}
                <button onClick={() => setEntryForm((f) => ({ ...f, lines: [...f.lines, { account_id: '', debit: '', credit: '', description: '' }] }))} className="btn-ghost btn-sm w-full border border-dashed border-surface-200"><Plus className="w-3.5 h-3.5" /> Add Line</button>
              </div>
              {entryForm.lines.length > 0 && (() => {
                const td = entryForm.lines.reduce((s: number, l: JournalLine) => s + (parseFloat(l.debit) || 0), 0)
                const tc = entryForm.lines.reduce((s: number, l: JournalLine) => s + (parseFloat(l.credit) || 0), 0)
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
