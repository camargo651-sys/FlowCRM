import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { fireTrigger } from '@/lib/automations/engine'
import { checkRateLimit } from '@/lib/api/rate-limit'

function getSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

// POST: Receive Telegram webhook updates (message, callback_query)
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  const { allowed } = checkRateLimit(ip, 'social')
  if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = getSupabase()
  if (!supabase) return NextResponse.json({ ok: true })

  let body: Record<string, any>
  try { body = await request.json() } catch { return NextResponse.json({ ok: true }) }

  // Handle message updates
  const message = body.message || body.callback_query?.message
  if (!message) return NextResponse.json({ ok: true })

  const chatId = String(message.chat?.id || '')
  const text = body.message?.text || body.callback_query?.data || ''
  const firstName = message.from?.first_name || ''
  const username = message.from?.username || ''
  const authorName = firstName || username || 'Unknown'

  // Find workspace with telegram integration enabled
  const { data: integration } = await supabase
    .from('integrations')
    .select('workspace_id')
    .eq('key', 'telegram')
    .eq('enabled', true)
    .limit(1)
    .single()

  const wsId = integration?.workspace_id
  if (!wsId) return NextResponse.json({ ok: true })

  // Find or create contact by username
  if (username) {
    const { data: existing } = await supabase
      .from('contacts')
      .select('id')
      .eq('workspace_id', wsId)
      .or(`metadata->>telegram_username.eq.${username},metadata->>telegram_chat_id.eq.${chatId}`)
      .limit(1)
      .single()

    if (!existing) {
      await supabase.from('contacts').insert({
        workspace_id: wsId,
        name: authorName,
        metadata: { telegram_username: username, telegram_chat_id: chatId },
      })
    }
  }

  // Duplicate detection: same username + platform in last 24h
  if (username) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: existing } = await supabase
      .from('social_leads')
      .select('id, metadata')
      .eq('workspace_id', wsId)
      .eq('author_username', username)
      .eq('platform', 'telegram')
      .gte('created_at', oneDayAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (existing) {
      const existingMeta = (existing.metadata || {}) as Record<string, any>
      const additionalMessages = existingMeta.additional_messages || []
      additionalMessages.push({
        message: text.slice(0, 2000),
        timestamp: new Date().toISOString(),
        source_type: 'dm',
      })
      await supabase.from('social_leads').update({
        metadata: { ...existingMeta, additional_messages: additionalMessages },
      }).eq('id', existing.id)
      return NextResponse.json({ ok: true })
    }
  }

  // Create social lead
  const { data: lead } = await supabase.from('social_leads').insert({
    workspace_id: wsId,
    platform: 'telegram',
    source_type: 'dm',
    author_name: authorName,
    author_username: username,
    message: text.slice(0, 2000),
    status: 'new',
    metadata: {
      chat_id: chatId,
      telegram_username: username,
      priority: 'high',
      has_phone: false,
    },
  }).select('id').single()

  // Notify workspace owner and fire trigger
  const { data: ws } = await supabase.from('workspaces').select('owner_id').eq('id', wsId).single()
  if (ws && lead) {
    await supabase.from('notifications').insert({
      workspace_id: wsId,
      user_id: ws.owner_id,
      type: 'system',
      title: `New Telegram lead: ${authorName}`,
      body: text.slice(0, 100) || 'New Telegram message',
      priority: 'high',
      action_url: '/leads',
    })

    await fireTrigger(supabase, {
      workspaceId: wsId,
      triggerType: 'lead_created',
      leadId: lead.id,
      leadName: authorName,
      leadPlatform: 'telegram',
      leadMessage: text.slice(0, 500),
      userId: ws.owner_id,
      metadata: { source_type: 'dm', priority: 'high', has_phone: false },
    })
  }

  return NextResponse.json({ ok: true })
}
