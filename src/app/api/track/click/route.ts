import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const VALID_ENTITIES = new Set(['invoice', 'quote', 'email', 'contract', 'portal'])
const VALID_EVENTS = new Set(['email_click', 'email_open', 'quote_view', 'invoice_view', 'portal_view', 'link_click'])

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const w = url.searchParams.get('w')
  const e = url.searchParams.get('e')
  const i = url.searchParams.get('i')
  const c = url.searchParams.get('c')
  const to = url.searchParams.get('to')
  const eventType = url.searchParams.get('event') || 'email_click'

  if (w && e && i && VALID_ENTITIES.has(e) && VALID_EVENTS.has(eventType)) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )
      await supabase.from('engagement_events').insert({
        workspace_id: w,
        entity: e,
        entity_id: i,
        contact_id: c || null,
        event_type: eventType,
        user_agent: request.headers.get('user-agent') || null,
        ip: request.headers.get('x-forwarded-for') || null,
        metadata: to ? { url: to } : {},
      })
    } catch {
      // continue
    }
  }

  if (to) {
    try {
      const target = new URL(to)
      return NextResponse.redirect(target.toString(), 302)
    } catch {
      // invalid URL → fall through to JSON response
    }
  }

  return NextResponse.json({ ok: true })
}
