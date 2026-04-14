import { NextResponse } from 'next/server'
import { getPublicKey, isConfigured } from '@/lib/notifications/vapid'

// GET /api/settings/vapid-keys
// Returns the VAPID public key for the browser to use when calling
// `pushManager.subscribe({ applicationServerKey })`. Never exposes the
// private key.
export async function GET() {
  if (!isConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        publicKey: null,
        hint: 'Run `npx web-push generate-vapid-keys` and set NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT in .env.local',
      },
      { status: 200 },
    )
  }
  return NextResponse.json({ configured: true, publicKey: getPublicKey() })
}
