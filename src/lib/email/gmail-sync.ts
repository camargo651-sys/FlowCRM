import { getValidToken } from './token-manager'

interface GmailMessage {
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

function parseEmailHeader(value: string): { name: string; email: string } {
  const match = value.match(/^(.+?)\s*<(.+?)>$/)
  if (match) return { name: match[1].replace(/"/g, '').trim(), email: match[2].trim() }
  return { name: value.split('@')[0], email: value.trim() }
}

function parseAddressList(value: string): { name: string; email: string }[] {
  if (!value) return []
  return value.split(',').map(v => parseEmailHeader(v.trim())).filter(a => a.email)
}

function getHeader(headers: any[], name: string): string {
  return headers?.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || ''
}

export async function syncGmailMessages(
  account: any,
  onTokenRefreshed: (id: string, token: string, expires: Date) => Promise<void>,
): Promise<{ messages: GmailMessage[]; newCursor: string | null }> {
  const accessToken = await getValidToken(account, onTokenRefreshed)
  const baseUrl = 'https://gmail.googleapis.com/gmail/v1/users/me'
  const messages: GmailMessage[] = []

  let messageIds: string[] = []
  let newHistoryId: string | null = null

  if (account.sync_cursor) {
    // Incremental sync via history API
    const historyUrl = `${baseUrl}/history?startHistoryId=${account.sync_cursor}&historyTypes=messageAdded&maxResults=50`
    const historyRes = await fetch(historyUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (historyRes.ok) {
      const historyData = await historyRes.json()
      newHistoryId = historyData.historyId || null
      const addedMessages = historyData.history?.flatMap((h: any) =>
        (h.messagesAdded || []).map((m: any) => m.message.id)
      ) || []
      messageIds = Array.from(new Set(addedMessages)) as string[]
    } else if (historyRes.status === 404) {
      // History expired, do full sync
      const listRes = await fetch(`${baseUrl}/messages?maxResults=50`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (listRes.ok) {
        const listData = await listRes.json()
        messageIds = (listData.messages || []).map((m: any) => m.id)
      }
    }
  } else {
    // First sync — get last 50 messages
    const listRes = await fetch(`${baseUrl}/messages?maxResults=50`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (listRes.ok) {
      const listData = await listRes.json()
      messageIds = (listData.messages || []).map((m: any) => m.id)
    }
  }

  // Fetch message details (batch in groups of 10 for performance)
  for (let i = 0; i < messageIds.length; i += 10) {
    const batch = messageIds.slice(i, i + 10)
    const details = await Promise.all(
      batch.map(async (id) => {
        const res = await fetch(`${baseUrl}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Date`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        return res.ok ? res.json() : null
      })
    )

    for (const msg of details) {
      if (!msg) continue

      const headers = msg.payload?.headers || []
      const from = parseEmailHeader(getHeader(headers, 'From'))
      const to = parseAddressList(getHeader(headers, 'To'))
      const cc = parseAddressList(getHeader(headers, 'Cc'))
      const dateStr = getHeader(headers, 'Date')

      // Update historyId to latest
      if (!newHistoryId || (msg.historyId && BigInt(msg.historyId) > BigInt(newHistoryId || '0'))) {
        newHistoryId = msg.historyId
      }

      messages.push({
        provider_message_id: msg.id,
        thread_id: msg.threadId,
        subject: getHeader(headers, 'Subject') || '(No subject)',
        snippet: msg.snippet || '',
        from_address: from.email,
        from_name: from.name,
        to_addresses: to,
        cc_addresses: cc,
        received_at: dateStr ? new Date(dateStr).toISOString() : new Date(parseInt(msg.internalDate)).toISOString(),
        is_read: !msg.labelIds?.includes('UNREAD'),
        labels: msg.labelIds || [],
      })
    }
  }

  return { messages, newCursor: newHistoryId }
}
