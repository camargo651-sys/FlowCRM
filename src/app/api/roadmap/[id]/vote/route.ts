import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
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

function getServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

async function recount(svc: ReturnType<typeof getServiceClient>, itemId: string) {
  if (!svc) return
  const { count } = await svc
    .from('roadmap_votes')
    .select('id', { count: 'exact', head: true })
    .eq('item_id', itemId)
  await svc.from('roadmap_items').update({ vote_count: count ?? 0 }).eq('id', itemId)
}

// POST: vote for an item (auth OR guest email)
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const itemId = params.id
  if (!itemId) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = getSupabase()
  const svc = getServiceClient()
  if (!svc) return NextResponse.json({ error: 'Not configured' }, { status: 503 })

  const { data: { user } } = await supabase.auth.getUser()
  const body = await request.json().catch(() => ({}))
  const guestEmail = (body as { email?: string }).email

  if (!user && (!guestEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail))) {
    return NextResponse.json({ error: 'Email or login required' }, { status: 400 })
  }

  const insertPayload: Record<string, unknown> = { item_id: itemId }
  if (user) insertPayload.user_id = user.id
  else insertPayload.guest_email = guestEmail

  const { error } = await svc.from('roadmap_votes').insert(insertPayload)
  if (error && !error.message.includes('duplicate')) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await recount(svc, itemId)
  const { data: item } = await svc.from('roadmap_items').select('*').eq('id', itemId).single()
  return NextResponse.json({ item })
}

// DELETE: unvote
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const itemId = params.id
  const supabase = getSupabase()
  const svc = getServiceClient()
  if (!svc) return NextResponse.json({ error: 'Not configured' }, { status: 503 })

  const { data: { user } } = await supabase.auth.getUser()
  const url = new URL(request.url)
  const guestEmail = url.searchParams.get('email')

  let query = svc.from('roadmap_votes').delete().eq('item_id', itemId)
  if (user) query = query.eq('user_id', user.id)
  else if (guestEmail) query = query.eq('guest_email', guestEmail)
  else return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await recount(svc, itemId)
  const { data: item } = await svc.from('roadmap_items').select('*').eq('id', itemId).single()
  return NextResponse.json({ item })
}
