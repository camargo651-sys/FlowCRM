'use client'
import { toast } from 'sonner'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, GripVertical, Save, X, Type, Hash, Calendar, ToggleLeft, List, Link2, DollarSign, Eye, EyeOff, ChevronDown, Mail, Phone, Building2, Briefcase, Globe, MapPin, Tag, StickyNote, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getActiveWorkspace } from '@/lib/get-active-workspace'

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

const BUILTIN_FIELDS: Record<string, { label: string; icon: typeof Type; sample: string }[]> = {
  contact: [
    { label: 'Email', icon: Mail, sample: 'maria@company.com' },
    { label: 'Phone', icon: Phone, sample: '+573001234567' },
    { label: 'Company', icon: Building2, sample: 'Acme Corp' },
    { label: 'Job Title', icon: Briefcase, sample: 'Marketing Director' },
    { label: 'Website', icon: Globe, sample: 'https://company.com' },
    { label: 'Address', icon: MapPin, sample: 'Cra 7 #32-16, Bogotá' },
    { label: 'Tags', icon: Tag, sample: 'VIP, Enterprise' },
    { label: 'Notes', icon: StickyNote, sample: '' },
  ],
  deal: [
    { label: 'Title', icon: Type, sample: 'Enterprise License Q2' },
    { label: 'Value', icon: DollarSign, sample: '$45,000' },
    { label: 'Stage', icon: List, sample: 'Negotiation' },
    { label: 'Contact', icon: User, sample: 'María García' },
    { label: 'Close Date', icon: Calendar, sample: '2026-06-15' },
    { label: 'Probability', icon: Hash, sample: '75%' },
    { label: 'Notes', icon: StickyNote, sample: '' },
  ],
  company: [
    { label: 'Name', icon: Building2, sample: 'Acme Corp' },
    { label: 'Industry', icon: Briefcase, sample: 'Technology' },
    { label: 'Website', icon: Globe, sample: 'https://acme.com' },
    { label: 'Phone', icon: Phone, sample: '+573001234567' },
    { label: 'Address', icon: MapPin, sample: 'Cra 7 #32-16, Bogotá' },
    { label: 'Tags', icon: Tag, sample: 'Enterprise' },
    { label: 'Notes', icon: StickyNote, sample: '' },
  ],
  product: [
    { label: 'Name', icon: Type, sample: 'Pro Plan' },
    { label: 'Price', icon: DollarSign, sample: '$99/mo' },
    { label: 'SKU', icon: Hash, sample: 'PRO-001' },
    { label: 'Description', icon: StickyNote, sample: '' },
  ],
  ticket: [
    { label: 'Subject', icon: Type, sample: 'Login issue' },
    { label: 'Status', icon: List, sample: 'Open' },
    { label: 'Priority', icon: Tag, sample: 'High' },
    { label: 'Assignee', icon: User, sample: 'Carlos Ruiz' },
    { label: 'Notes', icon: StickyNote, sample: '' },
  ],
}

const ENTITY_SAMPLE_NAMES: Record<string, { name: string; badge: string }> = {
  contact: { name: 'María García', badge: 'Customer' },
  deal: { name: 'Enterprise License Q2', badge: 'Negotiation' },
  company: { name: 'Acme Corp', badge: 'Active' },
  product: { name: 'Pro Plan', badge: 'Active' },
  ticket: { name: 'Login issue', badge: 'Open' },
}

function PreviewFieldInput({ type, options, label }: { type: string; options: string[] | null; label: string }) {
  switch (type) {
    case 'boolean':
      return (
        <div className="flex items-center gap-2">
          <div className="w-8 h-[18px] bg-surface-200 rounded-full relative">
            <div className="w-3.5 h-3.5 bg-white rounded-full absolute left-0.5 top-0.5 shadow-sm" />
          </div>
          <span className="text-[10px] text-surface-400">No</span>
        </div>
      )
    case 'select':
      return (
        <div className="relative">
          <div className="w-full h-7 border border-surface-200 rounded-md bg-surface-50 flex items-center justify-between px-2">
            <span className="text-[10px] text-surface-400">Select...</span>
            <ChevronDown className="w-3 h-3 text-surface-300" />
          </div>
          {options && options.length > 0 && (
            <p className="text-[9px] text-surface-300 mt-0.5">{options.join(', ')}</p>
          )}
        </div>
      )
    case 'currency':
      return (
        <div className="w-full h-7 border border-surface-200 rounded-md bg-surface-50 flex items-center px-2 gap-1">
          <span className="text-[10px] text-surface-400 font-medium">$</span>
          <span className="text-[10px] text-surface-300">0.00</span>
        </div>
      )
    case 'number':
      return (
        <div className="w-full h-7 border border-surface-200 rounded-md bg-surface-50 flex items-center px-2">
          <span className="text-[10px] text-surface-300">0</span>
        </div>
      )
    case 'date':
      return (
        <div className="w-full h-7 border border-surface-200 rounded-md bg-surface-50 flex items-center px-2 gap-1.5">
          <Calendar className="w-3 h-3 text-surface-300" />
          <span className="text-[10px] text-surface-300">yyyy-mm-dd</span>
        </div>
      )
    case 'url':
      return (
        <div className="w-full h-7 border border-surface-200 rounded-md bg-surface-50 flex items-center px-2 gap-1.5">
          <Link2 className="w-3 h-3 text-surface-300" />
          <span className="text-[10px] text-surface-300">https://</span>
        </div>
      )
    default:
      return (
        <div className="w-full h-7 border border-surface-200 rounded-md bg-surface-50 flex items-center px-2">
          <span className="text-[10px] text-surface-300">Enter {label.toLowerCase()}...</span>
        </div>
      )
  }
}

function LivePreviewPanel({ entity, customFields }: { entity: string; customFields: FieldDef[] }) {
  const builtinFields = BUILTIN_FIELDS[entity] || BUILTIN_FIELDS.contact
  const sample = ENTITY_SAMPLE_NAMES[entity] || ENTITY_SAMPLE_NAMES.contact
  const isContact = entity === 'contact'
  const isDeal = entity === 'deal'

  const customSections = Array.from(new Set(customFields.map(f => f.section || 'Custom')))

  return (
    <div className="bg-white rounded-2xl shadow-card border border-surface-100 overflow-hidden">
      {/* Preview header */}
      <div className="px-4 py-3 bg-surface-50 border-b border-surface-100">
        <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Live Preview</p>
      </div>

      {/* Entity header */}
      <div className="p-4 border-b border-surface-100">
        <div className="flex items-center gap-3">
          {isContact ? (
            <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
              MG
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center flex-shrink-0">
              {isDeal ? <DollarSign className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-surface-900 truncate">{sample.name}</p>
            <span className="inline-block text-[9px] px-1.5 py-0.5 bg-brand-50 text-brand-600 rounded font-medium mt-0.5">
              {sample.badge}
            </span>
          </div>
        </div>
      </div>

      {/* Built-in fields */}
      <div className="p-4 border-b border-surface-100">
        <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-3">Built-in Fields</p>
        <div className="space-y-2.5">
          {builtinFields.map(field => (
            <div key={field.label} className="opacity-60">
              <div className="flex items-center gap-1.5 mb-0.5">
                <field.icon className="w-3 h-3 text-surface-400" />
                <label className="text-[10px] font-medium text-surface-500">{field.label}</label>
              </div>
              {field.sample ? (
                <div className="w-full h-7 border border-surface-200 rounded-md bg-surface-50 flex items-center px-2">
                  <span className="text-[10px] text-surface-500">{field.sample}</span>
                </div>
              ) : (
                <div className="w-full h-16 border border-surface-200 rounded-md bg-surface-50 flex items-start p-2">
                  <span className="text-[10px] text-surface-300">Add notes...</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Custom fields */}
      {customFields.length > 0 && (
        <div className="p-4">
          {customSections.map(section => {
            const sectionFields = customFields.filter(f => (f.section || 'Custom') === section)
            if (sectionFields.length === 0) return null
            return (
              <div key={section} className="mb-4 last:mb-0">
                <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-3">
                  {section === 'General' ? 'Custom Fields' : section}
                </p>
                <div className="space-y-2.5">
                  {sectionFields.map(field => (
                    <div key={field.id} className="animate-fade-in">
                      <div className="flex items-center gap-1 mb-0.5">
                        <label className="text-[10px] font-medium text-surface-700">{field.label}</label>
                        {field.required && <span className="text-red-500 text-[10px]">*</span>}
                      </div>
                      <PreviewFieldInput type={field.type} options={field.options} label={field.label} />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Empty custom fields state */}
      {customFields.length === 0 && (
        <div className="p-4 text-center">
          <p className="text-[10px] text-surface-300 italic">No custom fields yet</p>
        </div>
      )}
    </div>
  )
}

export default function FormBuilderPage() {
  const supabase = createClient()
  const [fields, setFields] = useState<FieldDef[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [entity, setEntity] = useState('contact')
  const [workspaceId, setWorkspaceId] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [newField, setNewField] = useState({ label: '', type: 'text', section: 'General', required: false, options: '' })
  const [showPreview, setShowPreview] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const ws = await getActiveWorkspace(supabase, user.id, 'id')
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
    <div className="animate-fade-in max-w-7xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">Form Builder</h1>
          <p className="text-sm text-surface-500 mt-0.5">Customize the fields on your entity forms</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Mobile preview toggle */}
          <button
            onClick={() => setShowPreview(p => !p)}
            className="btn-secondary btn-sm lg:hidden"
          >
            {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
          <button onClick={() => setShowNew(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> Add Field</button>
        </div>
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

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left panel — field list (60%) */}
        <div className="w-full lg:w-[60%]">
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
        </div>

        {/* Right panel — live preview (40%) */}
        <div className={cn(
          'w-full lg:w-[40%]',
          'lg:block',
          showPreview ? 'block' : 'hidden'
        )}>
          <div className="sticky top-4">
            <LivePreviewPanel entity={entity} customFields={entityFields} />
          </div>
        </div>
      </div>

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
