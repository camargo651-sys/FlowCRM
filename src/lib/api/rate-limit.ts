// ============================================================
// In-memory rate limiter (for API Gateway behavior)
// For production: use Redis or Upstash
// ============================================================

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up expired entries periodically (only at runtime, not during build)
if (typeof globalThis !== 'undefined' && typeof globalThis.setInterval === 'function') {
  try {
    setInterval(() => {
      const now = Date.now()
      store.forEach((entry, key) => {
        if (entry.resetAt < now) store.delete(key)
      })
    }, 60000)
  } catch { /* ignore during build */ }
}

interface RateLimitConfig {
  windowMs: number  // Time window in milliseconds
  max: number       // Max requests per window
}

const LIMITS: Record<string, RateLimitConfig> = {
  api: { windowMs: 60000, max: 100 },       // 100 req/min for API
  auth: { windowMs: 300000, max: 10 },       // 10 req/5min for auth
  demo: { windowMs: 60000, max: 5 },        // 5 req/min for demo login
  import: { windowMs: 3600000, max: 10 },    // 10 imports/hour
  webhook: { windowMs: 1000, max: 50 },      // 50 req/sec for webhooks
  widget: { windowMs: 60000, max: 30 },      // 30 req/min for widget chat
  social: { windowMs: 60000, max: 30 },      // 30 req/min for social webhooks
  portal: { windowMs: 60000, max: 30 },      // 30 req/min for portal
  forms: { windowMs: 60000, max: 30 },       // 30 req/min for form submissions
}

/**
 * Check rate limit. Returns { allowed, remaining, resetIn }
 */
export function checkRateLimit(
  identifier: string,
  type: string = 'api',
): { allowed: boolean; remaining: number; resetIn: number } {
  const config = LIMITS[type] || LIMITS.api
  const key = `${type}:${identifier}`
  const now = Date.now()

  let entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + config.windowMs }
    store.set(key, entry)
  }

  entry.count++
  const remaining = Math.max(0, config.max - entry.count)
  const resetIn = Math.max(0, Math.ceil((entry.resetAt - now) / 1000))

  return {
    allowed: entry.count <= config.max,
    remaining,
    resetIn,
  }
}

/**
 * Rate limit headers for API responses
 */
export function rateLimitHeaders(result: { remaining: number; resetIn: number }) {
  return {
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetIn.toString(),
  }
}
