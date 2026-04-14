// Lightweight in-memory token bucket rate limiter for API routes.
// Per-instance (Vercel edge function): each region/instance has its own map,
// which is acceptable for basic abuse prevention. For distributed limits,
// swap to Upstash Redis or @vercel/kv later.

interface Bucket {
  tokens: number
  lastRefill: number
}

const buckets = new Map<string, Bucket>()
const MAX_ENTRIES = 10_000 // cap memory

/**
 * Check if a request from `key` is allowed.
 *
 * @param key      Unique identifier (typically `${ip}:${route}`)
 * @param limit    Max requests per window
 * @param windowMs Window size in milliseconds
 * @returns        { allowed, remaining, resetAt }
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  let bucket = buckets.get(key)

  if (!bucket) {
    // Evict oldest if map is full
    if (buckets.size >= MAX_ENTRIES) {
      const oldest = buckets.keys().next().value
      if (oldest) buckets.delete(oldest)
    }
    bucket = { tokens: limit, lastRefill: now }
    buckets.set(key, bucket)
  }

  // Refill proportional to elapsed time
  const elapsed = now - bucket.lastRefill
  if (elapsed >= windowMs) {
    bucket.tokens = limit
    bucket.lastRefill = now
  } else {
    const refill = Math.floor((elapsed / windowMs) * limit)
    if (refill > 0) {
      bucket.tokens = Math.min(limit, bucket.tokens + refill)
      bucket.lastRefill = now
    }
  }

  const resetAt = bucket.lastRefill + windowMs
  if (bucket.tokens <= 0) {
    return { allowed: false, remaining: 0, resetAt }
  }
  bucket.tokens -= 1
  return { allowed: true, remaining: bucket.tokens, resetAt }
}

export function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}
