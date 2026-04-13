'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Save } from 'lucide-react'
import {
  DEFAULT_STAGE_CONDITIONS,
  loadStageConditionsAsync,
  saveStageConditionsAsync,
  type StageCondition,
} from '@/lib/pipeline/stage-conditions'

const AVAILABLE_FIELDS = ['amount', 'close_date', 'contact_id', 'probability', 'owner_id']

export default function StageConditionsSettingsPage() {
  const [conditions, setConditions] = useState<StageCondition[]>([])

  useEffect(() => {
    loadStageConditionsAsync().then(setConditions)
  }, [])

  const update = (idx: number, patch: Partial<StageCondition>) => {
    setConditions(prev => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)))
  }

  const remove = (idx: number) => {
    setConditions(prev => prev.filter((_, i) => i !== idx))
  }

  const add = () => {
    setConditions(prev => [
      ...prev,
      { fromStage: '*', toStage: '', requiredFields: [], requireApproval: false },
    ])
  }

  const resetDefaults = () => {
    setConditions(DEFAULT_STAGE_CONDITIONS)
  }

  const save = async () => {
    const ok = await saveStageConditionsAsync(conditions)
    if (ok) toast.success('Stage conditions saved')
    else toast.error('Failed to save stage conditions')
  }

  const toggleField = (idx: number, field: string) => {
    const current = conditions[idx]
    const has = current.requiredFields.includes(field)
    const next = has
      ? current.requiredFields.filter(f => f !== field)
      : [...current.requiredFields, field]
    update(idx, { requiredFields: next })
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-surface-900">Stage Transition Conditions</h1>
          <p className="text-xs text-surface-500 mt-1">
            Define required fields and approval rules for moving deals between pipeline stages.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={resetDefaults}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-surface-200 hover:bg-surface-50"
          >
            Reset defaults
          </button>
          <button
            onClick={save}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 flex items-center gap-1"
          >
            <Save className="w-3 h-3" /> Save
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {conditions.map((cond, idx) => (
          <div key={idx} className="border border-surface-200 rounded-xl p-4 bg-white">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <label className="block">
                <span className="text-[10px] font-semibold text-surface-500 uppercase">From stage</span>
                <input
                  type="text"
                  value={cond.fromStage}
                  onChange={e => update(idx, { fromStage: e.target.value })}
                  placeholder="* (any)"
                  className="mt-1 w-full px-2 py-1.5 text-xs border border-surface-200 rounded-lg"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-semibold text-surface-500 uppercase">To stage</span>
                <input
                  type="text"
                  value={cond.toStage}
                  onChange={e => update(idx, { toStage: e.target.value })}
                  placeholder="e.g. Won"
                  className="mt-1 w-full px-2 py-1.5 text-xs border border-surface-200 rounded-lg"
                />
              </label>
            </div>

            <div className="mb-3">
              <span className="text-[10px] font-semibold text-surface-500 uppercase">Required fields</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {AVAILABLE_FIELDS.map(f => (
                  <button
                    key={f}
                    onClick={() => toggleField(idx, f)}
                    className={
                      'px-2 py-1 text-[11px] rounded-full border ' +
                      (cond.requiredFields.includes(f)
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-surface-600 border-surface-200')
                    }
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={!!cond.requireApproval}
                  onChange={e => update(idx, { requireApproval: e.target.checked })}
                />
                Require approval
              </label>
              <label className="flex items-center gap-2 text-xs">
                Min value:
                <input
                  type="number"
                  value={cond.minValue ?? ''}
                  onChange={e =>
                    update(idx, {
                      minValue: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                  className="w-24 px-2 py-1 border border-surface-200 rounded-lg"
                />
              </label>
              <button
                onClick={() => remove(idx)}
                className="ml-auto text-red-500 hover:text-red-700 flex items-center gap-1 text-xs"
              >
                <Trash2 className="w-3 h-3" /> Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={add}
        className="mt-4 px-3 py-2 text-xs font-semibold rounded-lg border border-dashed border-surface-300 text-surface-600 hover:bg-surface-50 flex items-center gap-1"
      >
        <Plus className="w-3 h-3" /> Add condition
      </button>
    </div>
  )
}
