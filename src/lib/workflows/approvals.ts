import { SupabaseClient } from '@supabase/supabase-js'

type EntityType = 'invoice' | 'purchase_order' | 'leave_request' | 'expense' | 'quote' | 'payment'

/**
 * Request approval for an entity.
 */
export async function requestApproval(
  supabase: SupabaseClient,
  params: {
    workspaceId: string
    entityType: EntityType
    entityId: string
    entityName: string
    requestedBy: string
    assignedTo?: string
    amount?: number
    notes?: string
  },
) {
  // If no specific approver, find workspace owner (admin)
  let assignedTo = params.assignedTo
  if (!assignedTo) {
    const { data: ws } = await supabase.from('workspaces').select('owner_id').eq('id', params.workspaceId).single()
    assignedTo = ws?.owner_id
  }

  const { data } = await supabase.from('approval_requests').insert({
    workspace_id: params.workspaceId,
    entity_type: params.entityType,
    entity_id: params.entityId,
    entity_name: params.entityName,
    requested_by: params.requestedBy,
    assigned_to: assignedTo,
    amount: params.amount,
    notes: params.notes,
  }).select().single()

  // Create notification for approver
  if (assignedTo) {
    await supabase.from('notifications').insert({
      workspace_id: params.workspaceId,
      user_id: assignedTo,
      type: 'system',
      title: `Approval needed: ${params.entityName}`,
      body: `${params.entityType} requires your approval${params.amount ? ` — $${params.amount.toLocaleString()}` : ''}`,
      priority: (params.amount || 0) > 10000 ? 'high' : 'medium',
      action_url: `/${params.entityType.replace('_', '-')}s`,
      metadata: { approval_id: data?.id, entity_type: params.entityType, entity_id: params.entityId },
    })
  }

  return data
}

/**
 * Approve or reject a request.
 */
export async function decideApproval(
  supabase: SupabaseClient,
  params: {
    approvalId: string
    decision: 'approved' | 'rejected'
    decidedBy: string
    notes?: string
  },
) {
  const { data: approval } = await supabase
    .from('approval_requests')
    .update({
      status: params.decision,
      decided_at: new Date().toISOString(),
      decided_by: params.decidedBy,
      decision_notes: params.notes,
    })
    .eq('id', params.approvalId)
    .select()
    .single()

  if (!approval) return null

  // Update the entity status based on decision
  if (params.decision === 'approved') {
    switch (approval.entity_type) {
      case 'purchase_order':
        await supabase.from('purchase_orders').update({ status: 'confirmed' }).eq('id', approval.entity_id)
        break
      case 'leave_request':
        await supabase.from('leave_requests').update({ status: 'approved', approved_by: params.decidedBy }).eq('id', approval.entity_id)
        break
      case 'expense':
        await supabase.from('expense_reports').update({ status: 'approved', approved_by: params.decidedBy, approved_at: new Date().toISOString() }).eq('id', approval.entity_id)
        break
      case 'invoice':
        await supabase.from('invoices').update({ status: 'sent' }).eq('id', approval.entity_id)
        break
      case 'quote':
        await supabase.from('quotes').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', approval.entity_id)
        break
    }
  } else {
    switch (approval.entity_type) {
      case 'leave_request':
        await supabase.from('leave_requests').update({ status: 'rejected' }).eq('id', approval.entity_id)
        break
      case 'expense':
        await supabase.from('expense_reports').update({ status: 'rejected' }).eq('id', approval.entity_id)
        break
    }
  }

  // Notify requester
  await supabase.from('notifications').insert({
    workspace_id: approval.workspace_id,
    user_id: approval.requested_by,
    type: 'system',
    title: `${approval.entity_name} ${params.decision}`,
    body: params.notes || `Your ${approval.entity_type.replace('_', ' ')} has been ${params.decision}.`,
    priority: params.decision === 'rejected' ? 'high' : 'medium',
  })

  return approval
}
