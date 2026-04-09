import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

/**
 * POST /api/auth/ensure-workspace
 * Called after login/signup to ensure the user has a workspace and profile.
 * The DB trigger sometimes fails silently, so this is the safety net.
 */
export async function POST() {
  const cookieStore = cookies()
  const supabase = createServerClient(
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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // Check if workspace exists
  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).limit(1).single()

  if (ws) {
    // Workspace exists, check profile
    const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).single()
    if (!profile) {
      // Create profile using service role
      const serviceSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      await serviceSupabase.from('profiles').insert({
        id: user.id,
        workspace_id: ws.id,
        full_name: user.user_metadata?.full_name || '',
        email: user.email,
        role: 'admin',
      })
    }
    return NextResponse.json({ ok: true, workspace_id: ws.id })
  }

  // No workspace — create one using service role (bypasses RLS)
  const serviceSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const name = user.user_metadata?.workspace_name || 'My Workspace'
  const slug = 'ws-' + user.id.replace(/-/g, '').slice(0, 12)

  const { data: newWs } = await serviceSupabase.from('workspaces').insert({
    owner_id: user.id,
    name,
    slug,
  }).select('id').single()

  if (newWs) {
    await serviceSupabase.from('profiles').insert({
      id: user.id,
      workspace_id: newWs.id,
      full_name: user.user_metadata?.full_name || '',
      email: user.email,
      role: 'admin',
    })
  }

  return NextResponse.json({ ok: true, workspace_id: newWs?.id })
}
