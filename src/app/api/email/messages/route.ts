import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

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
  const { to, cc, subject, body_html, body_text, contact_id, thread_id } = body
  if (!to || !subject) return NextResponse.json({ error: 'Missing to/subject' }, { status: 400 })

  // Auto-link contact by from-email if not provided
  let linkedContactId = contact_id || null
  if (!linkedContactId && Array.isArray(to) && to[0]) {
    const { data: c } = await supabase.from('contacts').select('id').eq('workspace_id', ws.id).eq('email', to[0]).maybeSingle()
    if (c) linkedContactId = c.id
  }

  const { data, error } = await supabase.from('email_messages').insert({
    workspace_id: ws.id,
    user_id: user.id,
    contact_id: linkedContactId,
    thread_id: thread_id || null,
    direction: 'outbound',
    from_address: user.email || '',
    from_name: user.user_metadata?.full_name || null,
    to_addresses: Array.isArray(to) ? to : [to],
    cc_addresses: cc || null,
    subject,
    snippet: (body_text || '').slice(0, 500),
    body_html: body_html || null,
    body_text: body_text || null,
    is_read: true,
    received_at: new Date().toISOString(),
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ message: data, todo: 'Real Gmail/Outlook send not yet wired — message stored locally' })
}
