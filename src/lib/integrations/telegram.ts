/**
 * Telegram Bot integration — send messages via Bot API.
 */

interface TelegramResult {
  success: boolean
  error?: string
}

/**
 * Send a text message via Telegram Bot API.
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
): Promise<TelegramResult> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    })

    const data = await res.json()

    if (!res.ok || !data.ok) {
      return { success: false, error: data.description || `HTTP ${res.status}` }
    }

    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error sending Telegram message',
    }
  }
}
