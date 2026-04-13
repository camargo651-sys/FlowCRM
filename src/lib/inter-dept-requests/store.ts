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

const STORAGE_KEY = 'tracktio_inter_dept_requests'

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

export function loadRequests(): InterDeptRequest[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as InterDeptRequest[]
  } catch {
    return []
  }
}

export function saveRequests(list: InterDeptRequest[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export function updateRequest(id: string, patch: Partial<InterDeptRequest>) {
  const list = loadRequests()
  const idx = list.findIndex(r => r.id === id)
  if (idx === -1) return null
  list[idx] = { ...list[idx], ...patch, updated_at: new Date().toISOString() }
  saveRequests(list)
  return list[idx]
}
