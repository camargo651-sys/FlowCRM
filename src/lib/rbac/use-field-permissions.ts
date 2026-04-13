'use client'
import { useEffect, useMemo, useState } from 'react'
import { useWorkspace } from '@/lib/workspace-context'
import {
  filterFields as filterFieldsPure,
  getFieldAccess,
  loadFieldPermissions,
  type FieldEntity,
  type FieldPermission,
} from './field-permissions'

/**
 * React hook that returns helpers to check/filter field visibility for
 * the current user's role. Role is resolved via workspace-context — if
 * the context does not yet expose a `role`, we fall back to localStorage
 * (`tracktio_current_role`) and finally to `admin`.
 */
export function useFieldPermissions() {
  const ws = useWorkspace() as unknown as { role?: string }
  const [perms, setPerms] = useState<FieldPermission[]>(() => loadFieldPermissions())
  const [role, setRole] = useState<string>('admin')

  useEffect(() => {
    setPerms(loadFieldPermissions())
    const fromCtx = ws?.role
    if (fromCtx) { setRole(fromCtx); return }
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('tracktio_current_role')
      if (stored) { setRole(stored); return }
    }
    setRole('admin')
  }, [ws?.role])

  return useMemo(() => ({
    role,
    canSee: (entity: FieldEntity, field: string) =>
      getFieldAccess(role, entity, field, perms) !== 'hidden',
    canEdit: (entity: FieldEntity, field: string) =>
      getFieldAccess(role, entity, field, perms) === 'editable',
    access: (entity: FieldEntity, field: string) =>
      getFieldAccess(role, entity, field, perms),
    filter: <T extends string>(entity: FieldEntity, fields: T[]) =>
      filterFieldsPure(role, entity, fields, perms),
  }), [role, perms])
}
