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
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )
}

// GET: List API keys
export async function GET() {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const { data } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, scopes, active, last_used_at, created_at')
    .eq('workspace_id', ws.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ data: data || [] })
}

// POST: Create API key
export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const { name, scopes } = await request.json()
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  // Generate key
  const rawKey = `flw_${crypto.randomBytes(32).toString('hex')}`
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
  const keyPrefix = rawKey.slice(0, 12) + '...'

  const { data, error } = await supabase.from('api_keys').insert({
    workspace_id: ws.id,
    user_id: user.id,
    name,
    key_hash: keyHash,
    key_prefix: keyPrefix,
    scopes: scopes || ['*'],
  }).select('id, name, key_prefix, scopes, created_at').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Return the raw key ONLY on creation (never again)
  return NextResponse.json({ data: { ...data, key: rawKey } })
}

// DELETE: Revoke API key
export async function DELETE(request: NextRequest) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await supabase.from('api_keys').update({ active: false }).eq('id', id)
  return NextResponse.json({ success: true })
}
