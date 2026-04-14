import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

function getServiceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

// Manual Stripe webhook signature verification (avoids Stripe lib dependency here).
// Stripe-Signature header format: t=TIMESTAMP,v1=HEX_SIG[,v1=HEX_SIG...]
function verifyStripeSignature(payload: string, header: string | null, secret: string): boolean {
  if (!header) return false
  const parts = Object.fromEntries(
    header.split(',').map((p) => {
      const [k, ...v] = p.split('=')
      return [k, v.join('=')]
    }),
  ) as Record<string, string>
  const t = parts.t
  const v1 = parts.v1
  if (!t || !v1) return false
  const signedPayload = `${t}.${payload}`
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1, 'hex'))
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  const supabase = getServiceSupabase()
  if (!supabase) return NextResponse.json({ error: 'Service not configured' }, { status: 503 })

  const rawBody = await request.text()

  let event: { type?: string; data?: { object?: Record<string, unknown> } }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const type = event.type
  const obj = (event.data?.object || {}) as Record<string, unknown>

  // Per-workspace webhook secret lookup.
  // Payment-link handlers stash `metadata.workspace_id` on checkout.session /
  // payment_intent objects. If present, prefer the workspace's own secret
  // stored in integrations.config.webhook_secret.
  const metadataEarly = (obj.metadata || {}) as Record<string, string>
  const wsIdEarly = metadataEarly.workspace_id

  let webhookSecret: string | null = null
  if (wsIdEarly) {
    const { data: integ } = await supabase
      .from('integrations')
      .select('config')
      .eq('workspace_id', wsIdEarly)
      .eq('key', 'stripe')
      .maybeSingle()
    const cfg = (integ?.config || {}) as { webhook_secret?: string }
    if (cfg.webhook_secret) webhookSecret = cfg.webhook_secret
  }
  if (!webhookSecret) webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || null

  if (webhookSecret) {
    const sig = request.headers.get('stripe-signature')
    if (!verifyStripeSignature(rawBody, sig, webhookSecret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }
  } else {
    console.warn('[webhooks/stripe] no webhook secret configured — skipping signature verification')
  }

  try {
    if (type === 'checkout.session.completed' || type === 'payment_intent.succeeded') {
      const metadata = (obj.metadata || {}) as Record<string, string>
      const invoiceId = metadata.invoice_id
      const workspaceId = metadata.workspace_id
      if (invoiceId && workspaceId) {
        const paidAmount = typeof obj.amount_total === 'number'
          ? (obj.amount_total as number) / 100
          : typeof obj.amount_received === 'number'
            ? (obj.amount_received as number) / 100
            : null

        await supabase
          .from('invoices')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            balance_due: 0,
            ...(paidAmount !== null ? { amount_paid: paidAmount } : {}),
          })
          .eq('id', invoiceId)
          .eq('workspace_id', workspaceId)

        const { data: ws } = await supabase
          .from('workspaces')
          .select('owner_id')
          .eq('id', workspaceId)
          .single()

        if (ws?.owner_id) {
          await supabase.from('notifications').insert({
            workspace_id: workspaceId,
            user_id: ws.owner_id,
            type: 'invoice_paid',
            title: 'Invoice paid',
            body: `An invoice was paid via Stripe${paidAmount !== null ? ` (${paidAmount.toFixed(2)})` : ''}.`,
            priority: 'normal',
            action_url: `/invoices/${invoiceId}`,
          })
        }
      }
    }
  } catch (e) {
    console.error('[webhooks/stripe] handler error', e)
    // Still return 200 — Stripe will retry non-2xx and we don't want loops on data issues.
  }

  return NextResponse.json({ received: true })
}
