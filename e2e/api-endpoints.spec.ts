import { test, expect } from '@playwright/test'

test.describe('API v1 Endpoints - Auth Required', () => {
  const endpoints = [
    '/api/v1/contacts', '/api/v1/deals', '/api/v1/products',
    '/api/v1/invoices', '/api/v1/payments', '/api/v1/quotes',
    '/api/v1/purchase-orders', '/api/v1/suppliers',
    '/api/v1/accounts', '/api/v1/journal-entries',
    '/api/v1/employees', '/api/v1/departments',
    '/api/v1/leave-requests', '/api/v1/payroll',
    '/api/v1/api-keys', '/api/v1/recurring-invoices',
    '/api/v1/bom', '/api/v1/work-orders', '/api/v1/approvals',
  ]

  for (const ep of endpoints) {
    test(`${ep} returns 401 without auth`, async ({ request }) => {
      const res = await request.get(ep)
      expect(res.status()).toBe(401)
    })
  }
})

test.describe('API - Other Endpoints', () => {
  test('POST /api/ai/insights returns 401 without auth', async ({ request }) => {
    const res = await request.post('/api/ai/insights')
    expect(res.status()).toBe(401)
  })

  test('POST /api/email-send returns 401 without auth', async ({ request }) => {
    const res = await request.post('/api/email-send')
    expect(res.status()).toBe(401)
  })

  test('GET /api/export returns 401 without auth', async ({ request }) => {
    const res = await request.get('/api/export?type=contacts')
    expect(res.status()).toBe(401)
  })

  test('GET /api/reports returns 401 without auth', async ({ request }) => {
    const res = await request.get('/api/reports?type=pnl')
    expect(res.status()).toBe(401)
  })

  test('POST /api/quotes/track returns 503 without service key', async ({ request }) => {
    const res = await request.post('/api/quotes/track', { data: { token: 'test' } })
    expect(res.status()).toBe(503)
  })
})

test.describe('Webhooks - No Auth Required', () => {
  test('POST /api/webhooks/whatsapp accepts without auth', async ({ request }) => {
    const res = await request.post('/api/webhooks/whatsapp', { data: {} })
    expect(res.status()).toBe(200)
  })

  test('POST /api/webhooks/calls returns 503 without service key', async ({ request }) => {
    const res = await request.post('/api/webhooks/calls', { data: {} })
    expect(res.status()).toBe(503)
  })

  test('GET /api/store returns error without slug', async ({ request }) => {
    const res = await request.get('/api/store')
    expect([400, 503]).toContain(res.status())
  })

  test('GET /api/store returns 503 or 404 for invalid slug', async ({ request }) => {
    const res = await request.get('/api/store?slug=nonexistent')
    expect([404, 503]).toContain(res.status())
  })
})
