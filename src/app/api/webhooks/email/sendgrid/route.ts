import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getServiceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

// SendGrid event → our event_type
function mapEvent(evt: string): string | null {
  switch (evt) {
    case 'processed':
    case 'send': return 'sent'
    case 'delivered': return 'delivered'
    case 'bounce': return 'bounced'
    case 'dropped':
    case 'deferred': return 'soft_bounced'
    case 'spamreport': return 'complained'
    case 'open': return 'opened'
    case 'click': return 'clicked'
    case 'unsubscribe':
    case 'group_unsubscribe': return 'unsubscribed'
    case 'blocked': return 'rejected'
    default: return null
  }
}

interface SendGridEvent {
  event: string
  email?: string
  sg_event_id?: string
  sg_message_id?: string
  timestamp?: number
  reason?: string
  [k: string]: unknown
}

export async function POST(request: NextRequest) {
  const supabase = getServiceSupabase()
  if (!supabase) return NextResponse.json({ error: 'Service not configured' }, { status: 503 })

  // Workspace resolution via ?secret=... query param (each workspace gets its own URL).
  // The webhook URL stored in the ESP panel embeds this secret.
  const secret = request.nextUrl.searchParams.get('secret')
  if (!secret) return NextResponse.json({ error: 'Missing secret' }, { status: 400 })

  const expectedSecret = process.env.EMAIL_WEBHOOK_SECRET
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 403 })
  }

  // Map secret → workspace via integrations row (config.webhook_secret = secret).
  const { data: integration } = await supabase
    .from('integrations')
    .select('workspace_id')
    .eq('key', 'sendgrid')
    .contains('config', { webhook_secret: secret })
    .limit(1)
    .maybeSingle()

  const workspaceId = integration?.workspace_id
  if (!workspaceId) {
    // Accept but noop — avoids leaking that the secret is wrong.
    return NextResponse.json({ received: true, matched: false })
  }

  let events: SendGridEvent[] = []
  try {
    const body = await request.json()
    events = Array.isArray(body) ? body : [body]
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const rows = events
    .map((e) => {
      const t = mapEvent(e.event)
      if (!t) return null
      return {
        workspace_id: workspaceId,
        provider: 'sendgrid',
        event_type: t,
        recipient_email: e.email || null,
        provider_event_id: e.sg_event_id || null,
        reason: e.reason || null,
        metadata: { sg_message_id: e.sg_message_id, raw: e },
        occurred_at: e.timestamp ? new Date(e.timestamp * 1000).toISOString() : new Date().toISOString(),
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  if (rows.length > 0) {
    await supabase.from('email_events').insert(rows)
  }

  return NextResponse.json({ received: true, count: rows.length })
}
