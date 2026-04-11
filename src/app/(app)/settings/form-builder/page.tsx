'use client'
import { toast } from 'sonner'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, GripVertical, Save, X, Type, Hash, Calendar, ToggleLeft, List, Link2, DollarSign, Eye, EyeOff, ChevronDown, Mail, Phone, Building2, Briefcase, Globe, MapPin, Tag, StickyNote, User, Calculator, Variable, BarChart3, Clock, Filter, Zap, TrendingUp, MessageSquare, FileText, Activity, ShoppingBag, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getActiveWorkspace } from '@/lib/get-active-workspace'
import { useI18n } from '@/lib/i18n/context'
import {
  FormulaConfig,
  SOURCE_NUMERIC_FIELDS,
  SOURCE_STATUS_OPTIONS,
  SOURCE_RELATIONSHIPS,
  TIME_FILTER_OPTIONS,
  AGGREGATION_OPTIONS,
  SOURCE_ENTITY_OPTIONS,
  describeFormula,
  formulaPreviewValue,
} from '@/lib/formula-engine'

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
  { value: 'formula', label: 'Formula', icon: Calculator },
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

// ─── Pre-defined variable definitions ────────────────────────────

interface VariableDef {
  key: string
  label: string
  description: string
  icon: typeof Calculator
  formulaConfig: FormulaConfig
}

const CONTACT_VARIABLES: VariableDef[] = [
  {
    key: 'deals_count', label: 'Number of deals', description: 'Total deals linked to this contact', icon: Briefcase,
    formulaConfig: { type: 'formula', source: 'deals', aggregation: 'count', field: null, time_filter: null, status_filter: null, relationship: 'contact_id' },
  },
  {
    key: 'deals_total_value', label: 'Total deal value', description: 'Sum of all deal values', icon: DollarSign,
    formulaConfig: { type: 'formula', source: 'deals', aggregation: 'sum', field: 'value', time_filter: null, status_filter: null, relationship: 'contact_id' },
  },
  {
    key: 'deals_won_count', label: 'Won deals', description: 'Number of deals marked as won', icon: TrendingUp,
    formulaConfig: { type: 'formula', source: 'deals', aggregation: 'count', field: null, time_filter: null, status_filter: 'won', relationship: 'contact_id' },
  },
  {
    key: 'quotes_count', label: 'Quotes sent', description: 'Total quotes linked to this contact', icon: FileText,
    formulaConfig: { type: 'formula', source: 'quotes', aggregation: 'count', field: null, time_filter: null, status_filter: null, relationship: 'contact_id' },
  },
  {
    key: 'invoices_total', label: 'Total invoiced', description: 'Sum of all invoice totals', icon: DollarSign,
    formulaConfig: { type: 'formula', source: 'invoices', aggregation: 'sum', field: 'total', time_filter: null, status_filter: null, relationship: 'contact_id' },
  },
  {
    key: 'invoices_outstanding', label: 'Outstanding balance', description: 'Sum of unpaid invoice balances', icon: DollarSign,
    formulaConfig: { type: 'formula', source: 'invoices', aggregation: 'sum', field: 'balance_due', time_filter: null, status_filter: null, relationship: 'contact_id' },
  },
  {
    key: 'last_activity_date', label: 'Last interaction', description: 'Date of the most recent activity', icon: Clock,
    formulaConfig: { type: 'formula', source: 'activities', aggregation: 'last', field: 'created_at', time_filter: null, status_filter: null, relationship: 'contact_id' },
  },
  {
    key: 'whatsapp_messages_count', label: 'WhatsApp messages', description: 'Total WhatsApp messages exchanged', icon: MessageSquare,
    formulaConfig: { type: 'formula', source: 'whatsapp_messages', aggregation: 'count', field: null, time_filter: null, status_filter: null, relationship: 'contact_id' },
  },
  {
    key: 'days_since_created', label: 'Days as customer', description: 'Days since contact was created', icon: Calendar,
    formulaConfig: { type: 'formula', source: 'deals', aggregation: 'count', field: null, time_filter: null, status_filter: null, relationship: 'contact_id' },
  },
  {
    key: 'activities_count', label: 'Total activities', description: 'All activities on this contact', icon: Activity,
    formulaConfig: { type: 'formula', source: 'activities', aggregation: 'count', field: null, time_filter: null, status_filter: null, relationship: 'contact_id' },
  },
]

const DEAL_VARIABLES: VariableDef[] = [
  {
    key: 'contact_name', label: 'Contact name', description: 'Name of the linked contact', icon: User,
    formulaConfig: { type: 'formula', source: 'deals', aggregation: 'last', field: 'contact_id', time_filter: null, status_filter: null, relationship: 'id' },
  },
  {
    key: 'contact_email', label: 'Contact email', description: 'Email of the linked contact', icon: Mail,
    formulaConfig: { type: 'formula', source: 'deals', aggregation: 'last', field: 'contact_id', time_filter: null, status_filter: null, relationship: 'id' },
  },
  {
    key: 'contact_phone', label: 'Contact phone', description: 'Phone of the linked contact', icon: Phone,
    formulaConfig: { type: 'formula', source: 'deals', aggregation: 'last', field: 'contact_id', time_filter: null, status_filter: null, relationship: 'id' },
  },
  {
    key: 'days_in_stage', label: 'Days in current stage', description: 'How long this deal has been in its stage', icon: Clock,
    formulaConfig: { type: 'formula', source: 'deals', aggregation: 'last', field: 'updated_at', time_filter: null, status_filter: null, relationship: 'id' },
  },
  {
    key: 'activities_count', label: 'Activities on this deal', description: 'Number of activities linked to this deal', icon: Activity,
    formulaConfig: { type: 'formula', source: 'activities', aggregation: 'count', field: null, time_filter: null, status_filter: null, relationship: 'deal_id' },
  },
  {
    key: 'quotes_count', label: 'Linked quotes', description: 'Quotes associated with this deal', icon: FileText,
    formulaConfig: { type: 'formula', source: 'quotes', aggregation: 'count', field: null, time_filter: null, status_filter: null, relationship: 'deal_id' },
  },
  {
    key: 'invoices_total', label: 'Invoiced amount', description: 'Total invoiced for this deal', icon: DollarSign,
    formulaConfig: { type: 'formula', source: 'invoices', aggregation: 'sum', field: 'total', time_filter: null, status_filter: null, relationship: 'deal_id' },
  },
]

const VARIABLE_MAP: Record<string, VariableDef[]> = {
  contact: CONTACT_VARIABLES,
  deal: DEAL_VARIABLES,
}

// ─── Formula builder sub-component ──────────────────────────────

function FormulaBuilderUI({
  entity,
  formulaConfig,
  onChange,
}: {
  entity: string
  formulaConfig: FormulaConfig
  onChange: (config: FormulaConfig) => void
}) {
  const needsField = ['sum', 'avg', 'min', 'max'].includes(formulaConfig.aggregation)
  const numericFields = SOURCE_NUMERIC_FIELDS[formulaConfig.source] || []
  const statusOptions = SOURCE_STATUS_OPTIONS[formulaConfig.source] || []
  const relationships = SOURCE_RELATIONSHIPS[formulaConfig.source] || {}
  const availableRelationships = Object.entries(relationships)
    .filter(([etype]) => etype === entity)
    .map(([, col]) => col)

  return (
    <div className="space-y-3 p-3 bg-surface-50 rounded-xl border border-surface-200">
      <div className="flex items-center gap-2 mb-1">
        <Calculator className="w-4 h-4 text-brand-600" />
        <span className="text-xs font-semibold text-surface-700">Formula Configuration</span>
      </div>

      {/* Source entity */}
      <div>
        <label className="label">Source Entity</label>
        <select
          className="input text-sm"
          value={formulaConfig.source}
          onChange={e => {
            const newSource = e.target.value
            const newRel = SOURCE_RELATIONSHIPS[newSource]?.[entity] || ''
            onChange({ ...formulaConfig, source: newSource, field: null, status_filter: null, relationship: newRel })
          }}
        >
          {SOURCE_ENTITY_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Aggregation */}
      <div>
        <label className="label">Aggregation</label>
        <select
          className="input text-sm"
          value={formulaConfig.aggregation}
          onChange={e => onChange({ ...formulaConfig, aggregation: e.target.value as FormulaConfig['aggregation'], field: needsField ? formulaConfig.field : null })}
        >
          {AGGREGATION_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Field to aggregate (only for sum/avg/min/max) */}
      {needsField && numericFields.length > 0 && (
        <div>
          <label className="label">Field to Aggregate</label>
          <select
            className="input text-sm"
            value={formulaConfig.field || ''}
            onChange={e => onChange({ ...formulaConfig, field: e.target.value || null })}
          >
            <option value="">Select field...</option>
            {numericFields.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Time filter */}
      <div>
        <label className="label">Time Filter</label>
        <select
          className="input text-sm"
          value={formulaConfig.time_filter || ''}
          onChange={e => onChange({ ...formulaConfig, time_filter: e.target.value || null })}
        >
          {TIME_FILTER_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Status filter */}
      {statusOptions.length > 0 && (
        <div>
          <label className="label">Status Filter (optional)</label>
          <select
            className="input text-sm"
            value={formulaConfig.status_filter || ''}
            onChange={e => onChange({ ...formulaConfig, status_filter: e.target.value || null })}
          >
            <option value="">Any status</option>
            {statusOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Relationship */}
      <div>
        <label className="label">Relationship Column</label>
        <input
          className="input text-sm"
          value={formulaConfig.relationship}
          onChange={e => onChange({ ...formulaConfig, relationship: e.target.value })}
          placeholder="e.g. contact_id"
        />
        {availableRelationships.length > 0 && (
          <p className="text-[10px] text-surface-400 mt-0.5">
            Detected: {availableRelationships.join(', ')}
          </p>
        )}
      </div>

      {/* Preview */}
      <div className="pt-2 border-t border-surface-200">
        <p className="text-[10px] text-surface-500">
          <span className="font-semibold">Preview:</span> {describeFormula(formulaConfig)}
        </p>
      </div>
    </div>
  )
}

// ─── Preview components ──────────────────────────────────────────

function PreviewFieldInput({ type, options, label, formulaConfig }: { type: string; options: string[] | null; label: string; formulaConfig?: FormulaConfig | null }) {
  if (type === 'formula' && formulaConfig) {
    return (
      <div className="w-full h-8 border border-violet-200 rounded-md bg-violet-50 flex items-center px-2 gap-1.5">
        <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-violet-200 text-violet-700 text-[8px] font-bold flex-shrink-0">fx</span>
        <span className="text-[10px] text-violet-700 font-medium truncate">{formulaPreviewValue(formulaConfig)}</span>
        <span className="text-[9px] text-violet-400 ml-auto flex-shrink-0">{describeFormula(formulaConfig)}</span>
      </div>
    )
  }

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
                  {sectionFields.map(field => {
                    const formulaConfig = field.type === 'formula' ? parseFormulaOptions(field.options) : null
                    return (
                      <div key={field.id} className="animate-fade-in">
                        <div className="flex items-center gap-1 mb-0.5">
                          {field.type === 'formula' && (
                            <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded bg-violet-200 text-violet-700 text-[7px] font-bold flex-shrink-0">fx</span>
                          )}
                          <label className="text-[10px] font-medium text-surface-700">{field.label}</label>
                          {field.required && <span className="text-red-500 text-[10px]">*</span>}
                        </div>
                        <PreviewFieldInput type={field.type} options={field.options} label={field.label} formulaConfig={formulaConfig} />
                      </div>
                    )
                  })}
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

/** Parse formula config from the options column (stored as a JSON string in a text[] slot) */
function parseFormulaOptions(options: string[] | null): FormulaConfig | null {
  if (!options || options.length === 0) return null
  try {
    const parsed = JSON.parse(options[0])
    if (parsed && parsed.type === 'formula') return parsed as FormulaConfig
  } catch {}
  return null
}

// ─── Variable Picker Modal ──────────────────────────────────────

function VariablePickerModal({
  entity,
  existingKeys,
  onAdd,
  onClose,
}: {
  entity: string
  existingKeys: Set<string>
  onAdd: (variable: VariableDef) => void
  onClose: () => void
}) {
  const variables = VARIABLE_MAP[entity] || []
  if (variables.length === 0) {
    return (
      <div className="modal-overlay">
        <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-lg animate-slide-up">
          <div className="flex items-center justify-between p-5 border-b border-surface-100">
            <h2 className="font-semibold text-surface-900">Add Variable</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
          </div>
          <div className="p-8 text-center">
            <Variable className="w-10 h-10 text-surface-300 mx-auto mb-3" />
            <p className="text-sm text-surface-500">No pre-defined variables available for <strong>{entity}</strong> entities.</p>
            <p className="text-xs text-surface-400 mt-1">Use the Formula field type to create custom computed fields.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay">
      <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-lg animate-slide-up max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-surface-100 flex-shrink-0">
          <div>
            <h2 className="font-semibold text-surface-900">Add Variable</h2>
            <p className="text-xs text-surface-400 mt-0.5">Pick a pre-defined computed field for {entity}s</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          <div className="space-y-2">
            {variables.map(v => {
              const alreadyAdded = existingKeys.has(v.key)
              return (
                <div
                  key={v.key}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border transition-all',
                    alreadyAdded
                      ? 'border-surface-100 bg-surface-50 opacity-50'
                      : 'border-surface-200 hover:border-brand-300 hover:bg-brand-50/30 cursor-pointer'
                  )}
                  onClick={() => !alreadyAdded && onAdd(v)}
                >
                  <div className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                    alreadyAdded ? 'bg-surface-100 text-surface-400' : 'bg-violet-100 text-violet-600'
                  )}>
                    <v.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-800">{v.label}</p>
                    <p className="text-[10px] text-surface-400">{v.description}</p>
                  </div>
                  {alreadyAdded ? (
                    <span className="text-[10px] px-2 py-0.5 bg-surface-100 rounded text-surface-400 font-medium">Added</span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 bg-brand-50 rounded text-brand-600 font-medium">+ Add</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────

export default function FormBuilderPage() {
  const { t } = useI18n()
  const supabase = createClient()
  const [fields, setFields] = useState<FieldDef[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [entity, setEntity] = useState('contact')
  const [workspaceId, setWorkspaceId] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showVariablePicker, setShowVariablePicker] = useState(false)
  const [newField, setNewField] = useState({ label: '', type: 'text', section: 'General', required: false, options: '' })
  const [showPreview, setShowPreview] = useState(false)
  const [formulaConfig, setFormulaConfig] = useState<FormulaConfig>({
    type: 'formula',
    source: 'deals',
    aggregation: 'count',
    field: null,
    time_filter: null,
    status_filter: null,
    relationship: 'contact_id',
  })

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
  const existingKeys = new Set(entityFields.map(f => f.key))
  const sections = Array.from(new Set(entityFields.map(f => (f as { section?: string }).section || 'General')))

  const addField = async () => {
    if (!newField.label) return
    const key = newField.label.toLowerCase().replace(/[^a-z0-9]/g, '_')

    let fieldOptions: string[] | null = null
    if (newField.type === 'select') {
      fieldOptions = newField.options.split(',').map(o => o.trim()).filter(Boolean)
    } else if (newField.type === 'formula') {
      fieldOptions = [JSON.stringify(formulaConfig)]
    }

    await supabase.from('custom_field_defs').insert({
      workspace_id: workspaceId,
      entity,
      label: newField.label,
      key,
      type: newField.type,
      options: fieldOptions,
      required: newField.required,
      order_index: entityFields.length,
    })
    setNewField({ label: '', type: 'text', section: 'General', required: false, options: '' })
    setFormulaConfig({
      type: 'formula', source: 'deals', aggregation: 'count', field: null,
      time_filter: null, status_filter: null, relationship: SOURCE_RELATIONSHIPS['deals']?.[entity] || 'contact_id',
    })
    setShowNew(false)
    toast.success('Field added')
    load()
  }

  const addVariable = async (variable: VariableDef) => {
    await supabase.from('custom_field_defs').insert({
      workspace_id: workspaceId,
      entity,
      label: variable.label,
      key: variable.key,
      type: 'formula',
      options: [JSON.stringify(variable.formulaConfig)],
      required: false,
      order_index: entityFields.length,
    })
    toast.success(`Variable "${variable.label}" added`)
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

  // Reset formula config relationship when entity changes
  useEffect(() => {
    setFormulaConfig(prev => ({
      ...prev,
      relationship: SOURCE_RELATIONSHIPS[prev.source]?.[entity] || 'contact_id',
    }))
  }, [entity])

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in max-w-7xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('pages.form_builder')}</h1>
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
          <button onClick={() => setShowVariablePicker(true)} className="btn-secondary btn-sm">
            <Variable className="w-3.5 h-3.5" /> Add Variable
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
              <div className="flex items-center justify-center gap-2">
                <button onClick={() => setShowVariablePicker(true)} className="btn-secondary btn-sm"><Variable className="w-3.5 h-3.5" /> Add Variable</button>
                <button onClick={() => setShowNew(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> Add Field</button>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {entityFields.map((field, i) => {
                const TypeIcon = FIELD_TYPES.find(t => t.value === field.type)?.icon || Type
                const isFormula = field.type === 'formula'
                const fc = isFormula ? parseFormulaOptions(field.options) : null
                return (
                  <div key={field.id} className={cn('card p-3 flex items-center gap-3 group', isFormula && 'border-violet-100')}>
                    <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => moveField(field.id, -1)} disabled={i === 0} className="text-surface-300 hover:text-surface-600 disabled:opacity-20">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 15l-6-6-6 6"/></svg>
                      </button>
                      <button onClick={() => moveField(field.id, 1)} disabled={i === entityFields.length - 1} className="text-surface-300 hover:text-surface-600 disabled:opacity-20">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 9l6 6 6-6"/></svg>
                      </button>
                    </div>
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                      isFormula ? 'bg-violet-100 text-violet-600' : 'bg-surface-100 text-surface-500')}>
                      <TypeIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-surface-800">{field.label}</p>
                        <span className="text-[9px] px-1.5 py-0.5 bg-surface-100 rounded text-surface-400 font-mono">{field.key}</span>
                        <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-medium',
                          isFormula ? 'bg-violet-50 text-violet-600' : 'bg-brand-50 text-brand-600'
                        )}>{field.type}</span>
                        {field.required && <span className="text-[9px] px-1.5 py-0.5 bg-red-50 rounded text-red-600 font-medium">required</span>}
                      </div>
                      {field.options && !isFormula && <p className="text-[10px] text-surface-400 mt-0.5">Options: {field.options.join(', ')}</p>}
                      {fc && <p className="text-[10px] text-violet-400 mt-0.5">{describeFormula(fc)}</p>}
                    </div>
                    {!isFormula && (
                      <button onClick={() => toggleRequired(field.id, field.required)}
                        className="text-[10px] text-surface-400 hover:text-brand-600">
                        {field.required ? 'Optional' : 'Required'}
                      </button>
                    )}
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
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-md animate-slide-up max-h-[90vh] overflow-y-auto">
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
                        newField.type === t.value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-surface-100 hover:border-surface-200 text-surface-600',
                        t.value === 'formula' && newField.type === t.value && 'border-violet-500 bg-violet-50 text-violet-700')}>
                      <t.icon className="w-4 h-4 mx-auto mb-1" />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              {newField.type === 'select' && (
                <div><label className="label">Options (comma separated)</label><input className="input" value={newField.options} onChange={e => setNewField(f => ({ ...f, options: e.target.value }))} placeholder="Option 1, Option 2, Option 3" /></div>
              )}
              {newField.type === 'formula' && (
                <FormulaBuilderUI
                  entity={entity}
                  formulaConfig={formulaConfig}
                  onChange={setFormulaConfig}
                />
              )}
              {newField.type !== 'formula' && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded border-surface-300 text-brand-600"
                    checked={newField.required} onChange={e => setNewField(f => ({ ...f, required: e.target.checked }))} />
                  <span className="text-xs text-surface-600">Required field</span>
                </label>
              )}
              <div className="flex gap-2">
                <button onClick={() => setShowNew(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={addField} disabled={!newField.label || (newField.type === 'formula' && !formulaConfig.relationship)} className="btn-primary flex-1">Add Field</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Variable picker modal */}
      {showVariablePicker && (
        <VariablePickerModal
          entity={entity}
          existingKeys={existingKeys}
          onAdd={(v) => {
            addVariable(v)
            // Don't close — let user add multiple
          }}
          onClose={() => setShowVariablePicker(false)}
        />
      )}
    </div>
  )
}
