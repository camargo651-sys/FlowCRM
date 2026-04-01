'use client'
import { useState } from 'react'
import { Filter, X, Plus, Save, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FilterRule {
  field: string
  operator: string
  value: string
}

interface SavedFilter {
  name: string
  rules: FilterRule[]
}

interface AdvancedFiltersProps {
  fields: { key: string; label: string; type: 'text' | 'number' | 'select' | 'date'; options?: string[] }[]
  onApply: (rules: FilterRule[]) => void
  storageKey: string
}

const OPERATORS: Record<string, { key: string; label: string }[]> = {
  text: [
    { key: 'contains', label: 'Contains' },
    { key: 'equals', label: 'Equals' },
    { key: 'starts_with', label: 'Starts with' },
    { key: 'is_empty', label: 'Is empty' },
    { key: 'is_not_empty', label: 'Is not empty' },
  ],
  number: [
    { key: 'equals', label: '=' },
    { key: 'gt', label: '>' },
    { key: 'gte', label: '>=' },
    { key: 'lt', label: '<' },
    { key: 'lte', label: '<=' },
  ],
  select: [
    { key: 'equals', label: 'Is' },
    { key: 'not_equals', label: 'Is not' },
  ],
  date: [
    { key: 'equals', label: 'On' },
    { key: 'gt', label: 'After' },
    { key: 'lt', label: 'Before' },
    { key: 'is_empty', label: 'No date' },
  ],
}

export default function AdvancedFilters({ fields, onApply, storageKey }: AdvancedFiltersProps) {
  const [open, setOpen] = useState(false)
  const [rules, setRules] = useState<FilterRule[]>([])
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(() => {
    try { return JSON.parse(localStorage.getItem(`tracktio_filters_${storageKey}`) || '[]') } catch { return [] }
  })
  const [saveName, setSaveName] = useState('')

  const addRule = () => setRules(prev => [...prev, { field: fields[0]?.key || '', operator: 'contains', value: '' }])
  const removeRule = (i: number) => setRules(prev => prev.filter((_, idx) => idx !== i))
  const updateRule = (i: number, key: string, val: string) => setRules(prev => prev.map((r, idx) => idx === i ? { ...r, [key]: val } : r))

  const apply = () => { onApply(rules); setOpen(false) }
  const clear = () => { setRules([]); onApply([]); setOpen(false) }

  const saveFilter = () => {
    if (!saveName || !rules.length) return
    const updated = [...savedFilters, { name: saveName, rules: [...rules] }]
    setSavedFilters(updated)
    localStorage.setItem(`tracktio_filters_${storageKey}`, JSON.stringify(updated))
    setSaveName('')
  }

  const loadFilter = (filter: SavedFilter) => { setRules([...filter.rules]); onApply(filter.rules); setOpen(false) }
  const deleteFilter = (i: number) => {
    const updated = savedFilters.filter((_, idx) => idx !== i)
    setSavedFilters(updated)
    localStorage.setItem(`tracktio_filters_${storageKey}`, JSON.stringify(updated))
  }

  const getFieldType = (key: string) => fields.find(f => f.key === key)?.type || 'text'
  const getFieldOptions = (key: string) => fields.find(f => f.key === key)?.options || []

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className={cn('btn-secondary btn-sm', rules.length > 0 && 'ring-2 ring-brand-500 text-brand-600')}>
        <Filter className="w-3.5 h-3.5" />
        Filters {rules.length > 0 && `(${rules.length})`}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-[480px] bg-white rounded-xl shadow-lg border border-surface-100 z-50 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-surface-900">Advanced Filters</h3>
              <button onClick={() => setOpen(false)} className="text-surface-400 hover:text-surface-600"><X className="w-4 h-4" /></button>
            </div>

            {/* Saved filters */}
            {savedFilters.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {savedFilters.map((sf, i) => (
                  <div key={i} className="flex items-center gap-1 px-2 py-1 bg-brand-50 rounded-lg text-[10px] font-medium text-brand-700">
                    <button onClick={() => loadFilter(sf)}>{sf.name}</button>
                    <button onClick={() => deleteFilter(i)} className="hover:text-red-500"><X className="w-2.5 h-2.5" /></button>
                  </div>
                ))}
              </div>
            )}

            {/* Rules */}
            <div className="space-y-2 mb-3">
              {rules.map((rule, i) => {
                const fieldType = getFieldType(rule.field)
                const ops = OPERATORS[fieldType] || OPERATORS.text
                return (
                  <div key={i} className="flex gap-1.5 items-center">
                    <select className="input text-xs flex-1" value={rule.field}
                      onChange={e => updateRule(i, 'field', e.target.value)}>
                      {fields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                    <select className="input text-xs w-24" value={rule.operator}
                      onChange={e => updateRule(i, 'operator', e.target.value)}>
                      {ops.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                    </select>
                    {!['is_empty', 'is_not_empty'].includes(rule.operator) && (
                      fieldType === 'select' ? (
                        <select className="input text-xs flex-1" value={rule.value} onChange={e => updateRule(i, 'value', e.target.value)}>
                          <option value="">Any</option>
                          {getFieldOptions(rule.field).map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input className="input text-xs flex-1" type={fieldType === 'number' ? 'number' : fieldType === 'date' ? 'date' : 'text'}
                          value={rule.value} onChange={e => updateRule(i, 'value', e.target.value)} placeholder="Value" />
                      )
                    )}
                    <button onClick={() => removeRule(i)} className="text-surface-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                )
              })}
            </div>

            <button onClick={addRule} className="btn-ghost btn-sm w-full border border-dashed border-surface-200 mb-3">
              <Plus className="w-3.5 h-3.5" /> Add filter rule
            </button>

            {/* Save filter */}
            {rules.length > 0 && (
              <div className="flex gap-1.5 mb-3">
                <input className="input text-xs flex-1" placeholder="Save filter as..." value={saveName} onChange={e => setSaveName(e.target.value)} />
                <button onClick={saveFilter} disabled={!saveName} className="btn-ghost btn-sm"><Save className="w-3.5 h-3.5" /></button>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={clear} className="btn-secondary flex-1 text-xs">Clear</button>
              <button onClick={apply} className="btn-primary flex-1 text-xs">Apply Filters</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Apply filter rules to a data array client-side
 */
export function applyFilterRules<T extends Record<string, any>>(data: T[], rules: { field: string; operator: string; value: string }[]): T[] {
  if (!rules.length) return data
  return data.filter(item => {
    return rules.every(rule => {
      const val = item[rule.field]
      const target = rule.value.toLowerCase()
      const str = String(val || '').toLowerCase()

      switch (rule.operator) {
        case 'contains': return str.includes(target)
        case 'equals': return str === target || Number(val) === Number(rule.value)
        case 'not_equals': return str !== target
        case 'starts_with': return str.startsWith(target)
        case 'is_empty': return !val || val === ''
        case 'is_not_empty': return !!val && val !== ''
        case 'gt': return Number(val) > Number(rule.value)
        case 'gte': return Number(val) >= Number(rule.value)
        case 'lt': return Number(val) < Number(rule.value)
        case 'lte': return Number(val) <= Number(rule.value)
        default: return true
      }
    })
  })
}
