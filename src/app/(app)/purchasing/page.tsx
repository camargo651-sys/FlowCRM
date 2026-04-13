'use client'
import { DbRow } from '@/types'
import { useI18n } from '@/lib/i18n/context'
import { toast } from 'sonner'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Truck, Package, CheckCircle2, X, Clock, Send, Copy } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { getActiveWorkspace } from '@/lib/get-active-workspace'
import { MobileList, MobileListCard, DesktopOnly } from '@/components/shared/MobileListCard'

const STATUS_STYLES: Record<string, string> = {
  draft: 'badge-gray', sent: 'badge-blue', confirmed: 'badge-yellow',
  received: 'badge-green', partial: 'badge-yellow', cancelled: 'badge-red',
}

const STATUS_OPTIONS = ['draft', 'sent', 'confirmed', 'partial', 'received', 'cancelled']

export default function PurchasingPage() {
  const supabase = createClient()
  const { t } = useI18n()
  interface POItem { description: string; quantity: number; unit_cost: number; product_id: string | null; received_qty?: number }
  interface POForm { supplier_id: string; expected_date: string; notes: string; items: POItem[] }
  interface SupForm { name: string; email: string; phone: string; address: string; payment_terms: string }
  const [orders, setOrders] = useState<DbRow[]>([])
  const [suppliers, setSuppliers] = useState<DbRow[]>([])
  const [products, setProducts] = useState<{ id: string; name: string; cost_price: number; stock_quantity: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewPO, setShowNewPO] = useState(false)
  const [showNewSupplier, setShowNewSupplier] = useState(false)
  const [showInlineSupplier, setShowInlineSupplier] = useState(false)
  const [showReceive, setShowReceive] = useState<string | null>(null)
  const [receiveItems, setReceiveItems] = useState<{ product_id: string | null; description: string; quantity: number; received_qty: number; receiving: number }[]>([])
  const [tab, setTab] = useState<'orders'|'suppliers'>('orders')
  const [workspaceId, setWorkspaceId] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // PO Form
  const [poForm, setPoForm] = useState<POForm>({ supplier_id: '', expected_date: '', notes: '', items: [] })
  // Supplier Form
  const [supForm, setSupForm] = useState<SupForm>({ name: '', email: '', phone: '', address: '', payment_terms: '' })
  // Inline supplier form
  const [inlineSupName, setInlineSupName] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const ws = await getActiveWorkspace(supabase, user.id, 'id')
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)

    const [poRes, supRes, prodRes] = await Promise.all([
      supabase.from('purchase_orders').select('*, suppliers(name), purchase_order_items(*)').eq('workspace_id', ws.id).order('created_at', { ascending: false }),
      supabase.from('suppliers').select('*').eq('workspace_id', ws.id).order('name'),
      supabase.from('products').select('id, name, cost_price, stock_quantity').eq('workspace_id', ws.id).eq('status', 'active').order('name'),
    ])
    setOrders(poRes.data || [])
    setSuppliers(supRes.data || [])
    setProducts(prodRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const createSupplier = async () => {
    if (!supForm.name) return
    setSaving(true)
    await supabase.from('suppliers').insert({ workspace_id: workspaceId, ...supForm })
    setSupForm({ name: '', email: '', phone: '', address: '', payment_terms: '' })
    setShowNewSupplier(false)
    setSaving(false)
    toast.success('Supplier created')
    load()
  }

  const createInlineSupplier = async () => {
    if (!inlineSupName) return
    const { data } = await supabase.from('suppliers').insert({ workspace_id: workspaceId, name: inlineSupName }).select('id').single()
    if (data) {
      setPoForm(f => ({ ...f, supplier_id: data.id }))
    }
    setInlineSupName('')
    setShowInlineSupplier(false)
    toast.success('Supplier created')
    load()
  }

  const createPO = async () => {
    if (!poForm.items.length) return
    setSaving(true)
    const total = poForm.items.reduce((s: number, i: POItem) => s + i.quantity * i.unit_cost, 0)
    const num = orders.length + 1
    const { data: po } = await supabase.from('purchase_orders').insert({
      workspace_id: workspaceId, po_number: `PO-${String(num).padStart(4, '0')}`,
      supplier_id: poForm.supplier_id || null, total, subtotal: total,
      expected_date: poForm.expected_date || null, notes: poForm.notes || null, status: 'draft',
    }).select('id').single()

    if (po) {
      await supabase.from('purchase_order_items').insert(
        poForm.items.map((item: POItem, i: number) => ({
          purchase_order_id: po.id, product_id: item.product_id || null,
          description: item.description, quantity: item.quantity,
          unit_cost: item.unit_cost, total: item.quantity * item.unit_cost, order_index: i,
        }))
      )
    }
    setPoForm({ supplier_id: '', expected_date: '', notes: '', items: [] })
    setShowNewPO(false)
    setSaving(false)
    toast.success('Purchase order created')
    load()
  }

  const duplicatePO = async (po: DbRow) => {
    const items = po.purchase_order_items || []
    const total = items.reduce((s: number, i: DbRow) => s + (i.quantity || 0) * (i.unit_cost || 0), 0)
    const num = orders.length + 1
    const { data: newPO } = await supabase.from('purchase_orders').insert({
      workspace_id: workspaceId, po_number: `PO-${String(num).padStart(4, '0')}`,
      supplier_id: po.supplier_id || null, total, subtotal: total,
      expected_date: null, notes: po.notes || null, status: 'draft',
    }).select('id').single()

    if (newPO && items.length) {
      await supabase.from('purchase_order_items').insert(
        items.map((item: DbRow, i: number) => ({
          purchase_order_id: newPO.id, product_id: item.product_id || null,
          description: item.description, quantity: item.quantity,
          unit_cost: item.unit_cost, total: (item.quantity || 0) * (item.unit_cost || 0), order_index: i,
        }))
      )
    }
    toast.success('PO duplicated')
    load()
  }

  const updatePOStatus = async (id: string, status: string) => {
    await supabase.from('purchase_orders').update({ status, ...(status === 'received' ? { received_at: new Date().toISOString() } : {}) }).eq('id', id)
    load()
  }

  const openReceive = (po: DbRow) => {
    const items = (po.purchase_order_items || []).map((item: DbRow) => ({
      product_id: item.product_id,
      description: item.description || '',
      quantity: item.quantity || 0,
      received_qty: item.received_qty || 0,
      receiving: (item.quantity || 0) - (item.received_qty || 0),
    }))
    setReceiveItems(items)
    setShowReceive(po.id)
  }

  const receivePartial = async () => {
    if (!showReceive) return
    setSaving(true)
    const po = orders.find(o => o.id === showReceive)
    if (!po) { setSaving(false); return }

    for (const item of receiveItems) {
      if (item.receiving <= 0) continue
      const newReceivedQty = item.received_qty + item.receiving

      // Update PO item received_qty
      if (item.product_id) {
        await supabase.from('purchase_order_items')
          .update({ received_qty: newReceivedQty })
          .eq('purchase_order_id', showReceive)
          .eq('product_id', item.product_id)

        // Create stock movement and update product stock
        const { data: product } = await supabase
          .from('products').select('stock_quantity').eq('id', item.product_id).single()
        if (product) {
          const newStock = product.stock_quantity + item.receiving
          await supabase.from('products').update({ stock_quantity: newStock }).eq('id', item.product_id)
          await supabase.from('stock_movements').insert({
            workspace_id: workspaceId,
            product_id: item.product_id,
            type: 'purchase',
            quantity: item.receiving,
            previous_stock: product.stock_quantity,
            new_stock: newStock,
            reference: `PO ${po.po_number}`,
          })
        }
      }
    }

    // Determine new PO status
    const allFullyReceived = receiveItems.every(i => i.received_qty + i.receiving >= i.quantity)
    const anyReceived = receiveItems.some(i => i.receiving > 0 || i.received_qty > 0)
    const newStatus = allFullyReceived ? 'received' : anyReceived ? 'partial' : po.status

    await supabase.from('purchase_orders').update({
      status: newStatus,
      ...(newStatus === 'received' ? { received_at: new Date().toISOString() } : {}),
    }).eq('id', showReceive)

    setShowReceive(null)
    setReceiveItems([])
    setSaving(false)
    toast.success(allFullyReceived ? 'PO fully received' : 'Partial receive recorded')
    load()
  }

  // Computed values
  const openPOsTotal = orders
    .filter(po => ['draft', 'sent', 'confirmed', 'partial'].includes(po.status))
    .reduce((s, po) => s + (po.total || 0), 0)

  const filteredOrders = orders.filter(po => {
    if (statusFilter !== 'all' && po.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const matchPO = po.po_number?.toLowerCase().includes(q)
      const matchSup = po.suppliers?.name?.toLowerCase().includes(q)
      if (!matchPO && !matchSup) return false
    }
    return true
  })

  const filteredSuppliers = suppliers.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    return s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q)
  })

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav.purchasing')}</h1>
          <p className="text-sm text-surface-500 mt-0.5">{orders.length} orders · {suppliers.length} suppliers</p>
        </div>
        <div className="flex flex-col md:flex-row gap-2">
          <button onClick={() => setShowNewSupplier(true)} className="btn-secondary btn-sm"><Plus className="w-3.5 h-3.5" /> Supplier</button>
          <button onClick={() => setShowNewPO(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> Purchase Order</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-50 rounded-xl flex items-center justify-center"><Truck className="w-4 h-4 text-brand-600" /></div>
          <div><p className="text-lg font-bold">{orders.length}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Total Orders</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center"><Clock className="w-4 h-4 text-amber-600" /></div>
          <div><p className="text-lg font-bold">{orders.filter(o => ['draft', 'sent', 'confirmed', 'partial'].includes(o.status)).length}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Open Orders</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></div>
          <div><p className="text-lg font-bold">{orders.filter(o => o.status === 'received').length}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Received</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center"><Package className="w-4 h-4 text-violet-600" /></div>
          <div><p className="text-lg font-bold">{formatCurrency(openPOsTotal)}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Open PO Value</p></div>
        </div>
      </div>

      <div className="segmented-control mb-4">
        {[{ id: 'orders', label: `Orders (${orders.length})` }, { id: 'suppliers', label: `Suppliers (${suppliers.length})` }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as 'orders'|'suppliers')}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all', tab === t.id ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input className="input pl-9 text-xs" placeholder={tab === 'orders' ? 'Search PO # or supplier...' : 'Search suppliers...'} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {tab === 'orders' && (
          <select className="input w-auto text-xs" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        )}
      </div>

      {tab === 'orders' && filteredOrders.length > 0 && (
        <MobileList>
          {filteredOrders.map(po => (
            <MobileListCard
              key={po.id}
              title={<span className="font-mono">{po.po_number}</span>}
              subtitle={po.suppliers?.name || '—'}
              badge={<span className={cn('badge text-[10px]', STATUS_STYLES[po.status])}>{po.status}</span>}
              meta={<>
                <span className="font-bold text-surface-700">{formatCurrency(po.total)}</span>
                {po.expected_date && <span>Exp: {po.expected_date}</span>}
              </>}
            >
              <div className="flex gap-1 flex-wrap">
                {po.status === 'draft' && <button onClick={() => updatePOStatus(po.id, 'sent')} className="btn-secondary btn-sm text-[10px]"><Send className="w-3 h-3" /> Send</button>}
                {(po.status === 'sent' || po.status === 'confirmed' || po.status === 'partial') && (
                  <button onClick={() => openReceive(po)} className="btn-sm bg-emerald-600 text-white text-[10px] rounded-lg px-2 py-1 inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Receive</button>
                )}
                {po.status !== 'cancelled' && (
                  <button onClick={() => duplicatePO(po)} className="btn-ghost btn-sm text-[10px]"><Copy className="w-3 h-3" /> Copy</button>
                )}
              </div>
            </MobileListCard>
          ))}
        </MobileList>
      )}

      {tab === 'orders' && (
        <DesktopOnly>
        <div className="card overflow-hidden">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-16"><Truck className="w-10 h-10 text-surface-300 mx-auto mb-3" /><p className="text-surface-500">No purchase orders found</p></div>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-surface-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">PO #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden md:table-cell">Supplier</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Total</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden lg:table-cell">Expected</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Status</th>
                <th className="px-4 py-3 w-48"></th>
              </tr></thead>
              <tbody>
                {filteredOrders.map(po => (
                  <tr key={po.id} className="border-b border-surface-50 hover:bg-surface-50">
                    <td className="px-4 py-3 text-sm font-semibold text-surface-800 font-mono">{po.po_number}</td>
                    <td className="px-4 py-3 text-sm text-surface-600 hidden md:table-cell">{po.suppliers?.name || '—'}</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-surface-900">{formatCurrency(po.total)}</td>
                    <td className="px-4 py-3 text-xs text-surface-500 hidden lg:table-cell">{po.expected_date || '—'}</td>
                    <td className="px-4 py-3"><span className={cn('badge text-[10px]', STATUS_STYLES[po.status])}>{po.status}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {po.status === 'draft' && <button onClick={() => updatePOStatus(po.id, 'sent')} className="btn-secondary btn-sm text-[10px]"><Send className="w-3 h-3" /> Send</button>}
                        {(po.status === 'sent' || po.status === 'confirmed' || po.status === 'partial') && (
                          <button onClick={() => openReceive(po)} className="btn-sm bg-emerald-600 text-white text-[10px] rounded-lg px-2 py-1 inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Receive</button>
                        )}
                        {po.status !== 'cancelled' && (
                          <button onClick={() => duplicatePO(po)} className="btn-ghost btn-sm text-[10px]" title="Duplicate PO"><Copy className="w-3 h-3" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        </DesktopOnly>
      )}

      {tab === 'suppliers' && filteredSuppliers.length > 0 && (
        <MobileList>
          {filteredSuppliers.map(s => (
            <MobileListCard
              key={s.id}
              title={s.name}
              subtitle={s.email || '—'}
              meta={<>
                {s.phone && <span>{s.phone}</span>}
                {s.payment_terms && <span>{s.payment_terms}</span>}
              </>}
            />
          ))}
        </MobileList>
      )}

      {tab === 'suppliers' && (
        <DesktopOnly>
        <div className="card overflow-hidden">
          {filteredSuppliers.length === 0 ? (
            <div className="text-center py-16"><Package className="w-10 h-10 text-surface-300 mx-auto mb-3" /><p className="text-surface-500">No suppliers found</p></div>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-surface-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden lg:table-cell">Phone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden lg:table-cell">Terms</th>
              </tr></thead>
              <tbody>
                {filteredSuppliers.map(s => (
                  <tr key={s.id} className="border-b border-surface-50">
                    <td className="px-4 py-3 text-sm font-semibold text-surface-800">{s.name}</td>
                    <td className="px-4 py-3 text-xs text-surface-500 hidden md:table-cell">{s.email || '—'}</td>
                    <td className="px-4 py-3 text-xs text-surface-500 hidden lg:table-cell">{s.phone || '—'}</td>
                    <td className="px-4 py-3 text-xs text-surface-500 hidden lg:table-cell">{s.payment_terms || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        </DesktopOnly>
      )}

      {/* Receive Partial Modal */}
      {showReceive && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-2xl max-h-[85vh] flex flex-col animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100 flex-shrink-0">
              <h2 className="font-semibold text-surface-900">Receive Items</h2>
              <button onClick={() => setShowReceive(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto flex-1">
              <p className="text-xs text-surface-500">Enter the quantity received for each item. Stock will be updated automatically.</p>
              {receiveItems.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 border border-surface-100 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-800 truncate">{item.description}</p>
                    <p className="text-[10px] text-surface-400">Ordered: {item.quantity} · Already received: {item.received_qty} · Remaining: {item.quantity - item.received_qty}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-surface-500 whitespace-nowrap">Receiving:</label>
                    <input type="number" min={0} max={item.quantity - item.received_qty}
                      className="input w-20 text-xs text-center"
                      value={item.receiving}
                      onChange={e => setReceiveItems(prev => prev.map((it, idx) => idx === i ? { ...it, receiving: Math.min(parseInt(e.target.value) || 0, it.quantity - it.received_qty) } : it))}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 p-5 border-t border-surface-100 flex-shrink-0">
              <button onClick={() => setShowReceive(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={receivePartial} disabled={saving || receiveItems.every(i => i.receiving <= 0)} className="btn-primary flex-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Confirm Receive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New PO Modal */}
      {showNewPO && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-2xl max-h-[85vh] flex flex-col animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100 flex-shrink-0">
              <h2 className="font-semibold text-surface-900">New Purchase Order</h2>
              <button onClick={() => setShowNewPO(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Supplier</label>
                  <select className="input" value={poForm.supplier_id} onChange={e => setPoForm((f) => ({ ...f, supplier_id: e.target.value }))}>
                    <option value="">Select supplier</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {!showInlineSupplier ? (
                    <button onClick={() => setShowInlineSupplier(true)} className="text-[10px] text-brand-600 hover:underline mt-1">+ Add new supplier</button>
                  ) : (
                    <div className="flex gap-1 mt-1">
                      <input className="input text-xs flex-1" placeholder="Supplier name" value={inlineSupName} onChange={e => setInlineSupName(e.target.value)} />
                      <button onClick={createInlineSupplier} disabled={!inlineSupName} className="btn-primary btn-sm text-[10px]">Add</button>
                      <button onClick={() => setShowInlineSupplier(false)} className="btn-ghost btn-sm text-[10px]"><X className="w-3 h-3" /></button>
                    </div>
                  )}
                </div>
                <div><label className="label">Expected Date</label><input type="date" className="input" value={poForm.expected_date} onChange={e => setPoForm((f) => ({ ...f, expected_date: e.target.value }))} /></div>
              </div>
              <div>
                <label className="label">Items</label>
                {poForm.items.map((item: POItem, i: number) => (
                  <div key={i} className="flex gap-2 items-center mb-2">
                    <input className="input flex-1 text-xs" placeholder="Description" value={item.description} onChange={e => setPoForm((f) => ({ ...f, items: f.items.map((it: POItem, idx: number) => idx === i ? { ...it, description: e.target.value } : it) }))} />
                    <input className="input w-16 text-xs text-center" type="number" value={item.quantity} onChange={e => setPoForm((f) => ({ ...f, items: f.items.map((it: POItem, idx: number) => idx === i ? { ...it, quantity: parseInt(e.target.value) || 0 } : it) }))} />
                    <input className="input w-24 text-xs text-right" type="number" placeholder="Cost" value={item.unit_cost} onChange={e => setPoForm((f) => ({ ...f, items: f.items.map((it: POItem, idx: number) => idx === i ? { ...it, unit_cost: parseFloat(e.target.value) || 0 } : it) }))} />
                    <button onClick={() => setPoForm((f) => ({ ...f, items: f.items.filter((_: POItem, idx: number) => idx !== i) }))} className="text-surface-300 hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <button onClick={() => setPoForm((f) => ({ ...f, items: [...f.items, { description: '', quantity: 1, unit_cost: 0, product_id: null }] }))} className="btn-ghost btn-sm flex-1 border border-dashed border-surface-200"><Plus className="w-3.5 h-3.5" /> Add Item</button>
                  {products.length > 0 && (
                    <select className="input text-xs flex-1" value="" onChange={e => { const p = products.find((pr: { id: string; name: string; cost_price: number; stock_quantity: number }) => pr.id === e.target.value); if (p) setPoForm((f) => ({ ...f, items: [...f.items, { description: p.name, quantity: 1, unit_cost: p.cost_price, product_id: p.id }] })) }}>
                      <option value="">From Inventory</option>
                      {products.map((p: { id: string; name: string; cost_price: number; stock_quantity: number }) => <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.cost_price)} (stock: {p.stock_quantity})</option>)}
                    </select>
                  )}
                </div>
              </div>
              <div className="flex justify-end"><span className="text-sm font-bold text-brand-600">Total: {formatCurrency(poForm.items.reduce((s: number, i: POItem) => s + i.quantity * i.unit_cost, 0))}</span></div>
            </div>
            <div className="flex gap-2 p-5 border-t border-surface-100 flex-shrink-0">
              <button onClick={() => setShowNewPO(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={createPO} disabled={!poForm.items.length || saving} className="btn-primary flex-1">Create PO</button>
            </div>
          </div>
        </div>
      )}

      {/* New Supplier Modal */}
      {showNewSupplier && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100">
              <h2 className="font-semibold text-surface-900">New Supplier</h2>
              <button onClick={() => setShowNewSupplier(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="label">Name *</label><input className="input" value={supForm.name} onChange={e => setSupForm((f) => ({ ...f, name: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Email</label><input className="input" type="email" value={supForm.email} onChange={e => setSupForm((f) => ({ ...f, email: e.target.value }))} /></div>
                <div><label className="label">Phone</label><input className="input" value={supForm.phone} onChange={e => setSupForm((f) => ({ ...f, phone: e.target.value }))} /></div>
              </div>
              <div><label className="label">Address</label><input className="input" value={supForm.address} onChange={e => setSupForm((f) => ({ ...f, address: e.target.value }))} /></div>
              <div><label className="label">Payment Terms</label>
                <select className="input" value={supForm.payment_terms} onChange={e => setSupForm((f) => ({ ...f, payment_terms: e.target.value }))}>
                  <option value="">Select</option><option value="Cash">Cash</option><option value="Net 15">Net 15</option><option value="Net 30">Net 30</option><option value="Net 60">Net 60</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowNewSupplier(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={createSupplier} disabled={!supForm.name || saving} className="btn-primary flex-1">Create</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
