import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, apiError, apiSuccess } from '@/lib/api/auth'
import { createPayPalOrder, capturePayPalOrder } from '@/lib/integrations/paypal'

/**
 * GET /api/payments/paypal?invoice_id=xxx
 * Loads invoice, creates PayPal order, redirects to approval URL.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth instanceof Response) return auth

  const url = new URL(request.url)
  const invoiceId = url.searchParams.get('invoice_id')
  if (!invoiceId) return apiError('invoice_id is required', 400)

  // Load invoice
  const { data: invoice, error } = await auth.supabase
    .from('invoices')
    .select('id, number, total, currency')
    .eq('id', invoiceId)
    .eq('workspace_id', auth.workspaceId)
    .single()

  if (error || !invoice) return apiError('Invoice not found', 404)

  // Load PayPal integration config
  const { data: integration } = await auth.supabase
    .from('integrations')
    .select('config')
    .eq('workspace_id', auth.workspaceId)
    .eq('key', 'paypal')
    .eq('enabled', true)
    .single()

  if (!integration) return apiError('PayPal integration not configured or not enabled', 400)

  const config = integration.config as Record<string, string>
  if (!config.client_id || !config.client_secret) {
    return apiError('PayPal client_id and client_secret are required', 400)
  }

  const result = await createPayPalOrder(
    config.client_id,
    config.client_secret,
    invoice.total,
    invoice.currency || 'USD',
  )

  if (!result.success || !result.data) return apiError(result.error || 'Failed to create PayPal order', 502)

  // Store order_id on invoice for later capture
  await auth.supabase
    .from('invoices')
    .update({ metadata: { paypal_order_id: result.data.order_id } })
    .eq('id', invoice.id)

  return NextResponse.redirect(result.data.approval_url)
}

/**
 * POST /api/payments/paypal
 * PayPal webhook/return — captures payment and updates invoice.
 */
export async function POST(request: NextRequest) {
  const body = await request.json()

  // PayPal webhooks send event_type
  const eventType = body.event_type
  const resource = body.resource

  // Use service role for webhook processing
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Handle CHECKOUT.ORDER.APPROVED — capture the payment
  if (eventType === 'CHECKOUT.ORDER.APPROVED' && resource?.id) {
    const orderId = resource.id

    // Find the invoice with this PayPal order
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, workspace_id, metadata')
      .eq('metadata->>paypal_order_id', orderId)
      .limit(1)

    if (!invoices || invoices.length === 0) {
      return apiSuccess({ received: true, matched: false })
    }

    const invoice = invoices[0]

    // Load PayPal config for this workspace
    const { data: integration } = await supabase
      .from('integrations')
      .select('config')
      .eq('workspace_id', invoice.workspace_id)
      .eq('key', 'paypal')
      .single()

    if (integration) {
      const config = integration.config as Record<string, string>
      const captureResult = await capturePayPalOrder(config.client_id, config.client_secret, orderId)

      if (captureResult.success) {
        await supabase
          .from('invoices')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('id', invoice.id)
      }
    }
  }

  // Handle PAYMENT.CAPTURE.COMPLETED
  if (eventType === 'PAYMENT.CAPTURE.COMPLETED' && resource?.supplementary_data?.related_ids?.order_id) {
    const orderId = resource.supplementary_data.related_ids.order_id
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id')
      .eq('metadata->>paypal_order_id', orderId)
      .limit(1)

    if (invoices && invoices.length > 0) {
      await supabase
        .from('invoices')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', invoices[0].id)
    }
  }

  return apiSuccess({ received: true })
}
