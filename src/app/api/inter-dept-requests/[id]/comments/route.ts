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

// POST: add comment to request
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  // Verify request belongs to workspace
  const { data: req } = await supabase
    .from('inter_dept_requests')
    .select('id')
    .eq('id', params.id)
    .eq('workspace_id', ws.id)
    .single()
  if (!req) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { text, author_name } = await request.json()
  if (!text || !text.trim()) return NextResponse.json({ error: 'Text required' }, { status: 400 })

  // Fetch user's profile name as fallback
  let finalAuthor = author_name
  if (!finalAuthor) {
    const { data: profile } = await supabase.from('profiles').select('full_name, email').eq('id', user.id).single()
    finalAuthor = profile?.full_name || profile?.email || 'Yo'
  }

  const { data: comment, error } = await supabase
    .from('inter_dept_request_comments')
    .insert({
      request_id: params.id,
      author_id: user.id,
      author_name: finalAuthor,
      text: text.trim(),
    })
    .select('*')
    .single()

  if (error || !comment) return NextResponse.json({ error: error?.message || 'Insert failed' }, { status: 500 })

  // Touch parent updated_at
  await supabase.from('inter_dept_requests').update({ updated_at: new Date().toISOString() }).eq('id', params.id)

  return NextResponse.json({
    comment: {
      id: comment.id,
      author: comment.author_name || 'Desconocido',
      text: comment.text,
      created_at: comment.created_at,
    },
    workspace_id: ws.id,
    user_id: user.id,
    author_name: finalAuthor,
  })
}
