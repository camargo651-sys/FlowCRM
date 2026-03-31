import { describe, it, expect } from 'vitest'
import { checkRateLimit } from '@/lib/api/rate-limit'

describe('Rate Limiting', () => {
  it('allows requests within limit', () => {
    const result = checkRateLimit('test-user-1', 'api')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBeGreaterThan(0)
  })

  it('tracks remaining requests', () => {
    const id = 'test-user-2'
    const r1 = checkRateLimit(id, 'api')
    const r2 = checkRateLimit(id, 'api')
    expect(r2.remaining).toBe(r1.remaining - 1)
  })

  it('blocks after exceeding limit', () => {
    const id = 'test-user-flood'
    // Auth limit is 10 per 5 min
    for (let i = 0; i < 10; i++) {
      checkRateLimit(id, 'auth')
    }
    const result = checkRateLimit(id, 'auth')
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('returns reset time', () => {
    const result = checkRateLimit('test-user-3', 'api')
    expect(result.resetIn).toBeGreaterThan(0)
    expect(result.resetIn).toBeLessThanOrEqual(60)
  })
})
