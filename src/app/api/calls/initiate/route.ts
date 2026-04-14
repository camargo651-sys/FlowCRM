import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api/auth'

interface Body {
  contact_id?: string
  deal_id?: string
  to_number?: string
  provider?: string
}

export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request)
  if (authResult instanceof NextResponse) return authResult
  const { supabase, workspaceId, userId } = authResult

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { contact_id, deal_id, to_number } = body
  const provider = body.provider || 'twilio'

  if (!contact_id || !to_number) {
    return NextResponse.json({ error: 'Missing required fields: contact_id, to_number' }, { status: 400 })
  }

  // Load Twilio integration
  const { data: integration } = await supabase
    .from('integrations')
    .select('config')
    .eq('workspace_id', workspaceId)
    .eq('key', 'twilio')
    .eq('enabled', true)
    .limit(1)
    .maybeSingle()

  const config = (integration?.config || null) as {
    accountSid?: string; account_sid?: string;
    authToken?: string; auth_token?: string;
    fromNumber?: string; phone_number?: string;
  } | null

  const accountSid = config?.accountSid || config?.account_sid
  const authToken = config?.authToken || config?.auth_token
  const fromNumber = config?.fromNumber || config?.phone_number

  // Fallback: tel: link
  if (!accountSid || !authToken || !fromNumber) {
    // Log the intent anyway
    const { data: logRow } = await supabase
      .from('call_logs')
      .insert({
        workspace_id: workspaceId,
        provider: 'tel',
        direction: 'outbound',
        from_number: null,
        to_number,
        started_at: new Date().toISOString(),
        contact_id,
        deal_id: deal_id || null,
        owner_id: userId,
        metadata: { mode: 'tel_fallback' },
      })
      .select('id')
      .single()

    return NextResponse.json({
      success: true,
      mode: 'tel',
      dial_url: `tel:${to_number}`,
      call_id: logRow?.id || null,
    })
  }

  // Initiate Twilio call via REST
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

  // Default TwiML URL — can be overridden via env
  const twimlUrl = process.env.TWILIO_VOICE_TWIML_URL || 'https://demo.twilio.com/docs/voice.xml'

  try {
    const twRes = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: to_number,
        From: fromNumber,
        Url: twimlUrl,
      }),
    })
    const data = await twRes.json()
    if (!twRes.ok) {
      return NextResponse.json(
        { error: data.message || `Twilio HTTP ${twRes.status}`, details: data },
        { status: 500 },
      )
    }

    const { data: logRow, error: logErr } = await supabase
      .from('call_logs')
      .insert({
        workspace_id: workspaceId,
        provider,
        external_id: data.sid || null,
        direction: 'outbound',
        from_number: fromNumber,
        to_number,
        started_at: new Date().toISOString(),
        contact_id,
        deal_id: deal_id || null,
        owner_id: userId,
        metadata: { twilio_status: data.status || null },
      })
      .select('id')
      .single()

    if (logErr) {
      return NextResponse.json({ success: true, mode: 'twilio', call_id: null, warning: logErr.message })
    }

    return NextResponse.json({ success: true, mode: 'twilio', call_id: logRow?.id, sid: data.sid })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
