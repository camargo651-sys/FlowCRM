import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { decryptToken } from '@/lib/email/token-manager'

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

  const { to, subject, body, contactId } = await request.json()
  if (!to || !subject || !body) {
    return NextResponse.json({ error: 'Missing to, subject, or body' }, { status: 400 })
  }

  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  // Try Gmail first
  const { data: gmailAccount } = await supabase
    .from('email_accounts')
    .select('*')
    .eq('workspace_id', ws.id)
    .eq('provider', 'gmail')
    .eq('status', 'active')
    .single()

  if (gmailAccount) {
    try {
      const accessToken = decryptToken(gmailAccount.access_token)
      const emailContent = [
        `To: ${to}`,
        `Subject: ${subject}`,
        `Content-Type: text/html; charset=utf-8`,
        `From: ${gmailAccount.email_address}`,
        '',
        body,
      ].join('\r\n')

      const encoded = Buffer.from(emailContent).toString('base64url')

      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: encoded }),
      })

      if (!res.ok) {
        const err = await res.text()
        console.error('Gmail send failed:', err)
        return NextResponse.json({ error: 'Failed to send email. Please try again.' }, { status: 500 })
      }

      const result = await res.json()

      // Log activity
      if (contactId) {
        await supabase.from('activities').insert({
          workspace_id: ws.id,
          type: 'email',
          title: `Sent: ${subject}`,
          notes: body.slice(0, 500),
          contact_id: contactId,
          owner_id: user.id,
          done: true,
          metadata: { direction: 'outbound', provider: 'gmail', message_id: result.id },
        })
      }

      return NextResponse.json({ success: true, message_id: result.id })
    } catch (err: unknown) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
    }
  }

  // Try Outlook
  const { data: outlookAccount } = await supabase
    .from('email_accounts')
    .select('*')
    .eq('workspace_id', ws.id)
    .eq('provider', 'outlook')
    .eq('status', 'active')
    .single()

  if (outlookAccount) {
    try {
      const accessToken = decryptToken(outlookAccount.access_token)

      const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            subject,
            body: { contentType: 'HTML', content: body },
            toRecipients: [{ emailAddress: { address: to } }],
          },
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        return NextResponse.json({ error: `Outlook send failed: ${err}` }, { status: 500 })
      }

      if (contactId) {
        await supabase.from('activities').insert({
          workspace_id: ws.id,
          type: 'email',
          title: `Sent: ${subject}`,
          notes: body.slice(0, 500),
          contact_id: contactId,
          owner_id: user.id,
          done: true,
          metadata: { direction: 'outbound', provider: 'outlook' },
        })
      }

      return NextResponse.json({ success: true })
    } catch (err: unknown) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'No email account connected. Connect Gmail or Outlook in Integrations.' }, { status: 400 })
}
