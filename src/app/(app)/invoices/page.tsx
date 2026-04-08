'use client'
import { useI18n } from '@/lib/i18n/context'
import { toast } from 'sonner'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, FileText, Send, DollarSign, CheckCircle2, X, Clock, AlertTriangle, Download } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'

interface Invoice {
  id: string; invoice_number: string; type: string; status: string
  contact_id: string | null; total: number; amount_paid: number; balance_due: number
  issue_date: string; due_date: string | null; currency: string
  contacts?: { name: string } | null; created_at: string
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'badge-gray', sent: 'badge-blue', paid: 'badge-green',
  partial: 'badge-yellow', overdue: 'badge-red', cancelled: 'badge-gray',
}

export default function InvoicesPage() {
  const supabase = createClient()
  const { t } = useI18n()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([])
  const [products, setProducts] = useState<{ id: string; name: string; unit_price: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showNew, setShowNew] = useState(false)
  const [workspaceId, setWorkspaceId] = useState('')

  // Form
  interface InvoiceItem { description: string; quantity: number; unit_price: number; product_id: string | null }
  interface InvoiceForm { contact_id: string; due_date: string; notes: string; items: InvoiceItem[] }
  const [form, setForm] = useState<InvoiceForm>({ contact_id: '', due_date: '', notes: '', items: [] })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)

    const [invRes, conRes, prodRes] = await Promise.all([
      supabase.from('invoices').select('*, contacts(name)').eq('workspace_id', ws.id).order('created_at', { ascending: false }),
      supabase.from('contacts').select('id, name').eq('workspace_id', ws.id).order('name'),
      supabase.from('products').select('id, name, unit_price').eq('workspace_id', ws.id).eq('status', 'active').order('name'),
    ])
    setInvoices(invRes.data || [])
    setContacts(conRes.data || [])
    setProducts(prodRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, { description: '', quantity: 1, unit_price: 0, product_id: null }] }))
  const addFromProduct = (p: { id: string; name: string; unit_price: number }) => setForm((f) => ({ ...f, items: [...f.items, { description: p.name, quantity: 1, unit_price: p.unit_price, product_id: p.id }] }))
  const updateItem = (i: number, field: string, val: string | number) => setForm((f) => ({ ...f, items: f.items.map((item, idx: number) => idx === i ? { ...item, [field]: val } : item) }))
  const removeItem = (i: number) => setForm((f) => ({ ...f, items: f.items.filter((_, idx: number) => idx !== i) }))

  const subtotal = form.items.reduce((s: number, i) => s + (i.quantity * i.unit_price), 0)
  const taxAmount = subtotal * 0 // configurable later
  const total = subtotal + taxAmount

  const createInvoice = async () => {
    if (!form.items.length) return
    setSaving(true)
    const count = invoices.length + 1
    const { data: inv } = await supabase.from('invoices').insert({
      workspace_id: workspaceId,
      invoice_number: `INV-${String(count).padStart(4, '0')}`,
      contact_id: form.contact_id || null,
      subtotal, tax_amount: taxAmount, total, balance_due: total,
      due_date: form.due_date || null,
      notes: form.notes || null,
      status: 'draft',
    }).select('id').single()

    if (inv) {
      await supabase.from('invoice_items').insert(
        form.items.map((item: InvoiceItem, i: number) => ({
          invoice_id: inv.id, product_id: item.product_id || null,
          description: item.description, quantity: item.quantity,
          unit_price: item.unit_price, total: item.quantity * item.unit_price, order_index: i,
        }))
      )
    }
    setForm({ contact_id: '', due_date: '', notes: '', items: [] })
    setShowNew(false)
    setSaving(false)
    toast.success('Invoice created')
    load()
  }

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('invoices').update({ status, ...(status === 'sent' ? { issue_date: new Date().toISOString().split('T')[0] } : {}) }).eq('id', id)
    load()
  }

  const filtered = invoices.filter(inv => {
    if (search && !inv.invoice_number.toLowerCase().includes(search.toLowerCase()) && !(inv as { contacts?: { name?: string } }).contacts?.name?.toLowerCase().includes(search.toLowerCase())) return false
    if (filterStatus !== 'all' && inv.status !== filterStatus) return false
    return true
  })

  const totalOutstanding = invoices.filter(i => ['sent','partial','overdue'].includes(i.status)).reduce((s, i) => s + i.balance_due, 0)
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0)

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('invoices.title')}</h1>
          <p className="text-sm text-surface-500 mt-0.5">{invoices.length} total · {formatCurrency(totalOutstanding)} outstanding</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New Invoice</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-50 rounded-xl flex items-center justify-center"><FileText className="w-4 h-4 text-brand-600" /></div>
          <div><p className="text-lg font-bold text-surface-900">{invoices.length}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Total</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center"><Clock className="w-4 h-4 text-amber-600" /></div>
          <div><p className="text-lg font-bold text-surface-900">{formatCurrency(totalOutstanding)}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Outstanding</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></div>
          <div><p className="text-lg font-bold text-surface-900">{formatCurrency(totalPaid)}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Collected</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center"><AlertTriangle className="w-4 h-4 text-red-600" /></div>
          <div><p className="text-lg font-bold text-surface-900">{invoices.filter(i => i.status === 'overdue').length}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Overdue</p></div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input className="input pl-9 text-xs" placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto text-xs" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 card p-6">
          <FileText className="w-12 h-12 text-surface-300 mx-auto mb-3" />
          <p className="text-surface-600 font-medium mb-1">No invoices yet</p>
          <button onClick={() => setShowNew(true)} className="btn-primary btn-sm mt-3"><Plus className="w-3.5 h-3.5" /> Create Invoice</button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Invoice</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden md:table-cell">Client</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden lg:table-cell">Date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Total</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden md:table-cell">Balance</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Status</th>
                <th className="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => (
                <tr key={inv.id} className="border-b border-surface-50 hover:bg-surface-50 transition-colors">
                  <td className="px-4 py-3"><span className="text-sm font-semibold text-surface-800 font-mono">{inv.invoice_number}</span></td>
                  <td className="px-4 py-3 hidden md:table-cell"><span className="text-sm text-surface-600">{(inv as { contacts?: { name?: string } }).contacts?.name || '—'}</span></td>
                  <td className="px-4 py-3 hidden lg:table-cell"><span className="text-xs text-surface-500">{inv.issue_date}</span></td>
                  <td className="px-4 py-3 text-right"><span className="text-sm font-bold text-surface-900">{formatCurrency(inv.total)}</span></td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">
                    <span className={cn('text-sm font-semibold', inv.balance_due > 0 ? 'text-amber-600' : 'text-emerald-600')}>
                      {formatCurrency(inv.balance_due)}
                    </span>
                  </td>
                  <td className="px-4 py-3"><span className={cn('badge text-[10px]', STATUS_STYLES[inv.status])}>{inv.status}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <a href={`/api/pdf?type=invoice&id=${inv.id}`} target="_blank" className="btn-ghost btn-sm text-[10px]"><Download className="w-3 h-3" /></a>
                      {inv.status === 'draft' && <button onClick={() => updateStatus(inv.id, 'sent')} className="btn-secondary btn-sm text-[10px]"><Send className="w-3 h-3" /> Send</button>}
                      {inv.status === 'sent' && <button onClick={() => updateStatus(inv.id, 'paid')} className="btn-sm bg-emerald-600 text-white text-[10px] rounded-lg px-2 py-1 inline-flex items-center gap-1"><DollarSign className="w-3 h-3" /> Paid</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Invoice Modal */}
      {showNew && (
        <div className="modal-overlay">
          <div className="modal-panel max-w-2xl">
            <div className="modal-header">
              <h2>New Invoice</h2>
              <button onClick={() => setShowNew(false)} className="modal-close"><X className="w-4 h-4" /></button>
            </div>
            <div className="modal-body space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Client</label>
                  <select className="input" value={form.contact_id} onChange={e => setForm((f) => ({ ...f, contact_id: e.target.value }))}>
                    <option value="">Select client</option>
                    {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Due Date</label>
                  <input type="date" className="input" value={form.due_date} onChange={e => setForm((f) => ({ ...f, due_date: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="label">Items</label>
                <div className="space-y-2">
                  {form.items.map((item: InvoiceItem, i: number) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input className="input flex-1 text-xs" placeholder="Description" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} />
                      <input className="input w-16 text-xs text-center" type="number" placeholder="Qty" value={item.quantity} onChange={e => updateItem(i, 'quantity', parseInt(e.target.value) || 0)} />
                      <input className="input w-24 text-xs text-right" type="number" placeholder="Price" value={item.unit_price} onChange={e => updateItem(i, 'unit_price', parseFloat(e.target.value) || 0)} />
                      <span className="text-xs font-bold text-surface-700 w-20 text-right">{formatCurrency(item.quantity * item.unit_price)}</span>
                      <button onClick={() => removeItem(i)} className="text-surface-300 hover:text-red-500"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={addItem} className="btn-ghost btn-sm flex-1 border border-dashed border-surface-200"><Plus className="w-3.5 h-3.5" /> Add Item</button>
                  {products.length > 0 && (
                    <select className="input text-xs flex-1" value="" onChange={e => { const p = products.find((pr: { id: string; name: string; unit_price: number }) => pr.id === e.target.value); if (p) addFromProduct(p) }}>
                      <option value="">Add from Inventory</option>
                      {products.map((p: { id: string; name: string; unit_price: number }) => <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.unit_price)}</option>)}
                    </select>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <div className="w-64 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-surface-500">Subtotal</span><span className="font-semibold">{formatCurrency(subtotal)}</span></div>
                  <div className="flex justify-between border-t border-surface-100 pt-1"><span className="font-bold text-surface-900">Total</span><span className="font-bold text-brand-600">{formatCurrency(total)}</span></div>
                </div>
              </div>

              <div><label className="label">Notes</label><textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
            </div>
            <div className="flex gap-2 p-5 border-t border-surface-100 flex-shrink-0">
              <button onClick={() => setShowNew(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={createInvoice} disabled={!form.items.length || saving} className="btn-primary flex-1">Create Invoice</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
