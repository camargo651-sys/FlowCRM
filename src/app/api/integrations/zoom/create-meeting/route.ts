import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, apiSuccess, apiError } from '@/lib/api/auth'
import { createZoomMeeting } from '@/lib/integrations/zoom'

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth instanceof NextResponse) return auth

  const { supabase, workspaceId } = auth

  let body: { topic: string; contactId?: string; duration?: number; startTime?: string }
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid JSON body', 400)
  }

  if (!body.topic) {
    return apiError('topic is required', 400)
  }

  // Load Zoom config from integrations table
  const { data: integration } = await supabase
    .from('integrations')
    .select('id, config')
    .eq('workspace_id', workspaceId)
    .eq('key', 'zoom')
    .single()

  if (!integration) {
    return apiError('Zoom integration not configured', 400)
  }

  const config = integration.config as Record<string, unknown>
  const accessToken = config.access_token as string
  if (!accessToken) {
    return apiError('Zoom access_token missing in integration config', 400)
  }

  const result = await createZoomMeeting(accessToken, {
    topic: body.topic,
    duration: body.duration,
    startTime: body.startTime,
  })

  if (!result.success) {
    return apiError(result.error || 'Failed to create Zoom meeting', 502)
  }

  // Store as activity linked to contact if provided
  if (body.contactId) {
    await supabase.from('activities').insert({
      workspace_id: workspaceId,
      contact_id: body.contactId,
      type: 'meeting',
      title: body.topic,
      description: `Zoom meeting: ${result.join_url}`,
      metadata: { zoom_meeting_id: result.meeting_id, join_url: result.join_url },
      user_id: auth.userId,
    })
  }

  return apiSuccess({
    join_url: result.join_url,
    meeting_id: result.meeting_id,
  })
}
