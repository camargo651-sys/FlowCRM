'use client'
import { useI18n } from '@/lib/i18n/context'
import { toast } from 'sonner'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Truck, Package, CheckCircle2, X, Clock, Send } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'

const STATUS_STYLES: Record<string, string> = {
  draft: 'badge-gray', sent: 'badge-blue', confirmed: 'badge-yellow',
  received: 'badge-green', partial: 'badge-yellow', cancelled: 'badge-red',
}

export default function PurchasingPage() {
  const supabase = createClient()
  const { t } = useI18n()
  const [orders, setOrders] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewPO, setShowNewPO] = useState(false)
  const [showNewSupplier, setShowNewSupplier] = useState(false)
  const [tab, setTab] = useState<'orders'|'suppliers'>('orders')
  const [workspaceId, setWorkspaceId] = useState('')

  // PO Form
  const [poForm, setPoForm] = useState<any>({ supplier_id: '', expected_date: '', notes: '', items: [] })
  // Supplier Form
  const [supForm, setSupForm] = useState<any>({ name: '', email: '', phone: '', address: '', payment_terms: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)

    const [poRes, supRes, prodRes] = await Promise.all([
      supabase.from('purchase_orders').select('*, suppliers(name)').eq('workspace_id', ws.id).order('created_at', { ascending: false }),
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
    load()
  }

  const createPO = async () => {
    if (!poForm.items.length) return
    setSaving(true)
    const total = poForm.items.reduce((s: number, i: any) => s + i.quantity * i.unit_cost, 0)
    const num = orders.length + 1
    const { data: po } = await supabase.from('purchase_orders').insert({
      workspace_id: workspaceId, po_number: `PO-${String(num).padStart(4, '0')}`,
      supplier_id: poForm.supplier_id || null, total, subtotal: total,
      expected_date: poForm.expected_date || null, notes: poForm.notes || null, status: 'draft',
    }).select('id').single()

    if (po) {
      await supabase.from('purchase_order_items').insert(
        poForm.items.map((item: any, i: number) => ({
          purchase_order_id: po.id, product_id: item.product_id || null,
          description: item.description, quantity: item.quantity,
          unit_cost: item.unit_cost, total: item.quantity * item.unit_cost, order_index: i,
        }))
      )
    }
    setPoForm({ supplier_id: '', expected_date: '', notes: '', items: [] })
    setShowNewPO(false)
    setSaving(false)
    load()
  }

  const updatePOStatus = async (id: string, status: string) => {
    await supabase.from('purchase_orders').update({ status, ...(status === 'received' ? { received_at: new Date().toISOString() } : {}) }).eq('id', id)
    // If received, stock is updated via API v1 logic — for now just reload
    load()
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav.purchasing')}</h1>
          <p className="text-sm text-surface-500 mt-0.5">{orders.length} orders · {suppliers.length} suppliers</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowNewSupplier(true)} className="btn-secondary btn-sm"><Plus className="w-3.5 h-3.5" /> Supplier</button>
          <button onClick={() => setShowNewPO(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> Purchase Order</button>
        </div>
      </div>

      <div className="flex gap-1 mb-6 p-1 bg-surface-100 rounded-xl w-fit">
        {[{ id: 'orders', label: `Orders (${orders.length})` }, { id: 'suppliers', label: `Suppliers (${suppliers.length})` }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all', tab === t.id ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500')}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'orders' && (
        <div className="card overflow-hidden">
          {orders.length === 0 ? (
            <div className="text-center py-16"><Truck className="w-10 h-10 text-surface-300 mx-auto mb-3" /><p className="text-surface-500">No purchase orders yet</p></div>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-surface-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">PO #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden md:table-cell">Supplier</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Total</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden lg:table-cell">Expected</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Status</th>
                <th className="px-4 py-3 w-28"></th>
              </tr></thead>
              <tbody>
                {orders.map(po => (
                  <tr key={po.id} className="border-b border-surface-50 hover:bg-surface-50">
                    <td className="px-4 py-3 text-sm font-semibold text-surface-800 font-mono">{po.po_number}</td>
                    <td className="px-4 py-3 text-sm text-surface-600 hidden md:table-cell">{po.suppliers?.name || '—'}</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-surface-900">{formatCurrency(po.total)}</td>
                    <td className="px-4 py-3 text-xs text-surface-500 hidden lg:table-cell">{po.expected_date || '—'}</td>
                    <td className="px-4 py-3"><span className={cn('badge text-[10px]', STATUS_STYLES[po.status])}>{po.status}</span></td>
                    <td className="px-4 py-3">
                      {po.status === 'draft' && <button onClick={() => updatePOStatus(po.id, 'sent')} className="btn-secondary btn-sm text-[10px]"><Send className="w-3 h-3" /> Send</button>}
                      {(po.status === 'sent' || po.status === 'confirmed') && <button onClick={() => updatePOStatus(po.id, 'received')} className="btn-sm bg-emerald-600 text-white text-[10px] rounded-lg px-2 py-1 inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Received</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'suppliers' && (
        <div className="card overflow-hidden">
          {suppliers.length === 0 ? (
            <div className="text-center py-16"><Package className="w-10 h-10 text-surface-300 mx-auto mb-3" /><p className="text-surface-500">No suppliers yet</p></div>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-surface-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden lg:table-cell">Phone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden lg:table-cell">Terms</th>
              </tr></thead>
              <tbody>
                {suppliers.map(s => (
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
      )}

      {/* New PO Modal */}
      {showNewPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-2xl max-h-[85vh] flex flex-col animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100 flex-shrink-0">
              <h2 className="font-semibold text-surface-900">New Purchase Order</h2>
              <button onClick={() => setShowNewPO(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Supplier</label>
                  <select className="input" value={poForm.supplier_id} onChange={e => setPoForm((f: any) => ({ ...f, supplier_id: e.target.value }))}>
                    <option value="">Select supplier</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div><label className="label">Expected Date</label><input type="date" className="input" value={poForm.expected_date} onChange={e => setPoForm((f: any) => ({ ...f, expected_date: e.target.value }))} /></div>
              </div>
              <div>
                <label className="label">Items</label>
                {poForm.items.map((item: any, i: number) => (
                  <div key={i} className="flex gap-2 items-center mb-2">
                    <input className="input flex-1 text-xs" placeholder="Description" value={item.description} onChange={e => setPoForm((f: any) => ({ ...f, items: f.items.map((it: any, idx: number) => idx === i ? { ...it, description: e.target.value } : it) }))} />
                    <input className="input w-16 text-xs text-center" type="number" value={item.quantity} onChange={e => setPoForm((f: any) => ({ ...f, items: f.items.map((it: any, idx: number) => idx === i ? { ...it, quantity: parseInt(e.target.value) || 0 } : it) }))} />
                    <input className="input w-24 text-xs text-right" type="number" placeholder="Cost" value={item.unit_cost} onChange={e => setPoForm((f: any) => ({ ...f, items: f.items.map((it: any, idx: number) => idx === i ? { ...it, unit_cost: parseFloat(e.target.value) || 0 } : it) }))} />
                    <button onClick={() => setPoForm((f: any) => ({ ...f, items: f.items.filter((_: any, idx: number) => idx !== i) }))} className="text-surface-300 hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <button onClick={() => setPoForm((f: any) => ({ ...f, items: [...f.items, { description: '', quantity: 1, unit_cost: 0, product_id: null }] }))} className="btn-ghost btn-sm flex-1 border border-dashed border-surface-200"><Plus className="w-3.5 h-3.5" /> Add Item</button>
                  {products.length > 0 && (
                    <select className="input text-xs flex-1" value="" onChange={e => { const p = products.find((pr: any) => pr.id === e.target.value); if (p) setPoForm((f: any) => ({ ...f, items: [...f.items, { description: p.name, quantity: 1, unit_cost: p.cost_price, product_id: p.id }] })) }}>
                      <option value="">From Inventory</option>
                      {products.map((p: any) => <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.cost_price)} (stock: {p.stock_quantity})</option>)}
                    </select>
                  )}
                </div>
              </div>
              <div className="flex justify-end"><span className="text-sm font-bold text-brand-600">Total: {formatCurrency(poForm.items.reduce((s: number, i: any) => s + i.quantity * i.unit_cost, 0))}</span></div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100">
              <h2 className="font-semibold text-surface-900">New Supplier</h2>
              <button onClick={() => setShowNewSupplier(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="label">Name *</label><input className="input" value={supForm.name} onChange={e => setSupForm((f: any) => ({ ...f, name: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Email</label><input className="input" type="email" value={supForm.email} onChange={e => setSupForm((f: any) => ({ ...f, email: e.target.value }))} /></div>
                <div><label className="label">Phone</label><input className="input" value={supForm.phone} onChange={e => setSupForm((f: any) => ({ ...f, phone: e.target.value }))} /></div>
              </div>
              <div><label className="label">Address</label><input className="input" value={supForm.address} onChange={e => setSupForm((f: any) => ({ ...f, address: e.target.value }))} /></div>
              <div><label className="label">Payment Terms</label>
                <select className="input" value={supForm.payment_terms} onChange={e => setSupForm((f: any) => ({ ...f, payment_terms: e.target.value }))}>
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
