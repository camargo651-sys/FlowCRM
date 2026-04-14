/**
 * VAPID + Web Push helpers.
 *
 * Generate a keypair once and put in .env.local:
 *   npx web-push generate-vapid-keys
 *
 * Environment variables consumed:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY  — base64url encoded P-256 uncompressed point
 *   VAPID_PRIVATE_KEY             — base64url encoded P-256 private scalar
 *   VAPID_SUBJECT                 — mailto:you@example.com or https URL
 *
 * Uses the `web-push` npm package for real RFC 8291 aes128gcm payload
 * encryption. If the package fails to load at runtime, we degrade to a
 * header-only no-op stub so the rest of the app keeps working.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:hello@tracktio.com'

interface WebPushLike {
  setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void
  sendNotification: (
    sub: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string,
  ) => Promise<{ statusCode: number; body?: string; headers?: Record<string, string> }>
}

let webpush: WebPushLike | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  webpush = require('web-push') as WebPushLike
  if (webpush && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  }
} catch (err) {
  console.warn('[vapid] web-push not available, falling back to no-op', err)
  webpush = null
}

export function isConfigured(): boolean {
  return !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY)
}

export function getPublicKey(): string {
  return VAPID_PUBLIC_KEY
}

export function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export function uint8ArrayToBase64Url(arr: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

interface PushSub {
  endpoint: string
  p256dh: string | null
  auth: string | null
}

export interface PushPayload {
  title: string
  body?: string
  url?: string
}

/**
 * Send a web-push notification via the web-push npm package (RFC 8291
 * aes128gcm). Falls back gracefully when VAPID keys or the web-push
 * package are not available.
 */
export async function sendPushNotification(
  sub: PushSub,
  payload: PushPayload,
): Promise<{ ok: boolean; status?: number; skipped?: boolean; error?: string }> {
  if (!isConfigured()) {
    console.warn('[vapid] keys missing, skipping push', payload)
    return { ok: false, skipped: true, error: 'no_vapid' }
  }
  if (!sub.endpoint) return { ok: false, error: 'no_endpoint' }
  if (!sub.p256dh || !sub.auth) return { ok: false, error: 'no_keys' }

  if (!webpush) {
    console.warn('[vapid] web-push lib unavailable, skipping', payload)
    return { ok: false, skipped: true, error: 'no_webpush_lib' }
  }

  try {
    const res = await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
    )
    return { ok: true, status: res.statusCode }
  } catch (err) {
    const e = err as { statusCode?: number; body?: string; message?: string }
    return {
      ok: false,
      status: e.statusCode,
      error: e.body || e.message || 'push failed',
    }
  }
}
