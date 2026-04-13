import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/api/rate-limit'

function getSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

// GET: Portal data for a contact
export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  const { allowed } = checkRateLimit(ip, 'portal')
  if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = getSupabase()
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 })

  const token = request.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const { data: portal } = await supabase.from('portal_tokens')
    .select('workspace_id, contact_id, active')
    .eq('token', token).eq('active', true).single()

  if (!portal) return NextResponse.json({ error: 'Invalid portal link' }, { status: 404 })

  // Update last accessed
  await supabase.from('portal_tokens').update({ last_accessed: new Date().toISOString() }).eq('token', token)

  // Get workspace info
  const { data: ws } = await supabase.from('workspaces')
    .select('name, primary_color, logo_url').eq('id', portal.workspace_id).single()

  // Get contact info
  const { data: contact } = await supabase.from('contacts')
    .select('name, email').eq('id', portal.contact_id).single()

  // Get their invoices, quotes, contracts, deals
  const [invoices, quotes, contracts, deals] = await Promise.all([
    supabase.from('invoices').select('id, invoice_number, total, balance_due, status, issue_date, due_date, currency, pdf_url')
      .eq('workspace_id', portal.workspace_id).eq('contact_id', portal.contact_id).order('created_at', { ascending: false }),
    supabase.from('quotes').select('id, quote_number, title, total, status, valid_until, view_token, currency')
      .eq('workspace_id', portal.workspace_id).eq('contact_id', portal.contact_id).order('created_at', { ascending: false }),
    supabase.from('contracts').select('id, contract_number, title, status, start_date, end_date, value, currency, file_url, created_at')
      .eq('workspace_id', portal.workspace_id).eq('contact_id', portal.contact_id).order('created_at', { ascending: false }),
    supabase.from('deals').select('id, title, value, status, probability, expected_close_date, pipeline_stages(name, color)')
      .eq('contact_id', portal.contact_id).order('created_at', { ascending: false }),
  ])

  // Assemble documents feed from contracts + invoices (+ optional `documents` table if present).
  type DocItem = { id: string; name: string; url?: string; type: string; created_at?: string }
  const documents: DocItem[] = []

  for (const c of (contracts.data || []) as Array<Record<string, unknown>>) {
    if (c.file_url) {
      documents.push({
        id: `contract:${c.id}`,
        name: `${(c.title as string) || 'Contrato'} (${(c.contract_number as string) || ''})`.trim(),
        url: c.file_url as string,
        type: 'contract',
        created_at: (c.created_at as string) || (c.start_date as string) || undefined,
      })
    }
  }
  for (const inv of (invoices.data || []) as Array<Record<string, unknown>>) {
    if (inv.pdf_url) {
      documents.push({
        id: `invoice:${inv.id}`,
        name: `${(inv.invoice_number as string) || 'Factura'}.pdf`,
        url: inv.pdf_url as string,
        type: 'invoice',
        created_at: (inv.issue_date as string) || undefined,
      })
    }
  }
  // Optional `documents` table — ignore errors if the relation does not exist.
  try {
    const { data: docRows, error: docErr } = await supabase.from('documents')
      .select('id, name, url, type, created_at')
      .eq('workspace_id', portal.workspace_id)
      .eq('contact_id', portal.contact_id)
      .order('created_at', { ascending: false })
    if (!docErr && docRows) {
      for (const d of docRows as Array<Record<string, unknown>>) {
        documents.push({
          id: `document:${d.id}`,
          name: (d.name as string) || 'Documento',
          url: (d.url as string) || undefined,
          type: (d.type as string) || 'document',
          created_at: (d.created_at as string) || undefined,
        })
      }
    }
  } catch {
    // table does not exist — safe to ignore
  }

  documents.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))

  return NextResponse.json({
    company: ws,
    contact,
    invoices: invoices.data || [],
    quotes: quotes.data || [],
    contracts: contracts.data || [],
    deals: deals.data || [],
    documents,
  })
}
