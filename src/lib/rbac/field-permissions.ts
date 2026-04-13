// ============================================================
// RBAC — Field-level Access Control
// Complements src/lib/rbac/permissions.ts (module/action level)
// ============================================================

export type FieldEntity =
  | 'contact'
  | 'deal'
  | 'invoice'
  | 'lead'
  | 'ticket'
  | 'company'
  | 'employee'

export type FieldAccess = 'hidden' | 'readonly' | 'editable'

export interface FieldPermission {
  role: string
  entity: FieldEntity
  field: string
  access: FieldAccess
}

export const ALL_FIELD_ENTITIES: { key: FieldEntity; label: string }[] = [
  { key: 'contact', label: 'Contact' },
  { key: 'deal', label: 'Deal' },
  { key: 'invoice', label: 'Invoice' },
  { key: 'lead', label: 'Lead' },
  { key: 'ticket', label: 'Ticket' },
  { key: 'company', label: 'Company' },
  { key: 'employee', label: 'Employee' },
]

export const ALL_FIELD_ACCESS: FieldAccess[] = ['hidden', 'readonly', 'editable']

/**
 * Reasonable defaults. Admin-configurable at runtime — persisted in
 * localStorage (stub) and eventually migrated to the `field_permissions` table.
 */
export const DEFAULT_FIELD_PERMISSIONS: FieldPermission[] = [
  // Sales should never see sensitive HR data
  { role: 'sales', entity: 'employee', field: 'salary', access: 'hidden' },
  { role: 'sales', entity: 'employee', field: 'ssn', access: 'hidden' },
  { role: 'sales', entity: 'employee', field: 'bank_account', access: 'hidden' },
  { role: 'sales', entity: 'invoice', field: 'cost', access: 'hidden' },
  { role: 'sales', entity: 'deal', field: 'margin', access: 'readonly' },

  // Warehouse has no business with contact emails/phones
  { role: 'warehouse', entity: 'contact', field: 'email', access: 'hidden' },
  { role: 'warehouse', entity: 'contact', field: 'phone', access: 'hidden' },
  { role: 'warehouse', entity: 'employee', field: 'salary', access: 'hidden' },

  // Accountant sees financials but shouldn't edit CRM narrative fields
  { role: 'accountant', entity: 'deal', field: 'notes', access: 'readonly' },
  { role: 'accountant', entity: 'contact', field: 'notes', access: 'readonly' },

  // HR manager: full employee access, but no sales pipeline editing
  { role: 'hr_manager', entity: 'deal', field: 'amount', access: 'readonly' },

  // Viewer: everything read-only on common sensitive fields
  { role: 'viewer', entity: 'contact', field: 'email', access: 'readonly' },
  { role: 'viewer', entity: 'contact', field: 'phone', access: 'readonly' },
  { role: 'viewer', entity: 'deal', field: 'amount', access: 'readonly' },
  { role: 'viewer', entity: 'invoice', field: 'total', access: 'readonly' },
  { role: 'viewer', entity: 'employee', field: 'salary', access: 'hidden' },
]

const STORAGE_KEY = 'tracktio_field_permissions'

/**
 * Sync loader — returns the last cached set (localStorage) or defaults.
 * Used by synchronous call sites (`getFieldAccess`, `filterFields`).
 */
export function loadFieldPermissions(): FieldPermission[] {
  if (typeof window === 'undefined') return DEFAULT_FIELD_PERMISSIONS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_FIELD_PERMISSIONS
    const parsed = JSON.parse(raw) as FieldPermission[]
    if (!Array.isArray(parsed)) return DEFAULT_FIELD_PERMISSIONS
    return parsed
  } catch {
    return DEFAULT_FIELD_PERMISSIONS
  }
}

/**
 * Async loader — fetches current permissions from the API and caches
 * them in localStorage so the sync loader stays fresh.
 */
export async function loadFieldPermissionsAsync(): Promise<FieldPermission[]> {
  if (typeof window === 'undefined') return DEFAULT_FIELD_PERMISSIONS
  try {
    const res = await fetch('/api/field-permissions', { cache: 'no-store' })
    if (!res.ok) return loadFieldPermissions()
    const data = await res.json()
    const perms = Array.isArray(data?.permissions) ? (data.permissions as FieldPermission[]) : []
    const effective = perms.length > 0 ? perms : DEFAULT_FIELD_PERMISSIONS
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(effective)) } catch {}
    return effective
  } catch {
    return loadFieldPermissions()
  }
}

export function saveFieldPermissions(perms: FieldPermission[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(perms))
}

export async function saveFieldPermissionsAsync(perms: FieldPermission[]): Promise<boolean> {
  if (typeof window === 'undefined') return false
  saveFieldPermissions(perms)
  try {
    const res = await fetch('/api/field-permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissions: perms }),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Resolve the access level for a specific (role, entity, field) tuple.
 * Admin always has full access. Default is `editable` if no rule matches.
 */
export function getFieldAccess(
  role: string | undefined | null,
  entity: FieldEntity,
  field: string,
  perms: FieldPermission[] = loadFieldPermissions(),
): FieldAccess {
  if (!role || role === 'admin') return 'editable'
  const rule = perms.find(p => p.role === role && p.entity === entity && p.field === field)
  return rule?.access ?? 'editable'
}

/**
 * Remove fields the role is not allowed to see.
 * Keeps readonly and editable fields in the list.
 */
export function filterFields<T extends string>(
  role: string | undefined | null,
  entity: FieldEntity,
  fields: T[],
  perms: FieldPermission[] = loadFieldPermissions(),
): T[] {
  return fields.filter(f => getFieldAccess(role, entity, f, perms) !== 'hidden')
}
