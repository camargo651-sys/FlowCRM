import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// VAPID keys from environment
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:hello@tracktio.com'

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

function uint8ArrayToBase64Url(arr: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function importVapidKeys() {
  const publicKeyBytes = base64UrlToUint8Array(VAPID_PUBLIC_KEY)
  const privateKeyBytes = base64UrlToUint8Array(VAPID_PRIVATE_KEY)

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBytes.buffer as ArrayBuffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign'],
  )

  return { privateKey, publicKeyBytes }
}

async function createVapidAuthHeader(audience: string) {
  const { privateKey, publicKeyBytes } = await importVapidKeys()
  const header = { typ: 'JWT', alg: 'ES256' }
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: VAPID_SUBJECT,
  }
  const encoder = new TextEncoder()
  const headerB64 = uint8ArrayToBase64Url(encoder.encode(JSON.stringify(header)))
  const payloadB64 = uint8ArrayToBase64Url(encoder.encode(JSON.stringify(payload)))
  const unsignedToken = `${headerB64}.${payloadB64}`
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    encoder.encode(unsignedToken),
  )
  const signatureB64 = uint8ArrayToBase64Url(new Uint8Array(signature))
  const jwt = `${unsignedToken}.${signatureB64}`
  const publicKeyB64 = uint8ArrayToBase64Url(publicKeyBytes)
  return `vapid t=${jwt}, k=${publicKeyB64}`
}

interface SubRow {
  endpoint: string
  p256dh: string | null
  auth: string | null
}

async function sendPushNotification(sub: SubRow, payload: object) {
  const url = new URL(sub.endpoint)
  const audience = `${url.protocol}//${url.host}`
  const authorization = await createVapidAuthHeader(audience)

  // Note: This sends an *unencrypted* placeholder body. Browsers may accept
  // empty body pushes that trigger the SW to call showNotification with its
  // fallback content. Full aes128gcm payload encryption requires a proper
  // web-push library; left as TODO for production.
  const response = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      TTL: '86400',
    },
    body: '',
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Push failed (${response.status}): ${text}`)
  }
  return payload
}

function getServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { user_id, workspace_id, title, body: messageBody, url } = body || {}

    if (!title) {
      return NextResponse.json({ error: 'title required' }, { status: 400 })
    }
    if (!user_id && !workspace_id) {
      return NextResponse.json({ error: 'user_id or workspace_id required' }, { status: 400 })
    }

    // Use service client for cross-user push so internal callers work
    const supabase = getServiceClient() || createClient()

    let q = supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
    if (user_id) q = q.eq('user_id', user_id)
    if (workspace_id) q = q.eq('workspace_id', workspace_id)

    const { data: subscriptions, error } = await q
    if (error) {
      console.error('[push/send] fetch subs failed', error)
      return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
    }

    const valid = (subscriptions || []).filter(
      (s) => s.endpoint && s.p256dh && s.auth,
    ) as SubRow[]

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      // TODO: configure VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env vars and
      // wire a real web-push payload encryption library (aes128gcm) before
      // production rollout. For now we no-op and just log.
      console.warn(
        `[push/send] VAPID keys missing — skipping ${valid.length} subscription(s)`,
        { title, body: messageBody, url },
      )
      return NextResponse.json({ sent: 0, skipped: valid.length, reason: 'no_vapid' })
    }

    const payload = { title, body: messageBody || '', url: url || '/dashboard' }

    const results = await Promise.allSettled(
      valid.map((s) => sendPushNotification(s, payload)),
    )
    const sent = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length
    return NextResponse.json({ sent, failed })
  } catch (err) {
    console.error('[push/send] error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
