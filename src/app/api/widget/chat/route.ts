import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { fireTrigger } from '@/lib/automations/engine'
import { sendWhatsAppMessage, normalizePhone, decryptToken } from '@/lib/whatsapp/client'
import { checkRateLimit } from '@/lib/api/rate-limit'

function getSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

// CORS headers for cross-origin widget requests
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  if (!supabase) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503, headers: CORS_HEADERS })
  }

  // Rate limit by IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'

  const { allowed } = checkRateLimit(ip, 'widget')
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: CORS_HEADERS }
    )
  }

  // Parse body
  let body: { workspaceId?: string; name?: string; phone?: string; message?: string; pageUrl?: string; visitorId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: CORS_HEADERS })
  }

  const { workspaceId, name, phone, message, pageUrl, visitorId } = body

  // Validate required fields
  if (!workspaceId || typeof workspaceId !== 'string') {
    return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400, headers: CORS_HEADERS })
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400, headers: CORS_HEADERS })
  }
  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    return NextResponse.json({ error: 'Phone number is required' }, { status: 400, headers: CORS_HEADERS })
  }
  if (!message || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400, headers: CORS_HEADERS })
  }

  // Verify workspace exists
  const { data: ws } = await supabase
    .from('workspaces')
    .select('id, owner_id, widget_config')
    .eq('id', workspaceId)
    .single()

  if (!ws) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404, headers: CORS_HEADERS })
  }

  const cleanName = name.trim().slice(0, 100)
  const cleanPhone = phone.trim().slice(0, 30)
  const cleanMessage = message.trim().slice(0, 2000)
  const widgetConfig = (ws.widget_config || {}) as Record<string, unknown>

  // --- Create social_lead ---
  const { data: lead } = await supabase.from('social_leads').insert({
    workspace_id: ws.id,
    platform: 'website',
    source_type: 'widget',
    author_name: cleanName,
    author_username: cleanPhone,
    message: cleanMessage,
    status: 'new',
    metadata: {
      phone: cleanPhone,
      pageUrl: pageUrl || null,
      visitorId: visitorId || null,
      priority: 'normal',
    },
  }).select('id').single()

  // --- Create or link contact ---
  const normalizedPhone = normalizePhone(cleanPhone)
  let contactId: string | null = null

  // Check if a contact with this phone already exists
  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id, tags')
    .eq('workspace_id', ws.id)
    .eq('phone', cleanPhone)
    .limit(1)
    .single()

  if (existingContact) {
    contactId = existingContact.id
    // Add widget tag if not present
    const tags = Array.isArray(existingContact.tags) ? existingContact.tags : []
    if (!tags.includes('widget')) {
      await supabase.from('contacts').update({ tags: [...tags, 'widget'] }).eq('id', contactId)
    }
  } else {
    // Create new contact
    const { data: newContact } = await supabase.from('contacts').insert({
      workspace_id: ws.id,
      name: cleanName,
      phone: cleanPhone,
      tags: ['widget', 'website'],
      source: 'widget',
    }).select('id').single()
    contactId = newContact?.id || null
  }

  // Link contact to lead
  if (contactId && lead) {
    await supabase.from('social_leads').update({ contact_id: contactId }).eq('id', lead.id)
  }

  // --- Send auto WhatsApp reply if configured ---
  const autoReplyEnabled = widgetConfig.auto_whatsapp_reply !== false // default on
  if (autoReplyEnabled) {
    try {
      const { data: waAccount } = await supabase
        .from('whatsapp_accounts')
        .select('*')
        .eq('workspace_id', ws.id)
        .eq('status', 'active')
        .single()

      if (waAccount) {
        const replyMessage = (widgetConfig.auto_reply_message as string)
          || `Hi ${cleanName}! Thanks for reaching out via our website. We'll be in touch shortly.`

        const accessToken = decryptToken(waAccount.access_token)
        const { messageId } = await sendWhatsAppMessage(
          accessToken,
          waAccount.phone_number_id,
          cleanPhone,
          replyMessage.replace('{name}', cleanName),
        )

        // Store outbound message
        await supabase.from('whatsapp_messages').insert({
          workspace_id: ws.id,
          whatsapp_account_id: waAccount.id,
          wamid: messageId,
          from_number: waAccount.display_phone || waAccount.phone_number_id,
          to_number: cleanPhone,
          direction: 'outbound',
          message_type: 'text',
          body: replyMessage.replace('{name}', cleanName),
          status: 'sent',
          contact_id: contactId,
          received_at: new Date().toISOString(),
        })
      }
    } catch {
      // WhatsApp sending failed — don't block the response
    }
  }

  // --- Create notification for workspace owner ---
  await supabase.from('notifications').insert({
    workspace_id: ws.id,
    user_id: ws.owner_id,
    type: 'system',
    title: `New website lead: ${cleanName}`,
    body: `${cleanMessage.slice(0, 100)} — Phone: ${cleanPhone}`,
    priority: 'medium',
    action_url: '/leads',
  })

  // --- Fire automation trigger ---
  if (lead) {
    await fireTrigger(supabase, {
      workspaceId: ws.id,
      triggerType: 'lead_created',
      leadId: lead.id,
      leadName: cleanName,
      leadPlatform: 'website',
      leadMessage: cleanMessage.slice(0, 500),
      userId: ws.owner_id,
      metadata: { source_type: 'widget', phone: cleanPhone, priority: 'normal' },
    })
  }

  return NextResponse.json(
    { success: true, message: 'We will contact you shortly' },
    { headers: CORS_HEADERS }
  )
}
