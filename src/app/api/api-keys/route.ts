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

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

export async function GET() {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ws = await getWorkspace(supabase, user.id)
  if (!ws) return NextResponse.json({ keys: [] })

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, last_used_at, expires_at, scopes, created_at')
    .eq('workspace_id', ws.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ keys: [], error: error.message })
  return NextResponse.json({ keys: data || [] })
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ws = await getWorkspace(supabase, user.id)
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const { name, scopes, expires_at } = await req.json()
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  // Generate token: tk_live_<32 random hex>
  const random = crypto.randomBytes(24).toString('hex')
  const fullKey = `tk_live_${random}`
  const prefix = fullKey.slice(0, 12) // tk_live_xxxx

  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      workspace_id: ws.id,
      user_id: user.id,
      name,
      key_prefix: prefix,
      key_hash: hashKey(fullKey),
      scopes: Array.isArray(scopes) && scopes.length > 0 ? scopes : ['read', 'write'],
      expires_at: expires_at || null,
    })
    .select('id, name, key_prefix, scopes, created_at')
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message || 'Insert failed' }, { status: 500 })

  return NextResponse.json({ key: data, plaintext: fullKey })
}

export async function DELETE(req: NextRequest) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ws = await getWorkspace(supabase, user.id)
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase.from('api_keys').delete().eq('id', id).eq('workspace_id', ws.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deleted: true })
}
