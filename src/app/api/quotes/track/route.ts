import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { emitSignal } from '@/lib/ai/signal-emitter'

function getServiceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

// POST: Record a quote view event
export async function POST(request: NextRequest) {
  const { token, duration_seconds, sections_viewed } = await request.json()
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const supabase = getServiceSupabase()
  if (!supabase) return NextResponse.json({ error: 'Service not configured' }, { status: 503 })

  // Find quote by token
  const { data: quote } = await supabase
    .from('quotes')
    .select('id, workspace_id, contact_id, deal_id, title, view_count')
    .eq('view_token', token)
    .single()

  if (!quote) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })

  const newViewCount = (quote.view_count || 0) + 1

  // Record view
  await supabase.from('quote_views').insert({
    workspace_id: quote.workspace_id,
    quote_id: quote.id,
    contact_id: quote.contact_id || null,
    ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '',
    user_agent: request.headers.get('user-agent') || '',
    duration_seconds: duration_seconds || 0,
    sections_viewed: sections_viewed || [],
  })

  // Update quote stats
  await supabase.from('quotes').update({
    view_count: newViewCount,
    last_viewed_at: new Date().toISOString(),
    avg_view_seconds: duration_seconds || 0,
  }).eq('id', quote.id)

  // Emit engagement signal
  if (quote.contact_id) {
    await emitSignal(supabase, {
      workspaceId: quote.workspace_id,
      contactId: quote.contact_id,
      dealId: quote.deal_id || undefined,
      signalType: 'quote_viewed',
      source: 'quote_tracker',
      metadata: {
        quote_id: quote.id,
        view_count: newViewCount,
        duration_seconds,
        sections_viewed,
      },
    })
  }

  // Get workspace owner for notification
  const { data: ws } = await supabase
    .from('workspaces')
    .select('owner_id')
    .eq('id', quote.workspace_id)
    .single()

  // Get contact name
  let contactName = 'Someone'
  if (quote.contact_id) {
    const { data: contact } = await supabase.from('contacts').select('name').eq('id', quote.contact_id).single()
    if (contact) contactName = contact.name
  }

  // Create notification — especially urgent if viewed multiple times
  if (ws) {
    const isRepeatView = newViewCount >= 2
    const viewedPricing = sections_viewed?.includes('pricing')

    let title: string
    let body: string
    let priority: string

    if (newViewCount >= 3 && viewedPricing) {
      title = `${contactName} reviewed your pricing ${newViewCount} times`
      body = `"${quote.title}" has been viewed ${newViewCount} times with focus on pricing. Call now and offer a targeted discount.`
      priority = 'urgent'
    } else if (newViewCount >= 3) {
      title = `${contactName} viewed your proposal ${newViewCount} times`
      body = `"${quote.title}" is getting serious attention. High buying intent — reach out now.`
      priority = 'high'
    } else if (isRepeatView) {
      title = `${contactName} is reviewing your proposal again`
      body = `"${quote.title}" viewed ${newViewCount} times. Interest is growing — follow up soon.`
      priority = 'medium'
    } else {
      title = `${contactName} opened your proposal`
      body = `"${quote.title}" was just viewed for the first time.`
      priority = 'low'
    }

    await supabase.from('notifications').insert({
      workspace_id: quote.workspace_id,
      user_id: ws.owner_id,
      type: 'quote_viewed',
      title,
      body,
      priority,
      action_url: `/contacts/${quote.contact_id}`,
      contact_id: quote.contact_id,
      deal_id: quote.deal_id,
      metadata: { quote_id: quote.id, view_count: newViewCount, sections_viewed },
    })
  }

  return NextResponse.json({ success: true })
}
