/**
 * Mailchimp integration — add contacts to audience lists.
 */

interface MailchimpResult {
  success: boolean
  data?: { id: string; status: string }
  error?: string
}

/**
 * Extract datacenter from Mailchimp API key.
 * Keys end with -us1, -us2, etc.
 */
function extractDatacenter(apiKey: string): string {
  const parts = apiKey.split('-')
  return parts[parts.length - 1] || 'us1'
}

export async function addToMailchimpList(
  apiKey: string,
  listId: string,
  email: string,
  name: string,
): Promise<MailchimpResult> {
  const dc = extractDatacenter(apiKey)
  const url = `https://${dc}.api.mailchimp.com/3.0/lists/${listId}/members`

  // Split name into first/last
  const nameParts = name.trim().split(/\s+/)
  const firstName = nameParts[0] || ''
  const lastName = nameParts.slice(1).join(' ') || ''

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email_address: email,
        status: 'subscribed',
        merge_fields: {
          FNAME: firstName,
          LNAME: lastName,
        },
      }),
    })

    // 200 or 400 with "already a list member" is fine
    if (res.ok) {
      const data = await res.json()
      return { success: true, data: { id: data.id, status: data.status } }
    }

    const errorBody = await res.json().catch(() => null)
    const errorTitle = errorBody?.title || ''

    // Already subscribed is not an error
    if (res.status === 400 && errorTitle === 'Member Exists') {
      return { success: true, data: { id: '', status: 'already_subscribed' } }
    }

    return {
      success: false,
      error: `Mailchimp API error ${res.status}: ${errorTitle || await res.text()}`,
    }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error calling Mailchimp API',
    }
  }
}
