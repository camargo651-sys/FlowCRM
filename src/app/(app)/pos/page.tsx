'use client'
import { toast } from 'sonner'
import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ShoppingCart, Plus, Minus, Trash2, Search, DollarSign, CreditCard, X, Receipt, Banknote } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { getActiveWorkspace } from '@/lib/get-active-workspace'

interface CartItem {
  product_id: string
  name: string
  quantity: number
  unit_price: number
  discount: number
  total: number
}

interface Product {
  id: string; name: string; sku: string; unit_price: number;
  stock_quantity: number; barcode: string | null; image_url: string | null;
}

export default function POSPage() {
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [workspaceId, setWorkspaceId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<string>('cash')
  const [amountPaid, setAmountPaid] = useState('')
  const [showPayment, setShowPayment] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [lastTransaction, setLastTransaction] = useState<{ id: string; total: number; payment_method: string; items: { name: string; quantity: number; price: number; total?: number }[]; created_at: string; transaction_number?: string; change_given?: number } | null>(null)
  const [processing, setProcessing] = useState(false)
  const [taxRate, setTaxRate] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const ws = await getActiveWorkspace(supabase, user.id, 'id, default_tax_rate')
    if (!ws) { setLoading(false); return }
    setTaxRate((ws.default_tax_rate || 0) / 100)
    setWorkspaceId(ws.id)

    const { data } = await supabase.from('products')
      .select('id, name, sku, unit_price, stock_quantity, barcode, image_url')
      .eq('workspace_id', ws.id).eq('status', 'active').order('name')
    setProducts(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Focus search on key press
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus() }
      if (e.key === 'F5') { e.preventDefault(); if (cart.length) setShowPayment(true) }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [cart])

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id)
      if (existing) {
        return prev.map(i => i.product_id === product.id
          ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unit_price * (1 - i.discount / 100) }
          : i)
      }
      return [...prev, { product_id: product.id, name: product.name, quantity: 1, unit_price: product.unit_price, discount: 0, total: product.unit_price }]
    })
  }

  const updateQty = (productId: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.product_id !== productId) return i
      const newQty = Math.max(0, i.quantity + delta)
      if (newQty === 0) return i
      return { ...i, quantity: newQty, total: newQty * i.unit_price * (1 - i.discount / 100) }
    }).filter(i => i.quantity > 0))
  }

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(i => i.product_id !== productId))
  }

  const subtotal = cart.reduce((s, i) => s + i.total, 0)
  const taxAmount = subtotal * taxRate
  const total = subtotal + taxAmount
  const change = parseFloat(amountPaid || '0') - total

  const completeSale = async () => {
    if (!cart.length) return
    setProcessing(true)

    // Get transaction count
    const { count } = await supabase.from('pos_transactions').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId)
    const num = (count || 0) + 1

    // Create transaction
    const { data: txn } = await supabase.from('pos_transactions').insert({
      workspace_id: workspaceId,
      transaction_number: `POS-${String(num).padStart(5, '0')}`,
      subtotal, tax_amount: taxAmount, total,
      payment_method: paymentMethod,
      amount_paid: parseFloat(amountPaid || '0') || total,
      change_given: Math.max(0, change),
      status: 'completed',
    }).select().single()

    if (txn) {
      // Insert items
      await supabase.from('pos_transaction_items').insert(
        cart.map(item => ({
          transaction_id: txn.id,
          product_id: item.product_id,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount: item.discount,
          total: item.total,
        }))
      )

      // Deduct stock
      for (const item of cart) {
        const { data: product } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single()
        if (product) {
          const newStock = product.stock_quantity - item.quantity
          await supabase.from('products').update({ stock_quantity: newStock }).eq('id', item.product_id)
          await supabase.from('stock_movements').insert({
            workspace_id: workspaceId, product_id: item.product_id,
            type: 'sale', quantity: item.quantity,
            previous_stock: product.stock_quantity, new_stock: newStock,
            reference: txn.transaction_number,
          })
        }
      }

      setLastTransaction({ ...txn, items: cart })
    }

    setCart([])
    setAmountPaid('')
    setShowPayment(false)
    setShowReceipt(true)
    setProcessing(false)
    load() // Refresh stock
  }

  const filtered = products.filter(p => {
    if (!search) return true
    const s = search.toLowerCase()
    return p.name.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s) || p.barcode?.toLowerCase().includes(s)
  })

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in -m-8 flex h-screen">
      {/* Left: Product Grid */}
      <div className="flex-1 flex flex-col bg-surface-50 p-4 overflow-hidden">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input ref={searchRef} className="input pl-9 text-sm w-full" placeholder="Search products or scan barcode (F2)..."
            value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 content-start">
          {filtered.map(product => (
            <button key={product.id} onClick={() => addToCart(product)}
              className="card p-3 text-left hover:shadow-card-hover hover:border-brand-200 transition-all active:scale-95">
              <div className="w-full h-16 bg-surface-100 rounded-lg flex items-center justify-center mb-2">
                {product.image_url ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover rounded-lg" /> : <ShoppingCart className="w-6 h-6 text-surface-300" />}
              </div>
              <p className="text-xs font-semibold text-surface-800 truncate">{product.name}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm font-bold text-brand-600">{formatCurrency(product.unit_price)}</span>
                <span className={cn('text-[10px] font-semibold', product.stock_quantity <= 5 ? 'text-red-500' : 'text-surface-400')}>
                  {product.stock_quantity} left
                </span>
              </div>
            </button>
          ))}
          {filtered.length === 0 && <div className="col-span-full text-center py-12 text-surface-400">No products found</div>}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-96 bg-white border-l border-surface-100 flex flex-col">
        <div className="p-4 border-b border-surface-100">
          <h2 className="font-bold text-surface-900 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" /> Current Sale
            <span className="text-xs bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full ml-auto">{cart.length} items</span>
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cart.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="w-10 h-10 text-surface-200 mx-auto mb-2" />
              <p className="text-xs text-surface-400">Click products to add</p>
              <p className="text-[10px] text-surface-300 mt-1">F2: Search · F5: Pay</p>
            </div>
          ) : cart.map(item => (
            <div key={item.product_id} className="flex items-center gap-2 p-2 bg-surface-50 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-surface-800 truncate">{item.name}</p>
                <p className="text-[10px] text-surface-400">{formatCurrency(item.unit_price)} each</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateQty(item.product_id, -1)} className="w-6 h-6 rounded bg-surface-200 flex items-center justify-center hover:bg-surface-300"><Minus className="w-3 h-3" /></button>
                <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                <button onClick={() => updateQty(item.product_id, 1)} className="w-6 h-6 rounded bg-surface-200 flex items-center justify-center hover:bg-surface-300"><Plus className="w-3 h-3" /></button>
              </div>
              <span className="text-sm font-bold text-surface-900 w-16 text-right">{formatCurrency(item.total)}</span>
              <button onClick={() => removeFromCart(item.product_id)} className="text-surface-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="p-4 border-t border-surface-100 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-surface-500">Subtotal</span><span className="font-semibold">{formatCurrency(subtotal)}</span></div>
          {taxAmount > 0 && <div className="flex justify-between text-sm"><span className="text-surface-500">Tax ({(taxRate * 100).toFixed(1)}%)</span><span>{formatCurrency(taxAmount)}</span></div>}
          <div className="flex justify-between text-lg font-bold border-t border-surface-100 pt-2">
            <span>Total</span><span className="text-brand-600">{formatCurrency(total)}</span>
          </div>
          <button onClick={() => setShowPayment(true)} disabled={!cart.length}
            className="btn-primary w-full py-3 text-sm font-bold disabled:opacity-50">
            <DollarSign className="w-4 h-4" /> Charge {formatCurrency(total)} (F5)
          </button>
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="btn-ghost w-full text-xs text-red-500">Clear Cart</button>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <div className="modal-overlay">
          <div className="modal-panel max-w-sm">
            <div className="modal-header">
              <h2>Payment</h2>
              <button onClick={() => setShowPayment(false)} className="modal-close"><X className="w-4 h-4" /></button>
            </div>
            <div className="modal-body space-y-4">
              <div className="text-center">
                <p className="text-3xl font-extrabold text-brand-600">{formatCurrency(total)}</p>
                <p className="text-xs text-surface-400 mt-1">Total to collect</p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'cash', label: 'Cash', icon: Banknote },
                  { key: 'card', label: 'Card', icon: CreditCard },
                  { key: 'transfer', label: 'Transfer', icon: DollarSign },
                ].map(m => (
                  <button key={m.key} onClick={() => setPaymentMethod(m.key)}
                    className={cn('p-3 rounded-xl text-center transition-all border-2',
                      paymentMethod === m.key ? 'border-brand-500 bg-brand-50' : 'border-surface-100 hover:border-surface-200')}>
                    <m.icon className={cn('w-5 h-5 mx-auto mb-1', paymentMethod === m.key ? 'text-brand-600' : 'text-surface-400')} />
                    <p className="text-[10px] font-semibold">{m.label}</p>
                  </button>
                ))}
              </div>

              {paymentMethod === 'cash' && (
                <div>
                  <label className="label">Amount received</label>
                  <input className="input text-center text-lg font-bold" type="number" value={amountPaid}
                    onChange={e => setAmountPaid(e.target.value)} placeholder={total.toFixed(2)} autoFocus />
                  {change > 0 && (
                    <p className="text-center text-lg font-bold text-emerald-600 mt-2">Change: {formatCurrency(change)}</p>
                  )}
                </div>
              )}

              <button onClick={completeSale} disabled={processing || (paymentMethod === 'cash' && parseFloat(amountPaid || '0') < total && amountPaid !== '')}
                className="btn-primary w-full py-3 text-sm font-bold">
                {processing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Receipt className="w-4 h-4" />}
                Complete Sale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && lastTransaction && (
        <div className="modal-overlay">
          <div className="modal-panel max-w-xs">
            <div className="p-6 text-center">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                <Receipt className="w-6 h-6 text-emerald-600" />
              </div>
              <p className="font-bold text-surface-900">Sale Complete!</p>
              <p className="text-xs text-surface-400 font-mono mt-1">{lastTransaction.transaction_number}</p>
              <p className="text-2xl font-extrabold text-emerald-600 mt-3">{formatCurrency(lastTransaction.total)}</p>
              {(lastTransaction.change_given ?? 0) > 0 && (
                <p className="text-sm text-surface-500 mt-1">Change: {formatCurrency(lastTransaction.change_given ?? 0)}</p>
              )}
              <div className="mt-4 space-y-1 text-xs text-left">
                {lastTransaction.items.map((item: { name: string; quantity: number; price: number; total?: number }, i: number) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-surface-600">{item.quantity}x {item.name}</span>
                    <span className="font-semibold">{formatCurrency(item.total ?? item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowReceipt(false)} className="btn-primary w-full mt-5">New Sale</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
