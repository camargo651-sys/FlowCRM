import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, generateBackupCodes } from '@/lib/security/totp'

function getSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(toSet: { name: string; value: string; options?: CookieOptions }[]) {
          try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const { data: row } = await supabase.from('user_2fa').select('*').eq('user_id', user.id).single()
  if (!row?.secret) return NextResponse.json({ error: 'No setup in progress' }, { status: 400 })

  if (!verifyToken(row.secret, token)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }

  const backupCodes = generateBackupCodes(10)

  const { error } = await supabase
    .from('user_2fa')
    .update({
      enabled: true,
      enabled_at: new Date().toISOString(),
      backup_codes: backupCodes,
    })
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ enabled: true, backup_codes: backupCodes })
}
