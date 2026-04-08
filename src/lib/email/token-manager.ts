import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
  const key = process.env.EMAIL_ENCRYPTION_KEY
  if (!key) throw new Error('EMAIL_ENCRYPTION_KEY not configured')
  return crypto.createHash('sha256').update(key).digest()
}

export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Format: iv:tag:ciphertext (all base64)
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`
}

export function decryptToken(ciphertext: string): string {
  const key = getEncryptionKey()
  const [ivB64, tagB64, encB64] = ciphertext.split(':')
  if (!ivB64 || !tagB64 || !encB64) throw new Error('Invalid encrypted token format')
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const encrypted = Buffer.from(encB64, 'base64')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted) + decipher.final('utf8')
}

interface EmailAccount {
  id: string
  provider?: 'gmail' | 'outlook' | string
  access_token: string
  refresh_token?: string
  token_expires_at?: string
  expires_at?: string
  sync_cursor?: string
}

interface TokenResult {
  access_token: string
  expires_at: Date
}

async function refreshGmailToken(refreshToken: string): Promise<TokenResult> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gmail token refresh failed: ${err}`)
  }
  const data = await res.json()
  return {
    access_token: data.access_token,
    expires_at: new Date(Date.now() + data.expires_in * 1000),
  }
}

async function refreshOutlookToken(refreshToken: string): Promise<TokenResult> {
  const tenantId = process.env.MICROSOFT_TENANT_ID || 'common'
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      scope: 'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read offline_access',
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Outlook token refresh failed: ${err}`)
  }
  const data = await res.json()
  return {
    access_token: data.access_token,
    expires_at: new Date(Date.now() + data.expires_in * 1000),
  }
}

/**
 * Returns a valid access token, refreshing if needed.
 * Updates the DB row via the provided callback.
 */
export async function getValidToken(
  account: EmailAccount,
  onTokenRefreshed: (accountId: string, accessToken: string, expiresAt: Date) => Promise<void>
): Promise<string> {
  const decryptedAccess = decryptToken(account.access_token)
  const expiresAt = new Date(account.token_expires_at || account.expires_at || 0)

  // If token is still valid (with 5min buffer), return it
  if (expiresAt.getTime() - Date.now() > 5 * 60 * 1000) {
    return decryptedAccess
  }

  // Refresh the token
  if (!account.refresh_token) throw new Error('No refresh token available')
  const decryptedRefresh = decryptToken(account.refresh_token)
  const result = account.provider === 'gmail'
    ? await refreshGmailToken(decryptedRefresh)
    : await refreshOutlookToken(decryptedRefresh)

  const encryptedAccess = encryptToken(result.access_token)
  await onTokenRefreshed(account.id, encryptedAccess, result.expires_at)

  return result.access_token
}
