'use client'
import { toast } from 'sonner'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, GripVertical, Save, X, Type, Hash, Calendar, ToggleLeft, List, Link2, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FieldDef {
  id: string
  entity: string
  label: string
  key: string
  type: string
  options: string[] | null
  required: boolean
  order_index: number
  section: string
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text', icon: Type },
  { value: 'number', label: 'Number', icon: Hash },
  { value: 'currency', label: 'Currency', icon: DollarSign },
  { value: 'date', label: 'Date', icon: Calendar },
  { value: 'boolean', label: 'Yes/No', icon: ToggleLeft },
  { value: 'select', label: 'Dropdown', icon: List },
  { value: 'url', label: 'URL', icon: Link2 },
]

const ENTITIES = [
  { value: 'contact', label: 'Contacts' },
  { value: 'deal', label: 'Deals' },
  { value: 'company', label: 'Companies' },
  { value: 'product', label: 'Products' },
  { value: 'ticket', label: 'Tickets' },
]

const SECTIONS = ['General', 'Details', 'Financial', 'Technical', 'Custom']

export default function FormBuilderPage() {
  const supabase = createClient()
  const [fields, setFields] = useState<FieldDef[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [entity, setEntity] = useState('contact')
  const [workspaceId, setWorkspaceId] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [newField, setNewField] = useState({ label: '', type: 'text', section: 'General', required: false, options: '' })

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)

    const { data } = await supabase.from('custom_field_defs')
      .select('*')
      .eq('workspace_id', ws.id)
      .order('order_index')
    setFields(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const entityFields = fields.filter(f => f.entity === entity)
  const sections = Array.from(new Set(entityFields.map(f => (f as { section?: string }).section || 'General')))

  const addField = async () => {
    if (!newField.label) return
    const key = newField.label.toLowerCase().replace(/[^a-z0-9]/g, '_')
    await supabase.from('custom_field_defs').insert({
      workspace_id: workspaceId,
      entity,
      label: newField.label,
      key,
      type: newField.type,
      options: newField.type === 'select' ? newField.options.split(',').map(o => o.trim()).filter(Boolean) : null,
      required: newField.required,
      order_index: entityFields.length,
    })
    setNewField({ label: '', type: 'text', section: 'General', required: false, options: '' })
    setShowNew(false)
    toast.success('Field added')
    load()
  }

  const deleteField = async (id: string) => {
    if (!confirm('Delete this field? Data in this field will be lost.')) return
    await supabase.from('custom_field_defs').delete().eq('id', id)
    toast.success('Field deleted')
    load()
  }

  const toggleRequired = async (id: string, current: boolean) => {
    await supabase.from('custom_field_defs').update({ required: !current }).eq('id', id)
    setFields(prev => prev.map(f => f.id === id ? { ...f, required: !current } : f))
  }

  const moveField = async (id: string, direction: number) => {
    const idx = entityFields.findIndex(f => f.id === id)
    if (idx < 0) return
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= entityFields.length) return

    const updates = [
      { id: entityFields[idx].id, order_index: newIdx },
      { id: entityFields[newIdx].id, order_index: idx },
    ]
    for (const u of updates) {
      await supabase.from('custom_field_defs').update({ order_index: u.order_index }).eq('id', u.id)
    }
    load()
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in max-w-4xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">Form Builder</h1>
          <p className="text-sm text-surface-500 mt-0.5">Customize the fields on your entity forms</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> Add Field</button>
      </div>

      {/* Entity selector */}
      <div className="segmented-control mb-8">
        {ENTITIES.map(e => (
          <button key={e.value} onClick={() => setEntity(e.value)}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all',
              entity === e.value ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500 hover:text-surface-700')}>
            {e.label} <span className="text-[10px] ml-1 text-surface-400">({fields.filter(f => f.entity === e.value).length})</span>
          </button>
        ))}
      </div>

      {/* Default fields info */}
      <div className="card p-4 mb-4 bg-surface-50 border-surface-200">
        <p className="text-xs text-surface-500">
          <strong>Built-in fields:</strong> Name, Email, Phone, Company, Tags, Notes — these are always present.
          Below are your <strong>custom fields</strong> that appear in the {entity} form.
        </p>
      </div>

      {/* Fields list */}
      {entityFields.length === 0 ? (
        <div className="card text-center py-12">
          <Type className="w-10 h-10 text-surface-300 mx-auto mb-3" />
          <p className="text-surface-600 font-medium mb-1">No custom fields for {entity}s</p>
          <p className="text-xs text-surface-400 mb-4">Add fields to customize your {entity} forms</p>
          <button onClick={() => setShowNew(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> Add Field</button>
        </div>
      ) : (
        <div className="space-y-1">
          {entityFields.map((field, i) => {
            const TypeIcon = FIELD_TYPES.find(t => t.value === field.type)?.icon || Type
            return (
              <div key={field.id} className="card p-3 flex items-center gap-3 group">
                <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => moveField(field.id, -1)} disabled={i === 0} className="text-surface-300 hover:text-surface-600 disabled:opacity-20">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 15l-6-6-6 6"/></svg>
                  </button>
                  <button onClick={() => moveField(field.id, 1)} disabled={i === entityFields.length - 1} className="text-surface-300 hover:text-surface-600 disabled:opacity-20">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 9l6 6 6-6"/></svg>
                  </button>
                </div>
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                  'bg-surface-100 text-surface-500')}>
                  <TypeIcon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-surface-800">{field.label}</p>
                    <span className="text-[9px] px-1.5 py-0.5 bg-surface-100 rounded text-surface-400 font-mono">{field.key}</span>
                    <span className="text-[9px] px-1.5 py-0.5 bg-brand-50 rounded text-brand-600 font-medium">{field.type}</span>
                    {field.required && <span className="text-[9px] px-1.5 py-0.5 bg-red-50 rounded text-red-600 font-medium">required</span>}
                  </div>
                  {field.options && <p className="text-[10px] text-surface-400 mt-0.5">Options: {field.options.join(', ')}</p>}
                </div>
                <button onClick={() => toggleRequired(field.id, field.required)}
                  className="text-[10px] text-surface-400 hover:text-brand-600">
                  {field.required ? 'Optional' : 'Required'}
                </button>
                <button onClick={() => deleteField(field.id)} className="text-surface-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* New field modal */}
      {showNew && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100">
              <h2 className="font-semibold text-surface-900">New Custom Field</h2>
              <button onClick={() => setShowNew(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="label">Field Label *</label><input className="input" value={newField.label} onChange={e => setNewField(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Industry, Budget, Region" /></div>
              <div><label className="label">Field Type</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {FIELD_TYPES.map(t => (
                    <button key={t.value} onClick={() => setNewField(f => ({ ...f, type: t.value }))}
                      className={cn('p-2 rounded-lg text-center transition-all border-2 text-[10px] font-medium',
                        newField.type === t.value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-surface-100 hover:border-surface-200 text-surface-600')}>
                      <t.icon className="w-4 h-4 mx-auto mb-1" />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              {newField.type === 'select' && (
                <div><label className="label">Options (comma separated)</label><input className="input" value={newField.options} onChange={e => setNewField(f => ({ ...f, options: e.target.value }))} placeholder="Option 1, Option 2, Option 3" /></div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-surface-300 text-brand-600"
                  checked={newField.required} onChange={e => setNewField(f => ({ ...f, required: e.target.checked }))} />
                <span className="text-xs text-surface-600">Required field</span>
              </label>
              <div className="flex gap-2">
                <button onClick={() => setShowNew(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={addField} disabled={!newField.label} className="btn-primary flex-1">Add Field</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
