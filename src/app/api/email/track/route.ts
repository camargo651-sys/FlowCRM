import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { emitSignal } from '@/lib/ai/signal-emitter'

// 1x1 transparent GIF
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
)

function getServiceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
  )
}

export async function GET(request: NextRequest) {
  const trackingId = request.nextUrl.searchParams.get('id')

  if (trackingId) {
    const supabase = getServiceSupabase()
    if (supabase) {
      // Update tracking record
      const { data: tracking } = await supabase
        .from('email_tracking')
        .select('id, workspace_id, contact_id, opened_count')
        .eq('id', trackingId)
        .single()

      if (tracking) {
        await supabase.from('email_tracking').update({
          opened_at: tracking.opened_count === 0 ? new Date().toISOString() : undefined,
          opened_count: (tracking.opened_count || 0) + 1,
        }).eq('id', tracking.id)

        // Fire engagement signal if contact is linked
        if (tracking.contact_id) {
          await emitSignal(supabase, {
            workspaceId: tracking.workspace_id,
            contactId: tracking.contact_id,
            signalType: 'email_opened',
            source: 'tracking_pixel',
            metadata: { tracking_id: trackingId },
          })
        }
      }
    }
  }

  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  })
}
