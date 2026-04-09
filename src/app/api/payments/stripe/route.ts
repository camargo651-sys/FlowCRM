import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

function getSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )
}

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Stripe API version may not be in type definitions yet
  return new Stripe(key, { apiVersion: '2025-04-30.basil' as Stripe.LatestApiVersion })
}

// POST: Create a Stripe checkout session for an invoice
export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const stripe = getStripe()
  if (!stripe) return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })

  const { invoice_id, success_url, cancel_url } = await request.json()
  if (!invoice_id) return NextResponse.json({ error: 'Missing invoice_id' }, { status: 400 })

  // Get invoice (scoped to user's workspace)
  const { data: wsData } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
  if (!wsData) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const { data: invoice } = await supabase.from('invoices')
    .select('*, contacts(name, email), invoice_items(*)')
    .eq('id', invoice_id).eq('workspace_id', wsData.id).single()

  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  // Create Stripe checkout session
  const lineItems = (invoice.invoice_items || []).map((item: { description: string; unit_price: number; quantity: number }) => ({
    price_data: {
      currency: (invoice.currency || 'usd').toLowerCase(),
      product_data: { name: item.description },
      unit_amount: Math.round(item.unit_price * 100),
    },
    quantity: item.quantity,
  }))

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: lineItems,
    mode: 'payment',
    success_url: success_url || `${process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || ''}/invoices?paid=${encodeURIComponent(invoice_id)}`,
    cancel_url: cancel_url || `${process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || ''}/invoices`,
    customer_email: (invoice as { contacts?: { email?: string } }).contacts?.email || undefined,
    metadata: { invoice_id, workspace_id: invoice.workspace_id },
  })

  return NextResponse.json({ url: session.url, session_id: session.id })
}
