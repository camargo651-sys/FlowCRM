import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { processSequenceSteps } from '@/lib/sequences/processor'

export async function POST(req: NextRequest) {
  // Protect with CRON_SECRET
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Use service role client for cron — bypasses RLS
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const processed = await processSequenceSteps(supabase)
    return NextResponse.json({ ok: true, processed })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
