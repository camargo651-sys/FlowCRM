import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

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

// GET: list team members (profiles) of the active workspace
export async function GET() {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
  if (!ws) return NextResponse.json({ users: [] })

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('workspace_id', ws.id)

  if (error) return NextResponse.json({ users: [] })

  const users = (profiles || []).map(p => ({
    id: p.id,
    name: p.full_name || p.email || 'Unknown',
    email: p.email || '',
  }))

  return NextResponse.json({ users, workspace_id: ws.id })
}
