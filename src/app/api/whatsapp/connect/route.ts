import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { encryptToken } from '@/lib/whatsapp/client'

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

  const { phone_number_id, access_token, verify_token } = await request.json()
  if (!phone_number_id || !access_token || !verify_token) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  // Validate token by fetching phone number info from Meta
  let displayPhone = ''
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phone_number_id}?fields=display_phone_number,verified_name&access_token=${access_token}`,
    )
    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `Invalid credentials: ${err}` }, { status: 400 })
    }
    const data = await res.json()
    displayPhone = data.display_phone_number || ''
  } catch (err: unknown) {
    return NextResponse.json({ error: `Validation failed: ${err instanceof Error ? err.message : 'Unknown error'}` }, { status: 400 })
  }

  // Encrypt and store
  const encryptedToken = encryptToken(access_token)

  const { error: dbError } = await supabase.from('whatsapp_accounts').upsert({
    workspace_id: ws.id,
    user_id: user.id,
    phone_number_id,
    display_phone: displayPhone,
    access_token: encryptedToken,
    verify_token,
    status: 'active',
  }, { onConflict: 'workspace_id,phone_number_id' })

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  // Update integrations table
  await supabase.from('integrations').upsert({
    workspace_id: ws.id,
    key: 'whatsapp',
    name: 'WhatsApp Business',
    enabled: true,
    config: { phone_number_id, display_phone: displayPhone },
  }, { onConflict: 'workspace_id,key' })

  return NextResponse.json({ success: true, display_phone: displayPhone })
}
