import { getValidToken } from './token-manager'

interface GmailAccount {
  id: string
  provider?: string
  access_token: string
  refresh_token?: string
  token_expires_at?: string
  expires_at?: string
  email_address?: string
}

export interface SendInput {
  to: string[]
  cc?: string[]
  subject: string
  body_html?: string | null
  body_text?: string | null
  thread_id?: string | null
  from_address?: string
  from_name?: string | null
}

export interface SendResult {
  id: string
  thread_id: string
}

function encodeHeader(value: string): string {
  // RFC 2047 encoded-word for non-ASCII headers
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function buildRawMime(input: SendInput): string {
  const boundary = `----tracktio_${Math.random().toString(36).slice(2)}`
  const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@tracktio>`
  const fromHeader = input.from_name
    ? `${encodeHeader(input.from_name)} <${input.from_address}>`
    : input.from_address || ''

  const headers: string[] = []
  headers.push(`From: ${fromHeader}`)
  headers.push(`To: ${input.to.join(', ')}`)
  if (input.cc && input.cc.length) headers.push(`Cc: ${input.cc.join(', ')}`)
  headers.push(`Subject: ${encodeHeader(input.subject)}`)
  headers.push(`Message-ID: ${messageId}`)
  headers.push('MIME-Version: 1.0')

  const hasHtml = !!input.body_html
  const hasText = !!input.body_text || !hasHtml
  const textPart = input.body_text || (input.body_html ? input.body_html.replace(/<[^>]+>/g, '') : '')

  if (hasHtml && hasText) {
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)
    const body = [
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      textPart,
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      input.body_html || '',
      `--${boundary}--`,
      '',
    ].join('\r\n')
    return headers.join('\r\n') + '\r\n' + body
  }

  if (hasHtml) {
    headers.push('Content-Type: text/html; charset=UTF-8')
    return headers.join('\r\n') + '\r\n\r\n' + (input.body_html || '')
  }

  headers.push('Content-Type: text/plain; charset=UTF-8')
  return headers.join('\r\n') + '\r\n\r\n' + textPart
}

export async function sendGmailMessage(
  account: GmailAccount,
  input: SendInput,
  onTokenRefreshed: (id: string, token: string, expires: Date) => Promise<void>,
): Promise<SendResult> {
  const accessToken = await getValidToken({ ...account, provider: 'gmail' }, onTokenRefreshed)

  const raw = base64url(
    buildRawMime({ ...input, from_address: input.from_address || account.email_address }),
  )

  const body: { raw: string; threadId?: string } = { raw }
  if (input.thread_id) body.threadId = input.thread_id

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gmail send failed (${res.status}): ${err}`)
  }

  const data = await res.json()
  return { id: data.id, thread_id: data.threadId }
}
