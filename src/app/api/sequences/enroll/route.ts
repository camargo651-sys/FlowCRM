import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { enrollContact } from '@/lib/sequences/processor'

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

export async function POST(request: Request) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { sequenceId, contactId, workspaceId } = body

  if (!sequenceId || !contactId || !workspaceId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Verify workspace ownership
  const { data: ws } = await supabase
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .eq('owner_id', user.id)
    .single()

  if (!ws) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 403 })
  }

  const result = await enrollContact(supabase, { sequenceId, contactId, workspaceId })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ ok: true, enrollmentId: result.enrollmentId })
}
