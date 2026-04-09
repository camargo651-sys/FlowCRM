'use client'
import { DbRow } from '@/types'
import { toast } from 'sonner'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ShoppingBag, Search, Truck, CheckCircle2, XCircle, Clock, Package } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { getActiveWorkspace } from '@/lib/get-active-workspace'

const STATUS_FLOW = ['pending', 'confirmed', 'processing', 'shipped', 'delivered']
const STATUS_STYLES: Record<string, string> = {
  pending: 'badge-yellow', confirmed: 'badge-blue', processing: 'badge-violet',
  shipped: 'badge-blue', delivered: 'badge-green', cancelled: 'badge-red', refunded: 'badge-gray',
}

export default function StoreOrdersPage() {
  const supabase = createClient()
  const [orders, setOrders] = useState<DbRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')
  const [storeEnabled, setStoreEnabled] = useState(false)
  const [storeSlug, setStoreSlug] = useState('')

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const ws = await getActiveWorkspace(supabase, user.id, 'id, slug, store_enabled')
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)
    setStoreEnabled(ws.store_enabled || false)
    setStoreSlug(ws.slug || '')

    const { data } = await supabase.from('store_orders')
      .select('*, contacts(name)')
      .eq('workspace_id', ws.id)
      .order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('store_orders').update({ status }).eq('id', id)
    load()
  }

  const toggleStore = async () => {
    await supabase.from('workspaces').update({ store_enabled: !storeEnabled }).eq('id', workspaceId)
    setStoreEnabled(!storeEnabled)
  }

  const filtered = orders.filter(o => {
    if (filter !== 'all' && o.status !== filter) return false
    if (search && !o.order_number.toLowerCase().includes(search.toLowerCase()) && !o.customer_name.toLowerCase().includes(search.toLowerCase()) && !o.customer_email.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const totalRevenue = orders.filter(o => !['cancelled', 'refunded'].includes(o.status)).reduce((s: number, o: DbRow) => s + (o.total || 0), 0)
  const pendingOrders = orders.filter(o => o.status === 'pending').length

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Online Store</h1>
          <p className="text-sm text-surface-500 mt-0.5">{orders.length} orders · {formatCurrency(totalRevenue)} revenue</p>
        </div>
        <div className="flex items-center gap-3">
          {storeSlug && storeEnabled && (
            <a href={`/store/${storeSlug}`} target="_blank" className="btn-secondary btn-sm">View Store</a>
          )}
          <button onClick={toggleStore} className={cn('btn-sm font-semibold rounded-lg px-4 py-1.5', storeEnabled ? 'bg-emerald-600 text-white' : 'bg-surface-200 text-surface-600')}>
            {storeEnabled ? 'Store Active' : 'Enable Store'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-50 rounded-xl flex items-center justify-center"><ShoppingBag className="w-4 h-4 text-brand-600" /></div>
          <div><p className="text-lg font-bold">{orders.length}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Total Orders</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center"><Clock className="w-4 h-4 text-amber-600" /></div>
          <div><p className="text-lg font-bold">{pendingOrders}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Pending</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></div>
          <div><p className="text-lg font-bold">{formatCurrency(totalRevenue)}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Revenue</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center"><Truck className="w-4 h-4 text-violet-600" /></div>
          <div><p className="text-lg font-bold">{orders.filter(o => o.status === 'shipped').length}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Shipped</p></div>
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input className="input pl-9 text-xs" placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto text-xs" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All</option>
          {STATUS_FLOW.map(s => <option key={s} value={s}>{s}</option>)}
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-16">
          <ShoppingBag className="w-10 h-10 text-surface-300 mx-auto mb-3" />
          <p className="text-surface-500 font-medium">No orders yet</p>
          <p className="text-xs text-surface-400 mt-1">{storeEnabled ? 'Share your store link to start receiving orders' : 'Enable your store to start selling online'}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead><tr className="border-b border-surface-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Order</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Customer</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Total</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden lg:table-cell">Date</th>
              <th className="px-4 py-3 w-32"></th>
            </tr></thead>
            <tbody>
              {filtered.map(order => {
                const currentIdx = STATUS_FLOW.indexOf(order.status)
                const nextStatus = currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null
                return (
                  <tr key={order.id} className="border-b border-surface-50 hover:bg-surface-50">
                    <td className="px-4 py-3"><span className="text-sm font-mono font-semibold text-surface-800">{order.order_number}</span></td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-surface-800">{order.customer_name}</p>
                      <p className="text-[10px] text-surface-400">{order.customer_email}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-surface-900">{formatCurrency(order.total)}</td>
                    <td className="px-4 py-3"><span className={cn('badge text-[10px]', STATUS_STYLES[order.status])}>{order.status}</span></td>
                    <td className="px-4 py-3 text-xs text-surface-500 hidden lg:table-cell">{new Date(order.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {nextStatus && (
                          <button onClick={() => updateStatus(order.id, nextStatus)}
                            className="btn-secondary btn-sm text-[10px] capitalize">{nextStatus}</button>
                        )}
                        {order.status === 'pending' && (
                          <button onClick={() => updateStatus(order.id, 'cancelled')}
                            className="btn-ghost btn-sm text-[10px] text-red-500">Cancel</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
