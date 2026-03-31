import { SupabaseClient } from '@supabase/supabase-js'

export async function logAudit(
  supabase: SupabaseClient,
  params: {
    workspaceId: string
    userId?: string
    action: string
    entityType: string
    entityId?: string
    entityName?: string
    changes?: Record<string, any>
    ipAddress?: string
  },
) {
  try {
    await supabase.from('audit_log').insert({
      workspace_id: params.workspaceId,
      user_id: params.userId || null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      entity_name: params.entityName || null,
      changes: params.changes || {},
      ip_address: params.ipAddress || null,
    })
  } catch {}
}
