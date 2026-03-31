'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Factory, X, Play, CheckCircle2, Clock, AlertTriangle, Package } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'

export default function ManufacturingPage() {
  const supabase = createClient()
  const [boms, setBoms] = useState<any[]>([])
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'work_orders'|'boms'>('work_orders')
  const [showNewBOM, setShowNewBOM] = useState(false)
  const [showNewWO, setShowNewWO] = useState(false)
  const [workspaceId, setWorkspaceId] = useState('')

  // BOM form
  const [bomName, setBomName] = useState('')
  const [bomProductId, setBomProductId] = useState('')
  const [bomYield, setBomYield] = useState(1)
  const [bomLines, setBomLines] = useState<any[]>([])

  // WO form
  const [woProductId, setWoProductId] = useState('')
  const [woBomId, setWoBomId] = useState('')
  const [woQty, setWoQty] = useState(1)
  const [woPriority, setWoPriority] = useState('normal')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)

    const [bomRes, woRes, prodRes] = await Promise.all([
      supabase.from('bill_of_materials').select('*, products(name, sku), bom_lines(*, products(name, sku))').eq('workspace_id', ws.id).order('name'),
      supabase.from('work_orders').select('*, products(name, sku), bill_of_materials(name)').eq('workspace_id', ws.id).order('created_at', { ascending: false }),
      supabase.from('products').select('id, name, sku, cost_price, stock_quantity').eq('workspace_id', ws.id).eq('status', 'active').order('name'),
    ])
    setBoms(bomRes.data || [])
    setWorkOrders(woRes.data || [])
    setProducts(prodRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const createBOM = async () => {
    if (!bomName || !bomProductId) return
    setSaving(true)
    const { data: bom } = await supabase.from('bill_of_materials').insert({
      workspace_id: workspaceId, product_id: bomProductId, name: bomName, yield_quantity: bomYield,
    }).select('id').single()

    if (bom && bomLines.length) {
      await supabase.from('bom_lines').insert(
        bomLines.map((l: any, i: number) => ({
          bom_id: bom.id, material_id: l.material_id, quantity: parseFloat(l.quantity) || 1,
          waste_percent: parseFloat(l.waste) || 0, order_index: i,
        }))
      )
    }
    setBomName(''); setBomProductId(''); setBomYield(1); setBomLines([])
    setShowNewBOM(false); setSaving(false); load()
  }

  const createWO = async () => {
    if (!woProductId) return
    setSaving(true)
    const count = workOrders.length + 1
    await supabase.from('work_orders').insert({
      workspace_id: workspaceId, wo_number: `WO-${String(count).padStart(4, '0')}`,
      product_id: woProductId, bom_id: woBomId || null,
      quantity: woQty, priority: woPriority, status: 'draft',
    })
    setWoProductId(''); setWoBomId(''); setWoQty(1); setWoPriority('normal')
    setShowNewWO(false); setSaving(false); load()
  }

  const updateWOStatus = async (id: string, status: string) => {
    await supabase.from('work_orders').update({ status }).eq('id', id)
    load()
  }

  const STATUS_STYLES: Record<string, string> = {
    draft: 'badge-gray', confirmed: 'badge-blue', in_progress: 'badge-yellow',
    quality_check: 'badge-violet', completed: 'badge-green', cancelled: 'badge-red',
  }
  const PRIORITY_STYLES: Record<string, string> = {
    low: 'text-surface-400', normal: 'text-blue-600', high: 'text-amber-600', urgent: 'text-red-600',
  }

  const inProgress = workOrders.filter(w => w.status === 'in_progress').length
  const completed = workOrders.filter(w => w.status === 'completed').length

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Manufacturing</h1><p className="text-sm text-surface-500 mt-0.5">{workOrders.length} work orders · {boms.length} BOMs</p></div>
        <div className="flex gap-2">
          <button onClick={() => setShowNewBOM(true)} className="btn-secondary btn-sm"><Plus className="w-3.5 h-3.5" /> BOM</button>
          <button onClick={() => setShowNewWO(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> Work Order</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="card p-4 flex items-center gap-3"><div className="w-9 h-9 bg-brand-50 rounded-xl flex items-center justify-center"><Factory className="w-4 h-4 text-brand-600" /></div><div><p className="text-lg font-bold">{workOrders.length}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Work Orders</p></div></div>
        <div className="card p-4 flex items-center gap-3"><div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center"><Play className="w-4 h-4 text-amber-600" /></div><div><p className="text-lg font-bold">{inProgress}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">In Progress</p></div></div>
        <div className="card p-4 flex items-center gap-3"><div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></div><div><p className="text-lg font-bold">{completed}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Completed</p></div></div>
        <div className="card p-4 flex items-center gap-3"><div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center"><Package className="w-4 h-4 text-violet-600" /></div><div><p className="text-lg font-bold">{boms.length}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">BOMs</p></div></div>
      </div>

      <div className="flex gap-1 mb-6 p-1 bg-surface-100 rounded-xl w-fit">
        {[{ id: 'work_orders', label: `Work Orders (${workOrders.length})` }, { id: 'boms', label: `BOMs (${boms.length})` }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all', tab === t.id ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500')}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'work_orders' && (
        <div className="card overflow-hidden">
          {workOrders.length === 0 ? (
            <div className="text-center py-16"><Factory className="w-10 h-10 text-surface-300 mx-auto mb-3" /><p className="text-surface-500">No work orders yet</p></div>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-surface-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">WO #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden md:table-cell">BOM</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Qty</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Priority</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Status</th>
                <th className="px-4 py-3 w-28"></th>
              </tr></thead>
              <tbody>
                {workOrders.map(wo => (
                  <tr key={wo.id} className="border-b border-surface-50 hover:bg-surface-50">
                    <td className="px-4 py-3 text-sm font-mono font-semibold text-surface-800">{wo.wo_number}</td>
                    <td className="px-4 py-3 text-sm text-surface-700">{wo.products?.name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-surface-500 hidden md:table-cell">{wo.bill_of_materials?.name || '—'}</td>
                    <td className="px-4 py-3 text-right text-sm font-bold">{wo.quantity}</td>
                    <td className="px-4 py-3"><span className={cn('text-xs font-bold capitalize', PRIORITY_STYLES[wo.priority])}>{wo.priority}</span></td>
                    <td className="px-4 py-3"><span className={cn('badge text-[10px]', STATUS_STYLES[wo.status])}>{wo.status.replace('_', ' ')}</span></td>
                    <td className="px-4 py-3">
                      {wo.status === 'draft' && <button onClick={() => updateWOStatus(wo.id, 'confirmed')} className="btn-secondary btn-sm text-[10px]">Confirm</button>}
                      {wo.status === 'confirmed' && <button onClick={() => updateWOStatus(wo.id, 'in_progress')} className="btn-sm bg-amber-600 text-white text-[10px] rounded-lg px-2 py-1 inline-flex items-center gap-1"><Play className="w-3 h-3" /> Start</button>}
                      {wo.status === 'in_progress' && <button onClick={() => updateWOStatus(wo.id, 'completed')} className="btn-sm bg-emerald-600 text-white text-[10px] rounded-lg px-2 py-1 inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Done</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'boms' && (
        <div className="space-y-3">
          {boms.length === 0 ? (
            <div className="card text-center py-16"><Package className="w-10 h-10 text-surface-300 mx-auto mb-3" /><p className="text-surface-500">No BOMs yet</p></div>
          ) : boms.map(bom => (
            <div key={bom.id} className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-surface-900">{bom.name}</h3>
                  <p className="text-xs text-surface-500">Produces: {bom.products?.name} ({bom.products?.sku}) · Yield: {bom.yield_quantity}</p>
                </div>
                <span className={cn('badge text-[10px]', bom.active ? 'badge-green' : 'badge-gray')}>{bom.active ? 'Active' : 'Inactive'}</span>
              </div>
              {(bom.bom_lines || []).length > 0 && (
                <table className="w-full text-xs">
                  <thead><tr className="text-surface-400"><th className="text-left py-1">Material</th><th className="text-left py-1">SKU</th><th className="text-right py-1">Qty</th><th className="text-right py-1">Waste %</th><th className="text-right py-1">Cost</th></tr></thead>
                  <tbody>
                    {bom.bom_lines.map((line: any) => (
                      <tr key={line.id} className="border-t border-surface-50">
                        <td className="py-1.5 text-surface-700">{line.products?.name}</td>
                        <td className="py-1.5 text-surface-400 font-mono">{line.products?.sku}</td>
                        <td className="py-1.5 text-right font-semibold">{line.quantity}</td>
                        <td className="py-1.5 text-right text-surface-400">{line.waste_percent || 0}%</td>
                        <td className="py-1.5 text-right font-semibold">{formatCurrency((line.products?.cost_price || 0) * line.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className="border-t-2 border-surface-200 font-bold">
                    <td colSpan={4} className="py-1.5">Total Material Cost</td>
                    <td className="py-1.5 text-right">{formatCurrency(bom.bom_lines.reduce((s: number, l: any) => s + (l.products?.cost_price || 0) * l.quantity, 0))}</td>
                  </tr></tfoot>
                </table>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New BOM Modal */}
      {showNewBOM && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-2xl max-h-[85vh] flex flex-col animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100 flex-shrink-0">
              <h2 className="font-semibold text-surface-900">New Bill of Materials</h2>
              <button onClick={() => setShowNewBOM(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">BOM Name *</label><input className="input" value={bomName} onChange={e => setBomName(e.target.value)} placeholder="e.g. Widget Assembly" /></div>
                <div><label className="label">Finished Product *</label>
                  <select className="input" value={bomProductId} onChange={e => setBomProductId(e.target.value)}>
                    <option value="">Select product</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                  </select>
                </div>
              </div>
              <div><label className="label">Yield Quantity</label><input className="input w-24" type="number" value={bomYield} onChange={e => setBomYield(parseInt(e.target.value) || 1)} /></div>
              <div>
                <label className="label">Materials</label>
                {bomLines.map((line: any, i: number) => (
                  <div key={i} className="flex gap-2 items-center mb-2">
                    <select className="input flex-1 text-xs" value={line.material_id} onChange={e => setBomLines(prev => prev.map((l, idx) => idx === i ? { ...l, material_id: e.target.value } : l))}>
                      <option value="">Select material</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.cost_price)} (stock: {p.stock_quantity})</option>)}
                    </select>
                    <input className="input w-20 text-xs text-center" type="number" placeholder="Qty" value={line.quantity} onChange={e => setBomLines(prev => prev.map((l, idx) => idx === i ? { ...l, quantity: e.target.value } : l))} />
                    <input className="input w-20 text-xs text-center" type="number" placeholder="Waste %" value={line.waste} onChange={e => setBomLines(prev => prev.map((l, idx) => idx === i ? { ...l, waste: e.target.value } : l))} />
                    <button onClick={() => setBomLines(prev => prev.filter((_, idx) => idx !== i))} className="text-surface-300 hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                ))}
                <button onClick={() => setBomLines(prev => [...prev, { material_id: '', quantity: 1, waste: 0 }])} className="btn-ghost btn-sm w-full border border-dashed border-surface-200"><Plus className="w-3.5 h-3.5" /> Add Material</button>
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-surface-100 flex-shrink-0">
              <button onClick={() => setShowNewBOM(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={createBOM} disabled={!bomName || !bomProductId || saving} className="btn-primary flex-1">Create BOM</button>
            </div>
          </div>
        </div>
      )}

      {/* New Work Order Modal */}
      {showNewWO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100">
              <h2 className="font-semibold text-surface-900">New Work Order</h2>
              <button onClick={() => setShowNewWO(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="label">Product to Manufacture *</label>
                <select className="input" value={woProductId} onChange={e => setWoProductId(e.target.value)}>
                  <option value="">Select product</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div><label className="label">BOM (optional)</label>
                <select className="input" value={woBomId} onChange={e => setWoBomId(e.target.value)}>
                  <option value="">No BOM</option>
                  {boms.filter(b => b.product_id === woProductId || !woProductId).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Quantity</label><input className="input" type="number" value={woQty} onChange={e => setWoQty(parseInt(e.target.value) || 1)} /></div>
                <div><label className="label">Priority</label>
                  <select className="input" value={woPriority} onChange={e => setWoPriority(e.target.value)}>
                    <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowNewWO(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={createWO} disabled={!woProductId || saving} className="btn-primary flex-1">Create</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
