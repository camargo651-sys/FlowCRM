/** @type {import('next').NextConfig} */
// Explicit allow-list for the image optimizer to mitigate GHSA-9g9p-9gw9-jx7f
// (remote patterns DoS). Only domains we actually embed images from.
const IMAGE_REMOTE_PATTERNS = [
  { protocol: 'https', hostname: '**.supabase.co' },
  { protocol: 'https', hostname: 'jmdstzhdebwtybwrvnmh.supabase.co' },
  { protocol: 'https', hostname: 'lh3.googleusercontent.com' }, // Google avatars
  { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
  { protocol: 'https', hostname: 'api.qrserver.com' }, // 2FA QR
  { protocol: 'https', hostname: 'flagcdn.com' }, // country flags
]

// CSP — conservative but app-compatible.
// - 'unsafe-inline' on scripts is needed for Next.js inline bootstrap.
// - Supabase realtime needs ws/wss.
// - Stripe checkout + js.stripe.com.
// - Google fonts + gstatic.
// CSP only applied in production — localhost over HTTP would break with
// upgrade-insecure-requests and strict connect-src.
const isProd = process.env.NODE_ENV === 'production'
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.googletagmanager.com https://connect.facebook.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https: http:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://www.google-analytics.com https://api.openai.com https://graph.microsoft.com https://gmail.googleapis.com https://api.twilio.com",
  "frame-src https://js.stripe.com https://checkout.stripe.com",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join('; ')

const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: IMAGE_REMOTE_PATTERNS,
    // Cap optimizer cache to mitigate GHSA-3x4c-7xq6-9pq8 disk exhaustion
    minimumCacheTTL: 60,
  },
  async headers() {
    const baseHeaders = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-XSS-Protection', value: '1; mode=block' },
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
    ]
    // HSTS + CSP only in production to avoid breaking localhost over HTTP
    if (isProd) {
      baseHeaders.push(
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'Content-Security-Policy', value: CSP },
      )
    }
    return [{ source: '/(.*)', headers: baseHeaders }]
  },
}

module.exports = nextConfig
