'use client'
import { DbRow } from '@/types'
import { useI18n } from '@/lib/i18n/context'
import { toast } from 'sonner'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, FileSignature, X, Clock, AlertTriangle, CheckCircle2, Calendar } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { getActiveWorkspace } from '@/lib/get-active-workspace'

const STATUS_STYLES: Record<string, string> = {
  draft: 'badge-gray', active: 'badge-green', expired: 'badge-red', cancelled: 'badge-gray', renewed: 'badge-blue',
}

interface ContractForm { title: string; contact_id: string; type: string; start_date: string; end_date: string; value: string; renewal_type: string; notes: string }

export default function ContractsPage() {
  const supabase = createClient()
  const { t } = useI18n()
  const [contracts, setContracts] = useState<DbRow[]>([])
  const [contacts, setContacts] = useState<DbRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [workspaceId, setWorkspaceId] = useState('')
  const [form, setForm] = useState<ContractForm>({ title: '', contact_id: '', type: '', start_date: '', end_date: '', value: '', renewal_type: 'manual', notes: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const ws = await getActiveWorkspace(supabase, user.id, 'id')
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)
    const [contractsRes, contactsRes] = await Promise.all([
      supabase.from('contracts').select('*, contacts(name)').eq('workspace_id', ws.id).order('created_at', { ascending: false }),
      supabase.from('contacts').select('id, name').eq('workspace_id', ws.id).order('name'),
    ])
    setContracts(contractsRes.data || [])
    setContacts(contactsRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const createContract = async () => {
    if (!form.title) return
    setSaving(true)
    const num = contracts.length + 1
    await supabase.from('contracts').insert({
      workspace_id: workspaceId, contract_number: `CTR-${String(num).padStart(4, '0')}`,
      title: form.title, contact_id: form.contact_id || null,
      type: form.type || null, start_date: form.start_date || null,
      end_date: form.end_date || null, value: parseFloat(form.value) || 0,
      renewal_type: form.renewal_type, notes: form.notes || null,
      status: 'draft',
    })
    setForm({ title: '', contact_id: '', type: '', start_date: '', end_date: '', value: '', renewal_type: 'manual', notes: '' })
    setShowNew(false); setSaving(false)
    toast.success('Contract created')
    load()
  }

  const now = new Date()
  const expiringCount = contracts.filter(c => {
    if (c.status !== 'active' || !c.end_date) return false
    const daysLeft = (new Date(c.end_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return daysLeft > 0 && daysLeft <= 30
  }).length
  const totalValue = contracts.filter(c => c.status === 'active').reduce((s: number, c) => s + ((c.value as number) || 0), 0)

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">{t('contracts.title')}</h1><p className="text-sm text-surface-500 mt-0.5">{contracts.length} contracts</p></div>
        <button onClick={() => setShowNew(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New Contract</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="card p-4 flex items-center gap-3"><div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></div><div><p className="text-lg font-bold">{contracts.filter(c => c.status === 'active').length}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Active</p></div></div>
        <div className="card p-4 flex items-center gap-3"><div className="w-9 h-9 bg-brand-50 rounded-xl flex items-center justify-center"><FileSignature className="w-4 h-4 text-brand-600" /></div><div><p className="text-lg font-bold">{formatCurrency(totalValue)}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Contract Value</p></div></div>
        {expiringCount > 0 && <div className="card p-4 flex items-center gap-3 border-amber-200"><div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center"><AlertTriangle className="w-4 h-4 text-amber-600" /></div><div><p className="text-lg font-bold text-amber-600">{expiringCount}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Expiring Soon</p></div></div>}
      </div>

      {contracts.length === 0 ? (
        <div className="card text-center py-16"><FileSignature className="w-10 h-10 text-surface-300 mx-auto mb-3" /><p className="text-surface-500">No contracts yet</p></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead><tr className="border-b border-surface-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Contract</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden md:table-cell">Client</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden lg:table-cell">Period</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Value</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Status</th>
            </tr></thead>
            <tbody>
              {contracts.map(c => {
                const daysLeft = c.end_date ? Math.floor((new Date(c.end_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null
                return (
                  <tr key={c.id} className="border-b border-surface-50 hover:bg-surface-50">
                    <td className="px-4 py-3"><p className="text-sm font-semibold text-surface-800">{c.title}</p><p className="text-[10px] text-surface-400 font-mono">{c.contract_number}{c.type ? ` · ${c.type}` : ''}</p></td>
                    <td className="px-4 py-3 text-sm text-surface-600 hidden md:table-cell">{c.contacts?.name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-surface-500 hidden lg:table-cell">
                      {c.start_date || '—'} → {c.end_date || '—'}
                      {daysLeft !== null && daysLeft > 0 && daysLeft <= 30 && <span className="text-amber-600 font-semibold ml-1">({daysLeft}d left)</span>}
                      {daysLeft !== null && daysLeft <= 0 && c.status === 'active' && <span className="text-red-600 font-semibold ml-1">(expired)</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold">{formatCurrency(c.value)}</td>
                    <td className="px-4 py-3"><span className={cn('badge text-[10px]', STATUS_STYLES[c.status])}>{c.status}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showNew && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-lg animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100">
              <h2 className="font-semibold text-surface-900">New Contract</h2>
              <button onClick={() => setShowNew(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="label">Title *</label><input className="input" value={form.title} onChange={e => setForm((f: ContractForm) => ({ ...f, title: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Client</label><select className="input" value={form.contact_id} onChange={e => setForm((f: ContractForm) => ({ ...f, contact_id: e.target.value }))}><option value="">Select</option>{contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div><label className="label">Type</label><input className="input" value={form.type} onChange={e => setForm((f: ContractForm) => ({ ...f, type: e.target.value }))} placeholder="e.g. SaaS, Service" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Start Date</label><input type="date" className="input" value={form.start_date} onChange={e => setForm((f: ContractForm) => ({ ...f, start_date: e.target.value }))} /></div>
                <div><label className="label">End Date</label><input type="date" className="input" value={form.end_date} onChange={e => setForm((f: ContractForm) => ({ ...f, end_date: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Value</label><input type="number" className="input" value={form.value} onChange={e => setForm((f: ContractForm) => ({ ...f, value: e.target.value }))} /></div>
                <div><label className="label">Renewal</label><select className="input" value={form.renewal_type} onChange={e => setForm((f: ContractForm) => ({ ...f, renewal_type: e.target.value }))}><option value="manual">Manual</option><option value="auto">Auto-renew</option><option value="notify">Notify before expiry</option></select></div>
              </div>
              <div><label className="label">Notes</label><textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm((f: ContractForm) => ({ ...f, notes: e.target.value }))} /></div>
              <div className="flex gap-2">
                <button onClick={() => setShowNew(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={createContract} disabled={!form.title || saving} className="btn-primary flex-1">Create</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
