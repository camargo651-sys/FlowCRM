'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Package, Plus, Search, Filter, AlertTriangle, ArrowUpDown, X,
  Edit2, Trash2, ArrowDown, ArrowUp, BarChart2, Tag, Box, TrendingUp,
  Upload, Download
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { cn, formatCurrency } from '@/lib/utils'

interface Product {
  id: string; sku: string; name: string; description: string;
  unit_price: number; cost_price: number; stock_quantity: number;
  min_stock: number; status: string; category_id: string | null;
  sizes: string[]; colors: string[]; brand: string; model: string;
  specs: any; tags: string[]; image_url: string | null;
  created_at: string; product_categories?: { name: string; type: string } | null;
}

interface Category {
  id: string; name: string; type: string; icon: string | null;
}

interface StockMovement {
  id: string; type: string; quantity: number; previous_stock: number;
  new_stock: number; reference: string; notes: string; created_at: string;
}

const CATEGORY_TYPES = [
  { key: 'basic', label: 'Basic Products', icon: '📦', desc: 'Simple products with name, price, and quantity' },
  { key: 'apparel', label: 'Apparel / Fashion', icon: '👕', desc: 'Products with sizes, colors, and variants' },
  { key: 'technical', label: 'Technical / Electronics', icon: '🔧', desc: 'Products with specs, brand, model, warranty' },
  { key: 'digital', label: 'Digital Products', icon: '💾', desc: 'Software, licenses, subscriptions' },
  { key: 'service', label: 'Services', icon: '🛠️', desc: 'Service packages with hourly rates' },
]

const MOVEMENT_COLORS: Record<string, string> = {
  purchase: 'text-emerald-600 bg-emerald-50',
  sale: 'text-red-600 bg-red-50',
  adjustment: 'text-amber-600 bg-amber-50',
  return: 'text-blue-600 bg-blue-50',
  transfer: 'text-violet-600 bg-violet-50',
}

export default function InventoryPage() {
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showNew, setShowNew] = useState(false)
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [showMovement, setShowMovement] = useState<string | null>(null)
  const [tab, setTab] = useState<'products' | 'dashboard' | 'movements'>('products')
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [workspaceId, setWorkspaceId] = useState('')

  // New product form
  const [newProduct, setNewProduct] = useState<any>({
    name: '', sku: '', description: '', unit_price: 0, cost_price: 0,
    stock_quantity: 0, min_stock: 0, category_id: '', status: 'active',
    sizes: [], colors: [], brand: '', model: '',
  })

  // New category form
  const [newCatName, setNewCatName] = useState('')
  const [newCatType, setNewCatType] = useState('basic')

  // Stock movement form
  const [movType, setMovType] = useState<string>('purchase')
  const [movQty, setMovQty] = useState('')
  const [movNotes, setMovNotes] = useState('')

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)

    const [prodsRes, catsRes] = await Promise.all([
      supabase.from('products').select('*, product_categories(name, type)').eq('workspace_id', ws.id).order('name'),
      supabase.from('product_categories').select('*').eq('workspace_id', ws.id).order('name'),
    ])

    setProducts(prodsRes.data || [])
    setCategories(catsRes.data || [])

    const { data: movsData } = await supabase
      .from('stock_movements')
      .select('*')
      .eq('workspace_id', ws.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setMovements(movsData || [])

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const createCategory = async () => {
    if (!newCatName || !workspaceId) return
    await supabase.from('product_categories').insert({
      workspace_id: workspaceId, name: newCatName, type: newCatType,
      icon: CATEGORY_TYPES.find(t => t.key === newCatType)?.icon || '📦',
    })
    setNewCatName('')
    setShowNewCategory(false)
    load()
  }

  const createProduct = async () => {
    if (!newProduct.name || !workspaceId) return
    await supabase.from('products').insert({
      workspace_id: workspaceId,
      ...newProduct,
      category_id: newProduct.category_id || null,
    })
    setNewProduct({ name: '', sku: '', description: '', unit_price: 0, cost_price: 0, stock_quantity: 0, min_stock: 0, category_id: '', status: 'active', sizes: [], colors: [], brand: '', model: '' })
    setShowNew(false)
    load()
  }

  const recordMovement = async (productId: string) => {
    if (!movQty || !workspaceId) return
    const product = products.find(p => p.id === productId)
    if (!product) return

    const qty = parseInt(movQty)
    const delta = movType === 'sale' ? -qty : qty
    const newStock = product.stock_quantity + delta

    await supabase.from('stock_movements').insert({
      workspace_id: workspaceId,
      product_id: productId,
      type: movType,
      quantity: qty,
      previous_stock: product.stock_quantity,
      new_stock: newStock,
      notes: movNotes || null,
    })

    await supabase.from('products').update({ stock_quantity: newStock }).eq('id', productId)

    setShowMovement(null)
    setMovQty('')
    setMovNotes('')
    load()
  }

  const selectedCategoryType = categories.find(c => c.id === newProduct.category_id)?.type || 'basic'

  const filtered = products.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.sku?.toLowerCase().includes(search.toLowerCase())) return false
    if (filterCategory !== 'all' && p.category_id !== filterCategory) return false
    if (filterStatus !== 'all' && p.status !== filterStatus) return false
    return true
  })

  const lowStockProducts = products.filter(p => p.stock_quantity <= p.min_stock && p.status === 'active')
  const totalValue = products.reduce((s, p) => s + (p.stock_quantity * p.cost_price), 0)

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="text-sm text-surface-500 mt-0.5">
            {products.length} product{products.length !== 1 ? 's' : ''} · {formatCurrency(totalValue)} total value
          </p>
        </div>
        <div className="flex gap-2">
          <a href="/api/export?type=products" className="btn-ghost btn-sm">
            <Download className="w-3.5 h-3.5" /> Export
          </a>
          <label className="btn-secondary btn-sm cursor-pointer">
            <Upload className="w-3.5 h-3.5" /> Import CSV
            <input type="file" accept=".csv" className="sr-only" onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const form = new FormData()
              form.append('file', file)
              form.append('type', 'products')
              await fetch('/api/import', { method: 'POST', body: form })
              load()
              e.target.value = ''
            }} />
          </label>
          <button onClick={() => setShowNewCategory(true)} className="btn-secondary btn-sm">
            <Tag className="w-3.5 h-3.5" /> Category
          </button>
          <button onClick={() => setShowNew(true)} className="btn-primary btn-sm">
            <Plus className="w-3.5 h-3.5" /> Add Product
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-50 rounded-xl flex items-center justify-center text-lg">📦</div>
          <div><p className="text-lg font-bold text-surface-900">{products.length}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Products</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center text-lg">💰</div>
          <div><p className="text-lg font-bold text-surface-900">{formatCurrency(totalValue)}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Stock Value</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center text-lg">📂</div>
          <div><p className="text-lg font-bold text-surface-900">{categories.length}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Categories</p></div>
        </div>
        <div className={cn('card p-4 flex items-center gap-3', lowStockProducts.length > 0 && 'border-red-200 bg-red-50/30')}>
          <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center text-lg">⚠️</div>
          <div><p className="text-lg font-bold text-surface-900">{lowStockProducts.length}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Low Stock</p></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-surface-100 rounded-xl w-fit">
        {[{ id: 'products', label: 'Products' }, { id: 'dashboard', label: 'Dashboard' }, { id: 'movements', label: 'Movements' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t.id ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500 hover:text-surface-700')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ===== DASHBOARD TAB ===== */}
      {tab === 'dashboard' && (() => {
        const COLORS = ['#6172f3','#34d399','#f87171','#fbbf24','#a78bfa','#22d3ee']
        const categoryDist = categories.map((c, i) => ({
          name: c.name,
          value: products.filter(p => p.category_id === c.id).length,
          color: COLORS[i % COLORS.length],
        })).filter(d => d.value > 0)

        const topByValue = [...products].sort((a, b) => (b.stock_quantity * b.cost_price) - (a.stock_quantity * a.cost_price)).slice(0, 8).map(p => ({
          name: p.name.slice(0, 20), value: p.stock_quantity * p.cost_price,
        }))

        const movementsByType = ['purchase', 'sale', 'adjustment', 'return', 'transfer'].map(t => ({
          name: t.charAt(0).toUpperCase() + t.slice(1),
          count: movements.filter(m => m.type === t).length,
        })).filter(d => d.count > 0)

        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="card p-5">
              <h3 className="font-semibold text-surface-900 mb-4">Stock Value by Product</h3>
              {topByValue.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topByValue} barSize={32}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ba3c0' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
                    <Tooltip formatter={(v: any) => [formatCurrency(v), 'Value']} contentStyle={{ borderRadius: 12, border: '1px solid #e4e7f0', fontSize: 12 }} />
                    <Bar dataKey="value" fill="#6172f3" radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-surface-400 text-sm text-center py-8">No products yet</p>}
            </div>

            <div className="card p-5">
              <h3 className="font-semibold text-surface-900 mb-4">Products by Category</h3>
              {categoryDist.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={categoryDist} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                        {categoryDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e4e7f0', fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-2">
                    {categoryDist.map(d => (
                      <div key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} /><span className="text-xs text-surface-600">{d.name}</span></div>
                        <span className="text-xs font-bold text-surface-800">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <p className="text-surface-400 text-sm text-center py-8">No categories yet</p>}
            </div>

            {movementsByType.length > 0 && (
              <div className="card p-5">
                <h3 className="font-semibold text-surface-900 mb-4">Movement Types</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={movementsByType} barSize={40}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e4e7f0', fontSize: 12 }} />
                    <Bar dataKey="count" fill="#34d399" radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="card p-5">
              <h3 className="font-semibold text-surface-900 mb-4">Restock Forecast</h3>
              {lowStockProducts.length > 0 ? (
                <div className="space-y-3">
                  {lowStockProducts.map(p => {
                    const urgency = p.stock_quantity === 0 ? 'Out of stock' : p.stock_quantity <= p.min_stock / 2 ? 'Critical' : 'Low'
                    return (
                      <div key={p.id} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-surface-800">{p.name}</p>
                          <p className="text-[10px] text-surface-400">{p.stock_quantity} left / min {p.min_stock}</p>
                        </div>
                        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',
                          urgency === 'Out of stock' ? 'bg-red-100 text-red-700' :
                          urgency === 'Critical' ? 'bg-amber-100 text-amber-700' : 'bg-yellow-100 text-yellow-700')}>
                          {urgency}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <span className="text-2xl">✅</span>
                  <p className="text-sm text-surface-500 mt-2">All stock levels are healthy</p>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* ===== MOVEMENTS TAB ===== */}
      {tab === 'movements' && (
        <div className="card overflow-hidden mb-6">
          {movements.length === 0 ? (
            <div className="text-center py-12">
              <ArrowUpDown className="w-8 h-8 text-surface-300 mx-auto mb-2" />
              <p className="text-surface-400 text-sm">No stock movements yet</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Product</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Type</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Qty</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Stock</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden md:table-cell">Notes</th>
                </tr>
              </thead>
              <tbody>
                {movements.map(m => {
                  const product = products.find(p => p.id === (m as any).product_id)
                  return (
                    <tr key={m.id} className="border-b border-surface-50">
                      <td className="px-4 py-3 text-xs text-surface-500">{new Date(m.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-sm font-medium text-surface-800">{product?.name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', MOVEMENT_COLORS[m.type] || 'text-surface-600 bg-surface-100')}>
                          {m.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold">
                        <span className={m.type === 'sale' ? 'text-red-600' : 'text-emerald-600'}>
                          {m.type === 'sale' ? '-' : '+'}{m.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-surface-500">{m.previous_stock} → {m.new_stock}</td>
                      <td className="px-4 py-3 text-xs text-surface-400 hidden md:table-cell">{m.notes || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Search & Filters */}
      {tab === 'products' && <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input className="input pl-9 text-xs" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto text-xs" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="all">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input w-auto text-xs" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="discontinued">Discontinued</option>
        </select>
      </div>}

      {/* Products Table */}
      {tab === 'products' && filtered.length === 0 ? (
        <div className="text-center py-20 card p-6">
          <Package className="w-12 h-12 text-surface-300 mx-auto mb-3" />
          <p className="text-surface-600 font-medium mb-1">No products yet</p>
          <p className="text-surface-400 text-sm mb-4">Add your first product to start managing inventory</p>
          <button onClick={() => setShowNew(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> Add Product</button>
        </div>
      ) : tab === 'products' ? (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden md:table-cell">SKU</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden lg:table-cell">Category</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Price</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Stock</th>
                <th className="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(product => (
                <tr key={product.id} className="border-b border-surface-50 last:border-0 hover:bg-surface-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-surface-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        {product.image_url ? <img src={product.image_url} className="w-10 h-10 rounded-xl object-cover" /> : <Package className="w-5 h-5 text-surface-400" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-surface-800">{product.name}</p>
                        {product.brand && <p className="text-[10px] text-surface-400">{product.brand} {product.model}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs text-surface-500 font-mono">{product.sku || '—'}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-surface-600">{(product as any).product_categories?.name || '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-semibold text-surface-800">{formatCurrency(product.unit_price)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={cn('text-sm font-bold', product.stock_quantity <= product.min_stock ? 'text-red-600' : 'text-surface-800')}>
                      {product.stock_quantity}
                    </span>
                    {product.stock_quantity <= product.min_stock && (
                      <AlertTriangle className="w-3 h-3 text-red-500 inline ml-1" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => { setShowMovement(product.id); setMovType('purchase'); setMovQty(''); setMovNotes('') }}
                      className="btn-secondary btn-sm text-[10px]">
                      <ArrowUpDown className="w-3 h-3" /> Move
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Low Stock Alerts */}
      {tab === 'products' && lowStockProducts.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-red-600 mb-3 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> Low Stock Alerts
          </h2>
          <div className="space-y-2">
            {lowStockProducts.map(p => (
              <div key={p.id} className="card p-4 border-red-200 bg-red-50/30 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-surface-800">{p.name}</p>
                  <p className="text-xs text-red-600">Stock: {p.stock_quantity} / Min: {p.min_stock}</p>
                </div>
                <button onClick={() => { setShowMovement(p.id); setMovType('purchase'); setMovQty(''); setMovNotes('') }}
                  className="btn-primary btn-sm text-xs">Restock</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Category Modal */}
      {showNewCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100">
              <h2 className="font-semibold text-surface-900">New Category</h2>
              <button onClick={() => setShowNewCategory(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Category Name</label>
                <input className="input" value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="e.g. Electronics" />
              </div>
              <div>
                <label className="label">Product Type</label>
                <div className="space-y-2">
                  {CATEGORY_TYPES.map(t => (
                    <label key={t.key} className={cn('flex items-center gap-3 p-3 rounded-xl cursor-pointer border-2 transition-all',
                      newCatType === t.key ? 'border-brand-500 bg-brand-50/50' : 'border-surface-100 hover:border-surface-200')}>
                      <input type="radio" name="catType" value={t.key} checked={newCatType === t.key} onChange={() => setNewCatType(t.key)} className="sr-only" />
                      <span className="text-lg">{t.icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-surface-800">{t.label}</p>
                        <p className="text-[10px] text-surface-400">{t.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowNewCategory(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={createCategory} disabled={!newCatName} className="btn-primary flex-1">Create</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Product Modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-lg animate-slide-up max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-surface-100 flex-shrink-0">
              <h2 className="font-semibold text-surface-900">New Product</h2>
              <button onClick={() => setShowNew(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Name *</label>
                  <input className="input" value={newProduct.name} onChange={e => setNewProduct((p: any) => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className="label">SKU</label>
                  <input className="input" value={newProduct.sku} onChange={e => setNewProduct((p: any) => ({ ...p, sku: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Category</label>
                <select className="input" value={newProduct.category_id} onChange={e => setNewProduct((p: any) => ({ ...p, category_id: e.target.value }))}>
                  <option value="">None</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input resize-none" rows={2} value={newProduct.description} onChange={e => setNewProduct((p: any) => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Sell Price</label>
                  <input className="input" type="number" value={newProduct.unit_price} onChange={e => setNewProduct((p: any) => ({ ...p, unit_price: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="label">Cost Price</label>
                  <input className="input" type="number" value={newProduct.cost_price} onChange={e => setNewProduct((p: any) => ({ ...p, cost_price: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Stock Quantity</label>
                  <input className="input" type="number" value={newProduct.stock_quantity} onChange={e => setNewProduct((p: any) => ({ ...p, stock_quantity: parseInt(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="label">Min Stock Alert</label>
                  <input className="input" type="number" value={newProduct.min_stock} onChange={e => setNewProduct((p: any) => ({ ...p, min_stock: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>

              {/* Apparel fields */}
              {selectedCategoryType === 'apparel' && (
                <>
                  <div>
                    <label className="label">Sizes (comma separated)</label>
                    <input className="input" placeholder="XS, S, M, L, XL" onChange={e => setNewProduct((p: any) => ({ ...p, sizes: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) }))} />
                  </div>
                  <div>
                    <label className="label">Colors (comma separated)</label>
                    <input className="input" placeholder="Black, White, Blue" onChange={e => setNewProduct((p: any) => ({ ...p, colors: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) }))} />
                  </div>
                </>
              )}

              {/* Technical fields */}
              {selectedCategoryType === 'technical' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Brand</label>
                    <input className="input" value={newProduct.brand} onChange={e => setNewProduct((p: any) => ({ ...p, brand: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Model</label>
                    <input className="input" value={newProduct.model} onChange={e => setNewProduct((p: any) => ({ ...p, model: e.target.value }))} />
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2 p-5 border-t border-surface-100 flex-shrink-0">
              <button onClick={() => setShowNew(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={createProduct} disabled={!newProduct.name} className="btn-primary flex-1">Create Product</button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Movement Modal */}
      {showMovement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-sm animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100">
              <h2 className="font-semibold text-surface-900">Stock Movement</h2>
              <button onClick={() => setShowMovement(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Type</label>
                <select className="input" value={movType} onChange={e => setMovType(e.target.value)}>
                  <option value="purchase">Purchase (In)</option>
                  <option value="sale">Sale (Out)</option>
                  <option value="adjustment">Adjustment</option>
                  <option value="return">Return</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>
              <div>
                <label className="label">Quantity</label>
                <input className="input" type="number" value={movQty} onChange={e => setMovQty(e.target.value)} placeholder="0" />
              </div>
              <div>
                <label className="label">Notes</label>
                <input className="input" value={movNotes} onChange={e => setMovNotes(e.target.value)} placeholder="Optional note" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowMovement(null)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={() => recordMovement(showMovement)} disabled={!movQty} className="btn-primary flex-1">
                  {movType === 'sale' ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />}
                  Record
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
