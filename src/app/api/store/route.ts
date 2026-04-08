import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

// GET: Public product catalog for a store
export async function GET(request: NextRequest) {
  const supabase = getSupabase()
  if (!supabase) return NextResponse.json({ error: 'Service not configured' }, { status: 503 })

  const slug = request.nextUrl.searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 })

  const { data: ws } = await supabase.from('workspaces').select('id, store_name, store_description, name, primary_color, logo_url')
    .eq('slug', slug).eq('store_enabled', true).single()
  if (!ws) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const { data: products } = await supabase.from('products')
    .select('id, name, short_description, description, unit_price, image_url, stock_quantity, product_categories(name)')
    .eq('workspace_id', ws.id).eq('status', 'active').eq('published', true)
    .order('name')

  return NextResponse.json({
    store: { name: ws.store_name || ws.name, description: ws.store_description, color: ws.primary_color, logo: ws.logo_url },
    products: products || [],
  })
}

// POST: Place an order
export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  if (!supabase) return NextResponse.json({ error: 'Service not configured' }, { status: 503 })

  const body = await request.json()
  const { slug, customer_name, customer_email, customer_phone, shipping_address, items } = body

  if (!slug || !customer_name || !customer_email || !items?.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data: ws } = await supabase.from('workspaces').select('id').eq('slug', slug).eq('store_enabled', true).single()
  if (!ws) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  // Validate products and calculate totals
  let subtotal = 0
  const orderItems: { product_id: string; name?: string; description?: string; quantity: number; unit_price: number; total: number }[] = []
  for (const item of items) {
    const { data: product } = await supabase.from('products')
      .select('id, name, unit_price, stock_quantity')
      .eq('id', item.product_id).eq('workspace_id', ws.id).eq('published', true).single()
    if (!product) continue
    if (product.stock_quantity < item.quantity) continue

    const lineTotal = product.unit_price * item.quantity
    subtotal += lineTotal
    orderItems.push({ product_id: product.id, name: product.name, quantity: item.quantity, unit_price: product.unit_price, total: lineTotal })
  }

  if (!orderItems.length) return NextResponse.json({ error: 'No valid items' }, { status: 400 })

  const total = subtotal

  // Create order
  const { count } = await supabase.from('store_orders').select('id', { count: 'exact', head: true }).eq('workspace_id', ws.id)
  const num = (count || 0) + 1

  const { data: order } = await supabase.from('store_orders').insert({
    workspace_id: ws.id,
    order_number: `ORD-${String(num).padStart(5, '0')}`,
    customer_name, customer_email, customer_phone: customer_phone || null,
    shipping_address: shipping_address || null,
    subtotal, total, status: 'pending', payment_status: 'pending',
  }).select('id, order_number').single()

  if (order) {
    await supabase.from('store_order_items').insert(orderItems.map(i => ({ order_id: order.id, ...i })))

    // Deduct stock
    for (const item of orderItems) {
      const { data: product } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single()
      if (product) {
        await supabase.from('products').update({ stock_quantity: product.stock_quantity - item.quantity }).eq('id', item.product_id)
        await supabase.from('stock_movements').insert({
          workspace_id: ws.id, product_id: item.product_id,
          type: 'sale', quantity: item.quantity,
          previous_stock: product.stock_quantity, new_stock: product.stock_quantity - item.quantity,
          reference: `Store Order ${order.order_number}`,
        })
      }
    }

    // Auto-create contact if not exists
    const { data: existing } = await supabase.from('contacts').select('id').eq('workspace_id', ws.id).ilike('email', customer_email).single()
    if (!existing) {
      const { data: newContact } = await supabase.from('contacts').insert({
        workspace_id: ws.id, name: customer_name, email: customer_email,
        phone: customer_phone || null, type: 'person', tags: ['e-commerce', 'store'],
      }).select('id').single()
      if (newContact) {
        await supabase.from('store_orders').update({ contact_id: newContact.id }).eq('id', order.id)
      }
    } else {
      await supabase.from('store_orders').update({ contact_id: existing.id }).eq('id', order.id)
    }

    // Notify workspace owner
    const { data: wsOwner } = await supabase.from('workspaces').select('owner_id').eq('id', ws.id).single()
    if (wsOwner) {
      await supabase.from('notifications').insert({
        workspace_id: ws.id, user_id: wsOwner.owner_id,
        type: 'system', title: `New order: ${order.order_number}`,
        body: `${customer_name} placed an order for $${total.toFixed(2)}`,
        priority: 'high',
      })
    }
  }

  return NextResponse.json({ success: true, order_number: order?.order_number })
}
