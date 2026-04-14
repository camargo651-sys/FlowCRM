import { NextRequest } from 'next/server'
import { authenticateRequest, apiSuccess, apiError } from '@/lib/api/auth'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateRequest(request)
  if (auth instanceof Response) return auth

  const { data: invoice, error } = await auth.supabase
    .from('invoices')
    .select('id, invoice_number, total, balance_due, currency, payment_link, contact_id')
    .eq('id', params.id)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (error || !invoice) return apiError('Invoice not found', 404)

  // If we already have a payment link, return it
  if (invoice.payment_link) {
    return apiSuccess({ url: invoice.payment_link, cached: true })
  }

  // Try Stripe integration
  const { data: stripeInt } = await auth.supabase
    .from('integrations')
    .select('config')
    .eq('workspace_id', auth.workspaceId)
    .eq('key', 'stripe')
    .eq('enabled', true)
    .maybeSingle()

  let url: string | null = null

  const stripeKey = stripeInt?.config?.secret_key as string | undefined
  if (stripeKey) {
    try {
      const amount = Math.round(Number(invoice.balance_due || invoice.total || 0) * 100)
      const currency = (invoice.currency || 'usd').toLowerCase()
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || ''

      // Fetch contact email for customer_email hint
      let contactEmail: string | null = null
      if (invoice.contact_id) {
        const { data: contact } = await auth.supabase
          .from('contacts')
          .select('email')
          .eq('id', invoice.contact_id)
          .maybeSingle()
        contactEmail = contact?.email || null
      }

      // Create a Stripe Checkout Session (hosted) — simpler than Payment Intent + custom UI.
      const body = new URLSearchParams()
      body.append('mode', 'payment')
      body.append('line_items[0][price_data][currency]', currency)
      body.append('line_items[0][price_data][product_data][name]', `Invoice ${invoice.invoice_number}`)
      body.append('line_items[0][price_data][unit_amount]', String(amount))
      body.append('line_items[0][quantity]', '1')
      body.append('success_url', `${appUrl}/invoices/${invoice.id}?paid=true`)
      body.append('cancel_url', `${appUrl}/invoices/${invoice.id}?canceled=true`)
      body.append('metadata[invoice_id]', invoice.id)
      body.append('metadata[workspace_id]', auth.workspaceId)
      if (contactEmail) body.append('customer_email', contactEmail)

      const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      })
      if (res.ok) {
        const json = (await res.json()) as { id: string; url: string }
        url = json.url
      } else {
        const errText = await res.text()
        console.error('[payment-link] Stripe error', res.status, errText.slice(0, 300))
      }
    } catch (e) {
      console.error('[payment-link] Stripe exception', e)
    }
  }

  if (!url) {
    // Fallback: portal token link (uses invoice id as the token query)
    const { data: portalToken } = await auth.supabase
      .from('portal_tokens')
      .select('token')
      .eq('workspace_id', auth.workspaceId)
      .eq('contact_id', invoice.contact_id)
      .maybeSingle()

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    const token = portalToken?.token || invoice.id
    url = `${appUrl}/portal/${token}?invoice=${invoice.id}`
  }

  await auth.supabase.from('invoices').update({ payment_link: url }).eq('id', invoice.id)

  return apiSuccess({ url, cached: false })
}
