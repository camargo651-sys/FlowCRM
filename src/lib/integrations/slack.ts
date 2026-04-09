/**
 * Slack integration — send notifications via incoming webhook.
 */

interface SlackMessage {
  text: string
  blocks?: unknown[]
}

interface SlackResult {
  success: boolean
  error?: string
}

export async function sendSlackNotification(
  webhookUrl: string,
  message: SlackMessage,
): Promise<SlackResult> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    })

    if (!res.ok) {
      const text = await res.text()
      return { success: false, error: `Slack webhook returned ${res.status}: ${text}` }
    }

    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error sending Slack notification',
    }
  }
}

/**
 * Build a formatted Slack message for CRM events.
 */
export function buildSlackMessage(
  event: string,
  payload: Record<string, unknown>,
): SlackMessage {
  const eventLabels: Record<string, string> = {
    deal_won: 'Deal Won',
    deal_lost: 'Deal Lost',
    lead_created: 'New Lead',
    contact_created: 'New Contact',
  }

  const label = eventLabels[event] || event

  // Build a short summary line
  let summary = `*${label}*`
  if (payload.title) summary += ` — ${payload.title}`
  if (payload.name) summary += ` — ${payload.name}`
  if (payload.value) summary += ` ($${Number(payload.value).toLocaleString()})`

  return {
    text: summary,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: summary },
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `Event: \`${event}\` | ${new Date().toLocaleString()}` },
        ],
      },
    ],
  }
}
