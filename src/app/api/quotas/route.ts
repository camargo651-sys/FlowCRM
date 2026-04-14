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

async function getWorkspaceId(supabase: ReturnType<typeof getSupabase>, userId: string): Promise<string | null> {
  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', userId).single()
  return ws?.id ?? null
}

export async function GET(request: NextRequest) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const wsId = await getWorkspaceId(supabase, user.id)
  if (!wsId) return NextResponse.json({ quotas: [] })

  const { searchParams } = new URL(request.url)
  const userIdFilter = searchParams.get('user_id')
  const activeOnly = searchParams.get('active') === '1'

  let q = supabase
    .from('sales_quotas')
    .select('id, workspace_id, user_id, period, target_amount, start_date, end_date, metric, created_at')
    .eq('workspace_id', wsId)
    .order('start_date', { ascending: false })

  if (userIdFilter) q = q.eq('user_id', userIdFilter)

  const { data, error } = await q
  if (error) return NextResponse.json({ quotas: [], error: error.message })

  let quotas = data || []
  if (activeOnly) {
    const today = new Date().toISOString().slice(0, 10)
    quotas = quotas.filter(q => q.start_date <= today && q.end_date >= today)
  }
  return NextResponse.json({ quotas })
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const wsId = await getWorkspaceId(supabase, user.id)
  if (!wsId) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const body = await request.json()
  const { user_id, period, target_amount, start_date, end_date, metric } = body
  if (!period || !target_amount || !start_date || !end_date) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('sales_quotas')
    .insert({
      workspace_id: wsId,
      user_id: user_id || null,
      period,
      target_amount: Number(target_amount),
      start_date,
      end_date,
      metric: metric || 'won_value',
    })
    .select('*')
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message || 'Insert failed' }, { status: 500 })
  return NextResponse.json({ quota: data })
}

export async function PATCH(request: NextRequest) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const wsId = await getWorkspaceId(supabase, user.id)
  if (!wsId) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const body = await request.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const allowed: Record<string, unknown> = {}
  for (const k of ['period', 'target_amount', 'start_date', 'end_date', 'metric', 'user_id']) {
    if (k in updates) allowed[k] = updates[k]
  }

  const { data, error } = await supabase
    .from('sales_quotas')
    .update(allowed)
    .eq('id', id)
    .eq('workspace_id', wsId)
    .select('*')
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message || 'Update failed' }, { status: 500 })
  return NextResponse.json({ quota: data })
}

export async function DELETE(request: NextRequest) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const wsId = await getWorkspaceId(supabase, user.id)
  if (!wsId) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await supabase
    .from('sales_quotas')
    .delete()
    .eq('id', id)
    .eq('workspace_id', wsId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
