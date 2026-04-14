import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { isConfigured, sendPushNotification } from '@/lib/notifications/vapid'

interface SubRow {
  endpoint: string
  p256dh: string | null
  auth: string | null
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

    if (!isConfigured()) {
      // TODO: configure VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env vars — see
      // src/lib/notifications/vapid.ts for instructions. Falls back to logging.
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
    const sent = results.filter(
      (r) => r.status === 'fulfilled' && (r as PromiseFulfilledResult<{ ok: boolean }>).value.ok,
    ).length
    const failed = results.length - sent
    return NextResponse.json({ sent, failed })
  } catch (err) {
    console.error('[push/send] error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
