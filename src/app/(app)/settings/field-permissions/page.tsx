'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Save, Shield } from 'lucide-react'
import {
  ALL_FIELD_ACCESS,
  ALL_FIELD_ENTITIES,
  DEFAULT_FIELD_PERMISSIONS,
  loadFieldPermissionsAsync,
  saveFieldPermissionsAsync,
  type FieldAccess,
  type FieldEntity,
  type FieldPermission,
} from '@/lib/rbac/field-permissions'
import { getAllRoles } from '@/lib/rbac/permissions'

export default function FieldPermissionsPage() {
  const [rows, setRows] = useState<FieldPermission[]>([])
  const [loaded, setLoaded] = useState(false)
  const roles = getAllRoles()

  useEffect(() => {
    loadFieldPermissionsAsync().then(r => {
      setRows(r)
      setLoaded(true)
    })
  }, [])

  const update = (i: number, patch: Partial<FieldPermission>) => {
    setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  const addRow = () => {
    setRows(rs => [
      ...rs,
      { role: roles[0]?.key || 'viewer', entity: 'contact', field: '', access: 'hidden' },
    ])
  }

  const remove = (i: number) => setRows(rs => rs.filter((_, idx) => idx !== i))

  const save = async () => {
    const clean = rows.filter(r => r.field.trim().length > 0)
    const ok = await saveFieldPermissionsAsync(clean)
    setRows(clean)
    if (ok) toast.success(`Saved ${clean.length} field permission rule${clean.length === 1 ? '' : 's'}`)
    else toast.error('Failed to save field permissions')
  }

  const resetDefaults = async () => {
    setRows(DEFAULT_FIELD_PERMISSIONS)
    const ok = await saveFieldPermissionsAsync(DEFAULT_FIELD_PERMISSIONS)
    if (ok) toast.success('Restored defaults')
    else toast.error('Failed to restore defaults')
  }

  if (!loaded) return <div className="p-6 text-sm text-surface-500">Loading…</div>

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900">Field Permissions</h1>
            <p className="text-sm text-surface-500">
              Control which roles can see or edit specific fields on each entity.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetDefaults}
            className="px-3 py-2 text-sm rounded-lg border border-surface-200 hover:bg-surface-50"
          >
            Reset defaults
          </button>
          <button
            onClick={save}
            className="px-3 py-2 text-sm rounded-lg bg-brand-500 text-white hover:bg-brand-600 flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Save
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-surface-200 overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-surface-50 text-surface-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-left px-4 py-3">Entity</th>
              <th className="text-left px-4 py-3">Field</th>
              <th className="text-left px-4 py-3">Access</th>
              <th className="w-10 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-surface-400">
                  No rules. Click &ldquo;Add rule&rdquo; to start restricting fields.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-surface-100">
                <td className="px-4 py-2">
                  <select
                    value={r.role}
                    onChange={e => update(i, { role: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm rounded-md border border-surface-200 bg-white"
                  >
                    {roles.map(role => (
                      <option key={role.key} value={role.key}>{role.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <select
                    value={r.entity}
                    onChange={e => update(i, { entity: e.target.value as FieldEntity })}
                    className="w-full px-2 py-1.5 text-sm rounded-md border border-surface-200 bg-white"
                  >
                    {ALL_FIELD_ENTITIES.map(ent => (
                      <option key={ent.key} value={ent.key}>{ent.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <input
                    value={r.field}
                    onChange={e => update(i, { field: e.target.value })}
                    placeholder="e.g. salary, email, amount"
                    className="w-full px-2 py-1.5 text-sm rounded-md border border-surface-200"
                  />
                </td>
                <td className="px-4 py-2">
                  <select
                    value={r.access}
                    onChange={e => update(i, { access: e.target.value as FieldAccess })}
                    className="w-full px-2 py-1.5 text-sm rounded-md border border-surface-200 bg-white"
                  >
                    {ALL_FIELD_ACCESS.map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2 text-right">
                  <button
                    onClick={() => remove(i)}
                    className="p-1.5 rounded-md text-surface-400 hover:text-red-500 hover:bg-red-50"
                    aria-label="Delete rule"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-surface-100 p-3">
          <button
            onClick={addRow}
            className="px-3 py-1.5 text-sm rounded-md border border-dashed border-surface-300 text-surface-600 hover:border-brand-400 hover:text-brand-600 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add rule
          </button>
        </div>
      </div>

      <p className="mt-4 text-xs text-surface-400">
        Rules persist to <code className="px-1 py-0.5 rounded bg-surface-100">localStorage</code>{' '}
        under <code className="px-1 py-0.5 rounded bg-surface-100">tracktio_field_permissions</code>.
        Database migration stub available at{' '}
        <code className="px-1 py-0.5 rounded bg-surface-100">supabase/migrations/</code>.
      </p>
    </div>
  )
}
