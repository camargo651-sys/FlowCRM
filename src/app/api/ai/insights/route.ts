import { createServerClient, type CookieOptions } from '@supabase/ssr'
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
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )
}

export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 501 })
  }

  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let ws: { id: string; name: string; terminology: Record<string, string>; industry?: string } | null = null
  const { data: wsData, error: wsError } = await supabase.from('workspaces').select('id, name, terminology, industry').eq('owner_id', user.id).single()
  if (wsError) {
    // Fallback without terminology column
    const { data: wsBasic } = await supabase.from('workspaces').select('id, name, industry').eq('owner_id', user.id).single()
    ws = wsBasic ? { ...wsBasic, terminology: {} } : null
  } else {
    ws = wsData
  }
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const today = now.toISOString()

  // Gather CRM data in parallel
  const [dealsRes, contactsRes, activitiesRes, quotesRes, stagesRes] = await Promise.all([
    supabase.from('deals').select('id, title, value, status, expected_close_date, updated_at, created_at').eq('workspace_id', ws.id).order('updated_at', { ascending: false }).limit(30),
    supabase.from('contacts').select('id, name, email, phone, type, created_at, updated_at').eq('workspace_id', ws.id).order('updated_at', { ascending: false }).limit(30),
    supabase.from('activities').select('id, title, type, done, due_date, notes, contacts(name), deals(title)').eq('workspace_id', ws.id).order('due_date', { ascending: true }).limit(30),
    supabase.from('quotes').select('id, title, total, status, created_at, contacts(name)').eq('workspace_id', ws.id).order('created_at', { ascending: false }).limit(15),
    supabase.from('pipeline_stages').select('id, name, color, win_stage, lost_stage').eq('workspace_id', ws.id).order('order_index'),
  ])

  const deals = dealsRes.data || []
  const contacts = contactsRes.data || []
  const activities = activitiesRes.data || []
  const quotes = quotesRes.data || []

  // Build terminology
  const term = (ws.terminology as Record<string, { singular?: string; plural?: string }>) || {}
  const dealLabel = term.deal?.singular || 'Deal'
  const contactLabel = term.contact?.singular || 'Contact'

  // Calculate key metrics
  const openDeals = deals.filter(d => d.status === 'open')
  const overdueActivities = activities.filter(a => !a.done && a.due_date && new Date(a.due_date) < now)
  const staleDeals = openDeals.filter(d => {
    const lastUpdate = new Date(d.updated_at)
    return (now.getTime() - lastUpdate.getTime()) > 7 * 24 * 60 * 60 * 1000
  })
  const upcomingCloses = openDeals.filter(d => {
    if (!d.expected_close_date) return false
    const close = new Date(d.expected_close_date)
    return close >= now && close <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  })
  const draftQuotes = quotes.filter(q => q.status === 'draft')
  const sentQuotes = quotes.filter(q => q.status === 'sent')
  const recentContacts = contacts.filter(c => new Date(c.created_at) > new Date(sevenDaysAgo))

  const crmSummary = `
## CRM Data Summary for "${ws.name}" (${ws.industry || 'General'})
Terminology: ${dealLabel}s, ${contactLabel}s
Today: ${now.toLocaleDateString()}

### Open ${dealLabel}s (${openDeals.length}):
${openDeals.map(d => `- "${d.title}" | ${d.value ? '$' + d.value : 'no value'} | Stage: ${(d as { pipeline_stages?: { name?: string } }).pipeline_stages?.name || 'unknown'} | Contact: ${(d as { contacts?: { name?: string } }).contacts?.name || 'none'} | Last updated: ${new Date(d.updated_at).toLocaleDateString()} | Close date: ${d.expected_close_date || 'not set'}`).join('\n')}

### Stale ${dealLabel}s (no activity in 7+ days): ${staleDeals.length}
${staleDeals.map(d => `- "${d.title}" (${(d as { contacts?: { name?: string } }).contacts?.name || 'no contact'}) — last touch: ${new Date(d.updated_at).toLocaleDateString()}`).join('\n')}

### Closing this week: ${upcomingCloses.length}
${upcomingCloses.map(d => `- "${d.title}" closing ${d.expected_close_date} — ${d.value ? '$' + d.value : 'no value'}`).join('\n')}

### Overdue tasks: ${overdueActivities.length}
${overdueActivities.map(a => `- "${a.title}" (${a.type}) due ${a.due_date ? new Date(a.due_date).toLocaleDateString() : '?'} — ${(a as { contacts?: { name?: string } }).contacts?.name || ''} ${(a as { deals?: { title?: string } }).deals?.title ? '/ ' + (a as { deals?: { title?: string } }).deals?.title : ''}`).join('\n')}

### Pending activities (not done): ${activities.filter(a => !a.done).length}
${activities.filter(a => !a.done).slice(0, 10).map(a => `- "${a.title}" (${a.type}) ${a.due_date ? 'due ' + new Date(a.due_date).toLocaleDateString() : ''}`).join('\n')}

### Quotes: ${draftQuotes.length} drafts, ${sentQuotes.length} sent, ${quotes.filter(q => q.status === 'accepted').length} accepted
${quotes.slice(0, 5).map(q => `- "${q.title}" — $${q.total} — ${q.status} — ${(q as { contacts?: { name?: string } }).contacts?.name || 'no client'}`).join('\n')}

### Recent contacts (last 7 days): ${recentContacts.length} new
### Total contacts: ${contacts.length}
`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: `You are an AI sales assistant embedded in a CRM. Analyze this CRM data and generate actionable insights.

${crmSummary}

Generate a JSON response with this EXACT structure (no markdown, just raw JSON):
{
  "greeting": "A short, contextual greeting based on time of day and what's happening (1 sentence, use the user's language based on the workspace context)",
  "urgent_actions": [
    {
      "id": "1",
      "priority": "high|medium|low",
      "icon": "phone|mail|alert|clock|dollar|trending|check|star",
      "title": "Short action title (imperative, e.g. 'Call María about the proposal')",
      "description": "Why this matters and what to do (1-2 sentences)",
      "entity_type": "deal|contact|quote|task",
      "entity_name": "Name of the deal/contact",
      "suggested_message": "If applicable, a ready-to-send message or talking point"
    }
  ],
  "insights": [
    {
      "id": "1",
      "type": "risk|opportunity|info|win",
      "title": "Short insight",
      "description": "Explanation (1-2 sentences)"
    }
  ],
  "daily_summary": "2-3 sentence summary of the day: what to focus on, what looks good, what needs attention"
}

Rules:
- Generate 3-6 urgent_actions, ordered by priority (most urgent first)
- Generate 2-4 insights
- Be specific: use actual names, values, dates from the data
- If deals are stale, suggest specific follow-up actions
- If close dates are approaching, flag them
- If there are overdue tasks, make them urgent
- If there are draft quotes, suggest sending them
- If the CRM is empty or has little data, give onboarding suggestions instead
- Keep language concise and action-oriented
- Match the language/terminology of the workspace (use the deal/contact labels provided)`
        }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return NextResponse.json({ error: `AI API error: ${response.status} - ${err}` }, { status: 500 })
    }

    const aiResponse = await response.json()
    const text = aiResponse.content?.[0]?.text || '{}'

    // Parse JSON from response (handle potential markdown wrapping)
    let parsed
    try {
      const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      parsed = JSON.parse(jsonStr)
    } catch {
      parsed = { greeting: 'Welcome back!', urgent_actions: [], insights: [], daily_summary: 'Unable to generate insights at this time.' }
    }

    return NextResponse.json(parsed)
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
