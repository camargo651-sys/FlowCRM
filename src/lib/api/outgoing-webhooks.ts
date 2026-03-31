import crypto from 'crypto'
import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Fire outgoing webhooks for a given event.
 * Looks up all active webhook configs for the workspace that match the event.
 */
export async function fireOutgoingWebhooks(
  supabase: SupabaseClient,
  workspaceId: string,
  event: string,
  payload: any,
) {
  // Get webhook configs from integrations table
  const { data: webhookInt } = await supabase
    .from('integrations')
    .select('config')
    .eq('workspace_id', workspaceId)
    .eq('key', 'webhooks')
    .eq('enabled', true)
    .single()

  if (!webhookInt?.config?.url) return

  const config = webhookInt.config
  const events = (config.events || '').split(',').map((e: string) => e.trim())

  // Check if this event is subscribed
  if (events.length && !events.includes('*') && !events.includes(event)) return

  const body = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    workspace_id: workspaceId,
    data: payload,
  })

  // Sign payload
  const signature = config.secret
    ? crypto.createHmac('sha256', config.secret).update(body).digest('hex')
    : ''

  try {
    await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-FlowCRM-Event': event,
        'X-FlowCRM-Signature': `sha256=${signature}`,
        'X-FlowCRM-Timestamp': new Date().toISOString(),
      },
      body,
    })
  } catch (err: any) {
    console.error(`Webhook delivery failed for ${event}:`, err.message)
  }
}
