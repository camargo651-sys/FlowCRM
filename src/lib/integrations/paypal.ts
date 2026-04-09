/**
 * PayPal integration — create orders for invoice payments.
 */

interface PayPalOrderResult {
  success: boolean
  data?: { approval_url: string; order_id: string }
  error?: string
}

interface PayPalCaptureResult {
  success: boolean
  data?: { status: string; id: string }
  error?: string
}

async function getPayPalAccessToken(
  clientId: string,
  clientSecret: string,
): Promise<{ token: string } | { error: string }> {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) {
    const text = await res.text()
    return { error: `PayPal auth error ${res.status}: ${text}` }
  }

  const data = await res.json()
  return { token: data.access_token }
}

export async function createPayPalOrder(
  clientId: string,
  clientSecret: string,
  amount: number,
  currency: string,
): Promise<PayPalOrderResult> {
  try {
    const authResult = await getPayPalAccessToken(clientId, clientSecret)
    if ('error' in authResult) {
      return { success: false, error: authResult.error }
    }

    const res = await fetch('https://api-m.paypal.com/v2/checkout/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authResult.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: currency || 'USD',
              value: amount.toFixed(2),
            },
          },
        ],
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return { success: false, error: `PayPal order error ${res.status}: ${text}` }
    }

    const data = await res.json()
    const approvalLink = data.links?.find((l: { rel: string; href: string }) => l.rel === 'approve')

    if (!approvalLink) {
      return { success: false, error: 'No approval URL returned from PayPal' }
    }

    return {
      success: true,
      data: { approval_url: approvalLink.href, order_id: data.id },
    }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error calling PayPal API',
    }
  }
}

export async function capturePayPalOrder(
  clientId: string,
  clientSecret: string,
  orderId: string,
): Promise<PayPalCaptureResult> {
  try {
    const authResult = await getPayPalAccessToken(clientId, clientSecret)
    if ('error' in authResult) {
      return { success: false, error: authResult.error }
    }

    const res = await fetch(`https://api-m.paypal.com/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authResult.token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      const text = await res.text()
      return { success: false, error: `PayPal capture error ${res.status}: ${text}` }
    }

    const data = await res.json()
    return {
      success: true,
      data: { status: data.status, id: data.id },
    }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error capturing PayPal order',
    }
  }
}
