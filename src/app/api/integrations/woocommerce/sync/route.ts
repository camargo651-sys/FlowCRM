import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, apiSuccess, apiError } from '@/lib/api/auth'
import { fetchWooOrders, WooOrder } from '@/lib/integrations/woocommerce'

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth instanceof NextResponse) return auth

  const { supabase, workspaceId } = auth

  // Load WooCommerce config
  const { data: integration } = await supabase
    .from('integrations')
    .select('id, config')
    .eq('workspace_id', workspaceId)
    .eq('key', 'woocommerce')
    .single()

  if (!integration) {
    return apiError('WooCommerce integration not configured', 400)
  }

  const config = integration.config as Record<string, unknown>
  const siteUrl = config.store_url as string
  const consumerKey = config.consumer_key as string
  const consumerSecret = config.consumer_secret as string

  if (!siteUrl || !consumerKey || !consumerSecret) {
    return apiError('WooCommerce store_url, consumer_key, and consumer_secret required in config', 400)
  }

  const lastSyncAt = (config.last_sync_at as string) || undefined

  const result = await fetchWooOrders(siteUrl, consumerKey, consumerSecret, lastSyncAt)
  if (!result.success || !result.orders) {
    return apiError(result.error || 'Failed to fetch WooCommerce orders', 502)
  }

  let synced = 0

  for (const order of result.orders) {
    // Upsert contact from billing data
    let contactId: string | null = null
    if (order.billing?.email) {
      const { data: existing } = await supabase
        .from('contacts')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('email', order.billing.email)
        .limit(1)
        .single()

      if (existing) {
        contactId = existing.id
      } else {
        const { data: newContact } = await supabase
          .from('contacts')
          .insert({
            workspace_id: workspaceId,
            email: order.billing.email,
            first_name: order.billing.first_name || '',
            last_name: order.billing.last_name || '',
            phone: order.billing.phone || null,
            source: 'woocommerce',
          })
          .select('id')
          .single()
        contactId = newContact?.id || null
      }
    }

    // Build shipping address string
    const s = order.shipping
    const shippingStr = s
      ? [s.address_1, s.city, s.state, s.country, s.postcode].filter(Boolean).join(', ')
      : null

    const { error: orderErr } = await supabase
      .from('store_orders')
      .upsert(
        {
          workspace_id: workspaceId,
          order_number: order.number || String(order.id),
          customer_name: `${order.billing.first_name} ${order.billing.last_name}`.trim() || 'Unknown',
          customer_email: order.billing.email || '',
          customer_phone: order.billing.phone || null,
          shipping_address: shippingStr,
          status: mapWooStatus(order),
          subtotal: parseFloat(order.subtotal || '0'),
          tax_amount: parseFloat(order.total_tax || '0'),
          total: parseFloat(order.total || '0'),
          payment_method: order.payment_method || null,
          payment_status: order.status === 'completed' ? 'paid' : 'pending',
          contact_id: contactId,
          metadata: { woo_id: order.id, source: 'woocommerce' },
        },
        { onConflict: 'workspace_id,order_number' },
      )

    if (!orderErr) synced++
  }

  // Update last_sync_at
  await supabase
    .from('integrations')
    .update({ config: { ...config, last_sync_at: new Date().toISOString() } })
    .eq('id', integration.id)

  return apiSuccess({ synced, total_fetched: result.orders.length })
}

function mapWooStatus(order: WooOrder): string {
  switch (order.status) {
    case 'completed': return 'delivered'
    case 'processing': return 'processing'
    case 'on-hold': return 'confirmed'
    case 'cancelled': return 'cancelled'
    case 'refunded': return 'refunded'
    default: return 'pending'
  }
}
