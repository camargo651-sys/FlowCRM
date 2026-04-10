'use client'
import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'
import { useWorkspace } from '@/lib/workspace-context'
import { createClient } from '@/lib/supabase/client'
import { Kanban, Zap, Mail, Bell, Check, Loader2, Sparkles, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'

type TemplateCategory = 'pipeline' | 'sequence' | 'automation'

interface Template {
  id: string
  name: string
  description: string
  category: TemplateCategory
  config: PipelineConfig | SequenceConfig | AutomationConfig
}

interface PipelineConfig {
  stages: { name: string; color: string; win_stage: boolean; lost_stage: boolean }[]
}

interface SequenceConfig {
  steps: { type: string; delay_hours: number; content: string }[]
}

interface AutomationConfig {
  trigger_type: string
  trigger_config: Record<string, string | number | boolean>
  action_type: string
  action_config: Record<string, string | number | boolean>
}

const STAGE_COLORS = ['#0891B2','#8b5cf6','#ec4899','#f97316','#f59e0b','#10b981','#06b6d4','#64748b']

const TEMPLATES: Template[] = [
  // Pipeline Templates
  {
    id: 'pipeline-sales',
    name: 'Sales Pipeline',
    description: 'Lead \u2192 Qualified \u2192 Proposal \u2192 Negotiation \u2192 Won/Lost',
    category: 'pipeline',
    config: {
      stages: [
        { name: 'Lead', color: STAGE_COLORS[0], win_stage: false, lost_stage: false },
        { name: 'Qualified', color: STAGE_COLORS[1], win_stage: false, lost_stage: false },
        { name: 'Proposal', color: STAGE_COLORS[2], win_stage: false, lost_stage: false },
        { name: 'Negotiation', color: STAGE_COLORS[3], win_stage: false, lost_stage: false },
        { name: 'Won', color: STAGE_COLORS[5], win_stage: true, lost_stage: false },
        { name: 'Lost', color: STAGE_COLORS[7], win_stage: false, lost_stage: true },
      ],
    },
  },
  {
    id: 'pipeline-realestate',
    name: 'Real Estate',
    description: 'Inquiry \u2192 Viewing \u2192 Offer \u2192 Closing \u2192 Completed',
    category: 'pipeline',
    config: {
      stages: [
        { name: 'Inquiry', color: STAGE_COLORS[0], win_stage: false, lost_stage: false },
        { name: 'Viewing', color: STAGE_COLORS[1], win_stage: false, lost_stage: false },
        { name: 'Offer', color: STAGE_COLORS[3], win_stage: false, lost_stage: false },
        { name: 'Closing', color: STAGE_COLORS[4], win_stage: false, lost_stage: false },
        { name: 'Completed', color: STAGE_COLORS[5], win_stage: true, lost_stage: false },
      ],
    },
  },
  {
    id: 'pipeline-recruitment',
    name: 'Recruitment',
    description: 'Applied \u2192 Screening \u2192 Interview \u2192 Offer \u2192 Hired',
    category: 'pipeline',
    config: {
      stages: [
        { name: 'Applied', color: STAGE_COLORS[0], win_stage: false, lost_stage: false },
        { name: 'Screening', color: STAGE_COLORS[1], win_stage: false, lost_stage: false },
        { name: 'Interview', color: STAGE_COLORS[2], win_stage: false, lost_stage: false },
        { name: 'Offer', color: STAGE_COLORS[4], win_stage: false, lost_stage: false },
        { name: 'Hired', color: STAGE_COLORS[5], win_stage: true, lost_stage: false },
      ],
    },
  },
  {
    id: 'pipeline-onboarding',
    name: 'Customer Onboarding',
    description: 'Signup \u2192 Setup \u2192 Training \u2192 Active',
    category: 'pipeline',
    config: {
      stages: [
        { name: 'Signup', color: STAGE_COLORS[0], win_stage: false, lost_stage: false },
        { name: 'Setup', color: STAGE_COLORS[1], win_stage: false, lost_stage: false },
        { name: 'Training', color: STAGE_COLORS[4], win_stage: false, lost_stage: false },
        { name: 'Active', color: STAGE_COLORS[5], win_stage: true, lost_stage: false },
      ],
    },
  },
  {
    id: 'pipeline-support',
    name: 'Support Escalation',
    description: 'New \u2192 Assigned \u2192 In Progress \u2192 Resolved',
    category: 'pipeline',
    config: {
      stages: [
        { name: 'New', color: STAGE_COLORS[0], win_stage: false, lost_stage: false },
        { name: 'Assigned', color: STAGE_COLORS[1], win_stage: false, lost_stage: false },
        { name: 'In Progress', color: STAGE_COLORS[3], win_stage: false, lost_stage: false },
        { name: 'Resolved', color: STAGE_COLORS[5], win_stage: true, lost_stage: false },
      ],
    },
  },
  {
    id: 'pipeline-events',
    name: 'Event Planning',
    description: 'Inquiry \u2192 Proposal \u2192 Confirmed \u2192 Completed',
    category: 'pipeline',
    config: {
      stages: [
        { name: 'Inquiry', color: STAGE_COLORS[0], win_stage: false, lost_stage: false },
        { name: 'Proposal', color: STAGE_COLORS[1], win_stage: false, lost_stage: false },
        { name: 'Confirmed', color: STAGE_COLORS[4], win_stage: false, lost_stage: false },
        { name: 'Completed', color: STAGE_COLORS[5], win_stage: true, lost_stage: false },
      ],
    },
  },

  // Sequence Templates
  {
    id: 'sequence-followup',
    name: 'Lead Follow-up (3-step WA)',
    description: 'Automated 3-step WhatsApp follow-up sequence for new leads',
    category: 'sequence',
    config: {
      steps: [
        { type: 'whatsapp', delay_hours: 0, content: 'Hi {{name}}! Thanks for your interest. How can we help you today?' },
        { type: 'whatsapp', delay_hours: 24, content: 'Hi {{name}}, just checking in. Did you have any questions about our services?' },
        { type: 'whatsapp', delay_hours: 72, content: 'Hi {{name}}, we wanted to follow up one more time. Let us know if there is anything we can do for you!' },
      ],
    },
  },
  {
    id: 'sequence-onboarding',
    name: 'Onboarding Welcome (Email)',
    description: 'Welcome email sequence for new customers during onboarding',
    category: 'sequence',
    config: {
      steps: [
        { type: 'email', delay_hours: 0, content: 'Welcome aboard! Here is everything you need to get started.' },
        { type: 'email', delay_hours: 48, content: 'How is your setup going? Here are some tips to get the most out of our platform.' },
        { type: 'email', delay_hours: 168, content: 'You have been with us for a week! Here are some advanced features to explore.' },
      ],
    },
  },
  {
    id: 'sequence-reengagement',
    name: 'Re-engagement Campaign',
    description: 'Win back inactive contacts with a multi-step re-engagement sequence',
    category: 'sequence',
    config: {
      steps: [
        { type: 'email', delay_hours: 0, content: 'We miss you! Here is what is new since you last visited.' },
        { type: 'whatsapp', delay_hours: 72, content: 'Hi {{name}}, we have some exciting updates we think you will love.' },
        { type: 'email', delay_hours: 168, content: 'Last chance: exclusive offer just for you to come back!' },
      ],
    },
  },
  {
    id: 'sequence-appointment',
    name: 'Appointment Reminder',
    description: 'Automated reminders before a scheduled appointment',
    category: 'sequence',
    config: {
      steps: [
        { type: 'whatsapp', delay_hours: 0, content: 'Reminder: You have an appointment scheduled. See you soon!' },
        { type: 'whatsapp', delay_hours: -24, content: 'Your appointment is tomorrow. Please confirm your attendance.' },
        { type: 'whatsapp', delay_hours: -1, content: 'Your appointment is in 1 hour. See you soon!' },
      ],
    },
  },

  // Automation Templates
  {
    id: 'auto-hot-lead',
    name: 'Notify on hot lead',
    description: 'Send a team notification when a high-value lead enters the pipeline',
    category: 'automation',
    config: {
      trigger_type: 'deal_created',
      trigger_config: { min_value: 10000 },
      action_type: 'notify_team',
      action_config: { message: 'New hot lead: {{deal_name}} worth {{deal_value}}' },
    },
  },
  {
    id: 'auto-task-deal',
    name: 'Auto-create task on new deal',
    description: 'Automatically create a follow-up task when a new deal is added',
    category: 'automation',
    config: {
      trigger_type: 'deal_created',
      trigger_config: {},
      action_type: 'create_task',
      action_config: { title: 'Follow up on {{deal_name}}', due_days: 2 },
    },
  },
  {
    id: 'auto-wa-won',
    name: 'Send WA when deal won',
    description: 'Send a congratulations WhatsApp message when a deal is marked as won',
    category: 'automation',
    config: {
      trigger_type: 'deal_won',
      trigger_config: {},
      action_type: 'send_whatsapp',
      action_config: { message: 'Great news! Your deal has been confirmed. Welcome aboard!' },
    },
  },
  {
    id: 'auto-weekly-digest',
    name: 'Weekly digest reminder',
    description: 'Send a weekly summary of pipeline activity to the team',
    category: 'automation',
    config: {
      trigger_type: 'schedule_weekly',
      trigger_config: { day: 'monday', hour: 9 },
      action_type: 'notify_team',
      action_config: { message: 'Weekly digest: Check your pipeline and update your deals!' },
    },
  },
]

const CATEGORY_META: Record<TemplateCategory, { label: string; icon: typeof Kanban; color: string }> = {
  pipeline: { label: 'Pipeline Templates', icon: Kanban, color: 'text-blue-600 bg-blue-50' },
  sequence: { label: 'Sequence Templates', icon: Mail, color: 'text-purple-600 bg-purple-50' },
  automation: { label: 'Automation Templates', icon: Zap, color: 'text-amber-600 bg-amber-50' },
}

export default function TemplatesMarketplacePage() {
  const { t } = useI18n()
  const { id: workspaceId } = useWorkspace()
  const supabase = createClient()
  const [installing, setInstalling] = useState<string | null>(null)
  const [installed, setInstalled] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<TemplateCategory | 'all'>('all')

  const installTemplate = useCallback(async (template: Template) => {
    if (!workspaceId) return
    setInstalling(template.id)

    try {
      if (template.category === 'pipeline') {
        const cfg = template.config as PipelineConfig
        // Count existing pipelines for order_index
        const { count } = await supabase.from('pipelines').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId)
        const orderIndex = count || 0

        const { data: pipeline } = await supabase.from('pipelines').insert([{
          workspace_id: workspaceId,
          name: template.name,
          color: STAGE_COLORS[orderIndex % STAGE_COLORS.length],
          order_index: orderIndex,
        }]).select().single()

        if (pipeline) {
          const stages = cfg.stages.map((s, i) => ({
            pipeline_id: pipeline.id,
            workspace_id: workspaceId,
            name: s.name,
            color: s.color,
            order_index: i,
            win_stage: s.win_stage,
            lost_stage: s.lost_stage,
          }))
          await supabase.from('pipeline_stages').insert(stages)
        }
        toast.success(`Pipeline "${template.name}" installed`)
      } else if (template.category === 'sequence') {
        const cfg = template.config as SequenceConfig
        const { data: sequence } = await supabase.from('sequences').insert([{
          workspace_id: workspaceId,
          name: template.name,
          enabled: false,
          trigger: 'manual',
        }]).select().single()

        if (sequence) {
          const steps = cfg.steps.map((s, i) => ({
            sequence_id: sequence.id,
            step_order: i,
            action_type: s.type === 'whatsapp' ? 'send_whatsapp' : 'send_email',
            action_config: { message: s.content },
            delay_minutes: Math.max(0, s.delay_hours * 60),
          }))
          await supabase.from('sequence_steps').insert(steps)
        }
        toast.success(`Sequence "${template.name}" installed`)
      } else if (template.category === 'automation') {
        const cfg = template.config as AutomationConfig
        await supabase.from('automations').insert([{
          workspace_id: workspaceId,
          name: template.name,
          enabled: false,
          trigger_type: cfg.trigger_type,
          trigger_config: cfg.trigger_config,
          action_type: cfg.action_type,
          action_config: cfg.action_config,
        }])
        toast.success(`Automation "${template.name}" installed`)
      }

      setInstalled(prev => { const next = new Set(Array.from(prev)); next.add(template.id); return next })
    } catch {
      toast.error('Failed to install template')
    } finally {
      setInstalling(null)
    }
  }, [workspaceId, supabase])

  const filtered = filter === 'all' ? TEMPLATES : TEMPLATES.filter(t => t.category === filter)
  const categories: (TemplateCategory | 'all')[] = ['all', 'pipeline', 'sequence', 'automation']

  return (
    <div className="animate-fade-in max-w-5xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav.marketplace')}</h1>
          <p className="page-subtitle">Pre-built templates to get you started quickly</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-6">
        <Filter className="w-4 h-4 text-surface-400" />
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              filter === cat
                ? 'bg-brand-600 text-white'
                : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
            )}
          >
            {cat === 'all' ? 'All' : CATEGORY_META[cat].label}
          </button>
        ))}
      </div>

      {/* Templates by Category */}
      {(['pipeline', 'sequence', 'automation'] as TemplateCategory[])
        .filter(cat => filter === 'all' || filter === cat)
        .map(cat => {
          const meta = CATEGORY_META[cat]
          const Icon = meta.icon
          const items = filtered.filter(t => t.category === cat)
          if (items.length === 0) return null

          return (
            <div key={cat} className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', meta.color)}>
                  <Icon className="w-4 h-4" />
                </div>
                <h2 className="font-semibold text-surface-900">{meta.label}</h2>
                <span className="text-xs text-surface-400 bg-surface-100 px-2 py-0.5 rounded-full">{items.length}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(template => {
                  const isInstalled = installed.has(template.id)
                  const isInstalling = installing === template.id

                  return (
                    <div key={template.id} className="card p-5 flex flex-col">
                      <div className="flex items-start gap-3 mb-3">
                        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', meta.color)}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-surface-900 truncate">{template.name}</h3>
                          <p className="text-xs text-surface-500 mt-0.5 line-clamp-2">{template.description}</p>
                        </div>
                      </div>

                      <div className="mt-auto pt-3">
                        {isInstalled ? (
                          <button disabled className="w-full py-2 px-3 rounded-lg bg-green-50 text-green-700 text-xs font-semibold flex items-center justify-center gap-1.5 border border-green-200">
                            <Check className="w-3.5 h-3.5" /> Installed
                          </button>
                        ) : (
                          <button
                            onClick={() => installTemplate(template)}
                            disabled={!!installing}
                            className="w-full py-2 px-3 rounded-lg bg-surface-900 text-white text-xs font-semibold hover:bg-surface-800 transition-colors flex items-center justify-center gap-1.5"
                          >
                            {isInstalling ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5" />
                            )}
                            {isInstalling ? 'Installing...' : 'Install'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
    </div>
  )
}
