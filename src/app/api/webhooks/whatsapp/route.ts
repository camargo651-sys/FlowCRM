import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/whatsapp/client'
import { processInboundWhatsAppMessage } from '@/lib/whatsapp/process-inbound'
import type { DbRow } from '@/types'

// Use service role for webhook (no user session)
function getServiceSupabase() {
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

  if (mode !== 'subscribe' || !token || !challenge) {
    return new NextResponse('Bad request', { status: 400 })
  }

  const supabase = getServiceSupabase()
  if (!supabase) return new NextResponse('Service not configured', { status: 503 })
  const { data: accounts } = await supabase
    .from('whatsapp_accounts')
    .select('verify_token')
    .eq('status', 'active')

  const matched = (accounts || []).some(a => a.verify_token === token)
  if (!matched) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  return new NextResponse(challenge, { status: 200 })
}

// POST: Incoming messages and status updates
export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  // Verify signature — required when app secret is configured
  const appSecret = process.env.WHATSAPP_APP_SECRET
  if (!appSecret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }
  const signature = request.headers.get('x-hub-signature-256') || ''
  if (!verifyWebhookSignature(rawBody, signature, appSecret)) {
    console.error('WhatsApp webhook signature mismatch')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  let payload: DbRow
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = getServiceSupabase()
  if (!supabase) return NextResponse.json({ status: 'ok' })

  // Process each entry
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'messages') continue
      const value = change.value
      if (!value) continue

      const phoneNumberId = value.metadata?.phone_number_id
      if (!phoneNumberId) continue

      // Look up WhatsApp account
      const { data: account } = await supabase
        .from('whatsapp_accounts')
        .select('*')
        .eq('phone_number_id', phoneNumberId)
        .eq('status', 'active')
        .single()

      if (!account) continue

      // Process incoming messages
      for (const msg of value.messages || []) {
        const profileName = value.contacts?.[0]?.profile?.name || null

        let body: string | undefined
        switch (msg.type) {
          case 'text':
            body = msg.text?.body
            break
          case 'image':
            body = msg.image?.caption || '[Image]'
            break
          case 'video':
            body = msg.video?.caption || '[Video]'
            break
          case 'document':
            body = msg.document?.caption || `[Document: ${msg.document?.filename || 'file'}]`
            break
          case 'audio':
            body = '[Audio message]'
            break
          case 'location':
            body = `[Location: ${msg.location?.latitude}, ${msg.location?.longitude}]`
            break
          case 'sticker':
            body = '[Sticker]'
            break
          case 'reaction':
            body = msg.reaction?.emoji || '[Reaction]'
            break
          default:
            body = `[${msg.type}]`
        }

        try {
          await processInboundWhatsAppMessage(supabase, {
            wamid: msg.id,
            from: msg.from,
            timestamp: msg.timestamp,
            type: msg.type,
            body,
            profileName,
            conversationId: value.metadata?.conversation_id,
          }, account)
        } catch (err: unknown) {
          console.error(`WhatsApp message processing error:`, err instanceof Error ? err.message : err)
        }
      }

      // Process status updates
      for (const status of value.statuses || []) {
        try {
          await supabase.from('whatsapp_messages').update({
            status: status.status, // sent, delivered, read, failed
            status_updated_at: new Date(parseInt(status.timestamp) * 1000).toISOString(),
          }).eq('wamid', status.id).eq('whatsapp_account_id', account.id)
        } catch (err: unknown) {
          console.error(`WhatsApp status update error:`, err instanceof Error ? err.message : err)
        }
      }
    }
  }

  // Always return 200 to Meta
  return NextResponse.json({ status: 'ok' })
}
