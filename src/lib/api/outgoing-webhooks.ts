import crypto from 'crypto'
import { SupabaseClient } from '@supabase/supabase-js'
import { sendSlackNotification, buildSlackMessage } from '@/lib/integrations/slack'

const SLACK_EVENTS = ['deal_won', 'deal_lost', 'lead_created', 'contact_created']

/**
 * Fire outgoing webhooks for a given event.
 * Looks up all active webhook configs for the workspace that match the event.
 */
export async function fireOutgoingWebhooks(
  supabase: SupabaseClient,
  workspaceId: string,
  event: string,
  payload: Record<string, unknown>,
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
        'X-Tracktio-Event': event,
        'X-Tracktio-Signature': `sha256=${signature}`,
        'X-Tracktio-Timestamp': new Date().toISOString(),
      },
      body,
    })
  } catch (err: unknown) {
  }

  // Send Slack notification if enabled and event is supported
  if (SLACK_EVENTS.includes(event)) {
    try {
      const { data: slackInt } = await supabase
        .from('integrations')
        .select('config')
        .eq('workspace_id', workspaceId)
        .eq('key', 'slack')
        .eq('enabled', true)
        .single()

      if (slackInt?.config?.webhook_url) {
        const slackMessage = buildSlackMessage(event, payload)
        await sendSlackNotification(slackInt.config.webhook_url, slackMessage)
      }
    } catch {
      // Slack notification is best-effort — don't block on failure
    }
  }
}
