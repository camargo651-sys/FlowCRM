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

// GET: list pending approvals for current user (or all in workspace)
export async function GET(request: NextRequest) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ws = await getWorkspace(supabase, user.id)
  if (!ws) return NextResponse.json({ requests: [] })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'pending'
  const mine = searchParams.get('mine') === 'true'

  let query = supabase
    .from('approval_requests')
    .select('*')
    .eq('workspace_id', ws.id)
    .eq('status', status)
    .order('created_at', { ascending: false })

  if (mine) {
    query = query.eq('approver_id', user.id)
  }

  const { data } = await query
  return NextResponse.json({ requests: data || [], user_id: user.id })
}

// POST: create approval request
export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ws = await getWorkspace(supabase, user.id)
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const body = await request.json()
  const { rule_id, entity, entity_id, approver_id, reason } = body
  if (!entity || !entity_id) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const { data, error } = await supabase
    .from('approval_requests')
    .insert({
      workspace_id: ws.id,
      rule_id: rule_id || null,
      entity, entity_id,
      requested_by: user.id,
      approver_id: approver_id || null,
      reason: reason || null,
      status: 'pending',
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ request: data })
}

// PATCH: approve / reject
export async function PATCH(request: NextRequest) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ws = await getWorkspace(supabase, user.id)
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const body = await request.json()
  const { id, status, reason } = body
  if (!id || !status) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  if (!['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('approval_requests')
    .update({
      status,
      reason: reason || null,
      decided_at: new Date().toISOString(),
      approver_id: user.id,
    })
    .eq('id', id)
    .eq('workspace_id', ws.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ request: data })
}
