import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getServiceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

function mapEvent(evt: string, severity?: string): string | null {
  switch (evt) {
    case 'accepted': return 'sent'
    case 'delivered': return 'delivered'
    case 'failed':
      return severity === 'temporary' ? 'soft_bounced' : 'bounced'
    case 'complained': return 'complained'
    case 'opened': return 'opened'
    case 'clicked': return 'clicked'
    case 'unsubscribed': return 'unsubscribed'
    case 'rejected': return 'rejected'
    default: return null
  }
}

export async function POST(request: NextRequest) {
  const supabase = getServiceSupabase()
  if (!supabase) return NextResponse.json({ error: 'Service not configured' }, { status: 503 })

  const secret = request.nextUrl.searchParams.get('secret')
  if (!secret) return NextResponse.json({ error: 'Missing secret' }, { status: 400 })

  const { data: integration } = await supabase
    .from('integrations')
    .select('workspace_id')
    .eq('key', 'mailgun')
    .contains('config', { webhook_secret: secret })
    .limit(1)
    .maybeSingle()

  const workspaceId = integration?.workspace_id
  if (!workspaceId) return NextResponse.json({ received: true, matched: false })

  let payload: { 'event-data'?: Record<string, unknown>; signature?: Record<string, string> } = {}
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const ev = (payload['event-data'] || {}) as {
    event?: string
    severity?: string
    recipient?: string
    id?: string
    timestamp?: number
    reason?: string
  }

  const t = mapEvent(ev.event || '', ev.severity)
  if (t) {
    await supabase.from('email_events').insert({
      workspace_id: workspaceId,
      provider: 'mailgun',
      event_type: t,
      recipient_email: ev.recipient || null,
      provider_event_id: ev.id || null,
      reason: ev.reason || null,
      metadata: { raw: ev },
      occurred_at: ev.timestamp ? new Date(ev.timestamp * 1000).toISOString() : new Date().toISOString(),
    })
  }

  return NextResponse.json({ received: true })
}
