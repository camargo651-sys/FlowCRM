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

// GET: request detail with comments
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ws = await getWorkspace(supabase, user.id)
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const { data: r, error } = await supabase
    .from('inter_dept_requests')
    .select('*')
    .eq('id', params.id)
    .eq('workspace_id', ws.id)
    .single()

  if (error || !r) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: comments } = await supabase
    .from('inter_dept_request_comments')
    .select('*')
    .eq('request_id', r.id)
    .order('created_at', { ascending: true })

  return NextResponse.json({
    request: {
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
      comments: (comments || []).map(c => ({
        id: c.id, author: c.author_name || 'Desconocido', text: c.text, created_at: c.created_at,
      })),
    },
    workspace_id: ws.id,
    user_id: user.id,
  })
}

// PATCH: update fields (status, title, etc.)
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ws = await getWorkspace(supabase, user.id)
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const patch = await request.json()
  const allowed: Record<string, any> = {}
  for (const k of ['title', 'description', 'from_dept', 'to_dept', 'priority', 'status']) {
    if (patch[k] !== undefined) allowed[k] = patch[k]
  }
  allowed.updated_at = new Date().toISOString()
  if (patch.status === 'approved') { allowed.approved_by = user.id; allowed.approved_at = new Date().toISOString() }
  if (patch.status === 'completed') { allowed.completed_at = new Date().toISOString() }

  const { data, error } = await supabase
    .from('inter_dept_requests')
    .update(allowed)
    .eq('id', params.id)
    .eq('workspace_id', ws.id)
    .select('*')
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message || 'Update failed' }, { status: 500 })

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
    },
  })
}
