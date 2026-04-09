import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/api/rate-limit'

function getSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

// GET: Fetch form config for public rendering
export async function GET(request: NextRequest) {
  const supabase = getSupabase()
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 })

  const formId = request.nextUrl.searchParams.get('id')
  if (!formId) return NextResponse.json({ error: 'Missing form id' }, { status: 400 })

  const { data: ws } = await supabase
    .from('workspaces')
    .select('id, name, primary_color, logo_url, slug')
    .eq('id', formId)
    .single()

  if (!ws) return NextResponse.json({ error: 'Form not found' }, { status: 404 })

  // Get custom fields for contacts
  const { data: fields } = await supabase
    .from('custom_field_defs')
    .select('label, key, type, options, required')
    .eq('workspace_id', ws.id)
    .eq('entity', 'contact')
    .order('order_index')

  return NextResponse.json({
    workspace: { name: ws.name, color: ws.primary_color, logo: ws.logo_url },
    fields: fields || [],
  })
}

// POST: Submit form (creates contact + optional deal)
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  const { allowed } = checkRateLimit(ip, 'forms')
  if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = getSupabase()
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 })

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { workspace_id, name, email, phone, company, message, source, custom_fields } = body as {
    workspace_id?: string; name?: string; email?: string; phone?: string;
    company?: string; message?: string; source?: string; custom_fields?: Record<string, unknown>
  }

  if (!workspace_id || !name || !email) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
  }

  // Validate email
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  // Validate lengths
  if (typeof name !== 'string' || name.length > 200) return NextResponse.json({ error: 'Invalid name' }, { status: 400 })

  // Verify workspace exists
  const { data: ws } = await supabase.from('workspaces').select('id, owner_id').eq('id', workspace_id).single()
  if (!ws) return NextResponse.json({ error: 'Invalid form' }, { status: 404 })

  // Check for existing contact
  const { data: existing } = await supabase.from('contacts').select('id').eq('workspace_id', ws.id).ilike('email', email).single()

  let contactId: string

  if (existing) {
    contactId = existing.id
    // Update with new info
    await supabase.from('contacts').update({
      phone: phone || undefined,
      company_name: company || undefined,
      notes: message ? `[Form submission] ${message}` : undefined,
      custom_fields: custom_fields || undefined,
    }).eq('id', contactId)
  } else {
    const { data: newContact } = await supabase.from('contacts').insert({
      workspace_id: ws.id,
      owner_id: ws.owner_id,
      name,
      email,
      phone: phone || null,
      company_name: company || null,
      type: 'person',
      notes: message || null,
      tags: ['web-form', source || 'website'],
      custom_fields: custom_fields || {},
    }).select('id').single()

    if (!newContact) return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 })
    contactId = newContact.id
  }

  // Log activity
  await supabase.from('activities').insert({
    workspace_id: ws.id,
    owner_id: ws.owner_id,
    contact_id: contactId,
    title: `New form submission from ${name} (${email})`,
    type: 'note',
    done: true,
  })

  // Notify owner
  await supabase.from('notifications').insert({
    workspace_id: ws.id,
    user_id: ws.owner_id,
    type: 'system',
    title: 'New lead from web form',
    body: `${name} (${email}) submitted a form${company ? ` from ${company}` : ''}.`,
    priority: 'high',
    action_url: `/contacts/${contactId}`,
  })

  return NextResponse.json({ success: true, contact_id: contactId })
}
