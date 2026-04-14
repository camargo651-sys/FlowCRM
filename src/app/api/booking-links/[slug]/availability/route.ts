import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

interface DayAvailability {
  [key: string]: string[] // e.g. mon: ["09:00-17:00"]
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function parseHHMM(s: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim())
  if (!m) return null
  return { h: parseInt(m[1], 10), m: parseInt(m[2], 10) }
}

function generateSlotsForDay(
  date: Date,
  ranges: string[],
  duration: number,
  buffer: number,
  taken: Set<string>,
  now: Date
): string[] {
  const slots: string[] = []
  for (const range of ranges || []) {
    const [a, b] = range.split('-')
    const start = parseHHMM(a || '')
    const end = parseHHMM(b || '')
    if (!start || !end) continue
    const cursor = new Date(date)
    cursor.setHours(start.h, start.m, 0, 0)
    const endTime = new Date(date)
    endTime.setHours(end.h, end.m, 0, 0)
    while (cursor.getTime() + duration * 60_000 <= endTime.getTime()) {
      const iso = cursor.toISOString()
      if (cursor.getTime() > now.getTime() && !taken.has(iso)) {
        slots.push(iso)
      }
      cursor.setMinutes(cursor.getMinutes() + duration + buffer)
    }
  }
  return slots
}

export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  const { searchParams } = new URL(request.url)
  const workspaceId = searchParams.get('workspace_id')

  let supabase
  try { supabase = getServiceClient() } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }

  let query = supabase
    .from('booking_links')
    .select('*')
    .eq('slug', params.slug)
    .eq('active', true)
  if (workspaceId) query = query.eq('workspace_id', workspaceId)

  const { data: link } = await query.limit(1).single()
  if (!link) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const duration = link.duration_minutes || 30
  const buffer = link.buffer_minutes || 0
  const availability: DayAvailability = link.availability || {}

  const now = new Date()
  const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

  const { data: existing } = await supabase
    .from('bookings')
    .select('scheduled_at, status')
    .eq('link_id', link.id)
    .gte('scheduled_at', now.toISOString())
    .lte('scheduled_at', horizon.toISOString())

  const taken = new Set<string>()
  for (const b of existing || []) {
    if (b.status !== 'cancelled') taken.add(new Date(b.scheduled_at).toISOString())
  }

  const days: { date: string; slots: string[] }[] = []
  for (let i = 0; i < 14; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() + i)
    d.setHours(0, 0, 0, 0)
    const dayKey = DAY_KEYS[d.getDay()]
    const ranges = availability[dayKey]
    if (!ranges || ranges.length === 0) continue
    const slots = generateSlotsForDay(d, ranges, duration, buffer, taken, now)
    if (slots.length > 0) {
      days.push({ date: d.toISOString().slice(0, 10), slots })
    }
  }

  return NextResponse.json({
    link: {
      id: link.id,
      slug: link.slug,
      title: link.title,
      description: link.description,
      duration_minutes: duration,
      timezone: link.timezone,
      workspace_id: link.workspace_id,
    },
    days,
  })
}
