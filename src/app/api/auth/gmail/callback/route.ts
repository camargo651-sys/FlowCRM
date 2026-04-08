import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { encryptToken } from '@/lib/email/token-manager'

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

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const stateParam = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL(`/integrations?error=${error}`, request.url))
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(new URL('/integrations?error=missing_params', request.url))
  }

  // Validate CSRF state
  const cookieStore = cookies()
  const savedNonce = cookieStore.get('oauth_state')?.value
  let state: { workspaceId: string; userId: string; nonce: string }

  try {
    state = JSON.parse(Buffer.from(stateParam, 'base64url').toString())
  } catch {
    return NextResponse.redirect(new URL('/integrations?error=invalid_state', request.url))
  }

  if (!savedNonce || savedNonce !== state.nonce) {
    return NextResponse.redirect(new URL('/integrations?error=csrf_mismatch', request.url))
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    console.error('Gmail token exchange failed:', err)
    return NextResponse.redirect(new URL('/integrations?error=token_exchange_failed', request.url))
  }

  const tokens = await tokenRes.json()

  // Fetch user email
  const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const userInfo = await userInfoRes.json()

  // Encrypt tokens before storing
  const encryptedAccess = encryptToken(tokens.access_token)
  const encryptedRefresh = encryptToken(tokens.refresh_token)
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  // Store in database
  const supabase = getSupabase()

  const { error: dbError } = await supabase.from('email_accounts').upsert({
    workspace_id: state.workspaceId,
    user_id: state.userId,
    provider: 'gmail',
    email_address: userInfo.email,
    access_token: encryptedAccess,
    refresh_token: encryptedRefresh,
    token_expires_at: expiresAt,
    scopes: ['gmail.readonly', 'userinfo.email'],
    status: 'active',
  }, { onConflict: 'workspace_id,email_address' })

  if (dbError) {
    console.error('Failed to save email account:', dbError)
    return NextResponse.redirect(new URL('/integrations?error=db_error', request.url))
  }

  // Update integrations table
  await supabase.from('integrations').upsert({
    workspace_id: state.workspaceId,
    key: 'gmail',
    name: 'Gmail',
    enabled: true,
    config: { email: userInfo.email },
  }, { onConflict: 'workspace_id,key' })

  const response = NextResponse.redirect(new URL('/integrations?connected=gmail', request.url))
  response.cookies.delete('oauth_state')
  return response
}
