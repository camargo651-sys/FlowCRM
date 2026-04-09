import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { fireTrigger } from '@/lib/automations/engine'
import { checkRateLimit } from '@/lib/api/rate-limit'

function getSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

// GET: Meta webhook verification handshake
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

// POST: Receive Instagram messaging events (DMs)
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  const { allowed } = checkRateLimit(ip, 'social')
  if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = getSupabase()
  if (!supabase) return NextResponse.json({ status: 'ok' })

  let body: Record<string, any>
  try { body = await request.json() } catch { return NextResponse.json({ status: 'ok' }) }

  if (body.object !== 'instagram') return NextResponse.json({ status: 'ok' })

  // Find workspace with instagram integration enabled
  const { data: integration } = await supabase
    .from('integrations')
    .select('workspace_id')
    .eq('key', 'instagram')
    .eq('enabled', true)
    .limit(1)
    .single()

  const wsId = integration?.workspace_id
  if (!wsId) return NextResponse.json({ status: 'ok' })

  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      const senderId = event.sender?.id || ''
      const messageText = event.message?.text || ''
      const timestamp = event.timestamp ? new Date(event.timestamp).toISOString() : new Date().toISOString()

      if (!senderId || !messageText) continue

      // Duplicate detection: same sender in last 24h
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data: existing } = await supabase
        .from('social_leads')
        .select('id, metadata')
        .eq('workspace_id', wsId)
        .eq('author_username', senderId)
        .eq('platform', 'instagram')
        .gte('created_at', oneDayAgo)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (existing) {
        const existingMeta = (existing.metadata || {}) as Record<string, any>
        const additionalMessages = existingMeta.additional_messages || []
        additionalMessages.push({
          message: messageText.slice(0, 2000),
          timestamp,
          source_type: 'dm',
        })
        await supabase.from('social_leads').update({
          metadata: { ...existingMeta, additional_messages: additionalMessages },
        }).eq('id', existing.id)
        continue
      }

      // Create social lead
      const { data: lead } = await supabase.from('social_leads').insert({
        workspace_id: wsId,
        platform: 'instagram',
        source_type: 'dm',
        author_name: senderId,
        author_username: senderId,
        message: messageText.slice(0, 2000),
        status: 'new',
        metadata: {
          sender_id: senderId,
          timestamp,
          priority: 'high',
          has_phone: false,
        },
      }).select('id').single()

      // Notify and fire trigger
      const { data: ws } = await supabase.from('workspaces').select('owner_id').eq('id', wsId).single()
      if (ws && lead) {
        await supabase.from('notifications').insert({
          workspace_id: wsId,
          user_id: ws.owner_id,
          type: 'system',
          title: `New Instagram DM from ${senderId}`,
          body: messageText.slice(0, 100) || 'New Instagram message',
          priority: 'high',
          action_url: '/leads',
        })

        await fireTrigger(supabase, {
          workspaceId: wsId,
          triggerType: 'lead_created',
          leadId: lead.id,
          leadName: senderId,
          leadPlatform: 'instagram',
          leadMessage: messageText.slice(0, 500),
          userId: ws.owner_id,
          metadata: { source_type: 'dm', priority: 'high', has_phone: false },
        })
      }
    }
  }

  return NextResponse.json({ status: 'ok' })
}
