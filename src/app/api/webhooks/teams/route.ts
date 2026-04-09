import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/api/rate-limit'

function getSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

// POST: Receive Microsoft Teams incoming webhook events
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  const { allowed } = checkRateLimit(ip, 'social')
  if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = getSupabase()
  if (!supabase) return NextResponse.json({ status: 'ok' })

  let body: Record<string, any>
  try { body = await request.json() } catch { return NextResponse.json({ status: 'ok' }) }

  const messageText = body.text || body.summary || body.title || ''
  const senderName = body.from?.name || body.from?.id || body.sender?.name || 'Teams User'

  // Find workspace with teams integration enabled
  const { data: integration } = await supabase
    .from('integrations')
    .select('workspace_id')
    .eq('key', 'teams')
    .eq('enabled', true)
    .limit(1)
    .single()

  const wsId = integration?.workspace_id
  if (!wsId) return NextResponse.json({ status: 'ok' })

  // Notify workspace owner
  const { data: ws } = await supabase.from('workspaces').select('owner_id').eq('id', wsId).single()
  if (ws) {
    await supabase.from('notifications').insert({
      workspace_id: wsId,
      user_id: ws.owner_id,
      type: 'system',
      title: `Teams message from ${senderName}`,
      body: messageText.slice(0, 200) || 'New message from Microsoft Teams',
      priority: 'medium',
      action_url: '/integrations',
    })
  }

  return NextResponse.json({ status: 'ok' })
}
