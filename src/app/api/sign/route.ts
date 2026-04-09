import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

// GET: Fetch contract/quote for signing
export async function GET(request: NextRequest) {
  const supabase = getSupabase()
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 })

  const token = request.nextUrl.searchParams.get('token')
  if (!token || typeof token !== 'string') return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  // Try contracts first
  const { data: contract } = await supabase
    .from('contracts')
    .select('id, title, contract_number, value, start_date, end_date, status, signed_at, notes, contacts(name, email), workspaces(name, primary_color, logo_url)')
    .eq('sign_token', token)
    .single()

  if (contract) {
    return NextResponse.json({
      type: 'contract',
      data: contract,
      already_signed: !!contract.signed_at,
    })
  }

  // Try quotes
  const { data: quote } = await supabase
    .from('quotes')
    .select('id, title, quote_number, total, valid_until, status, signed_at, notes, contacts(name, email), workspaces(name, primary_color, logo_url)')
    .eq('sign_token', token)
    .single()

  if (quote) {
    return NextResponse.json({
      type: 'quote',
      data: quote,
      already_signed: !!quote.signed_at,
    })
  }

  return NextResponse.json({ error: 'Document not found' }, { status: 404 })
}

// POST: Submit signature
export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 })

  const { token, signature_data, signer_name } = await request.json()
  if (!token || !signature_data) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  // Validate signature is a data URL
  if (!signature_data.startsWith('data:image/png;base64,')) {
    return NextResponse.json({ error: 'Invalid signature format' }, { status: 400 })
  }

  // Max size check (500KB base64)
  if (signature_data.length > 700000) {
    return NextResponse.json({ error: 'Signature too large' }, { status: 400 })
  }

  const now = new Date().toISOString()

  // Try contracts
  const { data: contract } = await supabase
    .from('contracts')
    .select('id, workspace_id, contact_id, title')
    .eq('sign_token', token)
    .is('signed_at', null)
    .single()

  if (contract) {
    await supabase.from('contracts').update({
      signed_at: now,
      signature_data,
      signer_name: signer_name || null,
      signer_ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '',
      status: 'active',
    }).eq('id', contract.id)

    // Log activity
    const { data: ws } = await supabase.from('workspaces').select('owner_id').eq('id', contract.workspace_id).single()
    if (ws) {
      await supabase.from('activities').insert({
        workspace_id: contract.workspace_id, owner_id: ws.owner_id,
        contact_id: contract.contact_id,
        title: `Contract "${contract.title}" signed${signer_name ? ` by ${signer_name}` : ''}`,
        type: 'note', done: true,
      })
      await supabase.from('notifications').insert({
        workspace_id: contract.workspace_id, user_id: ws.owner_id,
        type: 'system', title: 'Contract signed!',
        body: `"${contract.title}" was signed${signer_name ? ` by ${signer_name}` : ''}.`,
        priority: 'high', action_url: '/contracts',
      })
    }

    return NextResponse.json({ success: true, type: 'contract' })
  }

  // Try quotes
  const { data: quote } = await supabase
    .from('quotes')
    .select('id, workspace_id, contact_id, title')
    .eq('sign_token', token)
    .is('signed_at', null)
    .single()

  if (quote) {
    await supabase.from('quotes').update({
      signed_at: now,
      signature_data,
      signer_name: signer_name || null,
      status: 'accepted',
    }).eq('id', quote.id)

    const { data: ws } = await supabase.from('workspaces').select('owner_id').eq('id', quote.workspace_id).single()
    if (ws) {
      await supabase.from('activities').insert({
        workspace_id: quote.workspace_id, owner_id: ws.owner_id,
        contact_id: quote.contact_id,
        title: `Quote "${quote.title}" signed${signer_name ? ` by ${signer_name}` : ''}`,
        type: 'note', done: true,
      })
      await supabase.from('notifications').insert({
        workspace_id: quote.workspace_id, user_id: ws.owner_id,
        type: 'system', title: 'Quote accepted!',
        body: `"${quote.title}" was signed${signer_name ? ` by ${signer_name}` : ''}.`,
        priority: 'high', action_url: '/quotes',
      })
    }

    return NextResponse.json({ success: true, type: 'quote' })
  }

  return NextResponse.json({ error: 'Document not found or already signed' }, { status: 404 })
}
