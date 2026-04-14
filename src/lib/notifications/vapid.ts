/**
 * VAPID + Web Push helpers.
 *
 * Generate a keypair once and put in .env.local:
 *   npx web-push generate-vapid-keys
 *
 * Environment variables consumed:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY  — base64url encoded P-256 uncompressed point
 *   VAPID_PRIVATE_KEY             — base64url encoded PKCS8 P-256 private key
 *                                   (the raw 32-byte private value, per web-push CLI)
 *   VAPID_SUBJECT                 — mailto:you@example.com or https URL
 *
 * NOTE on payload encryption: real web-push requires RFC 8291 aes128gcm
 * encryption of the payload using the subscription's p256dh + auth keys.
 * Implementing it from scratch is non-trivial (ECDH, HKDF, AES-GCM). This
 * module sends an empty body push (header-only) which most browsers will
 * deliver — the service worker can then call `showNotification` with its
 * own fallback content (title/body it fetches itself). For production,
 * install the `web-push` package and use its `sendNotification` helper.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:hello@tracktio.com'

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

async function importPrivateKey(): Promise<CryptoKey> {
  // web-push CLI emits the raw 32-byte private scalar as base64url. WebCrypto
  // needs a pkcs8 wrapper, so we build a minimal one. If the env var is
  // already a full pkcs8 key (longer than 32 bytes), we pass it through.
  const raw = base64UrlToUint8Array(VAPID_PRIVATE_KEY)

  if (raw.length > 32) {
    return crypto.subtle.importKey(
      'pkcs8',
      raw.buffer as ArrayBuffer,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    )
  }

  // Wrap 32-byte scalar in pkcs8 via jwk import which accepts the raw d.
  const publicRaw = base64UrlToUint8Array(VAPID_PUBLIC_KEY)
  // uncompressed point: 0x04 || X(32) || Y(32)
  if (publicRaw.length !== 65 || publicRaw[0] !== 0x04) {
    throw new Error('VAPID_PUBLIC_KEY must be uncompressed P-256 (65 bytes, 0x04 prefix)')
  }
  const x = publicRaw.slice(1, 33)
  const y = publicRaw.slice(33, 65)
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    d: uint8ArrayToBase64Url(raw),
    x: uint8ArrayToBase64Url(x),
    y: uint8ArrayToBase64Url(y),
    ext: true,
  }
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
}

/**
 * Build a VAPID Authorization header for the given push endpoint audience.
 * Returns the header VALUE (caller sets `Authorization: <value>`).
 */
export async function buildVapidHeaders(endpoint: string): Promise<string> {
  if (!isConfigured()) throw new Error('VAPID not configured')
  const url = new URL(endpoint)
  const audience = `${url.protocol}//${url.host}`

  const privateKey = await importPrivateKey()

  const header = { typ: 'JWT', alg: 'ES256' }
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: VAPID_SUBJECT,
  }
  const encoder = new TextEncoder()
  const headerB64 = uint8ArrayToBase64Url(encoder.encode(JSON.stringify(header)))
  const payloadB64 = uint8ArrayToBase64Url(encoder.encode(JSON.stringify(payload)))
  const unsigned = `${headerB64}.${payloadB64}`
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    encoder.encode(unsigned),
  )
  const sigB64 = uint8ArrayToBase64Url(new Uint8Array(signature))
  const jwt = `${unsigned}.${sigB64}`
  return `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`
}

/**
 * TODO(RFC 8291 aes128gcm): real payload encryption.
 * Requires ECDH(P-256) with the subscription's p256dh, HKDF-SHA256 with the
 * `auth` secret as salt, then AES-128-GCM of `payload || 0x02`. Correct and
 * interoperable implementations live in the `web-push` npm package — prefer
 * installing it over rolling our own.
 */
export async function encryptPayload(
  _payload: string,
  _p256dh: string,
  _auth: string,
): Promise<{ ciphertext: Uint8Array; headers: Record<string, string> } | null> {
  return null
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
 * Send a web-push notification. Falls back gracefully:
 *  - No VAPID keys → logs and returns { skipped: true }
 *  - No payload encryption → sends empty-body push (SW must provide content)
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

  try {
    const auth = await buildVapidHeaders(sub.endpoint)
    // TODO: when encryptPayload is implemented, include Content-Encoding,
    // Encryption, Crypto-Key headers and send the ciphertext body.
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        Authorization: auth,
        TTL: '86400',
      },
      body: '',
    })
    if (!res.ok && res.status !== 201 && res.status !== 202) {
      const text = await res.text().catch(() => '')
      return { ok: false, status: res.status, error: text }
    }
    return { ok: true, status: res.status }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'push failed' }
  }
}
