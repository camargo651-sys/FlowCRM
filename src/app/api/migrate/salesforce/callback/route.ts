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
    },
  )
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const errorParam = request.nextUrl.searchParams.get('error')

  if (errorParam) {
    return NextResponse.redirect(`${request.nextUrl.origin}/settings/migrate?sf_error=${encodeURIComponent(errorParam)}`)
  }
  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 })
  }

  const clientId = process.env.SF_CLIENT_ID
  const clientSecret = process.env.SF_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'Salesforce not configured. Set SF_CLIENT_ID and SF_CLIENT_SECRET.' },
      { status: 501 },
    )
  }

  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
  const redirectUri = `${appUrl}/api/migrate/salesforce/callback`

  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  })

  const tokenRes = await fetch('https://login.salesforce.com/services/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenBody.toString(),
  })

  if (!tokenRes.ok) {
    const text = await tokenRes.text()
    console.error('[sf/callback] token exchange failed', tokenRes.status, text)
    return NextResponse.redirect(`${request.nextUrl.origin}/settings/migrate?sf_error=token_exchange_failed`)
  }

  const tok = (await tokenRes.json()) as {
    access_token: string
    refresh_token?: string
    instance_url: string
    id?: string
    issued_at?: string
  }

  await supabase.from('integrations').upsert(
    {
      workspace_id: ws.id,
      key: 'salesforce',
      enabled: true,
      config: {
        access_token: tok.access_token,
        refresh_token: tok.refresh_token || null,
        instance_url: tok.instance_url,
        issued_at: tok.issued_at || new Date().toISOString(),
      },
    },
    { onConflict: 'workspace_id,key' },
  )

  return NextResponse.redirect(`${request.nextUrl.origin}/settings/migrate?sf_connected=1`)
}
