import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { sendTransactionalEmail } from '@/lib/email/transactional'

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

// POST: Send a campaign to selected contacts
export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: ws } = await supabase.from('workspaces').select('id, name').eq('owner_id', user.id).single()
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const { subject, html_body, filter_tags, filter_type, filter_score } = await request.json()
  if (!subject || !html_body) return NextResponse.json({ error: 'Subject and body required' }, { status: 400 })

  // Build contact query with filters
  let query = supabase.from('contacts').select('id, name, email').eq('workspace_id', ws.id).not('email', 'is', null)

  if (filter_type && filter_type !== 'all') {
    query = query.eq('type', filter_type)
  }
  if (filter_score && filter_score !== 'all') {
    query = query.eq('score_label', filter_score)
  }
  if (filter_tags && filter_tags.length > 0) {
    query = query.overlaps('tags', filter_tags)
  }

  const { data: contacts } = await query.limit(500)
  if (!contacts || contacts.length === 0) {
    return NextResponse.json({ error: 'No contacts match your filters' }, { status: 400 })
  }

  // Filter out contacts without email
  const recipients = contacts.filter(c => c.email)

  let sent = 0
  let failed = 0

  for (const contact of recipients) {
    // Personalize body
    const personalizedHtml = html_body
      .replace(/\{\{name\}\}/g, contact.name || 'there')
      .replace(/\{\{first_name\}\}/g, (contact.name || 'there').split(' ')[0])
      .replace(/\{\{email\}\}/g, contact.email)
      .replace(/\{\{company\}\}/g, ws.name)

    const result = await sendTransactionalEmail({
      to: contact.email,
      subject: subject.replace(/\{\{name\}\}/g, contact.name || '').replace(/\{\{first_name\}\}/g, (contact.name || '').split(' ')[0]),
      html: personalizedHtml,
    })

    if (result.success) sent++
    else failed++

    // Rate limit: small delay between sends
    if (recipients.length > 10) {
      await new Promise(r => setTimeout(r, 100))
    }
  }

  // Log activity
  await supabase.from('activities').insert({
    workspace_id: ws.id,
    owner_id: user.id,
    title: `Email campaign "${subject}" sent to ${sent} contacts`,
    type: 'email',
    done: true,
  })

  return NextResponse.json({ success: true, sent, failed, total: recipients.length })
}
