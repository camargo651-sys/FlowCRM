import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getServiceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

// Postmark RecordType → our event_type
function mapEvent(rt: string, type?: string): string | null {
  switch (rt) {
    case 'Delivery': return 'delivered'
    case 'Bounce':
      if (type === 'SoftBounce' || type === 'Transient') return 'soft_bounced'
      return 'bounced'
    case 'SpamComplaint': return 'complained'
    case 'Open': return 'opened'
    case 'Click': return 'clicked'
    case 'SubscriptionChange': return 'unsubscribed'
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
    .eq('key', 'postmark')
    .contains('config', { webhook_secret: secret })
    .limit(1)
    .maybeSingle()

  const workspaceId = integration?.workspace_id
  if (!workspaceId) return NextResponse.json({ received: true, matched: false })

  let payload: Record<string, unknown> = {}
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const recordType = String(payload.RecordType || '')
  const bounceType = payload.Type as string | undefined
  const t = mapEvent(recordType, bounceType)
  if (t) {
    const recipient =
      (payload.Recipient as string | undefined) ||
      (payload.Email as string | undefined) ||
      null
    await supabase.from('email_events').insert({
      workspace_id: workspaceId,
      provider: 'postmark',
      event_type: t,
      recipient_email: recipient,
      provider_event_id: (payload.MessageID as string) || null,
      reason: (payload.Description as string) || null,
      metadata: { raw: payload },
      occurred_at: (payload.ReceivedAt as string) || (payload.BouncedAt as string) || new Date().toISOString(),
    })
  }

  return NextResponse.json({ received: true })
}
