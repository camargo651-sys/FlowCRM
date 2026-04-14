'use client'
import { useEffect, useState } from 'react'
import { Plus, Trash2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

interface Rule {
  id: string
  entity: string
  field: string
  operator: string
  value: number
  approver_role: string | null
  approver_user_id: string | null
  active: boolean
}

const ENTITIES = [
  { value: 'quote', label: 'Quote', defaultField: 'total' },
  { value: 'expense', label: 'Expense', defaultField: 'amount' },
  { value: 'invoice', label: 'Invoice', defaultField: 'total' },
  { value: 'contract', label: 'Contract', defaultField: 'value' },
  { value: 'deal', label: 'Deal', defaultField: 'value' },
]

const OPERATORS = [
  { value: 'gt', label: 'greater than (>)' },
  { value: 'gte', label: 'greater than or equal (>=)' },
  { value: 'lt', label: 'less than (<)' },
  { value: 'lte', label: 'less than or equal (<=)' },
  { value: 'eq', label: 'equals (=)' },
]

export default function ApprovalsSettingsPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)

  const [entity, setEntity] = useState('quote')
  const [field, setField] = useState('total')
  const [operator, setOperator] = useState('gt')
  const [value, setValue] = useState('10000')
  const [approverRole, setApproverRole] = useState('manager')

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/approval-rules')
      const j = await res.json()
      setRules(j.rules || [])
    } catch {
      toast.error('Failed to load')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleEntityChange = (e: string) => {
    setEntity(e)
    const def = ENTITIES.find(x => x.value === e)
    if (def) setField(def.defaultField)
  }

  const handleCreate = async () => {
    if (!field.trim() || value === '') {
      toast.error('Field and value required')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/approval-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity, field, operator, value: Number(value),
          approver_role: approverRole || null,
        }),
      })
      const j = await res.json()
      if (j.rule) {
        setRules(prev => [j.rule, ...prev])
        toast.success('Rule created')
        setShowForm(false)
        setValue('10000')
      } else {
        toast.error(j.error || 'Failed')
      }
    } catch {
      toast.error('Failed')
    }
    setCreating(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this rule?')) return
    try {
      const res = await fetch(`/api/approval-rules?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setRules(prev => prev.filter(r => r.id !== id))
        toast.success('Deleted')
      }
    } catch {
      toast.error('Failed')
    }
  }

  const operatorLabel = (op: string) => OPERATORS.find(o => o.value === op)?.label || op

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-brand-600" /> Approval rules
          </h1>
          <p className="text-sm text-surface-500 mt-1">Trigger approvals automatically when records meet conditions.</p>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700"
        >
          <Plus className="w-4 h-4" /> New rule
        </button>
      </div>

      {showForm && (
        <div className="mb-6 bg-white border border-surface-100 rounded-2xl p-5 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-surface-600 mb-1">Entity</label>
              <select
                value={entity} onChange={e => handleEntityChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm focus:outline-none focus:border-brand-500"
              >
                {ENTITIES.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-600 mb-1">Field</label>
              <input
                value={field} onChange={e => setField(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-600 mb-1">Operator</label>
              <select
                value={operator} onChange={e => setOperator(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm focus:outline-none focus:border-brand-500"
              >
                {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-600 mb-1">Value</label>
              <input
                type="number" value={value} onChange={e => setValue(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-600 mb-1">Approver role</label>
              <input
                value={approverRole} onChange={e => setApproverRole(e.target.value)}
                placeholder="manager"
                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-surface-600 hover:bg-surface-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create rule'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-surface-400">Loading...</div>
      ) : rules.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-surface-200 rounded-2xl">
          <ShieldCheck className="w-10 h-10 text-surface-300 mx-auto mb-3" />
          <p className="text-sm text-surface-500">No approval rules yet</p>
        </div>
      ) : (
        <div className="bg-white border border-surface-100 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-surface-50 text-surface-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2.5">Entity</th>
                <th className="text-left px-4 py-2.5">Condition</th>
                <th className="text-left px-4 py-2.5">Approver</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {rules.map(rule => (
                <tr key={rule.id} className="border-t border-surface-100">
                  <td className="px-4 py-3 capitalize font-medium text-surface-800">{rule.entity}</td>
                  <td className="px-4 py-3 text-surface-700">
                    <span className="font-mono text-xs">{rule.field}</span> {operatorLabel(rule.operator)} <span className="font-mono">{rule.value}</span>
                  </td>
                  <td className="px-4 py-3 text-surface-600">{rule.approver_role || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${rule.active ? 'bg-emerald-50 text-emerald-700' : 'bg-surface-100 text-surface-500'}`}>
                      {rule.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(rule.id)} className="text-surface-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
