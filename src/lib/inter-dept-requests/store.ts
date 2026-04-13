export type IDRStatus = 'draft' | 'submitted' | 'in_review' | 'approved' | 'rejected' | 'completed'
export type IDRPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface InterDeptRequest {
  id: string
  number: number
  title: string
  description?: string
  from_dept: string
  to_dept: string
  priority: IDRPriority
  status: IDRStatus
  requested_by: string
  created_at: string
  updated_at: string
  comments?: { id: string; author: string; text: string; created_at: string }[]
}

export const DEPARTMENTS = [
  'Ventas', 'Marketing', 'Operaciones', 'Finanzas', 'RRHH',
  'TI', 'Legal', 'Compras', 'Producción', 'Logística', 'Soporte',
]

export const STATUS_META: Record<IDRStatus, { label: string; className: string }> = {
  draft:      { label: 'Borrador',     className: 'bg-surface-100 text-surface-700' },
  submitted:  { label: 'Enviada',      className: 'bg-blue-50 text-blue-700' },
  in_review:  { label: 'En revisión',  className: 'bg-amber-50 text-amber-700' },
  approved:   { label: 'Aprobada',     className: 'bg-emerald-50 text-emerald-700' },
  rejected:   { label: 'Rechazada',    className: 'bg-rose-50 text-rose-700' },
  completed:  { label: 'Completada',   className: 'bg-violet-50 text-violet-700' },
}

export const PRIORITY_META: Record<IDRPriority, { label: string; className: string }> = {
  low:    { label: 'Baja',    className: 'bg-surface-100 text-surface-600' },
  normal: { label: 'Normal',  className: 'bg-blue-50 text-blue-700' },
  high:   { label: 'Alta',    className: 'bg-amber-50 text-amber-700' },
  urgent: { label: 'Urgente', className: 'bg-rose-50 text-rose-700' },
}

// ─── Async API-backed helpers ──────────────────────────────
export async function loadRequests(): Promise<InterDeptRequest[]> {
  try {
    const res = await fetch('/api/inter-dept-requests', { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return (data.requests || []) as InterDeptRequest[]
  } catch {
    return []
  }
}

export interface CreateRequestInput {
  title: string
  description?: string
  from_dept: string
  to_dept: string
  priority: IDRPriority
  requested_by?: string
  status?: IDRStatus
}

export async function createRequest(input: CreateRequestInput): Promise<InterDeptRequest | null> {
  try {
    const res = await fetch('/api/inter-dept-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.request as InterDeptRequest
  } catch {
    return null
  }
}

export async function updateRequest(id: string, patch: Partial<InterDeptRequest>): Promise<InterDeptRequest | null> {
  try {
    const res = await fetch(`/api/inter-dept-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.request as InterDeptRequest
  } catch {
    return null
  }
}

export async function loadRequest(id: string): Promise<{ request: InterDeptRequest | null; workspaceId: string; userId: string }> {
  try {
    const res = await fetch(`/api/inter-dept-requests/${id}`, { cache: 'no-store' })
    if (!res.ok) return { request: null, workspaceId: '', userId: '' }
    const data = await res.json()
    return {
      request: data.request as InterDeptRequest,
      workspaceId: data.workspace_id || '',
      userId: data.user_id || '',
    }
  } catch {
    return { request: null, workspaceId: '', userId: '' }
  }
}

export async function addComment(requestId: string, text: string): Promise<{
  comment: { id: string; author: string; text: string; created_at: string } | null
  workspaceId: string
  userId: string
  authorName: string
}> {
  try {
    const res = await fetch(`/api/inter-dept-requests/${requestId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) return { comment: null, workspaceId: '', userId: '', authorName: '' }
    const data = await res.json()
    return {
      comment: data.comment,
      workspaceId: data.workspace_id || '',
      userId: data.user_id || '',
      authorName: data.author_name || '',
    }
  } catch {
    return { comment: null, workspaceId: '', userId: '', authorName: '' }
  }
}

// Deprecated: no-op kept for backwards compat with any caller still using saveRequests.
export function saveRequests(_list: InterDeptRequest[]) {
  // Intentionally empty — persistence is handled via the API helpers above.
}
