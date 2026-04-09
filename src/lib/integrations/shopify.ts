/**
 * Shopify integration — fetch orders from Shopify Admin API.
 */

export interface ShopifyOrder {
  id: number
  order_number: number
  name: string
  email: string
  total_price: string
  subtotal_price: string
  total_tax: string
  financial_status: string
  fulfillment_status: string | null
  customer: {
    id: number
    email: string
    first_name: string
    last_name: string
    phone: string | null
  } | null
  shipping_address?: {
    address1: string
    city: string
    province: string
    country: string
    zip: string
  }
  created_at: string
  updated_at: string
}

interface ShopifyResult {
  success: boolean
  orders?: ShopifyOrder[]
  error?: string
}

export async function fetchShopifyOrders(
  shop: string,
  accessToken: string,
  since?: string,
): Promise<ShopifyResult> {
  try {
    const params = new URLSearchParams({
      status: 'any',
      limit: '50',
    })
    if (since) {
      params.set('created_at_min', since)
    }

    const res = await fetch(
      `https://${shop}/admin/api/2024-01/orders.json?${params.toString()}`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      },
    )

    if (!res.ok) {
      const text = await res.text()
      return { success: false, error: `Shopify API ${res.status}: ${text}` }
    }

    const data = await res.json()
    return { success: true, orders: data.orders }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error fetching Shopify orders',
    }
  }
}
