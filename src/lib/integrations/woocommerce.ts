/**
 * WooCommerce integration — fetch orders via WooCommerce REST API.
 */

export interface WooOrder {
  id: number
  number: string
  status: string
  total: string
  subtotal?: string
  total_tax: string
  payment_method: string
  billing: {
    first_name: string
    last_name: string
    email: string
    phone: string
    address_1: string
    city: string
    state: string
    postcode: string
    country: string
  }
  shipping: {
    first_name: string
    last_name: string
    address_1: string
    city: string
    state: string
    postcode: string
    country: string
  }
  date_created: string
  date_modified: string
}

interface WooResult {
  success: boolean
  orders?: WooOrder[]
  error?: string
}

export async function fetchWooOrders(
  siteUrl: string,
  consumerKey: string,
  consumerSecret: string,
  since?: string,
): Promise<WooResult> {
  try {
    const baseUrl = siteUrl.replace(/\/$/, '')
    const params = new URLSearchParams({
      per_page: '50',
      orderby: 'date',
      order: 'desc',
    })
    if (since) {
      params.set('after', since)
    }

    const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')

    const res = await fetch(
      `${baseUrl}/wp-json/wc/v3/orders?${params.toString()}`,
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
      },
    )

    if (!res.ok) {
      const text = await res.text()
      return { success: false, error: `WooCommerce API ${res.status}: ${text}` }
    }

    const data = await res.json()
    return { success: true, orders: data }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error fetching WooCommerce orders',
    }
  }
}
