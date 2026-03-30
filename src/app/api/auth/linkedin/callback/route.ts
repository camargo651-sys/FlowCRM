import { createServerClient } from '@supabase/ssr'
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
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
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

  // Validate CSRF
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
  const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      redirect_uri: process.env.LINKEDIN_REDIRECT_URI!,
    }),
  })

  if (!tokenRes.ok) {
    console.error('LinkedIn token exchange failed:', await tokenRes.text())
    return NextResponse.redirect(new URL('/integrations?error=token_exchange_failed', request.url))
  }

  const tokens = await tokenRes.json()

  // Fetch user profile using OpenID userinfo
  const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })

  if (!profileRes.ok) {
    console.error('LinkedIn profile fetch failed:', await profileRes.text())
    return NextResponse.redirect(new URL('/integrations?error=profile_failed', request.url))
  }

  const profile = await profileRes.json()

  const encryptedAccess = encryptToken(tokens.access_token)
  const encryptedRefresh = tokens.refresh_token ? encryptToken(tokens.refresh_token) : null
  const expiresAt = new Date(Date.now() + (tokens.expires_in || 5184000) * 1000).toISOString()

  const supabase = getSupabase()

  const { error: dbError } = await supabase.from('linkedin_accounts').upsert({
    workspace_id: state.workspaceId,
    user_id: state.userId,
    linkedin_id: profile.sub,
    name: profile.name || `${profile.given_name || ''} ${profile.family_name || ''}`.trim(),
    email: profile.email || null,
    profile_url: `https://www.linkedin.com/in/${profile.sub}`,
    access_token: encryptedAccess,
    refresh_token: encryptedRefresh,
    token_expires_at: expiresAt,
    scopes: ['openid', 'profile', 'email'],
    status: 'active',
  }, { onConflict: 'workspace_id,linkedin_id' })

  if (dbError) {
    console.error('Failed to save LinkedIn account:', dbError)
    return NextResponse.redirect(new URL('/integrations?error=db_error', request.url))
  }

  await supabase.from('integrations').upsert({
    workspace_id: state.workspaceId,
    key: 'linkedin',
    name: 'LinkedIn',
    enabled: true,
    config: { name: profile.name, email: profile.email },
  }, { onConflict: 'workspace_id,key' })

  const response = NextResponse.redirect(new URL('/integrations?connected=linkedin', request.url))
  response.cookies.delete('oauth_state')
  return response
}
