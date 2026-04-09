interface TwilioConfig {
  accountSid: string
  authToken: string
  fromNumber: string
}

interface TwilioResult {
  success: boolean
  sid?: string
  error?: string
}

/**
 * Send an SMS via Twilio REST API (no SDK required).
 */
export async function sendSMS(
  to: string,
  body: string,
  config: TwilioConfig,
): Promise<TwilioResult> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`

  const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64')

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: to,
        From: config.fromNumber,
        Body: body,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      return { success: false, error: data.message || `HTTP ${res.status}` }
    }

    return { success: true, sid: data.sid }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}
