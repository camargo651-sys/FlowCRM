import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

function getSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )
}

export async function POST() {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const now = new Date()

  // Fetch hot contacts (top engagement)
  const { data: hotContacts } = await supabase
    .from('contacts')
    .select('id, name, email, phone, engagement_score, score_label, last_interaction_at, interaction_count')
    .eq('workspace_id', ws.id)
    .in('score_label', ['hot', 'warm'])
    .order('engagement_score', { ascending: false })
    .limit(10)

  // Fetch stale deals (no ai_risk column — use time-based)
  const { data: riskyDeals } = await supabase
    .from('deals')
    .select('id, title, value, updated_at, expected_close_date')
    .eq('workspace_id', ws.id)
    .eq('status', 'open')
    .order('updated_at', { ascending: true })
    .limit(10)

  // Fetch recent signals for context
  const { data: recentSignals } = await supabase
    .from('engagement_signals')
    .select('signal_type, contact_id, deal_id, metadata, created_at, contacts(name)')
    .eq('workspace_id', ws.id)
    .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(30)

  // Contacts going cold (had activity but none in 7+ days)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: goingCold } = await supabase
    .from('contacts')
    .select('id, name, engagement_score, last_interaction_at')
    .eq('workspace_id', ws.id)
    .gt('interaction_count', 3)
    .lt('last_interaction_at', sevenDaysAgo)
    .order('engagement_score', { ascending: false })
    .limit(5)

  // Build proactive actions
  const proactiveActions: any[] = []

  // Hot contacts that haven't been contacted today
  for (const contact of hotContacts || []) {
    if (contact.score_label === 'hot') {
      const recentOutbound = (recentSignals || []).find(
        s => s.contact_id === contact.id && ['email_sent', 'whatsapp_sent'].includes(s.signal_type)
      )
      if (!recentOutbound) {
        proactiveActions.push({
          type: 'engage_hot',
          priority: 'high',
          contactId: contact.id,
          contactName: contact.name,
          score: contact.engagement_score,
          message: `${contact.name} is highly engaged (score: ${contact.engagement_score}). They've had ${contact.interaction_count} interactions. Reach out now while interest is high.`,
        })
      }
    }
  }

  // At-risk deals (time-based)
  for (const deal of riskyDeals || []) {
    const daysSinceUpdate = Math.floor((now.getTime() - new Date(deal.updated_at).getTime()) / (1000 * 60 * 60 * 24))
    if (daysSinceUpdate < 7) continue
    proactiveActions.push({
      type: daysSinceUpdate > 21 ? 'deal_critical' : 'deal_at_risk',
      priority: daysSinceUpdate > 21 ? 'high' : 'medium',
      dealId: deal.id,
      dealTitle: deal.title,
      contactName: 'Unknown',
      value: deal.value,
      score: 0,
      message: daysSinceUpdate > 21
        ? `"${deal.title}" has had no activity for ${daysSinceUpdate} days. ${deal.value ? `$${deal.value} at risk.` : ''} Take action now.`
        : `"${deal.title}" needs attention. Last touched ${daysSinceUpdate} days ago.`,
    })
  }

  // Contacts going cold
  for (const contact of goingCold || []) {
    const daysSince = Math.floor((now.getTime() - new Date(contact.last_interaction_at).getTime()) / (1000 * 60 * 60 * 24))
    proactiveActions.push({
      type: 'going_cold',
      priority: 'medium',
      contactId: contact.id,
      contactName: contact.name,
      score: contact.engagement_score,
      message: `${contact.name} is going cold — no interaction for ${daysSince} days. Previously active (score: ${contact.engagement_score}). Send a follow-up.`,
    })
  }

  // Signal-based real-time alerts (last 24h)
  const signalAlerts: any[] = []
  for (const signal of recentSignals || []) {
    const contactName = (signal as any).contacts?.name || 'Unknown'
    if (signal.signal_type === 'whatsapp_received') {
      signalAlerts.push({
        type: 'new_whatsapp',
        contactName,
        contactId: signal.contact_id,
        time: signal.created_at,
        message: `${contactName} sent you a WhatsApp message`,
      })
    } else if (signal.signal_type === 'email_replied') {
      signalAlerts.push({
        type: 'email_reply',
        contactName,
        contactId: signal.contact_id,
        time: signal.created_at,
        message: `${contactName} replied to your email`,
      })
    } else if (signal.signal_type === 'quote_viewed') {
      signalAlerts.push({
        type: 'quote_viewed',
        contactName,
        contactId: signal.contact_id,
        dealId: signal.deal_id,
        time: signal.created_at,
        message: `${contactName} viewed your quote — ${(signal.metadata as any)?.view_count > 2 ? 'multiple times! Call now.' : 'follow up soon.'}`,
      })
    } else if (signal.signal_type === 'call_positive') {
      signalAlerts.push({
        type: 'positive_call',
        contactName,
        contactId: signal.contact_id,
        time: signal.created_at,
        message: `Positive call with ${contactName} — momentum is high, send a follow-up.`,
      })
    }
  }

  return NextResponse.json({
    proactive_actions: proactiveActions.slice(0, 8),
    signal_alerts: signalAlerts.slice(0, 5),
    hot_contacts: (hotContacts || []).slice(0, 5),
    risky_deals: (riskyDeals || []).slice(0, 5),
  })
}
