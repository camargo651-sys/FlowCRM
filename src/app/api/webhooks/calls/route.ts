import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { matchPhoneNumber, normalizePhone } from '@/lib/whatsapp/client'
import { analyzeTranscript } from '@/lib/calls/transcription-analyzer'
import { emitSignal } from '@/lib/ai/signal-emitter'

function getServiceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
  )
}

// POST: Twilio recording/transcription callback
export async function POST(request: NextRequest) {
  // Verify webhook auth token if configured
  const webhookToken = process.env.TWILIO_WEBHOOK_TOKEN
  if (webhookToken) {
    const authHeader = request.headers.get('x-webhook-token') || request.nextUrl.searchParams.get('token') || ''
    if (authHeader !== webhookToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
  }
  const contentType = request.headers.get('content-type') || ''
  let body: Record<string, string>

  if (contentType.includes('application/x-www-form-urlencoded')) {
    // Twilio sends form-encoded data
    const formData = await request.formData()
    body = Object.fromEntries(formData.entries()) as Record<string, string>
  } else {
    body = await request.json()
  }

  const supabase = getServiceSupabase()
  if (!supabase) return NextResponse.json({ error: 'Service not configured' }, { status: 503 })

  // Determine provider and extract fields
  const provider = body.provider || 'twilio'
  const fromNumber = body.From || body.from_number || ''
  const toNumber = body.To || body.to_number || ''
  const duration = parseInt(body.CallDuration || body.RecordingDuration || body.duration_seconds || '0')
  const recordingUrl = body.RecordingUrl || body.recording_url || null
  const transcript = body.TranscriptionText || body.transcript || null
  const externalId = body.CallSid || body.external_id || null
  const direction = body.Direction?.includes('inbound') ? 'inbound' : 'outbound'

  if (!fromNumber && !toNumber) {
    return NextResponse.json({ error: 'No phone numbers provided' }, { status: 400 })
  }

  // Find workspace by matching phone number with a whatsapp_account or twilio integration
  const contactPhone = direction === 'inbound' ? fromNumber : toNumber
  const { data: allContacts } = await supabase
    .from('contacts')
    .select('id, phone, workspace_id, name')
    .not('phone', 'is', null)

  let contactId: string | null = null
  let workspaceId: string | null = null
  let contactName = ''

  for (const c of allContacts || []) {
    if (c.phone && matchPhoneNumber(c.phone, contactPhone)) {
      contactId = c.id
      workspaceId = c.workspace_id
      contactName = c.name
      break
    }
  }

  // If no contact found, try to find workspace from integrations
  if (!workspaceId) {
    const { data: twilioInt } = await supabase
      .from('integrations')
      .select('workspace_id')
      .eq('key', 'twilio')
      .eq('enabled', true)
      .limit(1)
      .single()

    if (twilioInt) workspaceId = twilioInt.workspace_id
  }

  if (!workspaceId) {
    return NextResponse.json({ error: 'Could not determine workspace' }, { status: 404 })
  }

  // If we have a transcript, analyze it with AI
  let analysis: { summary: string; sentiment: 'positive' | 'neutral' | 'negative'; key_topics: string[]; next_actions: string[] } = { summary: '', sentiment: 'neutral', key_topics: [], next_actions: [] }
  if (transcript) {
    analysis = await analyzeTranscript(transcript)
  }

  // Get workspace owner for owner_id
  const { data: ws } = await supabase.from('workspaces').select('owner_id').eq('id', workspaceId).single()

  // Store call log
  const { data: callLog } = await supabase.from('call_logs').insert({
    workspace_id: workspaceId,
    provider,
    external_id: externalId,
    from_number: fromNumber,
    to_number: toNumber,
    direction,
    duration_seconds: duration,
    started_at: new Date().toISOString(),
    recording_url: recordingUrl,
    transcript,
    summary: analysis.summary || null,
    sentiment: analysis.sentiment || null,
    key_topics: analysis.key_topics || [],
    next_actions: analysis.next_actions || [],
    contact_id: contactId,
    owner_id: ws?.owner_id || null,
  }).select('id').single()

  // Emit engagement signals
  if (contactId && workspaceId) {
    await emitSignal(supabase, {
      workspaceId,
      contactId,
      signalType: 'call_completed',
      source: provider,
    })
    if (analysis.sentiment === 'positive') {
      await emitSignal(supabase, { workspaceId, contactId, signalType: 'call_positive', source: provider })
    } else if (analysis.sentiment === 'negative') {
      await emitSignal(supabase, { workspaceId, contactId, signalType: 'call_negative', source: provider })
    }
  }

  // Log activity
  if (contactId && ws) {
    const title = transcript
      ? `Call with ${contactName}: ${analysis.summary?.slice(0, 80) || 'Transcribed'}`
      : `Call with ${contactName} (${Math.floor(duration / 60)}m ${duration % 60}s)`

    await supabase.from('activities').insert({
      workspace_id: workspaceId,
      type: 'call',
      title,
      notes: analysis.summary || `Duration: ${duration}s`,
      contact_id: contactId,
      owner_id: ws.owner_id,
      done: true,
      metadata: {
        call_log_id: callLog?.id,
        duration_seconds: duration,
        sentiment: analysis.sentiment,
        key_topics: analysis.key_topics,
        next_actions: analysis.next_actions,
        provider,
      },
    })

    // If AI found next actions, create tasks
    for (const action of analysis.next_actions?.slice(0, 3) || []) {
      await supabase.from('activities').insert({
        workspace_id: workspaceId,
        type: 'task',
        title: action,
        notes: `Auto-generated from call with ${contactName}`,
        contact_id: contactId,
        owner_id: ws.owner_id,
        done: false,
        due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
      })
    }
  }

  return NextResponse.json({ success: true, call_log_id: callLog?.id })
}
