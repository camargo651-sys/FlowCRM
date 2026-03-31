import { describe, it, expect } from 'vitest'
import { normalizePhone, matchPhoneNumber } from '@/lib/whatsapp/client'

describe('Phone Number Utilities', () => {
  describe('normalizePhone', () => {
    it('strips non-numeric characters', () => {
      expect(normalizePhone('+57 300 123 4567')).toBe('573001234567')
      expect(normalizePhone('(300) 123-4567')).toBe('3001234567')
    })

    it('removes leading +', () => {
      expect(normalizePhone('+1234567890')).toBe('1234567890')
    })
  })

  describe('matchPhoneNumber', () => {
    it('matches identical numbers', () => {
      expect(matchPhoneNumber('+573001234567', '+573001234567')).toBe(true)
    })

    it('matches with different formatting', () => {
      expect(matchPhoneNumber('+57 300 123 4567', '573001234567')).toBe(true)
    })

    it('matches last 10 digits across country codes', () => {
      expect(matchPhoneNumber('+573001234567', '+13001234567')).toBe(true)
    })

    it('does not match different numbers', () => {
      expect(matchPhoneNumber('+573001234567', '+573009999999')).toBe(false)
    })

    it('handles short numbers correctly', () => {
      expect(matchPhoneNumber('12345', '12345')).toBe(true)
    })
  })
})
