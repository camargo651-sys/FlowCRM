import { getValidToken } from './token-manager'

interface OutlookMessage {
  provider_message_id: string
  thread_id: string
  subject: string
  snippet: string
  from_address: string
  from_name: string
  to_addresses: { email: string; name: string }[]
  cc_addresses: { email: string; name: string }[]
  received_at: string
  is_read: boolean
  labels: string[]
}

function parseRecipients(recipients: { emailAddress?: { address?: string; name?: string } }[]): { email: string; name: string }[] {
  return (recipients || []).map(r => ({
    email: r.emailAddress?.address || '',
    name: r.emailAddress?.name || r.emailAddress?.address?.split('@')[0] || '',
  })).filter(r => r.email)
}

export async function syncOutlookMessages(
  account: { id: string; sync_cursor?: string; access_token: string; refresh_token?: string; expires_at?: string },
  onTokenRefreshed: (id: string, token: string, expires: Date) => Promise<void>,
): Promise<{ messages: OutlookMessage[]; newCursor: string | null }> {
  const accessToken = await getValidToken(account, onTokenRefreshed)
  const baseUrl = 'https://graph.microsoft.com/v1.0/me'
  const messages: OutlookMessage[] = []
  let newCursor: string | null = null

  const selectFields = 'id,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,conversationId,isRead,categories'

  let url: string
  if (account.sync_cursor) {
    // Incremental sync via delta
    url = account.sync_cursor
  } else {
    // First sync — last 50 messages
    url = `${baseUrl}/mailFolders/inbox/messages?$top=50&$orderby=receivedDateTime desc&$select=${selectFields}`
  }

  // Paginate through results (up to 50 messages per sync)
  let fetched = 0
  while (url && fetched < 50) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!res.ok) {
      if (res.status === 410 && account.sync_cursor) {
        // Delta link expired, restart
        url = `${baseUrl}/mailFolders/inbox/messages?$top=50&$orderby=receivedDateTime desc&$select=${selectFields}`
        continue
      }
      break
    }

    const data = await res.json()

    for (const msg of (data.value || [])) {
      messages.push({
        provider_message_id: msg.id,
        thread_id: msg.conversationId || '',
        subject: msg.subject || '(No subject)',
        snippet: (msg.bodyPreview || '').slice(0, 200),
        from_address: msg.from?.emailAddress?.address || '',
        from_name: msg.from?.emailAddress?.name || '',
        to_addresses: parseRecipients(msg.toRecipients),
        cc_addresses: parseRecipients(msg.ccRecipients),
        received_at: msg.receivedDateTime,
        is_read: msg.isRead ?? false,
        labels: msg.categories || [],
      })
      fetched++
    }

    // Store deltaLink or nextLink
    if (data['@odata.deltaLink']) {
      newCursor = data['@odata.deltaLink']
      url = ''
    } else if (data['@odata.nextLink'] && fetched < 50) {
      url = data['@odata.nextLink']
    } else {
      url = ''
    }
  }

  // If no delta link came back and this was a first sync, set up delta tracking
  if (!newCursor && !account.sync_cursor) {
    const deltaRes = await fetch(`${baseUrl}/mailFolders/inbox/messages/delta?$select=${selectFields}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (deltaRes.ok) {
      const deltaData = await deltaRes.json()
      newCursor = deltaData['@odata.deltaLink'] || null
    }
  }

  return { messages, newCursor }
}
