import { NextRequest } from 'next/server'
import { authenticateRequest, apiSuccess, apiError } from '@/lib/api/auth'
import { z } from 'zod'
import crypto from 'crypto'

const createSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  secret: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth instanceof Response) return auth
  const { supabase, workspaceId } = auth

  const { data, error } = await supabase
    .from('integrations')
    .select('id, key, config, created_at')
    .eq('workspace_id', workspaceId)
    .like('key', 'webhook_%')
    .order('created_at', { ascending: false })

  if (error) return apiError(error.message, 500)

  const webhooks = (data || []).map(row => ({
    id: row.id,
    key: row.key,
    url: (row.config as Record<string, unknown>)?.url,
    events: (row.config as Record<string, unknown>)?.events,
    created_at: row.created_at,
  }))

  return apiSuccess(webhooks)
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth instanceof Response) return auth
  const { supabase, workspaceId } = auth

  let body: z.infer<typeof createSchema>
  try {
    body = createSchema.parse(await request.json())
  } catch {
    return apiError('Invalid body: url (string), events (string[]) required', 400)
  }

  const webhookKey = `webhook_${crypto.randomUUID()}`

  const { data, error } = await supabase
    .from('integrations')
    .insert({
      workspace_id: workspaceId,
      key: webhookKey,
      provider: 'webhook',
      config: {
        url: body.url,
        events: body.events,
        secret: body.secret || null,
      },
    })
    .select()
    .single()

  if (error) return apiError(error.message, 500)

  return apiSuccess({
    id: data.id,
    key: data.key,
    url: body.url,
    events: body.events,
    created_at: data.created_at,
  })
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth instanceof Response) return auth
  const { supabase, workspaceId } = auth

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return apiError('id query parameter required', 400)

  const { error } = await supabase
    .from('integrations')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .like('key', 'webhook_%')

  if (error) return apiError(error.message, 500)

  return apiSuccess({ deleted: true })
}
