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

// GET: list roadmap items (public)
export async function GET(request: NextRequest) {
  const svc = getServiceClient()
  const supabase = svc || getSupabase()
  const url = new URL(request.url)
  const status = url.searchParams.get('status')

  let query = supabase
    .from('roadmap_items')
    .select('*')
    .order('vote_count', { ascending: false })
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ items: [], error: error.message })

  return NextResponse.json({ items: data || [] })
}

// POST: create new idea (auth required)
export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { title, description, category } = body as { title?: string; description?: string; category?: string }
  if (!title || typeof title !== 'string' || title.length > 200) {
    return NextResponse.json({ error: 'Invalid title' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('roadmap_items')
    .insert({
      title,
      description: description || null,
      category: category || 'feature',
      status: 'idea',
    })
    .select('*')
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message || 'Insert failed' }, { status: 500 })
  return NextResponse.json({ item: data })
}
