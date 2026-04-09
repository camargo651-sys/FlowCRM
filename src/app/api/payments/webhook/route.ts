import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

function getSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  return new Stripe(key, { apiVersion: '2025-04-30.basil' as Stripe.LatestApiVersion })
}

// POST: Stripe webhook — handle payment events
export async function POST(request: NextRequest) {
  const stripe = getStripe()
  const supabase = getSupabase()
  if (!stripe || !supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 })

  const body = await request.text()
  const sig = request.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret || !sig) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 503 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 403 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const invoiceId = session.metadata?.invoice_id
    const workspaceId = session.metadata?.workspace_id

    if (invoiceId && workspaceId) {
      const amount = (session.amount_total || 0) / 100

      // Verify invoice belongs to claimed workspace
      const { data: invoice } = await supabase.from('invoices').select('total, amount_paid').eq('id', invoiceId).eq('workspace_id', workspaceId).single()
      if (invoice) {
        const newPaid = (invoice.amount_paid || 0) + amount
        const balance = invoice.total - newPaid
        await supabase.from('invoices').update({
          amount_paid: newPaid, balance_due: balance,
          status: balance <= 0 ? 'paid' : 'partial',
          ...(balance <= 0 ? { paid_at: new Date().toISOString() } : {}),
        }).eq('id', invoiceId)
      }

      // Record payment
      await supabase.from('payments').insert({
        workspace_id: workspaceId, invoice_id: invoiceId,
        amount, currency: (session.currency || 'usd').toUpperCase(),
        method: 'stripe', reference: session.payment_intent as string,
        status: 'completed', payment_date: new Date().toISOString().split('T')[0],
        metadata: { stripe_session_id: session.id },
      })

      // Notify owner
      const { data: ws } = await supabase.from('workspaces').select('owner_id').eq('id', workspaceId).single()
      if (ws) {
        await supabase.from('notifications').insert({
          workspace_id: workspaceId, user_id: ws.owner_id,
          type: 'system', title: `Payment received: $${amount.toFixed(2)}`,
          body: `Stripe payment for invoice completed.`,
          priority: 'high', action_url: '/invoices',
        })
      }
    }
  }

  return NextResponse.json({ received: true })
}
