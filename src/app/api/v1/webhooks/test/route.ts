import { NextRequest } from 'next/server'
import { authenticateRequest, apiSuccess, apiError } from '@/lib/api/auth'
import { z } from 'zod'

const testSchema = z.object({
  url: z.string().url(),
  secret: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth instanceof Response) return auth
  const { workspaceId } = auth

  let body: z.infer<typeof testSchema>
  try {
    body = testSchema.parse(await request.json())
  } catch {
    return apiError('Invalid body: url (string) required', 400)
  }

  const payload = {
    event: 'test',
    timestamp: new Date().toISOString(),
    workspace_id: workspaceId,
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (body.secret) {
      const crypto = await import('crypto')
      const signature = crypto
        .createHmac('sha256', body.secret)
        .update(JSON.stringify(payload))
        .digest('hex')
      headers['X-Webhook-Signature'] = signature
    }

    const response = await fetch(body.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    })

    return apiSuccess({
      sent: true,
      status: response.status,
      ok: response.ok,
    })
  } catch (err) {
    return apiError(
      `Failed to reach webhook URL: ${err instanceof Error ? err.message : 'Unknown error'}`,
      502,
    )
  }
}
