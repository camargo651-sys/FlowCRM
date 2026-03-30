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

  const { data: ws } = await supabase.from('workspaces').select('id, name, terminology').eq('owner_id', user.id).single()
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const now = new Date()
  const term = (ws.terminology as any) || {}
  const dealLabel = term.deal?.singular || 'Deal'
  const dealLabelPlural = term.deal?.plural || 'Deals'
  const contactLabel = term.contact?.singular || 'Contact'

  const [dealsRes, activitiesRes, quotesRes, contactsRes] = await Promise.all([
    supabase.from('deals').select('id, title, value, status, expected_close_date, updated_at, contacts(name, email)').eq('workspace_id', ws.id).eq('status', 'open').order('updated_at', { ascending: false }),
    supabase.from('activities').select('id, title, type, done, due_date, contacts(name), deals(title)').eq('workspace_id', ws.id).eq('done', false).order('due_date', { ascending: true }),
    supabase.from('quotes').select('id, title, total, status, created_at, contacts(name)').eq('workspace_id', ws.id).order('created_at', { ascending: false }).limit(10),
    supabase.from('contacts').select('id, name, created_at').eq('workspace_id', ws.id).order('created_at', { ascending: false }).limit(5),
  ])

  const deals = dealsRes.data || []
  const activities = activitiesRes.data || []
  const quotes = quotesRes.data || []
  const contacts = contactsRes.data || []

  const actions: any[] = []
  const insights: any[] = []
  let actionId = 1

  // 1. Overdue tasks — highest priority
  const overdue = activities.filter(a => a.due_date && new Date(a.due_date) < now)
  overdue.slice(0, 3).forEach(a => {
    const daysOverdue = Math.floor((now.getTime() - new Date(a.due_date!).getTime()) / (1000 * 60 * 60 * 24))
    actions.push({
      id: String(actionId++),
      priority: daysOverdue > 3 ? 'high' : 'medium',
      icon: a.type === 'call' ? 'phone' : a.type === 'email' ? 'mail' : 'clock',
      title: `${a.title} — ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue`,
      description: `This ${a.type} was due ${new Date(a.due_date!).toLocaleDateString()}. ${(a as any).contacts?.name ? `Contact: ${(a as any).contacts.name}.` : ''} ${(a as any).deals?.title ? `Related to ${dealLabel.toLowerCase()}: ${(a as any).deals.title}.` : ''}`,
      entity_type: 'task',
      entity_name: a.title,
    })
  })

  // 2. Stale deals — no activity in 7+ days
  const staleDeals = deals.filter(d => {
    const daysSince = (now.getTime() - new Date(d.updated_at).getTime()) / (1000 * 60 * 60 * 24)
    return daysSince > 7
  })
  staleDeals.slice(0, 3).forEach(d => {
    const days = Math.floor((now.getTime() - new Date(d.updated_at).getTime()) / (1000 * 60 * 60 * 24))
    const contactName = (d as any).contacts?.name
    actions.push({
      id: String(actionId++),
      priority: days > 14 ? 'high' : 'medium',
      icon: 'alert',
      title: `Follow up on "${d.title}"`,
      description: `No activity for ${days} days.${contactName ? ` Reach out to ${contactName}.` : ''} ${d.value ? `Value: $${d.value}.` : ''}`,
      entity_type: 'deal',
      entity_name: d.title,
      suggested_message: contactName ? `Hi ${contactName.split(' ')[0]}, I wanted to follow up on ${d.title}. Do you have any updates or questions I can help with?` : undefined,
    })
  })

  // 3. Deals closing this week
  const closingThisWeek = deals.filter(d => {
    if (!d.expected_close_date) return false
    const close = new Date(d.expected_close_date)
    return close >= now && close <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  })
  closingThisWeek.forEach(d => {
    const daysUntil = Math.floor((new Date(d.expected_close_date!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    actions.push({
      id: String(actionId++),
      priority: daysUntil <= 2 ? 'high' : 'medium',
      icon: 'dollar',
      title: `"${d.title}" closes in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`,
      description: `Expected close: ${new Date(d.expected_close_date!).toLocaleDateString()}.${d.value ? ` Value: $${d.value}.` : ''} Make sure everything is ready.`,
      entity_type: 'deal',
      entity_name: d.title,
    })
  })

  // 4. Draft quotes not sent
  const draftQuotes = quotes.filter(q => q.status === 'draft')
  draftQuotes.slice(0, 2).forEach(q => {
    const daysOld = Math.floor((now.getTime() - new Date(q.created_at).getTime()) / (1000 * 60 * 60 * 24))
    actions.push({
      id: String(actionId++),
      priority: daysOld > 3 ? 'medium' : 'low',
      icon: 'mail',
      title: `Send quote "${q.title}"`,
      description: `This quote ($${q.total}) has been a draft for ${daysOld} day${daysOld !== 1 ? 's' : ''}.${(q as any).contacts?.name ? ` Client: ${(q as any).contacts.name}.` : ''} Review and send it.`,
      entity_type: 'quote',
      entity_name: q.title,
    })
  })

  // 5. Sent quotes without response
  const sentQuotes = quotes.filter(q => q.status === 'sent')
  sentQuotes.slice(0, 2).forEach(q => {
    const daysSent = Math.floor((now.getTime() - new Date(q.created_at).getTime()) / (1000 * 60 * 60 * 24))
    if (daysSent > 3) {
      actions.push({
        id: String(actionId++),
        priority: daysSent > 7 ? 'high' : 'medium',
        icon: 'phone',
        title: `Follow up on quote "${q.title}"`,
        description: `Sent ${daysSent} days ago ($${q.total}) — no response yet.${(q as any).contacts?.name ? ` Call ${(q as any).contacts.name} to check.` : ''}`,
        entity_type: 'quote',
        entity_name: q.title,
        suggested_message: (q as any).contacts?.name ? `Hi ${(q as any).contacts.name.split(' ')[0]}, I wanted to check if you had a chance to review the quote I sent for "${q.title}". Happy to discuss any questions.` : undefined,
      })
    }
  })

  // 6. Empty CRM suggestions
  if (deals.length === 0 && contacts.length === 0) {
    actions.push(
      { id: String(actionId++), priority: 'high' as const, icon: 'star', title: `Create your first ${contactLabel.toLowerCase()}`, description: `Start by adding your clients or leads. Go to ${contactLabel}s and add someone.`, entity_type: 'contact', entity_name: '' },
      { id: String(actionId++), priority: 'medium' as const, icon: 'trending', title: `Set up your pipeline`, description: `Configure your stages in Settings to match your sales process.`, entity_type: 'deal', entity_name: '' },
    )
  } else if (deals.length === 0 && contacts.length > 0) {
    actions.push({
      id: String(actionId++), priority: 'high', icon: 'trending',
      title: `Create your first ${dealLabel.toLowerCase()}`,
      description: `You have ${contacts.length} ${contactLabel.toLowerCase()}${contacts.length > 1 ? 's' : ''} but no ${dealLabelPlural.toLowerCase()}. Start tracking opportunities.`,
      entity_type: 'deal', entity_name: '',
    })
  }

  // Insights
  if (staleDeals.length > 0) {
    insights.push({
      id: '1', type: 'risk',
      title: `${staleDeals.length} stale ${dealLabelPlural.toLowerCase()}`,
      description: `${staleDeals.length} open ${dealLabelPlural.toLowerCase()} haven't been updated in over a week. They may need attention or should be marked as lost.`,
    })
  }

  if (closingThisWeek.length > 0) {
    const totalValue = closingThisWeek.reduce((s, d) => s + (d.value || 0), 0)
    insights.push({
      id: '2', type: 'opportunity',
      title: `$${totalValue.toLocaleString()} closing this week`,
      description: `${closingThisWeek.length} ${dealLabelPlural.toLowerCase()} expected to close in the next 7 days. Focus on getting them across the line.`,
    })
  }

  if (overdue.length > 0) {
    insights.push({
      id: '3', type: 'risk',
      title: `${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}`,
      description: `You have ${overdue.length} tasks past their due date. Complete or reschedule them to stay on top of your pipeline.`,
    })
  }

  const recentContacts = contacts.filter(c => (now.getTime() - new Date(c.created_at).getTime()) < 7 * 24 * 60 * 60 * 1000)
  if (recentContacts.length > 0) {
    insights.push({
      id: '4', type: 'info',
      title: `${recentContacts.length} new ${contactLabel.toLowerCase()}${recentContacts.length > 1 ? 's' : ''} this week`,
      description: `You added ${recentContacts.length} ${contactLabel.toLowerCase()}${recentContacts.length > 1 ? 's' : ''} recently. Make sure to follow up and create ${dealLabelPlural.toLowerCase()} for qualified ones.`,
    })
  }

  // Greeting
  const hour = now.getHours()
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const firstName = user.user_metadata?.full_name?.split(' ')[0] || ''
  const greeting = `${timeGreeting}${firstName ? `, ${firstName}` : ''}. Here's what needs your attention today.`

  // Summary
  const summaryParts = []
  if (overdue.length > 0) summaryParts.push(`${overdue.length} overdue task${overdue.length > 1 ? 's' : ''} need attention`)
  if (staleDeals.length > 0) summaryParts.push(`${staleDeals.length} ${dealLabelPlural.toLowerCase()} are going cold`)
  if (closingThisWeek.length > 0) summaryParts.push(`${closingThisWeek.length} ${dealLabelPlural.toLowerCase()} are expected to close this week`)
  if (draftQuotes.length > 0) summaryParts.push(`${draftQuotes.length} quote${draftQuotes.length > 1 ? 's' : ''} still in draft`)
  const summary = summaryParts.length > 0
    ? summaryParts.join('. ') + '.'
    : deals.length > 0
      ? `You have ${deals.length} open ${dealLabelPlural.toLowerCase()} worth $${deals.reduce((s, d) => s + (d.value || 0), 0).toLocaleString()}. Everything looks on track.`
      : `Welcome to FlowCRM! Start by adding ${contactLabel.toLowerCase()}s and creating your first ${dealLabel.toLowerCase()}.`

  // Sort actions by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  actions.sort((a, b) => priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder])

  return NextResponse.json({
    greeting,
    urgent_actions: actions.slice(0, 6),
    insights: insights.slice(0, 4),
    daily_summary: summary,
  })
}
