import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getServiceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
  )
}

interface GoogleEvent {
  id: string
  summary?: string
  description?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  attendees?: { email: string; displayName?: string; responseStatus?: string }[]
  status?: string
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) return null
  return res.json()
}

async function fetchGoogleCalendarEvents(accessToken: string): Promise<GoogleEvent[]> {
  const now = new Date()
  const timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events')
  url.searchParams.set('timeMin', timeMin)
  url.searchParams.set('timeMax', timeMax)
  url.searchParams.set('singleEvents', 'true')
  url.searchParams.set('orderBy', 'startTime')
  url.searchParams.set('maxResults', '250')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) return []
  const data = await res.json()
  return data.items || []
}

export async function POST(request: NextRequest) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }

  const authHeader = request.headers.get('authorization') || ''
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const supabase = getServiceSupabase()
  if (!supabase) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 })
  }

  // Find all workspaces with google_calendar integration enabled
  const { data: integrations } = await supabase
    .from('integrations')
    .select('workspace_id, config')
    .eq('key', 'google_calendar')
    .eq('enabled', true)

  if (!integrations?.length) {
    return NextResponse.json({ success: true, synced: 0, message: 'No integrations found' })
  }

  let totalSynced = 0

  for (const integration of integrations) {
    const config = integration.config as { refresh_token?: string; access_token?: string } | null
    if (!config?.refresh_token) continue

    // Refresh access token
    const tokenResult = await refreshAccessToken(config.refresh_token)
    if (!tokenResult) continue

    const accessToken = tokenResult.access_token

    // Update stored access token
    await supabase.from('integrations').update({
      config: { ...config, access_token: accessToken },
    }).eq('workspace_id', integration.workspace_id).eq('key', 'google_calendar')

    // Fetch events
    const events = await fetchGoogleCalendarEvents(accessToken)

    // Get workspace owner
    const { data: ws } = await supabase
      .from('workspaces')
      .select('owner_id')
      .eq('id', integration.workspace_id)
      .single()

    if (!ws) continue

    // Get workspace contacts for email matching
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, email')
      .eq('workspace_id', integration.workspace_id)
      .not('email', 'is', null)

    const emailToContactId = new Map<string, string>()
    for (const c of contacts || []) {
      if (c.email) emailToContactId.set(c.email.toLowerCase(), c.id)
    }

    for (const event of events) {
      if (!event.id || event.status === 'cancelled') continue

      const startTime = event.start?.dateTime || event.start?.date || null
      const endTime = event.end?.dateTime || event.end?.date || null
      const title = event.summary || 'Google Calendar Event'

      // Match first attendee to a contact
      let contactId: string | null = null
      for (const attendee of event.attendees || []) {
        const cid = emailToContactId.get(attendee.email.toLowerCase())
        if (cid) {
          contactId = cid
          break
        }
      }

      // Check if activity already exists with this google_event_id
      const { data: existing } = await supabase
        .from('activities')
        .select('id')
        .eq('workspace_id', integration.workspace_id)
        .contains('metadata', { google_event_id: event.id })
        .limit(1)
        .single()

      const activityData = {
        workspace_id: integration.workspace_id,
        type: 'meeting' as const,
        title,
        notes: event.description || null,
        contact_id: contactId,
        owner_id: ws.owner_id,
        done: startTime ? new Date(startTime) < new Date() : false,
        due_date: startTime,
        metadata: {
          google_event_id: event.id,
          google_end_time: endTime,
          attendees: (event.attendees || []).map((a) => a.email),
          source: 'google_calendar',
        },
      }

      if (existing) {
        await supabase.from('activities').update(activityData).eq('id', existing.id)
      } else {
        await supabase.from('activities').insert(activityData)
      }

      totalSynced++
    }
  }

  return NextResponse.json({ success: true, synced: totalSynced })
}
