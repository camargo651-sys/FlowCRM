'use client'
import { DbRow } from '@/types'
import { useI18n } from '@/lib/i18n/context'
import { toast } from 'sonner'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Factory, X, Play, CheckCircle2, Clock, AlertTriangle, Package, Search, ChevronRight } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { getActiveWorkspace } from '@/lib/get-active-workspace'
import { MobileList, MobileListCard, DesktopOnly } from '@/components/shared/MobileListCard'

const STATUS_FLOW = ['draft', 'confirmed', 'in_progress', 'quality_check', 'completed'] as const
const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', confirmed: 'Confirmed', in_progress: 'In Progress',
  quality_check: 'QC', completed: 'Completed', cancelled: 'Cancelled',
}

export default function ManufacturingPage() {
  const supabase = createClient()
  const { t } = useI18n()
  interface BomLine { id?: string; material_id: string; quantity: string | number; waste: string | number; waste_percent?: number; products?: { name?: string; sku?: string; cost_price: number; stock_quantity?: number } }
  const [boms, setBoms] = useState<DbRow[]>([])
  const [workOrders, setWorkOrders] = useState<DbRow[]>([])
  const [products, setProducts] = useState<DbRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'work_orders'|'boms'>('work_orders')
  const [showNewBOM, setShowNewBOM] = useState(false)
  const [showNewWO, setShowNewWO] = useState(false)
  const [workspaceId, setWorkspaceId] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // BOM form
  const [bomName, setBomName] = useState('')
  const [bomProductId, setBomProductId] = useState('')
  const [bomYield, setBomYield] = useState(1)
  const [bomLines, setBomLines] = useState<BomLine[]>([])

  // WO form
  const [woProductId, setWoProductId] = useState('')
  const [woBomId, setWoBomId] = useState('')
  const [woQty, setWoQty] = useState(1)
  const [woPriority, setWoPriority] = useState('normal')
  const [saving, setSaving] = useState(false)

  // Material availability warnings
  const [materialWarnings, setMaterialWarnings] = useState<string[]>([])

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const ws = await getActiveWorkspace(supabase, user.id, 'id')
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)

    const [bomRes, woRes, prodRes] = await Promise.all([
      supabase.from('bill_of_materials').select('*, products(name, sku), bom_lines(*, products(name, sku, cost_price, stock_quantity))').eq('workspace_id', ws.id).order('name'),
      supabase.from('work_orders').select('*, products(name, sku), bill_of_materials(name)').eq('workspace_id', ws.id).order('created_at', { ascending: false }),
      supabase.from('products').select('id, name, sku, cost_price, stock_quantity').eq('workspace_id', ws.id).eq('status', 'active').order('name'),
    ])
    setBoms(bomRes.data || [])
    setWorkOrders(woRes.data || [])
    setProducts(prodRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Check material availability when BOM or qty changes in WO form
  const checkMaterialAvailability = useCallback((bomId: string, qty: number) => {
    const bom = boms.find(b => b.id === bomId)
    if (!bom || !bom.bom_lines?.length) { setMaterialWarnings([]); return }
    const warnings: string[] = []
    const multiplier = qty / (bom.yield_quantity || 1)
    for (const line of bom.bom_lines) {
      const needed = Number(line.quantity) * multiplier * (1 + (line.waste_percent || 0) / 100)
      const available = line.products?.stock_quantity || 0
      if (needed > available) {
        warnings.push(`${line.products?.name || 'Unknown'}: need ${Math.ceil(needed)}, have ${available}`)
      }
    }
    setMaterialWarnings(warnings)
  }, [boms])

  useEffect(() => {
    if (woBomId && woQty > 0) checkMaterialAvailability(woBomId, woQty)
    else setMaterialWarnings([])
  }, [woBomId, woQty, checkMaterialAvailability])

  const createBOM = async () => {
    if (!bomName || !bomProductId) return
    setSaving(true)
    const { data: bom } = await supabase.from('bill_of_materials').insert({
      workspace_id: workspaceId, product_id: bomProductId, name: bomName, yield_quantity: bomYield,
    }).select('id').single()

    if (bom && bomLines.length) {
      await supabase.from('bom_lines').insert(
        bomLines.map((l: BomLine, i: number) => ({
          bom_id: bom.id, material_id: l.material_id, quantity: parseFloat(String(l.quantity)) || 1,
          waste_percent: parseFloat(String(l.waste)) || 0, order_index: i,
        }))
      )
    }
    setBomName(''); setBomProductId(''); setBomYield(1); setBomLines([])
    setShowNewBOM(false); setSaving(false); toast.success("Saved"); load()
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
    setMaterialWarnings([])
    setShowNewWO(false); setSaving(false); toast.success("Saved"); load()
  }

  const updateWOStatus = async (id: string, status: string) => {
    await supabase.from('work_orders').update({ status }).eq('id', id)
    toast.success(`Status updated to ${STATUS_LABELS[status] || status}`)
    load()
  }

  const getNextStatus = (current: string): string | null => {
    const idx = STATUS_FLOW.indexOf(current as typeof STATUS_FLOW[number])
    if (idx < 0 || idx >= STATUS_FLOW.length - 1) return null
    return STATUS_FLOW[idx + 1]
  }

  const getStatusProgress = (status: string): number => {
    const idx = STATUS_FLOW.indexOf(status as typeof STATUS_FLOW[number])
    if (idx < 0) return 0
    return Math.round(((idx) / (STATUS_FLOW.length - 1)) * 100)
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

  // BOM cost calculation helper
  const getBomCost = (bom: DbRow): number => {
    if (!bom.bom_lines?.length) return 0
    return bom.bom_lines.reduce((s: number, l: BomLine) => {
      const matCost = l.products?.cost_price || 0
      const qty = Number(l.quantity) || 0
      const wasteMult = 1 + ((l.waste_percent || 0) / 100)
      return s + matCost * qty * wasteMult
    }, 0)
  }

  // Filtered work orders
  const filteredWOs = workOrders.filter(wo => {
    if (statusFilter !== 'all' && wo.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const matchWO = wo.wo_number?.toLowerCase().includes(q)
      const matchProduct = wo.products?.name?.toLowerCase().includes(q)
      const matchBOM = wo.bill_of_materials?.name?.toLowerCase().includes(q)
      if (!matchWO && !matchProduct && !matchBOM) return false
    }
    return true
  })

  const filteredBOMs = boms.filter(bom => {
    if (!search) return true
    const q = search.toLowerCase()
    return bom.name?.toLowerCase().includes(q) || bom.products?.name?.toLowerCase().includes(q)
  })

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">{t('manufacturing.title')}</h1><p className="text-sm text-surface-500 mt-0.5">{workOrders.length} work orders · {boms.length} BOMs</p></div>
        <div className="flex flex-col md:flex-row gap-2">
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

      <div className="segmented-control mb-4">
        {[{ id: 'work_orders', label: `Work Orders (${workOrders.length})` }, { id: 'boms', label: `BOMs (${boms.length})` }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as 'work_orders'|'boms')}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all', tab === t.id ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input className="input pl-9 text-xs" placeholder={tab === 'work_orders' ? 'Search WO #, product, or BOM...' : 'Search BOMs...'} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {tab === 'work_orders' && (
          <select className="input w-auto text-xs" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            {STATUS_FLOW.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            <option value="cancelled">Cancelled</option>
          </select>
        )}
      </div>

      {tab === 'work_orders' && filteredWOs.length > 0 && (
        <MobileList>
          {filteredWOs.map(wo => {
            const progress = getStatusProgress(wo.status)
            const nextStatus = getNextStatus(wo.status)
            return (
              <MobileListCard
                key={wo.id}
                title={<span className="font-mono">{wo.wo_number}</span>}
                subtitle={wo.products?.name || '—'}
                badge={<span className={cn('badge text-[10px]', STATUS_STYLES[wo.status])}>{wo.status.replace('_', ' ')}</span>}
                meta={<>
                  <span>Qty: <b>{wo.quantity}</b></span>
                  <span className={cn('font-bold capitalize', PRIORITY_STYLES[wo.priority])}>{wo.priority}</span>
                  <span>{progress}%</span>
                </>}
              >
                <div className="overflow-x-auto -mx-1 px-1 mb-2">
                  <div className="flex items-center gap-0.5 w-max">
                    {STATUS_FLOW.map((s, i) => {
                      const currentIdx = STATUS_FLOW.indexOf(wo.status as typeof STATUS_FLOW[number])
                      const isActive = i <= currentIdx
                      const isCurrent = i === currentIdx
                      return (
                        <div key={s} className="flex items-center">
                          <div className={cn('w-2 h-2 rounded-full', isCurrent ? 'bg-brand-500 ring-2 ring-brand-200' : isActive ? 'bg-brand-400' : 'bg-surface-200')} title={STATUS_LABELS[s]} />
                          {i < STATUS_FLOW.length - 1 && <div className={cn('w-3 h-0.5', isActive && i < currentIdx ? 'bg-brand-400' : 'bg-surface-200')} />}
                        </div>
                      )
                    })}
                  </div>
                </div>
                {wo.status !== 'completed' && wo.status !== 'cancelled' && nextStatus && (
                  <button onClick={() => updateWOStatus(wo.id, nextStatus)}
                    className={cn('btn-sm text-[10px] rounded-lg px-2 py-1 inline-flex items-center gap-1',
                      nextStatus === 'completed' ? 'bg-emerald-600 text-white' :
                      nextStatus === 'in_progress' ? 'bg-amber-600 text-white' :
                      nextStatus === 'quality_check' ? 'bg-violet-600 text-white' : 'btn-secondary')}>
                    <ChevronRight className="w-3 h-3" /> {STATUS_LABELS[nextStatus]}
                  </button>
                )}
              </MobileListCard>
            )
          })}
        </MobileList>
      )}

      {tab === 'work_orders' && (
        <DesktopOnly>
        <div className="card overflow-hidden">
          {filteredWOs.length === 0 ? (
            <div className="text-center py-16"><Factory className="w-10 h-10 text-surface-300 mx-auto mb-3" /><p className="text-surface-500">No work orders found</p></div>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-surface-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">WO #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden md:table-cell">BOM</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Qty</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Priority</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden lg:table-cell">Progress</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Status</th>
                <th className="px-4 py-3 w-56"></th>
              </tr></thead>
              <tbody>
                {filteredWOs.map(wo => {
                  const progress = getStatusProgress(wo.status)
                  const nextStatus = getNextStatus(wo.status)
                  return (
                  <tr key={wo.id} className="border-b border-surface-50 hover:bg-surface-50">
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono font-semibold text-surface-800">{wo.wo_number}</span>
                      {/* Mini timeline */}
                      <div className="flex items-center gap-0.5 mt-1">
                        {STATUS_FLOW.map((s, i) => {
                          const currentIdx = STATUS_FLOW.indexOf(wo.status as typeof STATUS_FLOW[number])
                          const isActive = i <= currentIdx
                          const isCurrent = i === currentIdx
                          return (
                            <div key={s} className="flex items-center">
                              <div className={cn('w-2 h-2 rounded-full transition-colors', isCurrent ? 'bg-brand-500 ring-2 ring-brand-200' : isActive ? 'bg-brand-400' : 'bg-surface-200')}
                                title={STATUS_LABELS[s]} />
                              {i < STATUS_FLOW.length - 1 && <div className={cn('w-3 h-0.5', isActive && i < currentIdx ? 'bg-brand-400' : 'bg-surface-200')} />}
                            </div>
                          )
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-surface-700">{wo.products?.name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-surface-500 hidden md:table-cell">{wo.bill_of_materials?.name || '—'}</td>
                    <td className="px-4 py-3 text-right text-sm font-bold">{wo.quantity}</td>
                    <td className="px-4 py-3"><span className={cn('text-xs font-bold capitalize', PRIORITY_STYLES[wo.priority])}>{wo.priority}</span></td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-surface-100 rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full transition-all', progress === 100 ? 'bg-emerald-500' : progress > 50 ? 'bg-amber-500' : 'bg-brand-500')}
                            style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-[10px] text-surface-400 font-semibold">{progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className={cn('badge text-[10px]', STATUS_STYLES[wo.status])}>{wo.status.replace('_', ' ')}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {/* Quick status change dropdown */}
                        {wo.status !== 'completed' && wo.status !== 'cancelled' && nextStatus && (
                          <button onClick={() => updateWOStatus(wo.id, nextStatus)}
                            className={cn('btn-sm text-[10px] rounded-lg px-2 py-1 inline-flex items-center gap-1',
                              nextStatus === 'completed' ? 'bg-emerald-600 text-white' :
                              nextStatus === 'in_progress' ? 'bg-amber-600 text-white' :
                              nextStatus === 'quality_check' ? 'bg-violet-600 text-white' :
                              'btn-secondary')}>
                            <ChevronRight className="w-3 h-3" /> {STATUS_LABELS[nextStatus]}
                          </button>
                        )}
                        {/* Full status dropdown for non-linear changes */}
                        {wo.status !== 'completed' && wo.status !== 'cancelled' && (
                          <select className="input text-[10px] w-auto py-1 px-1.5 h-auto"
                            value="" onChange={e => { if (e.target.value) updateWOStatus(wo.id, e.target.value) }}>
                            <option value="">More...</option>
                            {STATUS_FLOW.filter(s => s !== wo.status).map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                            <option value="cancelled">Cancel</option>
                          </select>
                        )}
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        </DesktopOnly>
      )}

      {tab === 'boms' && (
        <div className="space-y-3">
          {filteredBOMs.length === 0 ? (
            <div className="card text-center py-16"><Package className="w-10 h-10 text-surface-300 mx-auto mb-3" /><p className="text-surface-500">No BOMs found</p></div>
          ) : filteredBOMs.map(bom => {
            const totalCost = getBomCost(bom)
            const unitCost = bom.yield_quantity > 0 ? totalCost / bom.yield_quantity : totalCost
            return (
            <div key={bom.id} className="card p-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-sm font-bold text-surface-900">{bom.name}</h3>
                  <p className="text-xs text-surface-500">Produces: {bom.products?.name} ({bom.products?.sku}) · Yield: {bom.yield_quantity}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-brand-600" title="Estimated BOM cost (incl. waste)">
                    Cost: {formatCurrency(totalCost)}{bom.yield_quantity > 1 ? ` (${formatCurrency(unitCost)}/unit)` : ''}
                  </span>
                  <span className={cn('badge text-[10px]', bom.active ? 'badge-green' : 'badge-gray')}>{bom.active ? 'Active' : 'Inactive'}</span>
                </div>
              </div>
              {(bom.bom_lines || []).length > 0 && (
                <div className="overflow-x-auto -mx-2 px-2">
                <table className="w-full text-xs min-w-[500px]">
                  <thead><tr className="text-surface-400"><th className="text-left py-1">Material</th><th className="text-left py-1">SKU</th><th className="text-right py-1">Qty</th><th className="text-right py-1">Waste %</th><th className="text-right py-1">Stock</th><th className="text-right py-1">Cost</th></tr></thead>
                  <tbody>
                    {bom.bom_lines.map((line: BomLine & { products?: { name: string; cost_price: number; stock_quantity?: number; sku?: string } }) => {
                      const lineCost = (line.products?.cost_price || 0) * Number(line.quantity) * (1 + ((line.waste_percent || 0) / 100))
                      const stockLow = (line.products?.stock_quantity || 0) < Number(line.quantity)
                      return (
                      <tr key={line.id} className="border-t border-surface-50">
                        <td className="py-1.5 text-surface-700">{line.products?.name}</td>
                        <td className="py-1.5 text-surface-400 font-mono">{line.products?.sku}</td>
                        <td className="py-1.5 text-right font-semibold">{line.quantity}</td>
                        <td className="py-1.5 text-right text-surface-400">{line.waste_percent || 0}%</td>
                        <td className={cn('py-1.5 text-right', stockLow ? 'text-red-600 font-bold' : 'text-surface-400')}>
                          {line.products?.stock_quantity ?? '—'}
                          {stockLow && <AlertTriangle className="w-3 h-3 text-red-500 inline ml-0.5" />}
                        </td>
                        <td className="py-1.5 text-right font-semibold">{formatCurrency(lineCost)}</td>
                      </tr>
                      )
                    })}
                  </tbody>
                  <tfoot><tr className="border-t-2 border-surface-200 font-bold">
                    <td colSpan={5} className="py-1.5">Total Material Cost (incl. waste)</td>
                    <td className="py-1.5 text-right">{formatCurrency(totalCost)}</td>
                  </tr></tfoot>
                </table>
                </div>
              )}
            </div>
            )
          })}
        </div>
      )}

      {/* New BOM Modal */}
      {showNewBOM && (
        <div className="modal-overlay">
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
                {bomLines.map((line: BomLine, i: number) => (
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
              {/* Live cost estimate */}
              {bomLines.length > 0 && (
                <div className="p-3 bg-surface-50 rounded-xl text-xs">
                  <span className="font-semibold text-surface-700">Estimated Cost: </span>
                  <span className="font-bold text-brand-600">{formatCurrency(bomLines.reduce((s, l) => {
                    const prod = products.find(p => p.id === l.material_id)
                    return s + (prod?.cost_price || 0) * (parseFloat(String(l.quantity)) || 0) * (1 + (parseFloat(String(l.waste)) || 0) / 100)
                  }, 0))}</span>
                </div>
              )}
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
        <div className="modal-overlay">
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

              {/* Material availability warnings */}
              {materialWarnings.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-semibold text-amber-700">Insufficient stock for some materials</span>
                  </div>
                  <ul className="space-y-0.5">
                    {materialWarnings.map((w, i) => (
                      <li key={i} className="text-[11px] text-amber-600">• {w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => { setShowNewWO(false); setMaterialWarnings([]) }} className="btn-secondary flex-1">Cancel</button>
                <button onClick={createWO} disabled={!woProductId || saving} className="btn-primary flex-1">Create</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
