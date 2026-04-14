import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

const VALID_ENTITIES = new Set(['invoice', 'quote', 'email', 'contract', 'portal'])

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const w = url.searchParams.get('w')
  const e = url.searchParams.get('e')
  const i = url.searchParams.get('i')
  const c = url.searchParams.get('c')

  if (w && e && i && VALID_ENTITIES.has(e)) {
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
        event_type: 'email_open',
        user_agent: request.headers.get('user-agent') || null,
        ip: request.headers.get('x-forwarded-for') || null,
      })
    } catch {
      // swallow — pixel must always render
    }
  }

  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(PIXEL.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
    },
  })
}
