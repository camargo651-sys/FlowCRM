import { NextRequest } from 'next/server'
import { authenticateRequest, apiSuccess, apiError } from '@/lib/api/auth'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateRequest(request)
  if (auth instanceof Response) return auth
  const { data, error } = await auth.supabase
    .from('subscriptions')
    .select('*, contacts(id, name, email)')
    .eq('id', params.id)
    .eq('workspace_id', auth.workspaceId)
    .single()
  if (error || !data) return apiError('Not found', 404)
  return apiSuccess(data)
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateRequest(request)
  if (auth instanceof Response) return auth
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return apiError('Invalid JSON', 400) }
  delete body.id
  delete body.workspace_id
  const { data, error } = await auth.supabase
    .from('subscriptions')
    .update(body)
    .eq('id', params.id)
    .eq('workspace_id', auth.workspaceId)
    .select()
    .single()
  if (error) return apiError(error.message, 400)
  return apiSuccess(data)
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateRequest(request)
  if (auth instanceof Response) return auth
  const { error } = await auth.supabase
    .from('subscriptions')
    .delete()
    .eq('id', params.id)
    .eq('workspace_id', auth.workspaceId)
  if (error) return apiError(error.message, 400)
  return apiSuccess({ deleted: true })
}
