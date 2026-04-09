import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getServiceSupabase() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
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

  // Verify state cookie
  const storedState = request.cookies.get('gcal_oauth_state')?.value
  if (!storedState || storedState !== stateParam) {
    return NextResponse.redirect(new URL('/integrations?error=invalid_state', request.url))
  }

  let state: { workspaceId: string; userId: string }
  try {
    state = JSON.parse(Buffer.from(stateParam, 'base64url').toString())
  } catch {
    return NextResponse.redirect(new URL('/integrations?error=invalid_state', request.url))
  }

  // Exchange code for tokens
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google-calendar/callback`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL('/integrations?error=token_exchange_failed', request.url))
  }

  const tokens = await tokenRes.json() as {
    access_token: string
    refresh_token?: string
    expires_in: number
    token_type: string
  }

  if (!tokens.refresh_token) {
    return NextResponse.redirect(new URL('/integrations?error=no_refresh_token', request.url))
  }

  const supabase = getServiceSupabase()

  // Store tokens in integrations table config (encrypted at rest via Supabase)
  await supabase.from('integrations').upsert({
    workspace_id: state.workspaceId,
    key: 'google_calendar',
    name: 'Google Calendar',
    enabled: true,
    config: {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_type: tokens.token_type,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      connected_by: state.userId,
      connected_at: new Date().toISOString(),
    },
  }, { onConflict: 'workspace_id,key' })

  const response = NextResponse.redirect(new URL('/integrations?connected=google_calendar', request.url))
  response.cookies.delete('gcal_oauth_state')
  return response
}
