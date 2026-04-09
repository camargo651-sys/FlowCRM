'use client'
import { toast } from 'sonner'
import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ShoppingCart, Plus, Minus, Trash2, Search, DollarSign, CreditCard, X, Receipt, Banknote, History, Percent, User, Printer, BarChart3, Pause, Play, AlertTriangle } from 'lucide-react'
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

interface Contact {
  id: string
  name: string
  email: string | null
}

interface PosTransaction {
  id: string
  transaction_number: string
  created_at: string
  total: number
  payment_method: string
  subtotal: number
  tax_amount: number
  change_given: number
  amount_paid: number
  pos_transaction_items?: { name: string; quantity: number; unit_price: number; total: number }[]
}

interface HeldCart {
  label: string
  items: CartItem[]
  total: number
  heldAt: string
  contactId?: string
  contactName?: string
}

interface DailySummary {
  totalSales: number
  totalRevenue: number
  byCash: number
  byCard: number
  byTransfer: number
  topProducts: { name: string; qty: number }[]
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
  const [lastTransaction, setLastTransaction] = useState<{ id: string; total: number; payment_method: string; items: { name: string; quantity: number; price: number; total?: number; discount?: number; unit_price?: number }[]; created_at: string; transaction_number?: string; change_given?: number; subtotal?: number; tax_amount?: number; amount_paid?: number } | null>(null)
  const [processing, setProcessing] = useState(false)
  const [taxRate, setTaxRate] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)

  // Feature 1: Transaction History
  const [showHistory, setShowHistory] = useState(false)
  const [transactions, setTransactions] = useState<PosTransaction[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Feature 2: Item Discount
  const [editingDiscount, setEditingDiscount] = useState<string | null>(null)

  // Feature 3: Customer/Contact Link
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [contactSearch, setContactSearch] = useState('')
  const [contactResults, setContactResults] = useState<Contact[]>([])
  const [showContactDropdown, setShowContactDropdown] = useState(false)

  // Feature 5: Daily Summary
  const [showDailySummary, setShowDailySummary] = useState(false)
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)

  // Feature 6: Hold/Park Sale
  const [showHeldCarts, setShowHeldCarts] = useState(false)
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([])

  // Feature 7: Mobile Responsive
  const [mobileCartOpen, setMobileCartOpen] = useState(false)

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

    // Load held carts from localStorage
    try {
      const stored = localStorage.getItem(`pos_held_carts_${ws.id}`)
      if (stored) setHeldCarts(JSON.parse(stored))
    } catch { /* ignore */ }
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

  // Feature 3: Contact search
  useEffect(() => {
    if (!contactSearch || contactSearch.length < 2 || !workspaceId) {
      setContactResults([])
      return
    }
    const timeout = setTimeout(async () => {
      const { data } = await supabase.from('contacts')
        .select('id, name, email')
        .eq('workspace_id', workspaceId)
        .or(`name.ilike.%${contactSearch}%,email.ilike.%${contactSearch}%`)
        .limit(8)
      setContactResults(data || [])
    }, 300)
    return () => clearTimeout(timeout)
  }, [contactSearch, workspaceId])

  // Feature 8: Stock Zero Prevention
  const addToCart = (product: Product) => {
    if (product.stock_quantity <= 0) {
      toast.error('Out of stock')
      return
    }
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id)
      if (existing) {
        if (existing.quantity >= product.stock_quantity) {
          toast.error(`Only ${product.stock_quantity} available`)
          return prev
        }
        return prev.map(i => i.product_id === product.id
          ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unit_price * (1 - i.discount / 100) }
          : i)
      }
      return [...prev, { product_id: product.id, name: product.name, quantity: 1, unit_price: product.unit_price, discount: 0, total: product.unit_price }]
    })
  }

  // Feature 8: Stock limit in updateQty
  const updateQty = (productId: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.product_id !== productId) return i
      const product = products.find(p => p.id === productId)
      const newQty = Math.max(0, i.quantity + delta)
      if (newQty === 0) return i
      if (product && newQty > product.stock_quantity) {
        toast.error(`Only ${product.stock_quantity} available`)
        return i
      }
      return { ...i, quantity: newQty, total: newQty * i.unit_price * (1 - i.discount / 100) }
    }).filter(i => i.quantity > 0))
  }

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(i => i.product_id !== productId))
  }

  // Feature 2: Update item discount
  const updateItemDiscount = (productId: string, discountStr: string) => {
    const discount = Math.max(0, Math.min(100, parseFloat(discountStr) || 0))
    setCart(prev => prev.map(i => {
      if (i.product_id !== productId) return i
      return { ...i, discount, total: i.quantity * i.unit_price * (1 - discount / 100) }
    }))
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

    // Create transaction (Feature 3: include contact_id)
    const insertData: Record<string, unknown> = {
      workspace_id: workspaceId,
      transaction_number: `POS-${String(num).padStart(5, '0')}`,
      subtotal, tax_amount: taxAmount, total,
      payment_method: paymentMethod,
      amount_paid: parseFloat(amountPaid || '0') || total,
      change_given: Math.max(0, change),
      status: 'completed',
    }
    if (selectedContact) {
      insertData.contact_id = selectedContact.id
    }

    const { data: txn } = await supabase.from('pos_transactions').insert(insertData).select().single()

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
    setSelectedContact(null)
    setContactSearch('')
    load() // Refresh stock
  }

  // Feature 1: Load transaction history
  const loadHistory = async () => {
    setLoadingHistory(true)
    const { data } = await supabase.from('pos_transactions')
      .select('id, transaction_number, created_at, total, payment_method, subtotal, tax_amount, change_given, amount_paid, pos_transaction_items(name, quantity, unit_price, total)')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(50)
    setTransactions(data || [])
    setLoadingHistory(false)
  }

  const toggleHistory = () => {
    if (!showHistory) loadHistory()
    setShowHistory(!showHistory)
  }

  const viewTransactionReceipt = (txn: PosTransaction) => {
    setLastTransaction({
      id: txn.id,
      total: txn.total,
      payment_method: txn.payment_method,
      items: (txn.pos_transaction_items || []).map(it => ({ name: it.name, quantity: it.quantity, price: it.unit_price * it.quantity, total: it.total, unit_price: it.unit_price })),
      created_at: txn.created_at,
      transaction_number: txn.transaction_number,
      change_given: txn.change_given,
      subtotal: txn.subtotal,
      tax_amount: txn.tax_amount,
      amount_paid: txn.amount_paid,
    })
    setShowReceipt(true)
  }

  // Feature 4: Print receipt
  const printReceipt = () => {
    if (!lastTransaction) return
    const items = lastTransaction.items
    const html = `<!DOCTYPE html><html><head><title>Receipt ${lastTransaction.transaction_number || ''}</title>
      <style>body{font-family:monospace;max-width:280px;margin:0 auto;padding:20px;font-size:12px}
      .center{text-align:center}.bold{font-weight:bold}.line{border-top:1px dashed #000;margin:8px 0}
      .row{display:flex;justify-content:space-between}.mt{margin-top:4px}
      @media print{body{margin:0;padding:10px}}</style></head><body>
      <div class="center bold" style="font-size:16px">Receipt</div>
      <div class="center mt">${lastTransaction.transaction_number || ''}</div>
      <div class="center mt">${new Date(lastTransaction.created_at).toLocaleString()}</div>
      <div class="line"></div>
      ${items.map(it => `<div class="row"><span>${it.quantity}x ${it.name}</span><span>${formatCurrency(it.total ?? it.price * it.quantity)}</span></div>`).join('')}
      <div class="line"></div>
      ${lastTransaction.subtotal != null ? `<div class="row"><span>Subtotal</span><span>${formatCurrency(lastTransaction.subtotal)}</span></div>` : ''}
      ${lastTransaction.tax_amount ? `<div class="row"><span>Tax</span><span>${formatCurrency(lastTransaction.tax_amount)}</span></div>` : ''}
      <div class="row bold" style="font-size:14px"><span>Total</span><span>${formatCurrency(lastTransaction.total)}</span></div>
      <div class="line"></div>
      <div class="row"><span>Payment</span><span>${lastTransaction.payment_method}</span></div>
      ${lastTransaction.amount_paid ? `<div class="row"><span>Paid</span><span>${formatCurrency(lastTransaction.amount_paid)}</span></div>` : ''}
      ${(lastTransaction.change_given ?? 0) > 0 ? `<div class="row"><span>Change</span><span>${formatCurrency(lastTransaction.change_given ?? 0)}</span></div>` : ''}
      <div class="line"></div>
      <div class="center mt">Thank you!</div>
      <script>window.onload=function(){window.print();}</script></body></html>`
    const win = window.open('', '_blank', 'width=320,height=600')
    if (win) { win.document.write(html); win.document.close() }
  }

  // Feature 5: Daily Summary
  const loadDailySummary = async () => {
    setLoadingSummary(true)
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { data: txns } = await supabase.from('pos_transactions')
      .select('id, total, payment_method, pos_transaction_items(name, quantity)')
      .eq('workspace_id', workspaceId)
      .eq('status', 'completed')
      .gte('created_at', todayStart.toISOString())

    const list = txns || []
    const totalRevenue = list.reduce((s, t) => s + (t.total || 0), 0)
    const byCash = list.filter(t => t.payment_method === 'cash').reduce((s, t) => s + (t.total || 0), 0)
    const byCard = list.filter(t => t.payment_method === 'card').reduce((s, t) => s + (t.total || 0), 0)
    const byTransfer = list.filter(t => t.payment_method === 'transfer').reduce((s, t) => s + (t.total || 0), 0)

    // Top products
    const productMap: Record<string, number> = {}
    list.forEach(t => {
      (t.pos_transaction_items || []).forEach((it: { name: string; quantity: number }) => {
        productMap[it.name] = (productMap[it.name] || 0) + it.quantity
      })
    })
    const topProducts = Object.entries(productMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, qty]) => ({ name, qty }))

    setDailySummary({ totalSales: list.length, totalRevenue, byCash, byCard, byTransfer, topProducts })
    setLoadingSummary(false)
    setShowDailySummary(true)
  }

  // Feature 6: Hold/Park Sale
  const holdCurrentSale = () => {
    if (!cart.length) return
    const label = new Date().toLocaleTimeString()
    const held: HeldCart = { label, items: [...cart], total, heldAt: new Date().toISOString(), contactId: selectedContact?.id, contactName: selectedContact?.name }
    const updated = [...heldCarts, held]
    setHeldCarts(updated)
    localStorage.setItem(`pos_held_carts_${workspaceId}`, JSON.stringify(updated))
    setCart([])
    setSelectedContact(null)
    setContactSearch('')
    toast.success('Sale held')
  }

  const resumeHeldCart = (index: number) => {
    const held = heldCarts[index]
    if (!held) return
    setCart(held.items)
    if (held.contactId && held.contactName) {
      setSelectedContact({ id: held.contactId, name: held.contactName, email: null })
    }
    const updated = heldCarts.filter((_, i) => i !== index)
    setHeldCarts(updated)
    localStorage.setItem(`pos_held_carts_${workspaceId}`, JSON.stringify(updated))
    setShowHeldCarts(false)
    toast.success('Sale resumed')
  }

  const removeHeldCart = (index: number) => {
    const updated = heldCarts.filter((_, i) => i !== index)
    setHeldCarts(updated)
    localStorage.setItem(`pos_held_carts_${workspaceId}`, JSON.stringify(updated))
  }

  const filtered = products.filter(p => {
    if (!search) return true
    const s = search.toLowerCase()
    return p.name.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s) || p.barcode?.toLowerCase().includes(s)
  })

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  const cartItemCount = cart.reduce((s, i) => s + i.quantity, 0)

  return (
    <div className="animate-fade-in -m-8 flex h-screen relative">
      {/* Left: Product Grid + History */}
      <div className="flex-1 flex flex-col bg-surface-50 p-4 overflow-hidden">
        {/* Header row with search + buttons */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input ref={searchRef} className="input pl-9 text-sm w-full" placeholder="Search products or scan barcode (F2)..."
              value={search} onChange={e => setSearch(e.target.value)} autoFocus />
          </div>
          <button onClick={toggleHistory} className={cn('btn-ghost px-3 flex items-center gap-1.5 text-xs font-semibold border', showHistory ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-surface-200')}>
            <History className="w-4 h-4" /> History
          </button>
          <button onClick={loadDailySummary} className="btn-ghost px-3 flex items-center gap-1.5 text-xs font-semibold border border-surface-200">
            <BarChart3 className="w-4 h-4" /> Summary
          </button>
        </div>

        {/* Feature 1: Transaction History View */}
        {showHistory ? (
          <div className="flex-1 overflow-y-auto">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-12 text-surface-400 text-sm">No transactions found</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-surface-500 border-b border-surface-200">
                    <th className="pb-2 font-medium">Transaction</th>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Items</th>
                    <th className="pb-2 font-medium">Payment</th>
                    <th className="pb-2 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(txn => (
                    <tr key={txn.id} onClick={() => viewTransactionReceipt(txn)}
                      className="border-b border-surface-100 hover:bg-surface-100 cursor-pointer transition-colors">
                      <td className="py-2 font-mono text-xs">{txn.transaction_number}</td>
                      <td className="py-2 text-xs text-surface-600">{new Date(txn.created_at).toLocaleString()}</td>
                      <td className="py-2 text-xs">{txn.pos_transaction_items?.length || 0}</td>
                      <td className="py-2"><span className="text-xs px-1.5 py-0.5 rounded bg-surface-100 capitalize">{txn.payment_method}</span></td>
                      <td className="py-2 text-right font-semibold">{formatCurrency(txn.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          /* Product Grid */
          <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 content-start">
            {filtered.map(product => {
              const outOfStock = product.stock_quantity <= 0
              return (
                <button key={product.id} onClick={() => addToCart(product)}
                  disabled={outOfStock}
                  className={cn('card p-3 text-left transition-all active:scale-95 relative',
                    outOfStock ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-card-hover hover:border-brand-200')}>
                  {/* Feature 8: Out of stock overlay */}
                  {outOfStock && (
                    <div className="absolute inset-0 bg-surface-50/60 rounded-xl flex items-center justify-center z-10">
                      <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-1 rounded-full flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Out of stock
                      </span>
                    </div>
                  )}
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
              )
            })}
            {filtered.length === 0 && <div className="col-span-full text-center py-12 text-surface-400">No products found</div>}
          </div>
        )}
      </div>

      {/* Right: Cart - Feature 7: responsive */}
      <div className={cn('bg-white border-l border-surface-100 flex flex-col',
        'hidden md:flex md:w-96',
        mobileCartOpen && 'fixed inset-0 z-50 flex w-full md:relative md:inset-auto md:w-96')}>
        {/* Mobile close button */}
        {mobileCartOpen && (
          <button onClick={() => setMobileCartOpen(false)} className="md:hidden absolute top-3 right-3 z-10 p-1 rounded-full bg-surface-100">
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="p-4 border-b border-surface-100">
          <h2 className="font-bold text-surface-900 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" /> Current Sale
            <span className="text-xs bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full ml-auto">{cart.length} items</span>
          </h2>
          {/* Feature 3: Customer Selector */}
          <div className="mt-2 relative">
            {selectedContact ? (
              <div className="flex items-center gap-2 text-xs bg-brand-50 border border-brand-200 rounded-lg px-2.5 py-1.5">
                <User className="w-3.5 h-3.5 text-brand-600" />
                <span className="font-semibold text-brand-700 flex-1 truncate">{selectedContact.name}</span>
                <button onClick={() => { setSelectedContact(null); setContactSearch('') }} className="text-brand-400 hover:text-brand-600">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400" />
                <input className="input pl-8 text-xs w-full py-1.5" placeholder="Search customer (optional)..."
                  value={contactSearch}
                  onChange={e => { setContactSearch(e.target.value); setShowContactDropdown(true) }}
                  onFocus={() => setShowContactDropdown(true)}
                  onBlur={() => setTimeout(() => setShowContactDropdown(false), 200)} />
              </div>
            )}
            {showContactDropdown && contactResults.length > 0 && (
              <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-surface-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {contactResults.map(c => (
                  <button key={c.id} className="w-full text-left px-3 py-2 text-xs hover:bg-surface-50 flex items-center gap-2"
                    onMouseDown={() => { setSelectedContact(c); setContactSearch(''); setShowContactDropdown(false) }}>
                    <User className="w-3 h-3 text-surface-400" />
                    <span className="font-semibold">{c.name}</span>
                    {c.email && <span className="text-surface-400 truncate">{c.email}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
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
                {/* Feature 2: Discount display */}
                <div className="flex items-center gap-1.5">
                  {item.discount > 0 ? (
                    <>
                      <span className="text-[10px] text-surface-400 line-through">{formatCurrency(item.unit_price)}</span>
                      <span className="text-[10px] text-emerald-600 font-semibold">{formatCurrency(item.unit_price * (1 - item.discount / 100))}</span>
                    </>
                  ) : (
                    <span className="text-[10px] text-surface-400">{formatCurrency(item.unit_price)} each</span>
                  )}
                  {/* Discount toggle */}
                  {editingDiscount === item.product_id ? (
                    <div className="flex items-center gap-0.5">
                      <input className="w-10 text-[10px] px-1 py-0.5 border border-surface-300 rounded text-center"
                        type="number" min="0" max="100" autoFocus
                        defaultValue={item.discount || ''}
                        placeholder="0"
                        onBlur={e => { updateItemDiscount(item.product_id, e.target.value); setEditingDiscount(null) }}
                        onKeyDown={e => { if (e.key === 'Enter') { updateItemDiscount(item.product_id, (e.target as HTMLInputElement).value); setEditingDiscount(null) } }} />
                      <span className="text-[10px] text-surface-400">%</span>
                    </div>
                  ) : (
                    <button onClick={() => setEditingDiscount(item.product_id)}
                      className={cn('w-4 h-4 rounded flex items-center justify-center', item.discount > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-surface-200 text-surface-400 hover:bg-surface-300')}>
                      <Percent className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
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
          {/* Feature 6: Hold & Resume buttons */}
          <div className="flex gap-2">
            {cart.length > 0 && (
              <button onClick={holdCurrentSale} className="btn-ghost flex-1 text-xs flex items-center justify-center gap-1 border border-surface-200">
                <Pause className="w-3.5 h-3.5" /> Hold
              </button>
            )}
            {heldCarts.length > 0 && (
              <button onClick={() => setShowHeldCarts(true)} className="btn-ghost flex-1 text-xs flex items-center justify-center gap-1 border border-amber-300 bg-amber-50 text-amber-700">
                <Play className="w-3.5 h-3.5" /> Resume ({heldCarts.length})
              </button>
            )}
          </div>
          {cart.length > 0 && (
            <button onClick={() => { setCart([]); setSelectedContact(null); setContactSearch('') }} className="btn-ghost w-full text-xs text-red-500">Clear Cart</button>
          )}
        </div>
      </div>

      {/* Feature 7: Mobile floating cart badge */}
      {!mobileCartOpen && (
        <button onClick={() => setMobileCartOpen(true)}
          className="md:hidden fixed bottom-6 right-6 z-40 bg-brand-600 text-white rounded-2xl px-4 py-3 shadow-lg flex items-center gap-2 active:scale-95 transition-transform">
          <ShoppingCart className="w-5 h-5" />
          {cartItemCount > 0 && (
            <>
              <span className="text-sm font-bold">{cartItemCount}</span>
              <span className="text-xs opacity-80">·</span>
              <span className="text-sm font-semibold">{formatCurrency(total)}</span>
            </>
          )}
        </button>
      )}

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
                {selectedContact && <p className="text-xs text-brand-600 mt-1">Customer: {selectedContact.name}</p>}
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
                {lastTransaction.items.map((item: { name: string; quantity: number; price: number; total?: number; discount?: number; unit_price?: number }, i: number) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-surface-600">{item.quantity}x {item.name}{item.discount ? ` (-${item.discount}%)` : ''}</span>
                    <span className="font-semibold">{formatCurrency(item.total ?? item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-5">
                {/* Feature 4: Print button */}
                <button onClick={printReceipt} className="btn-ghost flex-1 flex items-center justify-center gap-1.5 text-xs border border-surface-200">
                  <Printer className="w-4 h-4" /> Print
                </button>
                <button onClick={() => setShowReceipt(false)} className="btn-primary flex-1">New Sale</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feature 5: Daily Summary Modal */}
      {showDailySummary && (
        <div className="modal-overlay">
          <div className="modal-panel max-w-sm">
            <div className="modal-header">
              <h2>Daily Summary</h2>
              <button onClick={() => setShowDailySummary(false)} className="modal-close"><X className="w-4 h-4" /></button>
            </div>
            <div className="modal-body space-y-4">
              {loadingSummary ? (
                <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>
              ) : dailySummary ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-brand-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-extrabold text-brand-600">{dailySummary.totalSales}</p>
                      <p className="text-[10px] text-brand-500 font-semibold">Total Sales</p>
                    </div>
                    <div className="bg-emerald-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-extrabold text-emerald-600">{formatCurrency(dailySummary.totalRevenue)}</p>
                      <p className="text-[10px] text-emerald-500 font-semibold">Revenue</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-surface-700">By Payment Method</p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="flex items-center gap-1.5"><Banknote className="w-3.5 h-3.5 text-surface-400" /> Cash</span>
                        <span className="font-semibold">{formatCurrency(dailySummary.byCash)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5 text-surface-400" /> Card</span>
                        <span className="font-semibold">{formatCurrency(dailySummary.byCard)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-surface-400" /> Transfer</span>
                        <span className="font-semibold">{formatCurrency(dailySummary.byTransfer)}</span>
                      </div>
                    </div>
                  </div>
                  {dailySummary.topProducts.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-surface-700">Top Products</p>
                      <div className="space-y-1.5">
                        {dailySummary.topProducts.map((p, i) => (
                          <div key={i} className="flex justify-between items-center text-xs">
                            <span className="text-surface-600 truncate">{p.name}</span>
                            <span className="font-semibold text-surface-800">{p.qty} sold</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-center text-surface-400 text-sm py-4">No data</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Feature 6: Held Carts Modal */}
      {showHeldCarts && (
        <div className="modal-overlay">
          <div className="modal-panel max-w-sm">
            <div className="modal-header">
              <h2>Held Sales</h2>
              <button onClick={() => setShowHeldCarts(false)} className="modal-close"><X className="w-4 h-4" /></button>
            </div>
            <div className="modal-body space-y-2">
              {heldCarts.length === 0 ? (
                <p className="text-center text-surface-400 text-sm py-4">No held sales</p>
              ) : heldCarts.map((held, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-surface-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-surface-800">Held at {held.label}</p>
                    <p className="text-[10px] text-surface-400">{held.items.length} items · {formatCurrency(held.total)}</p>
                    {held.contactName && <p className="text-[10px] text-brand-600">{held.contactName}</p>}
                  </div>
                  <button onClick={() => resumeHeldCart(i)} className="btn-ghost text-xs border border-brand-300 text-brand-600 px-2 py-1">
                    <Play className="w-3 h-3" /> Resume
                  </button>
                  <button onClick={() => removeHeldCart(i)} className="text-surface-300 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
