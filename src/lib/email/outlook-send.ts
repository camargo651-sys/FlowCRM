import { getValidToken } from './token-manager'
import type { SendInput, SendResult } from './gmail-send'

interface OutlookAccount {
  id: string
  provider?: string
  access_token: string
  refresh_token?: string
  token_expires_at?: string
  expires_at?: string
  email_address?: string
}

function toRecipients(list?: string[]) {
  return (list || []).map((email) => ({ emailAddress: { address: email } }))
}

export async function sendOutlookMessage(
  account: OutlookAccount,
  input: SendInput,
  onTokenRefreshed: (id: string, token: string, expires: Date) => Promise<void>,
): Promise<SendResult> {
  const accessToken = await getValidToken({ ...account, provider: 'outlook' }, onTokenRefreshed)

  const contentType = input.body_html ? 'HTML' : 'Text'
  const content = input.body_html || input.body_text || ''

  // If replying to an existing thread, use createReply / reply endpoint
  if (input.thread_id) {
    const replyRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(input.thread_id)}/reply`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            toRecipients: toRecipients(input.to),
            ccRecipients: toRecipients(input.cc),
          },
          comment: content,
        }),
      },
    )
    if (replyRes.ok || replyRes.status === 202) {
      return { id: `outlook-reply-${Date.now()}`, thread_id: input.thread_id }
    }
    // Fall through to sendMail if reply fails (e.g. message id not accessible)
  }

  const message = {
    subject: input.subject,
    body: { contentType, content },
    toRecipients: toRecipients(input.to),
    ccRecipients: toRecipients(input.cc),
  }

  const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, saveToSentItems: true }),
  })

  if (!res.ok && res.status !== 202) {
    const err = await res.text()
    throw new Error(`Outlook send failed (${res.status}): ${err}`)
  }

  // Graph sendMail returns 202 with no body — synthesise an id
  return {
    id: `outlook-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    thread_id: input.thread_id || `outlook-thread-${Date.now()}`,
  }
}
