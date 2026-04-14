import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

export async function POST(request: NextRequest) {
  let supabase
  try { supabase = getServiceClient() } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }

  const body = await request.json()
  const { link_id, guest_name, guest_email, guest_phone, scheduled_at, notes } = body
  if (!link_id || !guest_name || !guest_email || !scheduled_at) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data: link } = await supabase
    .from('booking_links')
    .select('*')
    .eq('id', link_id)
    .eq('active', true)
    .single()
  if (!link) return NextResponse.json({ error: 'Booking link not found' }, { status: 404 })

  // Find or create contact by email within workspace
  let contactId: string | null = null
  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id')
    .eq('workspace_id', link.workspace_id)
    .ilike('email', guest_email)
    .limit(1)
    .maybeSingle()

  if (existingContact) {
    contactId = existingContact.id
  } else {
    const { data: newContact } = await supabase
      .from('contacts')
      .insert({
        workspace_id: link.workspace_id,
        name: guest_name,
        email: guest_email,
        phone: guest_phone || null,
        type: 'person',
        tags: ['scheduler'],
      })
      .select('id')
      .single()
    if (newContact) contactId = newContact.id
  }

  const { data: booking, error } = await supabase
    .from('bookings')
    .insert({
      link_id: link.id,
      workspace_id: link.workspace_id,
      contact_id: contactId,
      guest_name,
      guest_email,
      guest_phone: guest_phone || null,
      scheduled_at,
      duration_minutes: link.duration_minutes || 30,
      notes: notes || null,
      status: 'confirmed',
    })
    .select('*')
    .single()

  if (error || !booking) return NextResponse.json({ error: error?.message || 'Insert failed' }, { status: 500 })

  // Insert activity event of type 'meeting'
  try {
    await supabase.from('activities').insert({
      workspace_id: link.workspace_id,
      type: 'meeting',
      title: `${link.title} with ${guest_name}`,
      notes: notes || `Booked via scheduler. Email: ${guest_email}`,
      contact_id: contactId,
      owner_id: link.user_id,
      done: false,
      due_date: scheduled_at,
      metadata: {
        source: 'scheduler',
        booking_id: booking.id,
        guest_email,
      },
    })
  } catch {}

  // Notify the link owner
  try {
    await supabase.from('notifications').insert({
      workspace_id: link.workspace_id,
      user_id: link.user_id,
      type: 'system',
      title: `New booking: ${link.title}`,
      body: `${guest_name} booked ${new Date(scheduled_at).toLocaleString()}`,
      priority: 'normal',
    })
  } catch {}

  return NextResponse.json({ booking })
}
