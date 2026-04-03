'use client'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Zap, Plus, Trash2, ToggleLeft, ToggleRight, Clock, ArrowRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Automation {
  id: string
  name: string
  enabled: boolean
  trigger_type: string
  trigger_config: any
  action_type: string
  action_config: any
  last_triggered: string | null
  trigger_count: number
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
  const [newActionConfig, setNewActionConfig] = useState<any>({})

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
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

  const createAutomation = async () => {
    if (!newName) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
    if (!ws) return

    const { data } = await supabase.from('automations').insert({
      workspace_id: ws.id,
      name: newName,
      enabled: true,
      trigger_type: newTrigger,
      trigger_config: {},
      action_type: newAction,
      action_config: newActionConfig,
    }).select().single()

    if (data) setAutomations(prev => [...prev, data])
    setNewName('')
    setShowNew(false)
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100">
              <h2 className="font-semibold text-surface-900">New Automation</h2>
              <button onClick={() => setShowNew(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100">
                <X className="w-4 h-4 text-surface-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
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
                    onChange={e => setNewActionConfig((p: any) => ({ ...p, title: e.target.value }))} />
                  <p className="text-[10px] text-surface-400 mt-1">Use {'{{contact_name}}'}, {'{{deal_title}}'}, {'{{deal_value}}'}</p>
                </div>
              )}
              {newAction === 'send_whatsapp' && (
                <div>
                  <label className="label">Message</label>
                  <textarea className="input resize-none" rows={3} placeholder="Hi {{contact_name}}..."
                    value={newActionConfig.message || ''}
                    onChange={e => setNewActionConfig((p: any) => ({ ...p, message: e.target.value }))} />
                </div>
              )}
              {newAction === 'notify_team' && (
                <div>
                  <label className="label">Notification message</label>
                  <input className="input" placeholder="New deal: {{deal_title}}"
                    value={newActionConfig.message || ''}
                    onChange={e => setNewActionConfig((p: any) => ({ ...p, message: e.target.value }))} />
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => setShowNew(false)} className="btn-secondary flex-1">Cancel</button>
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
