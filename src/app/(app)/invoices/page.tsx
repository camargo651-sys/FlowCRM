'use client'
import { useI18n } from '@/lib/i18n/context'
import { toast } from 'sonner'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, FileText, Send, DollarSign, CheckCircle2, X, Clock, AlertTriangle, Download, CreditCard, Copy, Repeat, ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { pushUndoAction } from '@/lib/undo/stack'
import { formatCurrency, cn } from '@/lib/utils'
import { getActiveWorkspace } from '@/lib/get-active-workspace'
import { MobileList, MobileListCard, DesktopOnly } from '@/components/shared/MobileListCard'
import EmptyState from '@/components/shared/EmptyState'

interface Invoice {
  id: string; invoice_number: string; type: string; status: string
  contact_id: string | null; total: number; amount_paid: number; balance_due: number
  issue_date: string; due_date: string | null; currency: string
  contacts?: { name: string; email?: string } | null; created_at: string
  subtotal?: number; tax_amount?: number; tax_rate?: number; notes?: string
  metadata?: { recurring_invoice_id?: string } | null
}

interface Payment {
  id: string; invoice_id: string; amount: number; method: string; date: string; created_at: string
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'badge-gray', sent: 'badge-blue', paid: 'badge-green',
  partial: 'badge-yellow', overdue: 'badge-red', cancelled: 'badge-gray',
}

export default function InvoicesPage() {
  const router = useRouter()
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
  const [defaultTaxRate, setDefaultTaxRate] = useState(0)

  // Edit state (#1)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)

  // Payment modal state (#2)
  const [paymentModal, setPaymentModal] = useState<{ invoice: Invoice } | null>(null)
  const [paymentForm, setPaymentForm] = useState({ amount: 0, method: 'transfer', date: new Date().toISOString().split('T')[0] })
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [expandedPayments, setExpandedPayments] = useState<Record<string, Payment[]>>({})
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // Recurring invoices set (#8)
  const [recurringInvoiceIds, setRecurringInvoiceIds] = useState<Set<string>>(new Set())

  // Form
  interface InvoiceItem { description: string; quantity: number; unit_price: number; product_id: string | null }
  interface InvoiceForm { contact_id: string; due_date: string; notes: string; items: InvoiceItem[]; tax_rate: number; recurring: boolean; recurring_frequency: string; recurring_next_date: string }
  const [form, setForm] = useState<InvoiceForm>({ contact_id: '', due_date: '', notes: '', items: [], tax_rate: 0, recurring: false, recurring_frequency: 'monthly', recurring_next_date: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const ws = await getActiveWorkspace(supabase, user.id, 'id, default_tax_rate')
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)
    const wsTaxRate = (ws.default_tax_rate || 0)
    setDefaultTaxRate(wsTaxRate)

    const [invRes, conRes, prodRes, recRes] = await Promise.all([
      supabase.from('invoices').select('*, contacts(name, email)').eq('workspace_id', ws.id).is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('contacts').select('id, name').eq('workspace_id', ws.id).order('name'),
      supabase.from('products').select('id, name, unit_price').eq('workspace_id', ws.id).eq('status', 'active').order('name'),
      supabase.from('recurring_invoices').select('id').eq('workspace_id', ws.id).eq('active', true),
    ])
    setContacts(conRes.data || [])
    setProducts(prodRes.data || [])

    // Build set of recurring invoice IDs for indicator (#8)
    const recIds = new Set<string>()
    if (recRes.data) {
      for (const r of recRes.data) recIds.add(r.id)
    }
    setRecurringInvoiceIds(recIds)

    // Overdue auto-detection (#5)
    const today = new Date().toISOString().split('T')[0]
    const fetchedInvoices: Invoice[] = invRes.data || []
    const overdueUpdates: string[] = []
    for (const inv of fetchedInvoices) {
      if (inv.status === 'sent' && inv.due_date && inv.due_date < today) {
        overdueUpdates.push(inv.id)
        inv.status = 'overdue'
      }
    }
    if (overdueUpdates.length > 0) {
      await supabase.from('invoices').update({ status: 'overdue' }).in('id', overdueUpdates)
    }

    setInvoices(fetchedInvoices)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Reset form with defaults
  const resetForm = useCallback(() => {
    setForm({ contact_id: '', due_date: '', notes: '', items: [], tax_rate: defaultTaxRate, recurring: false, recurring_frequency: 'monthly', recurring_next_date: '' })
  }, [defaultTaxRate])

  const openNewInvoice = () => {
    setEditingInvoice(null)
    resetForm()
    setShowNew(true)
  }

  // Edit invoice (#1): load items and open modal
  const openEditInvoice = async (inv: Invoice) => {
    if (inv.status !== 'draft') return
    setEditingInvoice(inv)
    const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', inv.id).order('order_index')
    setForm({
      contact_id: inv.contact_id || '',
      due_date: inv.due_date || '',
      notes: inv.notes || '',
      tax_rate: inv.tax_rate ?? defaultTaxRate,
      items: (items || []).map((it: { description: string; quantity: number; unit_price: number; product_id: string | null }) => ({
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unit_price,
        product_id: it.product_id,
      })),
      recurring: false,
      recurring_frequency: 'monthly',
      recurring_next_date: '',
    })
    setShowNew(true)
  }

  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, { description: '', quantity: 1, unit_price: 0, product_id: null }] }))
  const addFromProduct = (p: { id: string; name: string; unit_price: number }) => setForm((f) => ({ ...f, items: [...f.items, { description: p.name, quantity: 1, unit_price: p.unit_price, product_id: p.id }] }))
  const updateItem = (i: number, field: string, val: string | number) => setForm((f) => ({ ...f, items: f.items.map((item, idx: number) => idx === i ? { ...item, [field]: val } : item) }))
  const removeItem = (i: number) => setForm((f) => ({ ...f, items: f.items.filter((_, idx: number) => idx !== i) }))

  const subtotal = form.items.reduce((s: number, i) => s + (i.quantity * i.unit_price), 0)
  const taxRate = (form.tax_rate || 0) / 100
  const taxAmount = subtotal * taxRate
  const total = subtotal + taxAmount

  const createInvoice = async () => {
    if (!form.items.length) return
    setSaving(true)

    if (editingInvoice) {
      // Update existing invoice (#1)
      await supabase.from('invoices').update({
        contact_id: form.contact_id || null,
        subtotal, tax_rate: form.tax_rate, tax_amount: taxAmount, total, balance_due: total - (editingInvoice.amount_paid || 0),
        due_date: form.due_date || null,
        notes: form.notes || null,
      }).eq('id', editingInvoice.id)

      // Delete old items and re-insert
      await supabase.from('invoice_items').delete().eq('invoice_id', editingInvoice.id)
      await supabase.from('invoice_items').insert(
        form.items.map((item: InvoiceItem, i: number) => ({
          invoice_id: editingInvoice.id, product_id: item.product_id || null,
          description: item.description, quantity: item.quantity,
          unit_price: item.unit_price, total: item.quantity * item.unit_price, order_index: i,
        }))
      )

      resetForm()
      setEditingInvoice(null)
      setShowNew(false)
      setSaving(false)
      toast.success('Invoice updated')
      load()
      return
    }

    // Create new invoice
    const count = invoices.length + 1
    const { data: inv } = await supabase.from('invoices').insert({
      workspace_id: workspaceId,
      invoice_number: `INV-${String(count).padStart(4, '0')}`,
      contact_id: form.contact_id || null,
      subtotal, tax_rate: form.tax_rate, tax_amount: taxAmount, total, balance_due: total,
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

      // Recurring invoice (#8)
      if (form.recurring) {
        await supabase.from('recurring_invoices').insert({
          workspace_id: workspaceId,
          title: `Recurring ${`INV-${String(count).padStart(4, '0')}`}`,
          contact_id: form.contact_id || null,
          frequency: form.recurring_frequency,
          next_date: form.recurring_next_date || form.due_date || new Date().toISOString().split('T')[0],
          subtotal, tax_rate: form.tax_rate, total,
          items: form.items.map((item: InvoiceItem) => ({
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
          })),
          active: true,
          auto_send: false,
          invoices_generated: 0,
        })
      }
    }
    resetForm()
    setShowNew(false)
    setSaving(false)
    toast.success('Invoice created')
    load()
  }

  // Send invoice via email (#3)
  const sendInvoice = async (inv: Invoice) => {
    try {
      const res = await fetch('/api/invoices/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: inv.id }),
      })
      const data = await res.json()
      if (res.ok) {
        const email = inv.contacts?.email || 'client'
        toast.success(`Invoice sent to ${email}`)
        load()
      } else {
        toast.error(data.error || 'Failed to send invoice')
        // Fallback: just update status locally
        if (data.error?.includes('not configured')) {
          await supabase.from('invoices').update({ status: 'sent', issue_date: new Date().toISOString().split('T')[0] }).eq('id', inv.id)
          load()
        }
      }
    } catch {
      toast.error('Failed to send invoice')
    }
  }

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('invoices').update({ status, ...(status === 'sent' ? { issue_date: new Date().toISOString().split('T')[0] } : {}) }).eq('id', id)
    load()
  }

  // Record payment (#2)
  const recordPayment = async () => {
    if (!paymentModal || paymentForm.amount <= 0) return
    setPaymentSaving(true)
    const inv = paymentModal.invoice

    await supabase.from('payments').insert({
      invoice_id: inv.id,
      workspace_id: workspaceId,
      amount: paymentForm.amount,
      method: paymentForm.method,
      date: paymentForm.date,
    })

    const newAmountPaid = (inv.amount_paid || 0) + paymentForm.amount
    const newBalanceDue = Math.max(0, inv.total - newAmountPaid)
    const newStatus = newBalanceDue <= 0 ? 'paid' : 'partial'

    await supabase.from('invoices').update({
      amount_paid: newAmountPaid,
      balance_due: newBalanceDue,
      status: newStatus,
    }).eq('id', inv.id)

    setPaymentSaving(false)
    setPaymentModal(null)
    setPaymentForm({ amount: 0, method: 'transfer', date: new Date().toISOString().split('T')[0] })
    toast.success(`Payment of ${formatCurrency(paymentForm.amount)} recorded`)
    load()
  }

  // Toggle payment history (#2)
  const togglePaymentHistory = async (invId: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(invId)) {
      newExpanded.delete(invId)
      setExpandedRows(newExpanded)
      return
    }
    const { data } = await supabase.from('payments').select('*').eq('invoice_id', invId).order('date', { ascending: false })
    setExpandedPayments(prev => ({ ...prev, [invId]: data || [] }))
    newExpanded.add(invId)
    setExpandedRows(newExpanded)
  }

  // Payment link (#6)
  const openPaymentLink = async (inv: Invoice) => {
    try {
      const res = await fetch('/api/payments/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: inv.id }),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        window.open(data.url, '_blank')
      } else {
        toast.error(data.error || 'Failed to create payment link')
      }
    } catch {
      toast.error('Failed to create payment link')
    }
  }

  // Duplicate invoice (#7)
  const duplicateInvoice = async (inv: Invoice) => {
    const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', inv.id).order('order_index')
    const count = invoices.length + 1
    const { data: newInv } = await supabase.from('invoices').insert({
      workspace_id: workspaceId,
      invoice_number: `INV-${String(count).padStart(4, '0')}`,
      contact_id: inv.contact_id,
      subtotal: inv.subtotal || inv.total,
      tax_rate: inv.tax_rate || 0,
      tax_amount: inv.tax_amount || 0,
      total: inv.total,
      balance_due: inv.total,
      due_date: inv.due_date,
      notes: inv.notes || null,
      status: 'draft',
      currency: inv.currency,
    }).select('id').single()

    if (newInv && items?.length) {
      await supabase.from('invoice_items').insert(
        items.map((item: { description: string; quantity: number; unit_price: number; product_id: string | null; total: number }, i: number) => ({
          invoice_id: newInv.id,
          product_id: item.product_id || null,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
          order_index: i,
        }))
      )
    }
    toast.success('Invoice duplicated')
    load()
  }

  const filtered = invoices.filter(inv => {
    if (search && !inv.invoice_number.toLowerCase().includes(search.toLowerCase()) && !(inv as { contacts?: { name?: string } }).contacts?.name?.toLowerCase().includes(search.toLowerCase())) return false
    if (filterStatus !== 'all' && inv.status !== filterStatus) return false
    return true
  })

  const totalOutstanding = invoices.filter(i => ['sent','partial','overdue'].includes(i.status)).reduce((s, i) => s + i.balance_due, 0)
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0)

  // Check if invoice has recurring parent (#8)
  const hasRecurringParent = (inv: Invoice) => {
    const meta = inv.metadata as { recurring_invoice_id?: string } | null
    return meta?.recurring_invoice_id && recurringInvoiceIds.has(meta.recurring_invoice_id)
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      <div className="page-header flex-col md:flex-row gap-3 md:gap-0">
        <div>
          <h1 className="page-title">{t('invoices.title')}</h1>
          <p className="text-sm text-surface-500 mt-0.5">{invoices.length} total · {formatCurrency(totalOutstanding)} outstanding</p>
        </div>
        <button onClick={openNewInvoice} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New Invoice</button>
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
      <div className="flex gap-3 mb-6 flex-wrap">
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
        <EmptyState
          icon={<FileText className="w-7 h-7" />}
          title="Bill your customers"
          description="Create your first invoice and start collecting payments."
          action={{ label: 'Create invoice', onClick: openNewInvoice, icon: <Plus className="w-3.5 h-3.5" /> }}
        />
      ) : (
        <>
        <DesktopOnly><div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Invoice</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden md:table-cell">Client</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden lg:table-cell">Date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Total</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden md:table-cell">Balance</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Status</th>
                <th className="px-4 py-3 w-44"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => (
                <>
                <tr key={inv.id} className="border-b border-surface-50 hover:bg-surface-50 transition-colors cursor-pointer" onClick={() => router.push('/invoices/' + inv.id)}>
                  <td className="px-4 py-3">
                    <span className="text-sm font-semibold text-surface-800 font-mono inline-flex items-center gap-1.5">
                      {hasRecurringParent(inv) && <span title="Recurring invoice"><Repeat className="w-3 h-3 text-brand-500" /></span>}
                      {inv.invoice_number}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell"><span className="text-sm text-surface-600">{(inv as { contacts?: { name?: string } }).contacts?.name || '—'}</span></td>
                  <td className="px-4 py-3 hidden lg:table-cell"><span className="text-xs text-surface-500">{inv.issue_date}</span></td>
                  <td className="px-4 py-3 text-right"><span className="text-sm font-bold text-surface-900">{formatCurrency(inv.total)}</span></td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">
                    <span className={cn('text-sm font-semibold', inv.balance_due > 0 ? 'text-amber-600' : 'text-emerald-600')}>
                      {formatCurrency(inv.balance_due)}
                    </span>
                  </td>
                  <td className="px-4 py-3"><span className={cn('badge text-[10px]', STATUS_STYLES[inv.status])}>{inv.status}</span></td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <a href={`/api/pdf?type=invoice&id=${inv.id}`} target="_blank" className="btn-ghost btn-sm text-[10px]"><Download className="w-3 h-3" /></a>
                      {inv.status === 'draft' && <button onClick={() => sendInvoice(inv)} className="btn-secondary btn-sm text-[10px]"><Send className="w-3 h-3" /> Send</button>}
                      {['sent', 'partial', 'overdue'].includes(inv.status) && (
                        <>
                          <button onClick={() => { setPaymentModal({ invoice: inv }); setPaymentForm({ amount: inv.balance_due, method: 'transfer', date: new Date().toISOString().split('T')[0] }) }} className="btn-sm bg-emerald-600 text-white text-[10px] rounded-lg px-2 py-1 inline-flex items-center gap-1"><DollarSign className="w-3 h-3" /> Pay</button>
                          {inv.balance_due > 0 && <button onClick={() => openPaymentLink(inv)} className="btn-ghost btn-sm text-[10px]" title="Stripe Payment Link"><CreditCard className="w-3 h-3" /></button>}
                          <button onClick={() => togglePaymentHistory(inv.id)} className="btn-ghost btn-sm text-[10px]" title="Payment history">
                            {expandedRows.has(inv.id) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          </button>
                        </>
                      )}
                      <button onClick={() => duplicateInvoice(inv)} className="btn-ghost btn-sm text-[10px]" title="Duplicate"><Copy className="w-3 h-3" /></button>
                      <button
                        onClick={async () => {
                          await supabase.from('invoices').update({ deleted_at: new Date().toISOString() }).eq('id', inv.id)
                          setInvoices(prev => prev.filter(i => i.id !== inv.id))
                          pushUndoAction({
                            label: `Invoice ${inv.invoice_number} deleted`,
                            undo: async () => {
                              await supabase.from('invoices').update({ deleted_at: null }).eq('id', inv.id)
                              load()
                            },
                          })
                        }}
                        className="btn-ghost btn-sm text-[10px] text-rose-600"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
                {/* Expanded payment history row (#2) */}
                {expandedRows.has(inv.id) && (
                  <tr key={`${inv.id}-payments`} className="border-b border-surface-50 bg-surface-25">
                    <td colSpan={7} className="px-8 py-3">
                      {(expandedPayments[inv.id] || []).length === 0 ? (
                        <p className="text-xs text-surface-400">No payments recorded</p>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-[10px] text-surface-500 font-semibold uppercase mb-1">Payment History</p>
                          {(expandedPayments[inv.id] || []).map(p => (
                            <div key={p.id} className="flex items-center gap-4 text-xs text-surface-600">
                              <span className="font-mono">{p.date}</span>
                              <span className="font-semibold text-emerald-600">{formatCurrency(p.amount)}</span>
                              <span className="badge badge-gray text-[10px]">{p.method}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
                </>
              ))}
            </tbody>
          </table>
        </div></DesktopOnly>
        <MobileList>
          {filtered.map(inv => (
            <MobileListCard
              key={inv.id}
              onClick={() => router.push('/invoices/' + inv.id)}
              title={<span className="font-mono inline-flex items-center gap-1.5">{hasRecurringParent(inv) && <Repeat className="w-3 h-3 text-brand-500" />}{inv.invoice_number}</span>}
              subtitle={(inv as { contacts?: { name?: string } }).contacts?.name || '—'}
              badge={<span className={cn('badge text-[10px]', STATUS_STYLES[inv.status])}>{inv.status}</span>}
              meta={<>
                <span>{inv.issue_date}</span>
                <span className={cn(inv.balance_due > 0 ? 'text-amber-600' : 'text-emerald-600', 'font-semibold')}>Balance: {formatCurrency(inv.balance_due)}</span>
              </>}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-surface-900">{formatCurrency(inv.total)}</span>
                {['sent', 'partial', 'overdue'].includes(inv.status) && (
                  <button onClick={(e) => { e.stopPropagation(); setPaymentModal({ invoice: inv }); setPaymentForm({ amount: inv.balance_due, method: 'transfer', date: new Date().toISOString().split('T')[0] }) }} className="bg-emerald-600 text-white text-[10px] rounded-lg px-2 py-1 inline-flex items-center gap-1"><DollarSign className="w-3 h-3" /> Pay</button>
                )}
              </div>
            </MobileListCard>
          ))}
        </MobileList>
        </>
      )}

      {/* Payment Modal (#2) */}
      {paymentModal && (
        <div className="modal-overlay">
          <div className="modal-panel max-w-sm">
            <div className="modal-header">
              <h2>Record Payment — {paymentModal.invoice.invoice_number}</h2>
              <button onClick={() => setPaymentModal(null)} className="modal-close"><X className="w-4 h-4" /></button>
            </div>
            <div className="modal-body space-y-4">
              <div>
                <label className="label">Amount</label>
                <input type="number" className="input" step="0.01" value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} />
                <p className="text-[10px] text-surface-400 mt-0.5">Balance due: {formatCurrency(paymentModal.invoice.balance_due)}</p>
              </div>
              <div>
                <label className="label">Method</label>
                <select className="input" value={paymentForm.method} onChange={e => setPaymentForm(f => ({ ...f, method: e.target.value }))}>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>
              <div>
                <label className="label">Date</label>
                <input type="date" className="input" value={paymentForm.date} onChange={e => setPaymentForm(f => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-surface-100 flex-shrink-0">
              <button onClick={() => setPaymentModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={recordPayment} disabled={paymentForm.amount <= 0 || paymentSaving} className="btn-primary flex-1">{paymentSaving ? 'Saving...' : 'Record Payment'}</button>
            </div>
          </div>
        </div>
      )}

      {/* New/Edit Invoice Modal */}
      {showNew && (
        <div className="modal-overlay">
          <div className="modal-panel max-w-2xl">
            <div className="modal-header">
              <h2>{editingInvoice ? 'Edit Invoice' : 'New Invoice'}</h2>
              <button onClick={() => { setShowNew(false); setEditingInvoice(null); resetForm() }} className="modal-close"><X className="w-4 h-4" /></button>
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
                  <div className="flex justify-between items-center">
                    <span className="text-surface-500">Tax</span>
                    <div className="flex items-center gap-1">
                      <input type="number" className="input w-16 text-xs text-right py-0.5 px-1" step="0.1" value={form.tax_rate} onChange={e => setForm(f => ({ ...f, tax_rate: parseFloat(e.target.value) || 0 }))} />
                      <span className="text-xs text-surface-400">%</span>
                      <span className="font-semibold ml-2">{formatCurrency(taxAmount)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between border-t border-surface-100 pt-1"><span className="font-bold text-surface-900">Total</span><span className="font-bold text-brand-600">{formatCurrency(total)}</span></div>
                </div>
              </div>

              <div><label className="label">Notes</label><textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>

              {/* Recurring Invoice (#8) - only for new invoices */}
              {!editingInvoice && (
                <div className="border border-surface-100 rounded-lg p-3 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-surface-300" checked={form.recurring} onChange={e => setForm(f => ({ ...f, recurring: e.target.checked }))} />
                    <span className="text-sm text-surface-700 font-medium">Make this recurring</span>
                    <Repeat className="w-3.5 h-3.5 text-surface-400" />
                  </label>
                  {form.recurring && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">Frequency</label>
                        <select className="input text-xs" value={form.recurring_frequency} onChange={e => setForm(f => ({ ...f, recurring_frequency: e.target.value }))}>
                          <option value="monthly">Monthly</option>
                          <option value="quarterly">Quarterly</option>
                          <option value="yearly">Annually</option>
                        </select>
                      </div>
                      <div>
                        <label className="label">Next Date</label>
                        <input type="date" className="input text-xs" value={form.recurring_next_date} onChange={e => setForm(f => ({ ...f, recurring_next_date: e.target.value }))} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-2 p-5 border-t border-surface-100 flex-shrink-0">
              <button onClick={() => { setShowNew(false); setEditingInvoice(null); resetForm() }} className="btn-secondary flex-1">Cancel</button>
              <button onClick={createInvoice} disabled={!form.items.length || saving} className="btn-primary flex-1">{saving ? 'Saving...' : editingInvoice ? 'Update Invoice' : 'Create Invoice'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
