import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, apiError, apiSuccess } from '@/lib/api/auth'
import { createMercadoPagoPreference } from '@/lib/integrations/mercadopago'

/**
 * GET /api/payments/mercadopago?invoice_id=xxx
 * Loads invoice, creates MercadoPago preference, redirects to payment URL.
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

  // Load MercadoPago integration config
  const { data: integration } = await auth.supabase
    .from('integrations')
    .select('config')
    .eq('workspace_id', auth.workspaceId)
    .eq('key', 'mercadopago')
    .eq('enabled', true)
    .single()

  if (!integration) return apiError('MercadoPago integration not configured or not enabled', 400)

  const config = integration.config as Record<string, string>
  const accessToken = config.access_token
  if (!accessToken) return apiError('MercadoPago access_token missing', 400)

  const result = await createMercadoPagoPreference(accessToken, {
    title: `Invoice ${invoice.number || invoice.id}`,
    amount: invoice.total,
    currency: invoice.currency || 'ARS',
  })

  if (!result.success || !result.data) return apiError(result.error || 'Failed to create preference', 502)

  return NextResponse.redirect(result.data.init_point)
}

/**
 * POST /api/payments/mercadopago
 * MercadoPago IPN webhook — receives payment notifications and updates invoice status.
 */
export async function POST(request: NextRequest) {
  const body = await request.json()

  // MercadoPago sends IPN with topic and id
  const topic = body.topic || body.type
  const resourceId = body.data?.id || body.id

  if (topic !== 'payment' && topic !== 'merchant_order') {
    return apiSuccess({ received: true, ignored: true })
  }

  if (!resourceId) return apiError('Missing resource id', 400)

  // Use service role to process webhook
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Find the invoice linked to this payment via metadata or external_reference
  // MercadoPago sends payment info — fetch payment details to get external_reference
  // For now, we look for invoices with mercadopago_payment_id in metadata
  if (topic === 'payment') {
    // Try to find invoice by mercadopago preference id stored during creation
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, status')
      .eq('metadata->>mercadopago_payment_id', String(resourceId))
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
