import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const clientId = process.env.SF_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      {
        error:
          'Salesforce not configured. Set SF_CLIENT_ID and SF_CLIENT_SECRET env vars (create a Connected App in Salesforce Setup → App Manager → New Connected App with OAuth Enabled, Callback URL set to /api/migrate/salesforce/callback, scopes: api, refresh_token).',
      },
      { status: 501 },
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || ''
  const redirectUri = `${appUrl}/api/migrate/salesforce/callback`

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'api refresh_token',
  })

  const authUrl = `https://login.salesforce.com/services/oauth2/authorize?${params.toString()}`
  return NextResponse.redirect(authUrl)
}
