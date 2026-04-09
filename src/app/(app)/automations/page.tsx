'use client'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Zap, Plus, Trash2, ToggleLeft, ToggleRight, Clock, ArrowRight, X, ChevronDown, ChevronRight, Timer, GitBranch } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getActiveWorkspace } from '@/lib/get-active-workspace'

interface Automation {
  id: string
  name: string
  enabled: boolean
  trigger_type: string
  trigger_config: Record<string, string | number | boolean>
  action_type: string
  action_config: Record<string, string | number | boolean>
  last_triggered: string | null
  trigger_count: number
}

interface AutomationStep {
  id?: string
  step_order: number
  action_type: string
  action_config: Record<string, string>
  delay_minutes: number
  condition_field: string
  condition_operator: string
  condition_value: string
}

const TRIGGER_LABELS: Record<string, string> = {
  deal_stage_changed: 'Deal stage changes',
  deal_created: 'New deal created',
  deal_idle: 'Deal idle for X days',
  deal_won: 'Deal marked as won',
  deal_lost: 'Deal marked as lost',
  contact_created: 'New contact created',
  contact_birthday: 'Contact birthday',
  task_overdue: 'Task becomes overdue',
  task_due_soon: 'Task due soon',
  quote_sent: 'Quote sent',
  quote_accepted: 'Quote accepted',
  quote_rejected: 'Quote rejected',
  whatsapp_received: 'WhatsApp message received',
  email_received: 'Email received',
  schedule_daily: 'Daily schedule',
  schedule_weekly: 'Weekly schedule',
  schedule_monthly: 'Monthly schedule',
}

const ACTION_LABELS: Record<string, string> = {
  create_task: 'Create task',
  send_whatsapp: 'Send WhatsApp message',
  send_email: 'Send email',
  notify_team: 'Notify team',
  update_deal: 'Update deal',
  update_contact: 'Update contact',
  create_deal: 'Create deal',
  webhook: 'Call webhook',
}

const TRIGGER_ICONS: Record<string, string> = {
  deal_stage_changed: '🔄', deal_created: '✨', deal_idle: '⏰', deal_won: '🎉', deal_lost: '❌',
  contact_created: '👤', contact_birthday: '🎂',
  task_overdue: '⚠️', task_due_soon: '📋',
  quote_sent: '📤', quote_accepted: '✅', quote_rejected: '🚫',
  whatsapp_received: '💬', email_received: '📧',
  schedule_daily: '📅', schedule_weekly: '📅', schedule_monthly: '📅',
}

const CONDITION_FIELDS: Record<string, string> = {
  deal_value: 'Deal value',
  deal_title: 'Deal title',
  contact_name: 'Contact name',
  contact_email: 'Contact email',
  stage_name: 'Stage name',
  lead_platform: 'Lead platform',
}

const CONDITION_OPERATORS: Record<string, string> = {
  equals: 'equals',
  not_equals: 'not equals',
  contains: 'contains',
  greater_than: 'greater than',
  less_than: 'less than',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
}

function formatDelay(minutes: number): string {
  if (minutes <= 0) return 'No delay'
  if (minutes < 60) return `${minutes}m`
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`
  return `${Math.round(minutes / 1440)}d`
}

function StepActionConfig({ step, onChange }: { step: AutomationStep; onChange: (cfg: Record<string, string>) => void }) {
  const config = step.action_config
  if (step.action_type === 'create_task') {
    return (
      <div className="mt-2">
        <input className="input text-xs" placeholder="Task title, e.g. Follow up with {{contact_name}}"
          value={config.title || ''}
          onChange={e => onChange({ ...config, title: e.target.value })} />
      </div>
    )
  }
  if (step.action_type === 'send_whatsapp') {
    return (
      <div className="mt-2">
        <textarea className="input text-xs resize-none" rows={2} placeholder="Message..."
          value={config.message || ''}
          onChange={e => onChange({ ...config, message: e.target.value })} />
      </div>
    )
  }
  if (step.action_type === 'notify_team') {
    return (
      <div className="mt-2">
        <input className="input text-xs" placeholder="Notification message"
          value={config.message || ''}
          onChange={e => onChange({ ...config, message: e.target.value })} />
      </div>
    )
  }
  if (step.action_type === 'webhook') {
    return (
      <div className="mt-2">
        <input className="input text-xs" placeholder="Webhook URL"
          value={config.url || ''}
          onChange={e => onChange({ ...config, url: e.target.value })} />
      </div>
    )
  }
  return null
}

function StepEditor({
  step,
  index,
  onUpdate,
  onRemove,
}: {
  step: AutomationStep
  index: number
  onUpdate: (s: AutomationStep) => void
  onRemove: () => void
}) {
  const [expanded, setExpanded] = useState(true)
  const [delayUnit, setDelayUnit] = useState<'minutes' | 'hours' | 'days'>('minutes')
  const [delayValue, setDelayValue] = useState(step.delay_minutes)
  const [hasCondition, setHasCondition] = useState(!!step.condition_field)

  const applyDelay = (val: number, unit: string) => {
    let mins = val
    if (unit === 'hours') mins = val * 60
    if (unit === 'days') mins = val * 1440
    onUpdate({ ...step, delay_minutes: mins })
  }

  return (
    <div className="relative">
      {/* Timeline connector */}
      {index > 0 && (
        <div className="absolute left-4 -top-3 w-0.5 h-3 bg-surface-200" />
      )}
      <div className="border border-surface-200 rounded-xl bg-white">
        {/* Step header */}
        <div
          className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
            {index + 1}
          </div>
          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-surface-400" /> : <ChevronRight className="w-3.5 h-3.5 text-surface-400" />}
          <span className="text-xs font-medium text-surface-700 flex-1">
            {ACTION_LABELS[step.action_type] || step.action_type}
          </span>
          {step.delay_minutes > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md font-medium">
              <Timer className="w-3 h-3" />
              {formatDelay(step.delay_minutes)}
            </span>
          )}
          {step.condition_field && (
            <span className="flex items-center gap-0.5 text-[10px] text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-md font-medium">
              <GitBranch className="w-3 h-3" />
              If
            </span>
          )}
          <button
            onClick={e => { e.stopPropagation(); onRemove() }}
            className="text-surface-300 hover:text-red-500 transition-colors ml-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Step body */}
        {expanded && (
          <div className="px-3 pb-3 space-y-3 border-t border-surface-100 pt-3">
            {/* Action type */}
            <div>
              <label className="text-[10px] font-medium text-surface-500 uppercase tracking-wider">Action</label>
              <select
                className="input text-xs mt-1"
                value={step.action_type}
                onChange={e => onUpdate({ ...step, action_type: e.target.value })}
              >
                {Object.entries(ACTION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <StepActionConfig step={step} onChange={cfg => onUpdate({ ...step, action_config: cfg })} />
            </div>

            {/* Delay */}
            <div>
              <label className="text-[10px] font-medium text-surface-500 uppercase tracking-wider">Delay before this step</label>
              <div className="flex gap-2 mt-1">
                <input
                  type="number"
                  min={0}
                  className="input text-xs w-20"
                  value={delayValue}
                  onChange={e => {
                    const v = parseInt(e.target.value) || 0
                    setDelayValue(v)
                    applyDelay(v, delayUnit)
                  }}
                />
                <select
                  className="input text-xs w-24"
                  value={delayUnit}
                  onChange={e => {
                    const u = e.target.value as 'minutes' | 'hours' | 'days'
                    setDelayUnit(u)
                    applyDelay(delayValue, u)
                  }}
                >
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
              </div>
            </div>

            {/* Condition */}
            <div>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasCondition}
                  onChange={e => {
                    setHasCondition(e.target.checked)
                    if (!e.target.checked) {
                      onUpdate({ ...step, condition_field: '', condition_operator: '', condition_value: '' })
                    }
                  }}
                  className="rounded border-surface-300"
                />
                <span className="text-[10px] font-medium text-surface-500 uppercase tracking-wider">Condition (optional)</span>
              </label>
              {hasCondition && (
                <div className="flex gap-2 mt-1.5">
                  <select
                    className="input text-xs flex-1"
                    value={step.condition_field}
                    onChange={e => onUpdate({ ...step, condition_field: e.target.value })}
                  >
                    <option value="">Field...</option>
                    {Object.entries(CONDITION_FIELDS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <select
                    className="input text-xs flex-1"
                    value={step.condition_operator}
                    onChange={e => onUpdate({ ...step, condition_operator: e.target.value })}
                  >
                    <option value="">Operator...</option>
                    {Object.entries(CONDITION_OPERATORS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  {step.condition_operator !== 'is_empty' && step.condition_operator !== 'is_not_empty' && (
                    <input
                      className="input text-xs flex-1"
                      placeholder="Value"
                      value={step.condition_value}
                      onChange={e => onUpdate({ ...step, condition_value: e.target.value })}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AutomationsPage() {
  const supabase = createClient()
  const { t } = useI18n()
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)

  // New automation form
  const [newName, setNewName] = useState('')
  const [newTrigger, setNewTrigger] = useState('deal_stage_changed')
  const [newAction, setNewAction] = useState('create_task')
  const [newActionConfig, setNewActionConfig] = useState<Record<string, string>>({})
  const [newSteps, setNewSteps] = useState<AutomationStep[]>([])

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const ws = await getActiveWorkspace(supabase, user.id, 'id')
    if (!ws) { setLoading(false); return }

    const { data } = await supabase.from('automations').select('*').eq('workspace_id', ws.id).order('created_at')
    setAutomations(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const toggleAutomation = async (id: string, enabled: boolean) => {
    await supabase.from('automations').update({ enabled: !enabled }).eq('id', id)
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, enabled: !enabled } : a))
  }

  const deleteAutomation = async (id: string) => {
    await supabase.from('automations').delete().eq('id', id)
    setAutomations(prev => prev.filter(a => a.id !== id))
  }

  const addStep = () => {
    setNewSteps(prev => [
      ...prev,
      {
        step_order: prev.length,
        action_type: 'create_task',
        action_config: {},
        delay_minutes: 0,
        condition_field: '',
        condition_operator: '',
        condition_value: '',
      },
    ])
  }

  const updateStep = (index: number, step: AutomationStep) => {
    setNewSteps(prev => prev.map((s, i) => i === index ? { ...step, step_order: i } : s))
  }

  const removeStep = (index: number) => {
    setNewSteps(prev => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_order: i })))
  }

  const createAutomation = async () => {
    if (!newName) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const ws = await getActiveWorkspace(supabase, user.id, 'id')
    if (!ws) return

    const { data, error } = await supabase.from('automations').insert({
      workspace_id: ws.id,
      name: newName,
      enabled: true,
      trigger_type: newTrigger,
      trigger_config: {},
      action_type: newSteps.length > 0 ? newSteps[0].action_type : newAction,
      action_config: newSteps.length > 0 ? newSteps[0].action_config : newActionConfig,
    }).select().single()

    if (error || !data) {
      toast.error('Failed to create automation')
      return
    }

    // Save steps if any
    if (newSteps.length > 0) {
      const stepsToInsert = newSteps.map((s, i) => ({
        automation_id: data.id,
        step_order: i,
        action_type: s.action_type,
        action_config: s.action_config,
        delay_minutes: s.delay_minutes || 0,
        condition_field: s.condition_field || null,
        condition_operator: s.condition_operator || null,
        condition_value: s.condition_value || null,
      }))

      const { error: stepErr } = await supabase.from('automation_steps').insert(stepsToInsert)
      if (stepErr) {
        toast.error('Automation created but failed to save steps')
      }
    }

    setAutomations(prev => [...prev, data])
    setNewName('')
    setNewActionConfig({})
    setNewSteps([])
    setShowNew(false)
    toast.success('Automation created')
  }

  const resetAndClose = () => {
    setShowNew(false)
    setNewName('')
    setNewActionConfig({})
    setNewSteps([])
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav.automations')}</h1>
          <p className="text-sm text-surface-500 mt-0.5">
            {automations.length} automation{automations.length !== 1 ? 's' : ''} · {automations.filter(a => a.enabled).length} active
          </p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary btn-sm">
          <Plus className="w-3.5 h-3.5" /> New Automation
        </button>
      </div>

      {automations.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Zap className="w-7 h-7 text-brand-500" />
          </div>
          <p className="text-surface-600 font-medium mb-1">No automations yet</p>
          <p className="text-surface-400 text-sm mb-4">Automations run tasks automatically based on triggers in your CRM</p>
          <button onClick={() => setShowNew(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> Create Automation</button>
        </div>
      ) : (
        <div className="space-y-3">
          {automations.map(auto => (
            <div key={auto.id} className={cn('card p-5 transition-all', !auto.enabled && 'opacity-60')}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center text-lg flex-shrink-0">
                    {TRIGGER_ICONS[auto.trigger_type] || '⚡'}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-surface-900">{auto.name}</h3>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-surface-500">
                      <span className="px-2 py-0.5 bg-surface-100 rounded-md font-medium">
                        {TRIGGER_LABELS[auto.trigger_type] || auto.trigger_type}
                      </span>
                      <ArrowRight className="w-3 h-3" />
                      <span className="px-2 py-0.5 bg-brand-50 text-brand-700 rounded-md font-medium">
                        {ACTION_LABELS[auto.action_type] || auto.action_type}
                      </span>
                    </div>
                    {auto.last_triggered && (
                      <p className="text-[10px] text-surface-400 mt-2 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Last triggered: {new Date(auto.last_triggered).toLocaleString()} · {auto.trigger_count} total
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleAutomation(auto.id, auto.enabled)}
                    className="text-surface-400 hover:text-surface-600">
                    {auto.enabled
                      ? <ToggleRight className="w-6 h-6 text-brand-600" />
                      : <ToggleLeft className="w-6 h-6" />}
                  </button>
                  <button onClick={() => deleteAutomation(auto.id)}
                    className="text-surface-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Automation Modal */}
      {showNew && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-lg animate-slide-up max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-surface-100 flex-shrink-0">
              <h2 className="font-semibold text-surface-900">New Automation</h2>
              <button onClick={resetAndClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100">
                <X className="w-4 h-4 text-surface-500" />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="label">Name</label>
                <input className="input" value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Follow up after demo" />
              </div>
              <div>
                <label className="label">When this happens...</label>
                <select className="input" value={newTrigger} onChange={e => setNewTrigger(e.target.value)}>
                  {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              {/* Single action mode (when no steps) */}
              {newSteps.length === 0 && (
                <>
                  <div>
                    <label className="label">Do this...</label>
                    <select className="input" value={newAction} onChange={e => setNewAction(e.target.value)}>
                      {Object.entries(ACTION_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  {newAction === 'create_task' && (
                    <div>
                      <label className="label">Task title</label>
                      <input className="input" placeholder="Follow up with {{contact_name}}"
                        value={newActionConfig.title || ''}
                        onChange={e => setNewActionConfig((p: Record<string, string>) => ({ ...p, title: e.target.value }))} />
                      <p className="text-[10px] text-surface-400 mt-1">Use {'{{contact_name}}'}, {'{{deal_title}}'}, {'{{deal_value}}'}</p>
                    </div>
                  )}
                  {newAction === 'send_whatsapp' && (
                    <div>
                      <label className="label">Message</label>
                      <textarea className="input resize-none" rows={3} placeholder="Hi {{contact_name}}..."
                        value={newActionConfig.message || ''}
                        onChange={e => setNewActionConfig((p: Record<string, string>) => ({ ...p, message: e.target.value }))} />
                    </div>
                  )}
                  {newAction === 'notify_team' && (
                    <div>
                      <label className="label">Notification message</label>
                      <input className="input" placeholder="New deal: {{deal_title}}"
                        value={newActionConfig.message || ''}
                        onChange={e => setNewActionConfig((p: Record<string, string>) => ({ ...p, message: e.target.value }))} />
                    </div>
                  )}
                </>
              )}

              {/* Multi-step workflow */}
              <div className="border-t border-surface-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-semibold text-surface-700 flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5 text-brand-500" />
                    Workflow Steps {newSteps.length > 0 && <span className="text-surface-400">({newSteps.length})</span>}
                  </label>
                  <button onClick={addStep} className="text-[10px] font-medium text-brand-600 hover:text-brand-700 flex items-center gap-0.5">
                    <Plus className="w-3 h-3" /> Add Step
                  </button>
                </div>

                {newSteps.length === 0 ? (
                  <p className="text-[10px] text-surface-400 italic">
                    No steps added. The automation will run the single action above. Add steps to create a multi-step workflow with delays and conditions.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {newSteps.map((step, i) => (
                      <StepEditor
                        key={i}
                        step={step}
                        index={i}
                        onUpdate={s => updateStep(i, s)}
                        onRemove={() => removeStep(i)}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={resetAndClose} className="btn-secondary flex-1">Cancel</button>
                <button onClick={createAutomation} disabled={!newName} className="btn-primary flex-1">
                  <Zap className="w-3.5 h-3.5" /> Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
