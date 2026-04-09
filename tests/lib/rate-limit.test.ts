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

  describe('different limit profiles', () => {
    it('demo limit allows only 5 requests per minute', () => {
      const id = 'test-demo-user'
      for (let i = 0; i < 5; i++) {
        const r = checkRateLimit(id, 'demo')
        expect(r.allowed).toBe(true)
      }
      const blocked = checkRateLimit(id, 'demo')
      expect(blocked.allowed).toBe(false)
      expect(blocked.remaining).toBe(0)
    })

    it('widget limit allows 30 requests per minute', () => {
      const id = 'test-widget-user'
      for (let i = 0; i < 30; i++) {
        const r = checkRateLimit(id, 'widget')
        expect(r.allowed).toBe(true)
      }
      const blocked = checkRateLimit(id, 'widget')
      expect(blocked.allowed).toBe(false)
    })

    it('api limit allows 100 requests per minute', () => {
      const id = 'test-api-heavy'
      // First request should show 99 remaining
      const first = checkRateLimit(id, 'api')
      expect(first.allowed).toBe(true)
      expect(first.remaining).toBe(99)
    })

    it('falls back to api limits for unknown type', () => {
      const id = 'test-unknown-type'
      const result = checkRateLimit(id, 'nonexistent_type')
      expect(result.allowed).toBe(true)
      // Should use api config: 100 max, so remaining = 99
      expect(result.remaining).toBe(99)
    })
  })

  describe('window reset behavior', () => {
    it('different identifiers have independent limits', () => {
      const idA = 'test-independent-a'
      const idB = 'test-independent-b'

      // Exhaust auth limit for A
      for (let i = 0; i < 10; i++) {
        checkRateLimit(idA, 'auth')
      }
      expect(checkRateLimit(idA, 'auth').allowed).toBe(false)

      // B should still be allowed
      expect(checkRateLimit(idB, 'auth').allowed).toBe(true)
    })

    it('different types for same identifier are independent', () => {
      const id = 'test-multi-type'

      // Exhaust demo limit (5)
      for (let i = 0; i < 5; i++) {
        checkRateLimit(id, 'demo')
      }
      expect(checkRateLimit(id, 'demo').allowed).toBe(false)

      // API type should still work
      expect(checkRateLimit(id, 'api').allowed).toBe(true)
    })
  })
})
