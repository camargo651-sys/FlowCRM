import crypto from 'crypto'

// ─── Base32 (RFC 4648) ────────────────────────────────────────────
const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(buf: Buffer): string {
  let bits = 0
  let value = 0
  let out = ''
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i]
    bits += 8
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode(str: string): Buffer {
  const clean = str.replace(/=+$/, '').toUpperCase().replace(/\s+/g, '')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (let i = 0; i < clean.length; i++) {
    const idx = B32_ALPHABET.indexOf(clean[i])
    if (idx < 0) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

// ─── TOTP (RFC 6238) ──────────────────────────────────────────────

/** Generate a random base32 TOTP secret (160 bits) */
export function generateSecret(): string {
  return base32Encode(crypto.randomBytes(20))
}

/** Generate 10 backup codes formatted as XXXX-XXXX */
export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    const buf = crypto.randomBytes(5)
    const hex = buf.toString('hex').toUpperCase()
    codes.push(`${hex.slice(0, 4)}-${hex.slice(4, 8)}`)
  }
  return codes
}

/** Compute HOTP (RFC 4226) value for a counter */
function hotp(secretBuf: Buffer, counter: number): string {
  const buf = Buffer.alloc(8)
  // Write 64-bit counter big-endian
  for (let i = 7; i >= 0; i--) {
    buf[i] = counter & 0xff
    counter = Math.floor(counter / 256)
  }
  const hmac = crypto.createHmac('sha1', secretBuf).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return (code % 1_000_000).toString().padStart(6, '0')
}

/** Verify a TOTP token, allowing +/- 1 step drift */
export function verifyToken(secret: string, token: string, window = 1): boolean {
  if (!/^\d{6}$/.test(token)) return false
  const secretBuf = base32Decode(secret)
  const step = 30
  const counter = Math.floor(Date.now() / 1000 / step)
  for (let w = -window; w <= window; w++) {
    if (hotp(secretBuf, counter + w) === token) return true
  }
  return false
}

/** Build the otpauth URL (used by authenticator apps to render QR) */
export function buildOtpauthUrl(secret: string, label: string, issuer = 'Tracktio'): string {
  const enc = encodeURIComponent
  return `otpauth://totp/${enc(issuer)}:${enc(label)}?secret=${secret}&issuer=${enc(issuer)}&algorithm=SHA1&digits=6&period=30`
}
