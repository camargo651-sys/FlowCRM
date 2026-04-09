/**
 * Microsoft Teams integration — send notifications via incoming webhook.
 */

interface TeamsMessage {
  title: string
  text: string
}

interface TeamsResult {
  success: boolean
  error?: string
}

/**
 * Send a message to a Microsoft Teams channel via incoming webhook.
 * Uses the Adaptive Card format supported by Teams connectors.
 */
export async function sendTeamsMessage(
  webhookUrl: string,
  message: TeamsMessage,
): Promise<TeamsResult> {
  const card = {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            {
              type: 'TextBlock',
              text: message.title,
              weight: 'Bolder',
              size: 'Medium',
            },
            {
              type: 'TextBlock',
              text: message.text,
              wrap: true,
            },
          ],
        },
      },
    ],
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    })

    if (!res.ok) {
      const text = await res.text()
      return { success: false, error: `Teams webhook returned ${res.status}: ${text}` }
    }

    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error sending Teams message',
    }
  }
}
