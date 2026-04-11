'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Shield, Plus, X, Save, Trash2, CheckCircle2, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ALL_MODULES, ALL_ACTIONS, ROLE_TEMPLATES } from '@/lib/rbac/permissions'
import { getActiveWorkspace } from '@/lib/get-active-workspace'
import { useI18n } from '@/lib/i18n/context'

interface CustomRole {
  id: string; name: string; description: string; color: string;
  is_system: boolean; permissions: Record<string, string[]>; created_at: string;
}

export default function RolesPage() {
  const { t } = useI18n()
  const supabase = createClient()
  const [roles, setRoles] = useState<CustomRole[]>([])
  const [loading, setLoading] = useState(true)
  const [workspaceId, setWorkspaceId] = useState('')
  const [editing, setEditing] = useState<CustomRole | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('#0891B2')
  const [permissions, setPermissions] = useState<Record<string, string[]>>({})

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const ws = await getActiveWorkspace(supabase, user.id, 'id')
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)

    const { data } = await supabase.from('custom_roles').select('*').eq('workspace_id', ws.id).order('name')
    setRoles(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const startEditing = (role: CustomRole) => {
    setEditing(role)
    setName(role.name)
    setDescription(role.description || '')
    setColor(role.color || '#0891B2')
    setPermissions(role.permissions || {})
    setShowNew(true)
  }

  const loadTemplate = (templateKey: string) => {
    const template = ROLE_TEMPLATES[templateKey]
    if (template) {
      setName(template.label)
      setDescription(template.description)
      setPermissions({ ...template.permissions })
    }
  }

  const togglePermission = (module: string, action: string) => {
    setPermissions(prev => {
      const current = prev[module] || []
      if (current.includes(action)) {
        const updated = current.filter(a => a !== action)
        if (updated.length === 0) { const { [module]: _, ...rest } = prev; return rest }
        return { ...prev, [module]: updated }
      }
      return { ...prev, [module]: [...current, action] }
    })
  }

  const toggleAllForModule = (module: string) => {
    setPermissions(prev => {
      const current = prev[module] || []
      if (current.length === ALL_ACTIONS.length) {
        const { [module]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [module]: ALL_ACTIONS.map(a => a.key) }
    })
  }

  const saveRole = async () => {
    if (!name) return
    setSaving(true)

    if (editing) {
      await supabase.from('custom_roles').update({ name, description, color, permissions }).eq('id', editing.id)
    } else {
      await supabase.from('custom_roles').insert({ workspace_id: workspaceId, name, description, color, permissions })
    }

    setShowNew(false); setEditing(null); setSaving(false)
    setName(''); setDescription(''); setPermissions({})
    load()
  }

  const deleteRole = async (id: string) => {
    if (!confirm('Delete this role? Users with this role will lose their permissions.')) return
    await supabase.from('custom_roles').delete().eq('id', id)
    load()
  }

  const seedDefaultRoles = async () => {
    for (const [key, template] of Object.entries(ROLE_TEMPLATES)) {
      await supabase.from('custom_roles').upsert({
        workspace_id: workspaceId, name: template.label, description: template.description,
        permissions: template.permissions, is_system: true, color: key === 'admin' ? '#0891B2' : key === 'sales' ? '#10b981' : key === 'accountant' ? '#8b5cf6' : key === 'warehouse' ? '#f59e0b' : key === 'hr_manager' ? '#ec4899' : '#64748b',
      }, { onConflict: 'workspace_id,name' })
    }
    load()
  }

  const COLORS = ['#0891B2','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#64748b']

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">{t('pages.roles')}</h1><p className="text-sm text-surface-500 mt-0.5">{roles.length} roles configured</p></div>
        <div className="flex gap-2">
          {roles.length === 0 && <button onClick={seedDefaultRoles} className="btn-secondary btn-sm"><Copy className="w-3.5 h-3.5" /> Load Defaults</button>}
          <button onClick={() => { setEditing(null); setName(''); setDescription(''); setPermissions({}); setShowNew(true) }} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> {t('action.new')} Role</button>
        </div>
      </div>

      {/* Roles list */}
      {roles.length === 0 ? (
        <div className="card text-center py-16">
          <Shield className="w-10 h-10 text-surface-300 mx-auto mb-3" />
          <p className="text-surface-600 font-medium mb-1">No roles configured</p>
          <p className="text-xs text-surface-400 mb-4">Click "Load Defaults" to create standard roles, or create custom ones</p>
          <button onClick={seedDefaultRoles} className="btn-primary btn-sm"><Copy className="w-3.5 h-3.5" /> Load Default Roles</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {roles.map(role => {
            const moduleCount = Object.keys(role.permissions || {}).length
            const actionCount = Object.values(role.permissions || {}).flat().length
            return (
              <div key={role.id} className="card p-5 hover:shadow-card-hover transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: role.color }}>{role.name.charAt(0)}</div>
                    <div>
                      <h3 className="text-sm font-bold text-surface-900">{role.name}</h3>
                      <p className="text-[10px] text-surface-400">{role.description}</p>
                    </div>
                  </div>
                  {!role.is_system && <button onClick={() => deleteRole(role.id)} className="text-surface-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>}
                </div>

                <div className="flex items-center gap-3 mb-3 text-[10px] text-surface-500">
                  <span>{moduleCount} modules</span>
                  <span>{actionCount} permissions</span>
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {Object.keys(role.permissions || {}).map(mod => {
                    const info = ALL_MODULES.find(m => m.key === mod)
                    return info ? (
                      <span key={mod} className="text-[9px] px-1.5 py-0.5 bg-surface-100 rounded-md font-medium text-surface-600">{info.icon} {info.label}</span>
                    ) : null
                  })}
                </div>

                <button onClick={() => startEditing(role)} className="btn-secondary btn-sm w-full text-xs">Edit Permissions</button>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit/Create Modal */}
      {showNew && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100 flex-shrink-0">
              <h2 className="font-semibold text-surface-900">{editing ? 'Edit Role' : 'New Role'}</h2>
              <button onClick={() => { setShowNew(false); setEditing(null) }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto flex-1">
              {/* Role info */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="label">Role Name *</label>
                  <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sales Manager" />
                </div>
                <div>
                  <label className="label">Color</label>
                  <div className="flex gap-1.5">
                    {COLORS.map(c => (
                      <button key={c} onClick={() => setColor(c)} className={cn('w-7 h-7 rounded-lg transition-all', color === c && 'ring-2 ring-offset-2 ring-brand-500')} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="label">Description</label>
                <input className="input" value={description} onChange={e => setDescription(e.target.value)} placeholder="What can this role do?" />
              </div>

              {/* Template shortcuts */}
              {!editing && (
                <div>
                  <label className="label">Start from template</label>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(ROLE_TEMPLATES).map(([key, tmpl]) => (
                      <button key={key} onClick={() => loadTemplate(key)} className="btn-ghost btn-sm text-[10px] border border-surface-200">{tmpl.label}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Permission matrix */}
              <div>
                <label className="label">Permissions</label>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-surface-200">
                        <th className="text-left py-2 px-3 font-semibold text-surface-500 w-48">Module</th>
                        {ALL_ACTIONS.map(a => (
                          <th key={a.key} className="text-center py-2 px-2 font-semibold text-surface-500 w-16">{a.label}</th>
                        ))}
                        <th className="text-center py-2 px-2 font-semibold text-surface-500 w-12">All</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ALL_MODULES.map(mod => {
                        const modPerms = permissions[mod.key] || []
                        const allChecked = modPerms.length === ALL_ACTIONS.length
                        return (
                          <tr key={mod.key} className="border-b border-surface-50 hover:bg-surface-50">
                            <td className="py-2 px-3 font-medium text-surface-700">
                              <span className="mr-1.5">{mod.icon}</span>{mod.label}
                            </td>
                            {ALL_ACTIONS.map(action => (
                              <td key={action.key} className="text-center py-2 px-2">
                                <input type="checkbox" className="w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                                  checked={modPerms.includes(action.key)}
                                  onChange={() => togglePermission(mod.key, action.key)} />
                              </td>
                            ))}
                            <td className="text-center py-2 px-2">
                              <input type="checkbox" className="w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                                checked={allChecked}
                                onChange={() => toggleAllForModule(mod.key)} />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex gap-2 p-5 border-t border-surface-100 flex-shrink-0">
              <button onClick={() => { setShowNew(false); setEditing(null) }} className="btn-secondary flex-1">Cancel</button>
              <button onClick={saveRole} disabled={!name || saving} className="btn-primary flex-1">
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                {editing ? 'Update Role' : 'Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
