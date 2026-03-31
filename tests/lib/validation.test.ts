import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Replicate the contact schema from the API
const contactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  type: z.enum(['person', 'company']).optional(),
  company_name: z.string().max(200).optional().nullable(),
  job_title: z.string().max(200).optional().nullable(),
  website: z.string().url().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  tags: z.array(z.string()).optional(),
}).passthrough()

const dealSchema = z.object({
  title: z.string().min(1).max(200),
  value: z.number().min(0).optional().nullable(),
  status: z.enum(['open', 'won', 'lost']).optional(),
  contact_id: z.string().uuid().optional().nullable(),
  probability: z.number().min(0).max(100).optional(),
}).passthrough()

describe('Contact Validation', () => {
  it('validates a valid contact', () => {
    const result = contactSchema.safeParse({ name: 'John Doe', email: 'john@example.com' })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = contactSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const result = contactSchema.safeParse({ name: 'John', email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('allows null email', () => {
    const result = contactSchema.safeParse({ name: 'John', email: null })
    expect(result.success).toBe(true)
  })

  it('rejects name over 200 chars', () => {
    const result = contactSchema.safeParse({ name: 'a'.repeat(201) })
    expect(result.success).toBe(false)
  })

  it('validates type enum', () => {
    expect(contactSchema.safeParse({ name: 'John', type: 'person' }).success).toBe(true)
    expect(contactSchema.safeParse({ name: 'John', type: 'company' }).success).toBe(true)
    expect(contactSchema.safeParse({ name: 'John', type: 'invalid' }).success).toBe(false)
  })

  it('allows extra fields with passthrough', () => {
    const result = contactSchema.safeParse({ name: 'John', custom_field: 'value' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.custom_field).toBe('value')
  })
})

describe('Deal Validation', () => {
  it('validates a valid deal', () => {
    const result = dealSchema.safeParse({ title: 'Big Deal', value: 50000 })
    expect(result.success).toBe(true)
  })

  it('rejects empty title', () => {
    const result = dealSchema.safeParse({ title: '' })
    expect(result.success).toBe(false)
  })

  it('rejects negative value', () => {
    const result = dealSchema.safeParse({ title: 'Deal', value: -100 })
    expect(result.success).toBe(false)
  })

  it('validates status enum', () => {
    expect(dealSchema.safeParse({ title: 'Deal', status: 'open' }).success).toBe(true)
    expect(dealSchema.safeParse({ title: 'Deal', status: 'won' }).success).toBe(true)
    expect(dealSchema.safeParse({ title: 'Deal', status: 'pending' }).success).toBe(false)
  })

  it('validates probability range', () => {
    expect(dealSchema.safeParse({ title: 'Deal', probability: 50 }).success).toBe(true)
    expect(dealSchema.safeParse({ title: 'Deal', probability: 101 }).success).toBe(false)
    expect(dealSchema.safeParse({ title: 'Deal', probability: -1 }).success).toBe(false)
  })

  it('validates UUID for contact_id', () => {
    expect(dealSchema.safeParse({ title: 'Deal', contact_id: '550e8400-e29b-41d4-a716-446655440000' }).success).toBe(true)
    expect(dealSchema.safeParse({ title: 'Deal', contact_id: 'not-a-uuid' }).success).toBe(false)
  })
})
