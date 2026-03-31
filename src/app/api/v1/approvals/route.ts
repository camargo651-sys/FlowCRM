import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, apiSuccess, apiError, apiList, parsePagination } from '@/lib/api/auth'
import { requestApproval, decideApproval } from '@/lib/workflows/approvals'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth instanceof Response) return auth

  const { page, perPage, offset } = parsePagination(request)
  const url = new URL(request.url)
  const status = url.searchParams.get('status')
  const entityType = url.searchParams.get('entity_type')

  let query = auth.supabase.from('approval_requests').select('*', { count: 'exact' }).eq('workspace_id', auth.workspaceId)
  if (status) query = query.eq('status', status)
  if (entityType) query = query.eq('entity_type', entityType)

  const { data, count, error } = await query.order('created_at', { ascending: false }).range(offset, offset + perPage - 1)
  if (error) return apiError(error.message, 500)
  return apiList(data || [], count || 0, page, perPage)
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth instanceof Response) return auth

  const body = await request.json()
  const { action } = body

  // Decide on existing approval
  if (action === 'approve' || action === 'reject') {
    const result = await decideApproval(auth.supabase, {
      approvalId: body.approval_id,
      decision: action === 'approve' ? 'approved' : 'rejected',
      decidedBy: auth.userId,
      notes: body.notes,
    })
    if (!result) return apiError('Approval not found', 404)
    return apiSuccess(result)
  }

  // Create new approval request
  if (!body.entity_type || !body.entity_id) return apiError('Missing entity_type or entity_id', 400)

  const result = await requestApproval(auth.supabase, {
    workspaceId: auth.workspaceId,
    entityType: body.entity_type,
    entityId: body.entity_id,
    entityName: body.entity_name || body.entity_type,
    requestedBy: auth.userId,
    assignedTo: body.assigned_to,
    amount: body.amount,
    notes: body.notes,
  })

  return apiSuccess(result)
}
