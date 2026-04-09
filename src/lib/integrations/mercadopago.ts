/**
 * MercadoPago integration — create checkout preferences for invoice payments.
 */

interface MercadoPagoInvoice {
  title: string
  amount: number
  currency: string
}

interface MercadoPagoPreference {
  init_point: string
  id: string
}

interface MercadoPagoResult {
  success: boolean
  data?: MercadoPagoPreference
  error?: string
}

export async function createMercadoPagoPreference(
  accessToken: string,
  invoice: MercadoPagoInvoice,
): Promise<MercadoPagoResult> {
  try {
    const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [
          {
            title: invoice.title,
            quantity: 1,
            unit_price: invoice.amount,
            currency_id: invoice.currency || 'ARS',
          },
        ],
        auto_return: 'approved',
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return { success: false, error: `MercadoPago API error ${res.status}: ${text}` }
    }

    const data = await res.json()
    return {
      success: true,
      data: { init_point: data.init_point, id: data.id },
    }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error calling MercadoPago API',
    }
  }
}
