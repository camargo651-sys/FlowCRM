import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, apiSuccess, apiError } from '@/lib/api/auth'
import { fetchShopifyOrders, ShopifyOrder } from '@/lib/integrations/shopify'

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth instanceof NextResponse) return auth

  const { supabase, workspaceId } = auth

  // Load Shopify config
  const { data: integration } = await supabase
    .from('integrations')
    .select('id, config')
    .eq('workspace_id', workspaceId)
    .eq('key', 'shopify')
    .single()

  if (!integration) {
    return apiError('Shopify integration not configured', 400)
  }

  const config = integration.config as Record<string, unknown>
  const shop = config.shop_url as string
  const accessToken = config.access_token as string

  if (!shop || !accessToken) {
    return apiError('Shopify shop_url and access_token required in config', 400)
  }

  const lastSyncAt = (config.last_sync_at as string) || undefined

  const result = await fetchShopifyOrders(shop, accessToken, lastSyncAt)
  if (!result.success || !result.orders) {
    return apiError(result.error || 'Failed to fetch Shopify orders', 502)
  }

  let synced = 0

  for (const order of result.orders) {
    // Upsert contact from customer data
    let contactId: string | null = null
    if (order.customer?.email) {
      const { data: existing } = await supabase
        .from('contacts')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('email', order.customer.email)
        .limit(1)
        .single()

      if (existing) {
        contactId = existing.id
      } else {
        const { data: newContact } = await supabase
          .from('contacts')
          .insert({
            workspace_id: workspaceId,
            email: order.customer.email,
            first_name: order.customer.first_name || '',
            last_name: order.customer.last_name || '',
            phone: order.customer.phone || null,
            source: 'shopify',
          })
          .select('id')
          .single()
        contactId = newContact?.id || null
      }
    }

    // Build shipping address string
    const addr = order.shipping_address
    const shippingStr = addr
      ? [addr.address1, addr.city, addr.province, addr.country, addr.zip].filter(Boolean).join(', ')
      : null

    // Upsert store order
    const { error: orderErr } = await supabase
      .from('store_orders')
      .upsert(
        {
          workspace_id: workspaceId,
          order_number: order.name || String(order.order_number),
          customer_name: order.customer
            ? `${order.customer.first_name} ${order.customer.last_name}`.trim()
            : 'Unknown',
          customer_email: order.email || order.customer?.email || '',
          customer_phone: order.customer?.phone || null,
          shipping_address: shippingStr,
          status: mapShopifyStatus(order),
          subtotal: parseFloat(order.subtotal_price) || 0,
          tax_amount: parseFloat(order.total_tax) || 0,
          total: parseFloat(order.total_price) || 0,
          payment_status: order.financial_status === 'paid' ? 'paid' : 'pending',
          contact_id: contactId,
          metadata: { shopify_id: order.id, source: 'shopify' },
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

function mapShopifyStatus(order: ShopifyOrder): string {
  if (order.fulfillment_status === 'fulfilled') return 'delivered'
  if (order.fulfillment_status === 'partial') return 'shipped'
  if (order.financial_status === 'refunded') return 'refunded'
  if (order.financial_status === 'paid') return 'confirmed'
  return 'pending'
}
