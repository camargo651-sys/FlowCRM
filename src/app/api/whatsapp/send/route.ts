import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { sendWhatsAppMessage, decryptToken } from '@/lib/whatsapp/client'

function getSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )
}

export async function POST(request: Request) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { contactId, message } = await request.json()
  if (!contactId || !message) {
    return NextResponse.json({ error: 'Missing contactId or message' }, { status: 400 })
  }

  // Get workspace
  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  // Get contact phone (scoped to workspace)
  const { data: contact } = await supabase.from('contacts').select('id, name, phone').eq('id', contactId).eq('workspace_id', ws.id).single()
  if (!contact?.phone) {
    return NextResponse.json({ error: 'Contact has no phone number' }, { status: 400 })
  }

  // Get active WhatsApp account
  const { data: waAccount } = await supabase
    .from('whatsapp_accounts')
    .select('*')
    .eq('workspace_id', ws.id)
    .eq('status', 'active')
    .single()

  if (!waAccount) {
    return NextResponse.json({ error: 'No active WhatsApp account' }, { status: 404 })
  }

  try {
    const accessToken = decryptToken(waAccount.access_token)
    const { messageId } = await sendWhatsAppMessage(
      accessToken,
      waAccount.phone_number_id,
      contact.phone,
      message,
    )

    // Store outbound message
    const { data: stored } = await supabase.from('whatsapp_messages').insert({
      workspace_id: ws.id,
      whatsapp_account_id: waAccount.id,
      wamid: messageId,
      from_number: waAccount.display_phone || waAccount.phone_number_id,
      to_number: contact.phone,
      direction: 'outbound',
      message_type: 'text',
      body: message,
      status: 'sent',
      contact_id: contactId,
      received_at: new Date().toISOString(),
    }).select().single()

    // Log activity
    await supabase.from('activities').insert({
      workspace_id: ws.id,
      type: 'whatsapp',
      title: `WhatsApp to ${contact.name}: ${message.slice(0, 80)}`,
      notes: message.slice(0, 500),
      contact_id: contactId,
      owner_id: user.id,
      due_date: new Date().toISOString(),
      done: true,
      metadata: { wamid: messageId, direction: 'outbound' },
    })

    return NextResponse.json({ success: true, message: stored })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
