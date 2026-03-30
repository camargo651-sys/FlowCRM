import crypto from 'crypto'
import { encryptToken, decryptToken } from '@/lib/email/token-manager'

export { encryptToken, decryptToken }

const GRAPH_API_VERSION = 'v21.0'

export function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9+]/g, '').replace(/^\+/, '')
}

export function matchPhoneNumber(a: string, b: string): boolean {
  const na = normalizePhone(a)
  const nb = normalizePhone(b)
  if (na === nb) return true
  // Compare last 10 digits (handles country code mismatches)
  const tailA = na.slice(-10)
  const tailB = nb.slice(-10)
  return tailA.length >= 10 && tailA === tailB
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  appSecret: string,
): boolean {
  const expected = crypto.createHmac('sha256', appSecret).update(payload).digest('hex')
  return `sha256=${expected}` === signature
}

export async function sendWhatsAppMessage(
  accessToken: string,
  phoneNumberId: string,
  to: string,
  body: string,
): Promise<{ messageId: string }> {
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: normalizePhone(to),
        type: 'text',
        text: { body },
      }),
    },
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`WhatsApp API error: ${res.status} - ${err}`)
  }

  const data = await res.json()
  return { messageId: data.messages?.[0]?.id || '' }
}
