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

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const dealId = params.id
  const body = await request.json()
  const on_hold = !!body.on_hold

  const patch: Record<string, unknown> = on_hold
    ? {
        status: 'on_hold',
        hold_reason: body.hold_reason || null,
        hold_until: body.hold_until || null,
        hold_at: new Date().toISOString(),
      }
    : {
        status: 'open',
        hold_reason: null,
        hold_until: null,
        hold_at: null,
      }

  const { data, error } = await supabase
    .from('deals')
    .update(patch)
    .eq('id', dealId)
    .eq('workspace_id', ws.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deal: data })
}
