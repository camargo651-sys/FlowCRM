import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

function getServiceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
  )
}

export async function POST(request: NextRequest) {
  const supabase = getServiceSupabase()
  if (!supabase) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 })
  }

  const rawBody = await request.text()

  // Verify webhook signature if secret is configured
  const webhookSecret = process.env.CALENDLY_WEBHOOK_SECRET
  if (webhookSecret) {
    const signature = request.headers.get('calendly-webhook-signature') || ''
    const parts = Object.fromEntries(
      signature.split(',').map((p) => {
        const [k, v] = p.split('=')
        return [k, v]
      }),
    )
    const t = parts.t
    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(`${t}.${rawBody}`)
      .digest('hex')

    if (parts.v1 !== expectedSig) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const event = payload.event as string | undefined
  if (!event) {
    return NextResponse.json({ error: 'Missing event type' }, { status: 400 })
  }

  // Find workspace via integrations table
  const { data: integration } = await supabase
    .from('integrations')
    .select('workspace_id')
    .eq('key', 'calendly')
    .eq('enabled', true)
    .limit(1)
    .single()

  if (!integration) {
    return NextResponse.json({ error: 'No workspace with Calendly enabled' }, { status: 404 })
  }

  const workspaceId = integration.workspace_id

  // Get workspace owner
  const { data: ws } = await supabase
    .from('workspaces')
    .select('owner_id')
    .eq('id', workspaceId)
    .single()

  if (!ws) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }

  const inviteePayload = payload.payload
  const inviteeEmail = inviteePayload?.email || inviteePayload?.invitee?.email || ''
  const inviteeName = inviteePayload?.name || inviteePayload?.invitee?.name || 'Unknown'
  const eventName = inviteePayload?.event_type?.name || inviteePayload?.scheduled_event?.name || 'Calendly Meeting'
  const startTime = inviteePayload?.scheduled_event?.start_time || inviteePayload?.event?.start_time || new Date().toISOString()

  // Try to match contact by email
  let contactId: string | null = null
  if (inviteeEmail) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('workspace_id', workspaceId)
      .ilike('email', inviteeEmail)
      .limit(1)
      .single()

    if (contact) contactId = contact.id
  }

  if (event === 'invitee.created') {
    // Create meeting activity
    await supabase.from('activities').insert({
      workspace_id: workspaceId,
      type: 'meeting',
      title: `${eventName} with ${inviteeName}`,
      notes: `Booked via Calendly. Email: ${inviteeEmail}`,
      contact_id: contactId,
      owner_id: ws.owner_id,
      done: false,
      due_date: startTime,
      metadata: {
        source: 'calendly',
        calendly_event_uri: inviteePayload?.scheduled_event?.uri || null,
        invitee_email: inviteeEmail,
      },
    })

    // Create notification for workspace owner
    await supabase.from('notifications').insert({
      workspace_id: workspaceId,
      user_id: ws.owner_id,
      type: 'meeting_booked',
      title: `New meeting: ${eventName}`,
      body: `${inviteeName} (${inviteeEmail}) booked a meeting via Calendly`,
      priority: 'normal',
      action_url: '/activities',
      contact_id: contactId,
    })

    return NextResponse.json({ success: true, action: 'meeting_created' })
  }

  if (event === 'invitee.canceled') {
    // Mark matching meeting activity as done/canceled
    const { data: existing } = await supabase
      .from('activities')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('type', 'meeting')
      .contains('metadata', { source: 'calendly', invitee_email: inviteeEmail })
      .eq('done', false)
      .limit(1)
      .single()

    if (existing) {
      await supabase.from('activities').update({
        done: true,
        notes: `Canceled by ${inviteeName} (${inviteeEmail})`,
      }).eq('id', existing.id)
    }

    // Notify owner of cancellation
    await supabase.from('notifications').insert({
      workspace_id: workspaceId,
      user_id: ws.owner_id,
      type: 'meeting_canceled',
      title: `Meeting canceled: ${eventName}`,
      body: `${inviteeName} (${inviteeEmail}) canceled their Calendly meeting`,
      priority: 'normal',
      action_url: '/activities',
      contact_id: contactId,
    })

    return NextResponse.json({ success: true, action: 'meeting_canceled' })
  }

  return NextResponse.json({ success: true, action: 'ignored', event })
}
