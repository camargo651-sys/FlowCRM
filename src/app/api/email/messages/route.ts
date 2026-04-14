import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { sendGmailMessage } from '@/lib/email/gmail-send'
import { sendOutlookMessage } from '@/lib/email/outlook-send'

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

async function getWorkspace(supabase: ReturnType<typeof getSupabase>, userId: string) {
  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', userId).single()
  return ws
}

// GET /api/email/messages?contact_id=&archived=&starred=&search=&folder=inbox|sent|starred|archived
export async function GET(request: NextRequest) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ws = await getWorkspace(supabase, user.id)
  if (!ws) return NextResponse.json({ messages: [] })

  const url = new URL(request.url)
  const contactId = url.searchParams.get('contact_id')
  const folder = url.searchParams.get('folder') || 'inbox'
  const search = url.searchParams.get('search')

  let query = supabase
    .from('email_messages')
    .select('id, workspace_id, contact_id, thread_id, direction, from_address, from_name, to_addresses, cc_addresses, subject, snippet, body_html, body_text, has_attachments, is_read, starred, archived, received_at, created_at')
    .eq('workspace_id', ws.id)
    .order('received_at', { ascending: false })
    .limit(200)

  if (contactId) {
    query = query.eq('contact_id', contactId)
  } else {
    if (folder === 'archived') query = query.eq('archived', true)
    else query = query.eq('archived', false)
    if (folder === 'starred') query = query.eq('starred', true)
    if (folder === 'sent') query = query.eq('direction', 'outbound')
    if (folder === 'inbox') query = query.eq('direction', 'inbound')
  }

  if (search) {
    query = query.or(`subject.ilike.%${search}%,snippet.ilike.%${search}%,from_address.ilike.%${search}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ messages: data || [] })
}

// POST /api/email/messages — store outbound (real Gmail send is TODO, currently local-only)
export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ws = await getWorkspace(supabase, user.id)
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const body = await request.json()
  const { to, cc, subject, body_html, body_text, contact_id, thread_id, account_id } = body
  if (!to || !subject) return NextResponse.json({ error: 'Missing to/subject' }, { status: 400 })

  const toList: string[] = Array.isArray(to) ? to : [to]
  const ccList: string[] | undefined = Array.isArray(cc) ? cc : (cc ? [cc] : undefined)

  // Auto-link contact by to-email if not provided
  let linkedContactId = contact_id || null
  if (!linkedContactId && toList[0]) {
    const { data: c } = await supabase.from('contacts').select('id').eq('workspace_id', ws.id).eq('email', toList[0]).maybeSingle()
    if (c) linkedContactId = c.id
  }

  // Resolve sending account: explicit account_id, or fall back to first active account for user
  let sendAccount: {
    id: string
    provider: string
    email_address: string
    access_token: string
    refresh_token: string | null
    token_expires_at: string | null
  } | null = null

  if (account_id) {
    const { data: acc } = await supabase
      .from('email_accounts')
      .select('id, provider, email_address, access_token, refresh_token, token_expires_at')
      .eq('id', account_id)
      .eq('workspace_id', ws.id)
      .maybeSingle()
    if (acc) sendAccount = acc
  } else {
    const { data: acc } = await supabase
      .from('email_accounts')
      .select('id, provider, email_address, access_token, refresh_token, token_expires_at')
      .eq('workspace_id', ws.id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()
    if (acc) sendAccount = acc
  }

  const onTokenRefreshed = async (accountId: string, encryptedToken: string, expiresAt: Date) => {
    await supabase.from('email_accounts').update({
      access_token: encryptedToken,
      token_expires_at: expiresAt.toISOString(),
      status: 'active',
    }).eq('id', accountId)
  }

  let externalId: string | null = null
  let externalThreadId: string | null = thread_id || null
  let sendFailed = false
  let sendError: string | null = null

  if (sendAccount) {
    try {
      const sendInput = {
        to: toList,
        cc: ccList,
        subject,
        body_html: body_html || null,
        body_text: body_text || null,
        thread_id: thread_id || null,
        from_address: sendAccount.email_address,
        from_name: user.user_metadata?.full_name || null,
      }
      const result = sendAccount.provider === 'gmail'
        ? await sendGmailMessage(sendAccount as never, sendInput, onTokenRefreshed)
        : await sendOutlookMessage(sendAccount as never, sendInput, onTokenRefreshed)
      externalId = result.id
      externalThreadId = result.thread_id || externalThreadId
    } catch (err) {
      sendFailed = true
      sendError = err instanceof Error ? err.message : 'send failed'
      console.error('[email/messages] send failed', sendError)
    }
  }

  const insertPayload: Record<string, unknown> = {
    workspace_id: ws.id,
    user_id: user.id,
    contact_id: linkedContactId,
    thread_id: externalThreadId,
    direction: 'outbound',
    from_address: sendAccount?.email_address || user.email || '',
    from_name: user.user_metadata?.full_name || null,
    to_addresses: toList,
    cc_addresses: ccList || null,
    subject,
    snippet: (body_text || '').slice(0, 500),
    body_html: body_html || null,
    body_text: body_text || null,
    is_read: true,
    received_at: new Date().toISOString(),
  }
  if (externalId) insertPayload.external_id = externalId
  if (sendAccount) insertPayload.email_account_id = sendAccount.id
  if (sendFailed) insertPayload.send_failed = true

  const { data, error } = await supabase.from('email_messages').insert(insertPayload).select().single()

  if (error) {
    // Retry without optional columns that may not exist in schema
    const retry = await supabase.from('email_messages').insert({
      workspace_id: ws.id,
      user_id: user.id,
      contact_id: linkedContactId,
      thread_id: externalThreadId,
      direction: 'outbound',
      from_address: sendAccount?.email_address || user.email || '',
      from_name: user.user_metadata?.full_name || null,
      to_addresses: toList,
      cc_addresses: ccList || null,
      subject,
      snippet: (body_text || '').slice(0, 500),
      body_html: body_html || null,
      body_text: body_text || null,
      is_read: true,
      received_at: new Date().toISOString(),
    }).select().single()
    if (retry.error) return NextResponse.json({ error: retry.error.message }, { status: 500 })
    return NextResponse.json({
      message: retry.data,
      sent: !!externalId,
      send_failed: sendFailed,
      send_error: sendError,
      todo: sendAccount ? undefined : 'No connected email account — message stored locally',
    })
  }

  return NextResponse.json({
    message: data,
    sent: !!externalId,
    send_failed: sendFailed,
    send_error: sendError,
    todo: sendAccount ? undefined : 'No connected email account — message stored locally',
  })
}
