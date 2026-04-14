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

// GET: list notes with optional filters
// query params: tag, pinned, contact_id, deal_id, ticket_id, search, archived, mine
export async function GET(request: NextRequest) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ws = await getWorkspace(supabase, user.id)
  if (!ws) return NextResponse.json({ notes: [] })

  const url = new URL(request.url)
  const tag = url.searchParams.get('tag')
  const pinned = url.searchParams.get('pinned')
  const contactId = url.searchParams.get('contact_id')
  const dealId = url.searchParams.get('deal_id')
  const ticketId = url.searchParams.get('ticket_id')
  const search = url.searchParams.get('search')
  const archived = url.searchParams.get('archived')
  const mine = url.searchParams.get('mine')

  let query = supabase.from('notes').select('*').eq('workspace_id', ws.id)

  if (archived === 'true') query = query.eq('archived', true)
  else query = query.eq('archived', false)

  if (pinned === 'true') query = query.eq('pinned', true)
  if (mine === 'true') query = query.eq('author_id', user.id)
  if (contactId) query = query.eq('contact_id', contactId)
  if (dealId) query = query.eq('deal_id', dealId)
  if (ticketId) query = query.eq('ticket_id', ticketId)
  if (tag) query = query.contains('tags', [tag])
  if (search) query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`)

  query = query.order('pinned', { ascending: false }).order('updated_at', { ascending: false })

  const { data, error } = await query
  if (error) return NextResponse.json({ notes: [], error: error.message })

  return NextResponse.json({ notes: data || [], workspace_id: ws.id, user_id: user.id })
}

// POST: create note
export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ws = await getWorkspace(supabase, user.id)
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const body = await request.json()
  const { title, content, tags, pinned, contact_id, deal_id, ticket_id, color } = body

  const { data, error } = await supabase
    .from('notes')
    .insert({
      workspace_id: ws.id,
      author_id: user.id,
      title: title || null,
      content: content || '',
      tags: tags || [],
      pinned: pinned || false,
      contact_id: contact_id || null,
      deal_id: deal_id || null,
      ticket_id: ticket_id || null,
      color: color || '#fef3c7',
    })
    .select('*')
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message || 'Insert failed' }, { status: 500 })

  return NextResponse.json({ note: data })
}
