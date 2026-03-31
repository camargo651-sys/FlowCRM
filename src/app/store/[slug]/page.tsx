'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ShoppingCart, Plus, Minus, X, Package, Send } from 'lucide-react'

interface Product {
  id: string; name: string; short_description: string; description: string;
  unit_price: number; image_url: string | null; stock_quantity: number;
  product_categories?: { name: string } | null;
}

interface CartItem { product: Product; quantity: number }

export default function StorefrontPage() {
  const { slug } = useParams()
  const [store, setStore] = useState<any>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCart, setShowCart] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [orderPlaced, setOrderPlaced] = useState<string | null>(null)
  const [checkoutForm, setCheckoutForm] = useState({ name: '', email: '', phone: '', address: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/store?slug=${slug}`).then(r => r.json()).then(data => {
      if (data.store) { setStore(data.store); setProducts(data.products || []) }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [slug])

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id)
      if (existing) return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { product, quantity: 1 }]
    })
  }

  const updateCartQty = (productId: string, delta: number) => {
    setCart(prev => prev.map(i => i.product.id === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i).filter(i => i.quantity > 0))
  }

  const cartTotal = cart.reduce((s, i) => s + i.product.unit_price * i.quantity, 0)
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)

  const placeOrder = async () => {
    if (!checkoutForm.name || !checkoutForm.email) return
    setSubmitting(true)
    const res = await fetch('/api/store', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug, customer_name: checkoutForm.name, customer_email: checkoutForm.email,
        customer_phone: checkoutForm.phone, shipping_address: checkoutForm.address,
        items: cart.map(i => ({ product_id: i.product.id, quantity: i.quantity })),
      }),
    })
    const data = await res.json()
    if (data.success) {
      setOrderPlaced(data.order_number)
      setCart([]); setShowCheckout(false); setShowCart(false)
    }
    setSubmitting(false)
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><div style={{ width: 32, height: 32, border: '3px solid #e2e8f0', borderTop: '3px solid #6172f3', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /></div>

  if (!store) return (
    <div style={{ textAlign: 'center', padding: '80px 20px', fontFamily: '-apple-system, sans-serif' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b' }}>Store not found</h1>
      <p style={{ color: '#64748b', marginTop: 8 }}>This store doesn't exist or is not active.</p>
    </div>
  )

  if (orderPlaced) return (
    <div style={{ textAlign: 'center', padding: '80px 20px', fontFamily: '-apple-system, sans-serif' }}>
      <div style={{ width: 64, height: 64, background: '#d1fae5', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <span style={{ fontSize: 28 }}>✅</span>
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b' }}>Order Placed!</h1>
      <p style={{ color: '#64748b', marginTop: 8 }}>Your order <strong>{orderPlaced}</strong> has been received.</p>
      <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 4 }}>We'll contact you shortly to confirm.</p>
      <button onClick={() => setOrderPlaced(null)} style={{ marginTop: 24, padding: '10px 24px', background: store.color || '#6172f3', color: 'white', border: 'none', borderRadius: 12, fontWeight: 600, cursor: 'pointer' }}>
        Continue Shopping
      </button>
    </div>
  )

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', color: '#1e293b', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <header style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {store.logo && <img src={store.logo} style={{ width: 32, height: 32, borderRadius: 8 }} />}
          <span style={{ fontWeight: 800, fontSize: 18 }}>{store.name}</span>
        </div>
        <button onClick={() => setShowCart(true)} style={{ position: 'relative', padding: '8px 16px', background: store.color || '#6172f3', color: 'white', border: 'none', borderRadius: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          🛒 Cart {cartCount > 0 && <span style={{ background: 'white', color: store.color || '#6172f3', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>{cartCount}</span>}
        </button>
      </header>

      {/* Store description */}
      {store.description && (
        <div style={{ textAlign: 'center', padding: '32px 24px 16px' }}>
          <p style={{ color: '#64748b', fontSize: 14 }}>{store.description}</p>
        </div>
      )}

      {/* Products */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
        {products.map(product => (
          <div key={product.id} style={{ background: 'white', borderRadius: 16, overflow: 'hidden', border: '1px solid #e2e8f0', transition: 'box-shadow 0.2s' }}>
            <div style={{ height: 180, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {product.image_url ? <img src={product.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 40, opacity: 0.3 }}>📦</span>}
            </div>
            <div style={{ padding: 16 }}>
              <h3 style={{ fontWeight: 700, fontSize: 14 }}>{product.name}</h3>
              {product.short_description && <p style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>{product.short_description}</p>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: store.color || '#6172f3' }}>${product.unit_price.toLocaleString()}</span>
                <button onClick={() => addToCart(product)} disabled={product.stock_quantity <= 0}
                  style={{ padding: '8px 16px', background: product.stock_quantity > 0 ? (store.color || '#6172f3') : '#e2e8f0', color: product.stock_quantity > 0 ? 'white' : '#94a3b8', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 12, cursor: product.stock_quantity > 0 ? 'pointer' : 'default' }}>
                  {product.stock_quantity > 0 ? 'Add to Cart' : 'Out of Stock'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {products.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>No products available yet.</div>
      )}

      {/* Cart Sidebar */}
      {showCart && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowCart(false)} />
          <div style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: 380, background: 'white', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 20, borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontWeight: 700 }}>Cart ({cartCount})</h2>
              <button onClick={() => setShowCart(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
              {cart.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>Your cart is empty</p>
              ) : cart.map(item => (
                <div key={item.product.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: 13 }}>{item.product.name}</p>
                    <p style={{ color: '#64748b', fontSize: 12 }}>${item.product.unit_price.toLocaleString()}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => updateCartQty(item.product.id, -1)} style={{ width: 28, height: 28, borderRadius: 6, background: '#f1f5f9', border: 'none', cursor: 'pointer', fontWeight: 700 }}>−</button>
                    <span style={{ fontWeight: 700, width: 24, textAlign: 'center' }}>{item.quantity}</span>
                    <button onClick={() => updateCartQty(item.product.id, 1)} style={{ width: 28, height: 28, borderRadius: 6, background: '#f1f5f9', border: 'none', cursor: 'pointer', fontWeight: 700 }}>+</button>
                  </div>
                  <span style={{ fontWeight: 700, minWidth: 60, textAlign: 'right' }}>${(item.product.unit_price * item.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div style={{ padding: 16, borderTop: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 18, marginBottom: 16 }}>
                  <span>Total</span><span style={{ color: store.color || '#6172f3' }}>${cartTotal.toLocaleString()}</span>
                </div>
                <button onClick={() => { setShowCart(false); setShowCheckout(true) }}
                  style={{ width: '100%', padding: 14, background: store.color || '#6172f3', color: 'white', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}>
                  Checkout
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowCheckout(false)} />
          <div style={{ position: 'relative', background: 'white', borderRadius: 20, width: '100%', maxWidth: 420, padding: 24 }}>
            <h2 style={{ fontWeight: 700, marginBottom: 16 }}>Checkout — ${cartTotal.toLocaleString()}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input style={{ padding: 12, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 14 }} placeholder="Full name *" value={checkoutForm.name} onChange={e => setCheckoutForm(f => ({ ...f, name: e.target.value }))} />
              <input style={{ padding: 12, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 14 }} type="email" placeholder="Email *" value={checkoutForm.email} onChange={e => setCheckoutForm(f => ({ ...f, email: e.target.value }))} />
              <input style={{ padding: 12, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 14 }} placeholder="Phone" value={checkoutForm.phone} onChange={e => setCheckoutForm(f => ({ ...f, phone: e.target.value }))} />
              <input style={{ padding: 12, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 14 }} placeholder="Shipping address" value={checkoutForm.address} onChange={e => setCheckoutForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button onClick={() => setShowCheckout(false)} style={{ flex: 1, padding: 12, background: '#f1f5f9', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={placeOrder} disabled={!checkoutForm.name || !checkoutForm.email || submitting}
                style={{ flex: 1, padding: 12, background: store.color || '#6172f3', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', opacity: (!checkoutForm.name || !checkoutForm.email) ? 0.5 : 1 }}>
                {submitting ? 'Placing...' : 'Place Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', fontSize: 12 }}>
        Powered by Tracktio
      </footer>
    </div>
  )
}
