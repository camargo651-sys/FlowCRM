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

// GET: list requests for current workspace
export async function GET() {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ws = await getWorkspace(supabase, user.id)
  if (!ws) return NextResponse.json({ requests: [] })

  const { data: requests, error } = await supabase
    .from('inter_dept_requests')
    .select('*')
    .eq('workspace_id', ws.id)
    .order('number', { ascending: false })

  if (error) return NextResponse.json({ requests: [] })

  const ids = (requests || []).map(r => r.id)
  let commentsByReq: Record<string, any[]> = {}
  if (ids.length > 0) {
    const { data: comments } = await supabase
      .from('inter_dept_request_comments')
      .select('*')
      .in('request_id', ids)
      .order('created_at', { ascending: true })
    for (const c of comments || []) {
      ;(commentsByReq[c.request_id] ||= []).push({
        id: c.id, author: c.author_name || 'Desconocido', text: c.text, created_at: c.created_at,
      })
    }
  }

  const result = (requests || []).map(r => ({
    id: r.id,
    number: r.number,
    title: r.title,
    description: r.description || undefined,
    from_dept: r.from_dept,
    to_dept: r.to_dept,
    priority: r.priority,
    status: r.status,
    requested_by: r.requested_by_name || '',
    created_at: r.created_at,
    updated_at: r.updated_at,
    comments: commentsByReq[r.id] || [],
  }))

  return NextResponse.json({ requests: result, workspace_id: ws.id, user_id: user.id })
}

// POST: create request
export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ws = await getWorkspace(supabase, user.id)
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const body = await request.json()
  const { title, description, from_dept, to_dept, priority, requested_by, status } = body
  if (!title || !from_dept || !to_dept) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const { data, error } = await supabase
    .from('inter_dept_requests')
    .insert({
      workspace_id: ws.id,
      title,
      description: description || null,
      from_dept,
      to_dept,
      priority: priority || 'normal',
      status: status || 'submitted',
      requested_by: user.id,
      requested_by_name: requested_by || 'Yo',
    })
    .select('*')
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message || 'Insert failed' }, { status: 500 })

  return NextResponse.json({
    request: {
      id: data.id,
      number: data.number,
      title: data.title,
      description: data.description || undefined,
      from_dept: data.from_dept,
      to_dept: data.to_dept,
      priority: data.priority,
      status: data.status,
      requested_by: data.requested_by_name || '',
      created_at: data.created_at,
      updated_at: data.updated_at,
      comments: [],
    },
  })
}
