import { NextResponse } from 'next/server'

// Salesforce requires OAuth2 Web Server / JWT flow which is more involved.
// TODO: implement full OAuth2 flow with Connected App, PKCE, and refresh tokens.
// For now this endpoint is a stub so the UI can flag "coming soon".

export async function POST() {
  return NextResponse.json(
    { error: 'Salesforce migration coming soon. OAuth2 Connected App flow pending.' },
    { status: 501 }
  )
}
