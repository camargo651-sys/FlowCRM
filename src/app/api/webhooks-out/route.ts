import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

function getSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(toSet: { name: string; value: string; options?: CookieOptions }[]) {
          try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )
}

async function getWorkspace(supabase: ReturnType<typeof getSupabase>, userId: string) {
  const { data } = await supabase.from('workspaces').select('id').eq('owner_id', userId).single()
  return data
}

export async function GET() {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ws = await getWorkspace(supabase, user.id)
  if (!ws) return NextResponse.json({ webhooks: [] })

  const { data, error } = await supabase
    .from('webhooks')
    .select('*')
    .eq('workspace_id', ws.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ webhooks: [], error: error.message })
  return NextResponse.json({ webhooks: data || [] })
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ws = await getWorkspace(supabase, user.id)
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const { name, url, events, active } = await req.json()
  if (!name || !url || !Array.isArray(events) || events.length === 0) {
    return NextResponse.json({ error: 'name, url, events required' }, { status: 400 })
  }

  const secret = 'whsec_' + crypto.randomBytes(24).toString('hex')

  const { data, error } = await supabase
    .from('webhooks')
    .insert({
      workspace_id: ws.id,
      name,
      url,
      events,
      secret,
      active: active !== false,
    })
    .select('*')
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message || 'Insert failed' }, { status: 500 })
  return NextResponse.json({ webhook: data })
}

export async function PATCH(req: NextRequest) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ws = await getWorkspace(supabase, user.id)
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const { id, ...patch } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('webhooks')
    .update(patch)
    .eq('id', id)
    .eq('workspace_id', ws.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ webhook: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ws = await getWorkspace(supabase, user.id)
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase.from('webhooks').delete().eq('id', id).eq('workspace_id', ws.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deleted: true })
}
