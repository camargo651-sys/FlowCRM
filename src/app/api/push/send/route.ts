import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// VAPID public/private keys from environment
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

  const publicKey = await crypto.subtle.importKey(
    'raw',
    publicKeyBytes.buffer as ArrayBuffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    []
  )

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBytes.buffer as ArrayBuffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign']
  )

  return { publicKey, privateKey, publicKeyBytes }
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
    encoder.encode(unsignedToken)
  )

  const signatureB64 = uint8ArrayToBase64Url(new Uint8Array(signature))
  const jwt = `${unsignedToken}.${signatureB64}`
  const publicKeyB64 = uint8ArrayToBase64Url(publicKeyBytes)

  return `vapid t=${jwt}, k=${publicKeyB64}`
}

async function sendPushNotification(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: object
) {
  const url = new URL(subscription.endpoint)
  const audience = `${url.protocol}//${url.host}`

  const authorization = await createVapidAuthHeader(audience)

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
      'Content-Encoding': 'aes128gcm',
      TTL: '86400',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Push failed (${response.status}): ${text}`)
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId, title, body, url } = await request.json()
    if (!userId || !title) {
      return NextResponse.json({ error: 'userId and title required' }, { status: 400 })
    }

    // Fetch push subscriptions for target user
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, keys')
      .eq('user_id', userId)

    if (error) {
      console.error('Fetch subscriptions error:', error)
      return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
    }

    if (!subscriptions?.length) {
      return NextResponse.json({ error: 'No subscriptions found for user' }, { status: 404 })
    }

    const payload = { title, body: body || '', url: url || '/dashboard' }

    const results = await Promise.allSettled(
      subscriptions.map((sub) => sendPushNotification(sub as any, payload))
    )

    const sent = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length

    return NextResponse.json({ sent, failed })
  } catch (err) {
    console.error('Push send error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
