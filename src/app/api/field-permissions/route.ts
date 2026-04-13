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

export async function GET() {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ws = await getWorkspace(supabase, user.id)
  if (!ws) return NextResponse.json({ permissions: [] })

  const { data, error } = await supabase
    .from('field_permissions')
    .select('role, entity, field, access')
    .eq('workspace_id', ws.id)

  if (error) return NextResponse.json({ permissions: [] })
  return NextResponse.json({ permissions: data || [] })
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ws = await getWorkspace(supabase, user.id)
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const body = await request.json()
  const perms = Array.isArray(body?.permissions) ? body.permissions : []

  await supabase.from('field_permissions').delete().eq('workspace_id', ws.id)

  if (perms.length > 0) {
    const rows = perms
      .filter((p: { field?: string }) => p.field && p.field.trim().length > 0)
      .map((p: { role: string; entity: string; field: string; access: string }) => ({
        workspace_id: ws.id,
        role: p.role,
        entity: p.entity,
        field: p.field,
        access: p.access,
      }))
    if (rows.length > 0) {
      const { error } = await supabase.from('field_permissions').insert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, count: perms.length })
}

export async function DELETE() {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ws = await getWorkspace(supabase, user.id)
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const { error } = await supabase.from('field_permissions').delete().eq('workspace_id', ws.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
