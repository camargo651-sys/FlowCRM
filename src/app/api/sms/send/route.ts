import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api/auth'
import { sendSMS } from '@/lib/integrations/twilio'

export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request)
  if (authResult instanceof NextResponse) return authResult

  const { supabase, workspaceId, userId } = authResult

  const body = await request.json()
  const { to, message, contactId } = body as { to?: string; message?: string; contactId?: string }

  if (!to || !message) {
    return NextResponse.json({ error: 'Missing required fields: to, message' }, { status: 400 })
  }

  // Load Twilio config from integrations table
  const { data: integration } = await supabase
    .from('integrations')
    .select('config')
    .eq('workspace_id', workspaceId)
    .eq('key', 'twilio')
    .eq('enabled', true)
    .single()

  if (!integration?.config) {
    return NextResponse.json({ error: 'Twilio integration not configured' }, { status: 400 })
  }

  const config = integration.config as { accountSid?: string; authToken?: string; fromNumber?: string }

  if (!config.accountSid || !config.authToken || !config.fromNumber) {
    return NextResponse.json({ error: 'Twilio configuration incomplete' }, { status: 400 })
  }

  const result = await sendSMS(to, message, {
    accountSid: config.accountSid,
    authToken: config.authToken,
    fromNumber: config.fromNumber,
  })

  // Log activity regardless of success
  await supabase.from('activities').insert({
    workspace_id: workspaceId,
    type: 'sms',
    title: `SMS to ${to}`,
    notes: message,
    contact_id: contactId || null,
    owner_id: userId,
    done: true,
    metadata: {
      sms_sid: result.sid || null,
      sms_success: result.success,
      sms_error: result.error || null,
      to_number: to,
    },
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error, sent: false }, { status: 502 })
  }

  return NextResponse.json({ success: true, sid: result.sid })
}
