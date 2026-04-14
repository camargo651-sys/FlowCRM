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

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ws = await getWorkspace(supabase, user.id)
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const { data: msg, error } = await supabase
    .from('email_messages')
    .select('*')
    .eq('id', params.id)
    .eq('workspace_id', ws.id)
    .single()
  if (error || !msg) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Fetch full thread
  let thread: unknown[] = []
  if (msg.thread_id) {
    const { data: t } = await supabase
      .from('email_messages')
      .select('id, direction, from_address, from_name, to_addresses, subject, snippet, body_html, body_text, received_at, is_read, starred')
      .eq('workspace_id', ws.id)
      .eq('thread_id', msg.thread_id)
      .order('received_at', { ascending: true })
    thread = t || []
  }

  return NextResponse.json({ message: msg, thread })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ws = await getWorkspace(supabase, user.id)
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const body = await request.json()
  const allowed: Record<string, unknown> = {}
  if (typeof body.is_read === 'boolean') allowed.is_read = body.is_read
  if (typeof body.read === 'boolean') allowed.is_read = body.read
  if (typeof body.starred === 'boolean') allowed.starred = body.starred
  if (typeof body.archived === 'boolean') allowed.archived = body.archived

  const { data, error } = await supabase
    .from('email_messages')
    .update(allowed)
    .eq('id', params.id)
    .eq('workspace_id', ws.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: data })
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ws = await getWorkspace(supabase, user.id)
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const { error } = await supabase.from('email_messages').delete().eq('id', params.id).eq('workspace_id', ws.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
