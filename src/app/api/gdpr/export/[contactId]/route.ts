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
        setAll(toSet: { name: string; value: string; options?: CookieOptions }[]) {
          try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )
}

export async function GET(_req: NextRequest, { params }: { params: { contactId: string } }) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify the contact belongs to a workspace owned by this user
  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const contactId = params.contactId

  const { data: contact, error: cErr } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .eq('workspace_id', ws.id)
    .single()

  if (cErr || !contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

  // Helper to safely query optional tables
  const safeQuery = async (table: string, column: string) => {
    try {
      const { data, error } = await supabase.from(table).select('*').eq(column, contactId)
      if (error) return []
      return data || []
    } catch { return [] }
  }

  const [deals, invoices, activities, notes, calls, emails, tickets] = await Promise.all([
    safeQuery('deals', 'contact_id'),
    safeQuery('invoices', 'contact_id'),
    safeQuery('activities', 'contact_id'),
    safeQuery('notes', 'contact_id'),
    safeQuery('calls', 'contact_id'),
    safeQuery('emails', 'contact_id'),
    safeQuery('tickets', 'contact_id'),
  ])

  const exportData = {
    exported_at: new Date().toISOString(),
    exported_by: user.email,
    workspace_id: ws.id,
    contact,
    deals,
    invoices,
    activities,
    notes,
    calls,
    emails,
    tickets,
    _meta: {
      format: 'tracktio-gdpr-export-v1',
      record_counts: {
        deals: deals.length,
        invoices: invoices.length,
        activities: activities.length,
        notes: notes.length,
        calls: calls.length,
        emails: emails.length,
        tickets: tickets.length,
      },
    },
  }

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="contact-${contactId}.json"`,
    },
  })
}
