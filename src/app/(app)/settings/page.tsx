'use client'
import { toast } from 'sonner'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, Trash2, GripVertical, Save, Kanban, Palette, Users, Globe, Upload, CheckCircle2, Type, Database, ChevronDown, ChevronRight, MessageCircle, Route, FormInput, FileText, Shield, Lock, Sliders, UserCog, Building2, CreditCard, Plug, Tag, Map } from 'lucide-react'
import CostVisibilityWidget from '@/components/shared/CostVisibilityWidget'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/context'
import { LOCALES } from '@/lib/i18n/translations'
import type { PipelineStage } from '@/types'
import { getActiveWorkspace } from '@/lib/get-active-workspace'

const STAGE_COLORS = ['#0891B2','#8b5cf6','#ec4899','#f97316','#f59e0b','#10b981','#06b6d4','#64748b']
const BRAND_COLORS = ['#0891B2','#8b5cf6','#ec4899','#ef4444','#f97316','#f59e0b','#10b981','#06b6d4','#3b82f6','#64748b']
const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
  { value: 'boolean', label: 'Yes/No' },
  { value: 'url', label: 'URL' },
]

interface Pipeline {
  id: string
  name: string
  color: string
  workspace_id: string
  order_index: number
  contact_id?: string | null
}

interface CompanyContact {
  id: string
  name: string
}

interface CustomField {
  id: string
  workspace_id: string
  entity: string
  label: string
  key: string
  type: string
  options?: string[]
  required: boolean
  order_index: number
}

export default function SettingsPage() {
  const supabase = createClient()
  const { t, locale, setLocale } = useI18n()
  const [tab, setTab] = useState<'pipelines' | 'terminology' | 'fields' | 'brand' | 'language' | 'team' | 'whatsapp_bot' | 'lead_routing'>('pipelines')
  const [pipelines, setPipelines] = useState<(Pipeline & { stages: PipelineStage[] })[]>([])
  const [expandedPipeline, setExpandedPipeline] = useState<string | null>(null)
  const [companies, setCompanies] = useState<CompanyContact[]>([])
  const [workspaceId, setWorkspaceId] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#0891B2')
  const [logoUrl, setLogoUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  // White-label branding
  const [customDomain, setCustomDomain] = useState('')
  const [faviconUrl, setFaviconUrl] = useState('')
  const [loginMessage, setLoginMessage] = useState('')
  const [poweredByVisible, setPoweredByVisible] = useState(true)

  // Terminology
  const [dealLabel, setDealLabel] = useState({ singular: 'Deal', plural: 'Deals' })
  const [contactLabel, setContactLabel] = useState({ singular: 'Contact', plural: 'Contacts' })
  const [pipelineLabel, setPipelineLabel] = useState({ singular: 'Pipeline', plural: 'Pipelines' })

  // Custom fields
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [fieldEntity, setFieldEntity] = useState<'deal' | 'contact'>('deal')

  // WhatsApp Bot
  const [botEnabled, setBotEnabled] = useState(false)
  const [botGreeting, setBotGreeting] = useState('Hi! Thanks for contacting us. Let me ask a few questions to help you better.')
  const [botQuestions, setBotQuestions] = useState<string[]>([])
  const [botQualifyKeyword, setBotQualifyKeyword] = useState('')

  // AI Auto-Reply
  const [aiEnabled, setAiEnabled] = useState(false)
  const [aiInstructions, setAiInstructions] = useState('')
  const [aiThreshold, setAiThreshold] = useState<'high' | 'medium' | 'all'>('medium')

  // Lead Routing
  const [routingEnabled, setRoutingEnabled] = useState(false)
  const [routingMode, setRoutingMode] = useState<'round_robin' | 'least_loaded' | 'smart' | 'manual'>('round_robin')
  const [routingReps, setRoutingReps] = useState<string[]>([])
  const [routingLastIndex, setRoutingLastIndex] = useState(0)
  const [routingRepConfigs, setRoutingRepConfigs] = useState<Record<string, { services: string; startHour: number; endHour: number }>>({})
  const [routingFallback, setRoutingFallback] = useState('')
  const [autoSequenceEnabled, setAutoSequenceEnabled] = useState(false)
  const [autoSequenceId, setAutoSequenceId] = useState('')
  const [autoSequenceHours, setAutoSequenceHours] = useState(24)
  const [sequences, setSequences] = useState<{ id: string; name: string }[]>([])
  const [teamProfiles, setTeamProfiles] = useState<{ id: string; full_name: string; email: string }[]>([])

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const ws = await getActiveWorkspace(supabase, user.id, '*')
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)
    setWorkspaceName(ws.name)
    setPrimaryColor(ws.primary_color || '#0891B2')
    setLogoUrl(ws.logo_url || '')
    setCustomDomain(ws.custom_domain || '')

    // Load branding config
    if (ws.branding_config) {
      const bc = ws.branding_config as { favicon_url?: string; login_message?: string; powered_by_visible?: boolean }
      setFaviconUrl(bc.favicon_url || '')
      setLoginMessage(bc.login_message || '')
      setPoweredByVisible(bc.powered_by_visible !== false)
    }

    // Load WhatsApp bot config
    if (ws.whatsapp_bot_config) {
      const bot = ws.whatsapp_bot_config as { enabled: boolean; greeting: string; questions: string[]; qualify_keyword: string; ai_enabled?: boolean; ai_instructions?: string; ai_threshold?: 'high' | 'medium' | 'all' }
      setBotEnabled(bot.enabled ?? false)
      if (bot.greeting) setBotGreeting(bot.greeting)
      if (bot.questions) setBotQuestions(bot.questions)
      if (bot.qualify_keyword) setBotQualifyKeyword(bot.qualify_keyword)
      setAiEnabled(bot.ai_enabled ?? false)
      if (bot.ai_instructions) setAiInstructions(bot.ai_instructions)
      if (bot.ai_threshold) setAiThreshold(bot.ai_threshold)
    }

    // Load lead routing config
    if (ws.lead_routing_config) {
      const rc = ws.lead_routing_config as { enabled: boolean; mode: 'round_robin' | 'least_loaded' | 'smart' | 'manual'; reps: string[]; last_assigned_index: number; rep_configs?: { id: string; services?: string[]; schedule?: { start: number; end: number } }[]; fallback_rep?: string; auto_sequence?: { enabled: boolean; sequence_id: string; no_reply_hours: number } }
      setRoutingEnabled(rc.enabled ?? false)
      setRoutingMode(rc.mode ?? 'round_robin')
      setRoutingReps(rc.reps ?? [])
      setRoutingLastIndex(rc.last_assigned_index ?? 0)
      setRoutingFallback(rc.fallback_rep ?? '')
      if (rc.auto_sequence) {
        setAutoSequenceEnabled(rc.auto_sequence.enabled ?? false)
        setAutoSequenceId(rc.auto_sequence.sequence_id ?? '')
        setAutoSequenceHours(rc.auto_sequence.no_reply_hours ?? 24)
      }
      if (rc.rep_configs) {
        const configs: Record<string, { services: string; startHour: number; endHour: number }> = {}
        for (const rpc of rc.rep_configs) {
          configs[rpc.id] = { services: (rpc.services || []).join(', '), startHour: rpc.schedule?.start ?? 9, endHour: rpc.schedule?.end ?? 18 }
        }
        setRoutingRepConfigs(configs)
      }
    }

    // Load team profiles for routing
    const { data: teamData } = await supabase.from('profiles').select('id, full_name, email').eq('workspace_id', ws.id)
    setTeamProfiles((teamData || []) as { id: string; full_name: string; email: string }[])

    // Load sequences for auto-enrollment
    const { data: seqData } = await supabase.from('sequences').select('id, name').eq('workspace_id', ws.id).eq('enabled', true)
    setSequences((seqData || []) as { id: string; name: string }[])

    // Load terminology
    if (ws.terminology) {
      const term = ws.terminology as Record<string, { singular: string; plural: string }>
      if (term.deal) setDealLabel(term.deal)
      if (term.contact) setContactLabel(term.contact)
      if (term.pipeline) setPipelineLabel(term.pipeline)
    }

    // Load companies for pipeline association
    const { data: companiesData } = await supabase.from('contacts').select('id, name').eq('workspace_id', ws.id).order('name')
    setCompanies(companiesData || [])

    // Load all pipelines with their stages
    const { data: pipelinesData } = await supabase.from('pipelines').select('*').eq('workspace_id', ws.id).order('order_index')
    const pipelinesList = pipelinesData || []

    if (pipelinesList.length === 0 && !ws.onboarding_completed) {
      // Create default pipeline
      const { data: newPipeline } = await supabase.from('pipelines').insert([{
        workspace_id: ws.id, name: 'Sales Pipeline', color: '#0891B2', order_index: 0,
      }]).select().single()
      if (newPipeline) {
        const defaults = ['Lead','Qualified','Proposal','Negotiation','Closed Won'].map((name, i) => ({
          pipeline_id: newPipeline.id, workspace_id: ws.id, name, order_index: i,
          color: STAGE_COLORS[i], win_stage: name === 'Closed Won', lost_stage: false,
        }))
        const { data: stages } = await supabase.from('pipeline_stages').insert(defaults).select()
        pipelinesList.push(newPipeline)
        setPipelines([{ ...newPipeline, stages: stages || [] }])
        setExpandedPipeline(newPipeline.id)
      }
    } else {
      // Load stages for each pipeline
      const withStages = await Promise.all(pipelinesList.map(async (p: Pipeline) => {
        const { data: stages } = await supabase.from('pipeline_stages').select('*').eq('pipeline_id', p.id).order('order_index')
        return { ...p, stages: stages || [] }
      }))
      setPipelines(withStages)
      if (withStages.length > 0) setExpandedPipeline(withStages[0].id)
    }

    // Load custom fields
    const { data: fields } = await supabase.from('custom_field_defs').select('*').eq('workspace_id', ws.id).order('order_index')
    setCustomFields(fields || [])

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // --- PIPELINE FUNCTIONS ---
  const addPipeline = async () => {
    const { data } = await supabase.from('pipelines').insert([{
      workspace_id: workspaceId, name: `New ${pipelineLabel.singular}`, color: STAGE_COLORS[pipelines.length % STAGE_COLORS.length], order_index: pipelines.length,
    }]).select().single()
    if (data) {
      setPipelines(prev => [...prev, { ...data, stages: [] }])
      setExpandedPipeline(data.id)
    }
  }

  const deletePipeline = async (id: string) => {
    await supabase.from('pipeline_stages').delete().eq('pipeline_id', id)
    await supabase.from('pipelines').delete().eq('id', id)
    setPipelines(prev => prev.filter(p => p.id !== id))
  }

  const updatePipelineName = (id: string, name: string) => {
    setPipelines(prev => prev.map(p => p.id === id ? { ...p, name } : p))
  }

  const updatePipelineClient = (id: string, contactId: string) => {
    setPipelines(prev => prev.map(p => p.id === id ? { ...p, contact_id: contactId || null } : p))
  }

  const addStage = (pipelineId: string) => {
    const pipeline = pipelines.find(p => p.id === pipelineId)
    if (!pipeline) return
    const newStage: { id: string; pipeline_id: string; workspace_id: string; name: string; order_index: number; color: string; win_stage: boolean; lost_stage: boolean; created_at: string } = {
      id: `temp-${Date.now()}`, pipeline_id: pipelineId, workspace_id: workspaceId,
      name: 'New Stage', order_index: pipeline.stages.length, color: STAGE_COLORS[pipeline.stages.length % STAGE_COLORS.length],
      win_stage: false, lost_stage: false, created_at: new Date().toISOString(),
    }
    setPipelines(prev => prev.map(p => p.id === pipelineId ? { ...p, stages: [...p.stages, newStage] } : p))
  }

  const updateStage = (pipelineId: string, stageId: string, field: string, value: string | boolean | number | string[]) => {
    setPipelines(prev => prev.map(p => p.id === pipelineId
      ? { ...p, stages: p.stages.map(s => s.id === stageId ? { ...s, [field]: value } : s) }
      : p
    ))
  }

  const removeStage = (pipelineId: string, stageId: string) => {
    setPipelines(prev => prev.map(p => p.id === pipelineId
      ? { ...p, stages: p.stages.filter(s => s.id !== stageId) }
      : p
    ))
  }

  const savePipelines = async () => {
    setSaving(true)
    for (const pipeline of pipelines) {
      await supabase.from('pipelines').update({ name: pipeline.name, color: pipeline.color, contact_id: pipeline.contact_id || null }).eq('id', pipeline.id)

      const existing = pipeline.stages.filter(s => !s.id.startsWith('temp-')).map(s => s.id)
      if (existing.length > 0) {
        await supabase.from('pipeline_stages').delete().eq('pipeline_id', pipeline.id).not('id', 'in', `(${existing.join(',')})`)
      } else {
        await supabase.from('pipeline_stages').delete().eq('pipeline_id', pipeline.id)
      }

      for (let i = 0; i < pipeline.stages.length; i++) {
        const stage = pipeline.stages[i]
        const stageData = { ...stage, order_index: i }
        if (stage.id.startsWith('temp-')) {
          const { id, ...rest } = stageData
          await supabase.from('pipeline_stages').insert([rest])
        } else {
          await supabase.from('pipeline_stages').update(stageData).eq('id', stage.id)
        }
      }
    }
    await load()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // --- TERMINOLOGY ---
  const saveTerminology = async () => {
    setSaving(true)
    await supabase.from('workspaces').update({
      terminology: { deal: dealLabel, contact: contactLabel, pipeline: pipelineLabel },
    }).eq('id', workspaceId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // --- CUSTOM FIELDS ---
  const addField = () => {
    const newField: { id: string; workspace_id: string; entity: string; label: string; key: string; type: string; options: string[]; required: boolean; order_index: number } = {
      id: `temp-${Date.now()}`, workspace_id: workspaceId, entity: fieldEntity,
      label: '', key: '', type: 'text', options: [], required: false,
      order_index: customFields.filter(f => f.entity === fieldEntity).length,
    }
    setCustomFields(prev => [...prev, newField])
  }

  const updateField = (id: string, field: string, value: string | boolean | string[]) => {
    setCustomFields(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f))
  }

  const removeField = async (id: string) => {
    if (!id.startsWith('temp-')) {
      await supabase.from('custom_field_defs').delete().eq('id', id)
    }
    setCustomFields(prev => prev.filter(f => f.id !== id))
  }

  const saveFields = async () => {
    setSaving(true)
    const fieldsToSave = customFields.filter(f => f.entity === fieldEntity)
    for (let i = 0; i < fieldsToSave.length; i++) {
      const field = fieldsToSave[i]
      const data = {
        workspace_id: field.workspace_id, entity: field.entity,
        label: field.label, key: field.label.toLowerCase().replace(/\s+/g, '_'),
        type: field.type, options: field.options?.length ? field.options : null,
        required: field.required, order_index: i,
      }
      if (field.id.startsWith('temp-')) {
        await supabase.from('custom_field_defs').insert([data])
      } else {
        await supabase.from('custom_field_defs').update(data).eq('id', field.id)
      }
    }
    await load()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // --- BRAND ---
  const saveBrand = async () => {
    setSaving(true)
    await supabase.from('workspaces').update({
      name: workspaceName,
      primary_color: primaryColor,
      logo_url: logoUrl || null,
      custom_domain: customDomain || null,
      branding_config: {
        favicon_url: faviconUrl || null,
        login_message: loginMessage || null,
        powered_by_visible: poweredByVisible,
      },
    }).eq('id', workspaceId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || file.size > 2 * 1024 * 1024) return
    const ext = file.name.split('.').pop()
    const path = `${workspaceId}/logo.${ext}`
    const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('logos').getPublicUrl(path)
      setLogoUrl(data.publicUrl)
    }
  }

  const handleLanguageChange = async (newLocale: string) => {
    setLocale(newLocale as 'en' | 'es' | 'fr' | 'de' | 'pt')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // --- WHATSAPP BOT ---
  const saveBotConfig = async () => {
    setSaving(true)
    await supabase.from('workspaces').update({
      whatsapp_bot_config: {
        enabled: botEnabled,
        greeting: botGreeting,
        questions: botQuestions.filter(q => q.trim()),
        qualify_keyword: botQualifyKeyword,
        ai_enabled: aiEnabled,
        ai_instructions: aiInstructions,
        ai_threshold: aiThreshold,
      },
    }).eq('id', workspaceId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // --- LEAD ROUTING ---
  const saveRoutingConfig = async () => {
    setSaving(true)
    await supabase.from('workspaces').update({
      lead_routing_config: {
        enabled: routingEnabled,
        mode: routingMode,
        reps: routingReps,
        last_assigned_index: routingLastIndex,
        fallback_rep: routingFallback || null,
        auto_sequence: {
          enabled: autoSequenceEnabled,
          sequence_id: autoSequenceId,
          no_reply_hours: autoSequenceHours,
        },
        rep_configs: routingReps.map(id => ({
          id,
          services: (routingRepConfigs[id]?.services || '').split(',').map(s => s.trim()).filter(Boolean),
          schedule: { start: routingRepConfigs[id]?.startHour ?? 9, end: routingRepConfigs[id]?.endHour ?? 18 },
        })),
      },
    }).eq('id', workspaceId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const toggleRoutingRep = (repId: string) => {
    setRoutingReps(prev =>
      prev.includes(repId) ? prev.filter(id => id !== repId) : [...prev, repId]
    )
  }

  const getNextRepName = (): string => {
    if (!routingEnabled || routingReps.length === 0) return 'N/A'
    if (routingMode === 'manual') return 'Manual assignment'
    if (routingMode === 'least_loaded') return 'Rep with fewest open leads'
    const nextIndex = (routingLastIndex + 1) % routingReps.length
    const nextRep = teamProfiles.find(p => p.id === routingReps[nextIndex])
    return nextRep?.full_name || nextRep?.email || 'Unknown'
  }

  const TABS = [
    { id: 'pipelines', label: pipelineLabel.plural, icon: Kanban },
    { id: 'terminology', label: t('settings.tab_terminology'), icon: Type },
    { id: 'fields', label: t('settings.tab_custom_fields'), icon: Database },
    { id: 'brand', label: t('settings.brand'), icon: Palette },
    { id: 'language', label: t('settings.language'), icon: Globe },
    { id: 'team', label: t('settings.team'), icon: Users },
    { id: 'whatsapp_bot', label: t('settings.tab_whatsapp_bot'), icon: MessageCircle },
    { id: 'lead_routing', label: t('settings.tab_lead_routing'), icon: Route },
  ] as const

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in max-w-3xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('settings.title')}</h1>
          <p className="page-subtitle">{t('settings.subtitle')}</p>
        </div>
        <button
          onClick={() => {
            try { localStorage.removeItem('tracktio_tour_completed') } catch {}
            window.dispatchEvent(new CustomEvent('tracktio:start-tour'))
          }}
          className="btn-sm border border-surface-200 text-surface-600 hover:bg-surface-50 rounded-lg px-3 py-1.5 text-xs font-medium"
        >
          Show tour
        </button>
      </div>

      {/* Cost visibility */}
      <div className="mb-6">
        <CostVisibilityWidget />
      </div>

      {/* Settings hub: links to all sub-module settings, grouped by category */}
      <div className="mb-8 space-y-5">
        {[
          {
            category: t('settings.cat_personalization'),
            items: [
              { href: '/settings/form-builder', icon: FormInput, label: t('settings.hub.form_builder_label'), desc: t('settings.hub.form_builder_desc') },
              { href: '/settings/templates', icon: FileText, label: t('settings.hub.templates_label'), desc: t('settings.hub.templates_desc') },
              { href: '/settings/stage-conditions', icon: Sliders, label: t('settings.hub.stage_conditions_label'), desc: t('settings.hub.stage_conditions_desc') },
              { href: '/settings/loss-reasons', icon: Tag, label: t('settings.hub.loss_reasons_label'), desc: t('settings.hub.loss_reasons_desc') },
            ],
          },
          {
            category: t('settings.cat_permissions'),
            items: [
              { href: '/roles', icon: Shield, label: t('settings.hub.roles_label'), desc: t('settings.hub.roles_desc') },
              { href: '/settings/field-permissions', icon: Lock, label: t('settings.hub.field_perms_label'), desc: t('settings.hub.field_perms_desc') },
              { href: '/team', icon: UserCog, label: t('settings.hub.team_label'), desc: t('settings.hub.team_desc') },
            ],
          },
          {
            category: t('settings.cat_account'),
            items: [
              { href: '/billing', icon: CreditCard, label: t('settings.hub.billing_label'), desc: t('settings.hub.billing_desc') },
              { href: '/roadmap', icon: Map, label: 'Public Roadmap', desc: 'Vote on features and submit ideas' },
            ],
          },
          {
            category: t('settings.cat_integrations'),
            items: [
              { href: '/integrations', icon: Plug, label: t('settings.hub.integrations_label'), desc: t('settings.hub.integrations_desc') },
              { href: '/settings/migrate', icon: Database, label: 'Import from other CRM', desc: 'Migrate from HubSpot, Pipedrive, Zoho or CSV' },
            ],
          },
        ].map(group => (
          <div key={group.category}>
            <p className="text-[11px] font-bold text-surface-500 uppercase tracking-wider mb-2">{group.category}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {group.items.map(({ href, icon: Icon, label, desc }) => (
                <Link key={href} href={href} className="card p-4 hover:border-brand-300 hover:shadow-sm transition-all flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-brand-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-surface-900">{label}</p>
                    <p className="text-xs text-surface-500 mt-0.5 line-clamp-1">{desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="segmented-control mb-8 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            data-active={tab === id}
            className={cn(tab === id && 'active')}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* ==================== PIPELINES TAB ==================== */}
      {tab === 'pipelines' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-surface-900">{t('settings.your_pipelines')}</h2>
              <p className="text-xs text-surface-500 mt-0.5">{t('settings.pipelines_hint')}</p>
            </div>
            <button onClick={addPipeline} className="btn-secondary btn-sm"><Plus className="w-3.5 h-3.5" /> {t('settings.add_pipeline')}</button>
          </div>

          {pipelines.map(pipeline => (
            <div key={pipeline.id} className="card overflow-hidden">
              {/* Pipeline header */}
              <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-surface-50 transition-colors"
                onClick={() => setExpandedPipeline(expandedPipeline === pipeline.id ? null : pipeline.id)}>
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: pipeline.color }} />
                <input value={pipeline.name}
                  onChange={e => updatePipelineName(pipeline.id, e.target.value)}
                  onClick={e => e.stopPropagation()}
                  className="flex-1 bg-transparent font-semibold text-surface-900 focus:outline-none border-b border-transparent focus:border-brand-400 text-sm" />
                <span className="text-xs text-surface-400 font-medium">{pipeline.stages.length} {t('settings.stages_count')}</span>
                {pipelines.length > 1 && (
                  <button onClick={e => { e.stopPropagation(); deletePipeline(pipeline.id) }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-surface-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {expandedPipeline === pipeline.id ? <ChevronDown className="w-4 h-4 text-surface-400" /> : <ChevronRight className="w-4 h-4 text-surface-400" />}
              </div>

              {/* Expanded content */}
              {expandedPipeline === pipeline.id && (
                <div className="border-t border-surface-100 p-4">
                  {/* Client association */}
                  {companies.length > 0 && (
                    <div className="mb-4 p-3 bg-surface-50 rounded-xl border border-surface-100">
                      <label className="text-[10px] font-semibold text-surface-400 uppercase tracking-wide">{t('settings.assigned_client_optional')}</label>
                      <select className="input mt-1.5 text-sm" value={pipeline.contact_id || ''}
                        onChange={e => updatePipelineClient(pipeline.id, e.target.value)}>
                        <option value="">{t('settings.no_client_general')}</option>
                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <p className="text-[11px] text-surface-400 mt-1">{t('settings.assigned_client_hint')}</p>
                    </div>
                  )}

                  {/* Stages */}
                  <div className="space-y-2 mb-4">
                    {pipeline.stages.map(stage => (
                      <div key={stage.id}>
                      <div className="flex items-center gap-3 p-3 bg-surface-50 rounded-xl border border-surface-100">
                        <GripVertical className="w-4 h-4 text-surface-300 flex-shrink-0 cursor-grab" />
                        <div className="relative flex-shrink-0">
                          <div className="w-7 h-7 rounded-lg border-2 border-white shadow-sm cursor-pointer" style={{ backgroundColor: stage.color }}>
                            <input type="color" value={stage.color} onChange={e => updateStage(pipeline.id, stage.id, 'color', e.target.value)}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                          </div>
                        </div>
                        <input value={stage.name} onChange={e => updateStage(pipeline.id, stage.id, 'name', e.target.value)}
                          className="flex-1 bg-transparent text-sm font-medium text-surface-800 focus:outline-none border-b border-transparent focus:border-brand-400 pb-0.5 min-w-0" />
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={stage.win_stage} onChange={e => updateStage(pipeline.id, stage.id, 'win_stage', e.target.checked)} className="w-3.5 h-3.5 accent-emerald-500" />
                            <span className="text-[10px] font-semibold text-emerald-600 uppercase">{t('settings.won')}</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={stage.lost_stage} onChange={e => updateStage(pipeline.id, stage.id, 'lost_stage', e.target.checked)} className="w-3.5 h-3.5 accent-red-500" />
                            <span className="text-[10px] font-semibold text-red-500 uppercase">{t('settings.lost')}</span>
                          </label>
                          <button onClick={() => removeStage(pipeline.id, stage.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-surface-300 hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-5 mt-1 flex-wrap">
                        <span className="text-[9px] text-surface-400 font-semibold uppercase">{t('settings.require_label')}</span>
                        {[
                          { key: 'value', label: t('settings.req_value') },
                          { key: 'contact', label: t('settings.req_contact') },
                          { key: 'close_date', label: t('settings.req_close_date') },
                          { key: 'probability', label: t('settings.req_probability') },
                        ].map(rf => {
                          const reqs = (stage.required_fields as string[]) || []
                          const checked = reqs.includes(rf.key)
                          return (
                            <label key={rf.key} className="flex items-center gap-1 cursor-pointer">
                              <input type="checkbox" checked={checked} className="w-3 h-3"
                                onChange={() => {
                                  const updated = checked ? reqs.filter((r: string) => r !== rf.key) : [...reqs, rf.key]
                                  updateStage(pipeline.id, stage.id, 'required_fields', updated)
                                }} />
                              <span className="text-[10px] text-surface-500">{rf.label}</span>
                            </label>
                          )
                        })}
                      </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => addStage(pipeline.id)} className="btn-ghost btn-sm w-full justify-center border border-dashed border-surface-200">
                    <Plus className="w-3.5 h-3.5" /> {t('settings.add_stage')}
                  </button>
                </div>
              )}
            </div>
          ))}

          <button onClick={savePipelines} disabled={saving} className="btn-primary">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? t('settings.saved') : t('settings.save_all_pipelines')}
          </button>
        </div>
      )}

      {/* ==================== TERMINOLOGY TAB ==================== */}
      {tab === 'terminology' && (
        <div className="card p-6">
          <h2 className="font-semibold text-surface-900 mb-1">{t('settings.customize_terminology')}</h2>
          <p className="text-xs text-surface-500 mb-6">{t('settings.terminology_desc')}</p>

          <div className="space-y-6">
            <div className="p-4 bg-surface-50 rounded-xl space-y-3">
              <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wide">{t('settings.term_deal_q')}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('settings.singular')}</label>
                  <input className="input" value={dealLabel.singular} onChange={e => setDealLabel(v => ({ ...v, singular: e.target.value }))} placeholder="Deal" />
                </div>
                <div>
                  <label className="label">{t('settings.plural')}</label>
                  <input className="input" value={dealLabel.plural} onChange={e => setDealLabel(v => ({ ...v, plural: e.target.value }))} placeholder="Deals" />
                </div>
              </div>
              <p className="text-[11px] text-surface-400">{t('settings.term_deal_examples')}</p>
            </div>

            <div className="p-4 bg-surface-50 rounded-xl space-y-3">
              <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wide">{t('settings.term_contact_q')}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('settings.singular')}</label>
                  <input className="input" value={contactLabel.singular} onChange={e => setContactLabel(v => ({ ...v, singular: e.target.value }))} placeholder="Contact" />
                </div>
                <div>
                  <label className="label">{t('settings.plural')}</label>
                  <input className="input" value={contactLabel.plural} onChange={e => setContactLabel(v => ({ ...v, plural: e.target.value }))} placeholder="Contacts" />
                </div>
              </div>
              <p className="text-[11px] text-surface-400">{t('settings.term_contact_examples')}</p>
            </div>

            <div className="p-4 bg-surface-50 rounded-xl space-y-3">
              <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wide">{t('settings.term_pipeline_q')}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t('settings.singular')}</label>
                  <input className="input" value={pipelineLabel.singular} onChange={e => setPipelineLabel(v => ({ ...v, singular: e.target.value }))} placeholder="Pipeline" />
                </div>
                <div>
                  <label className="label">{t('settings.plural')}</label>
                  <input className="input" value={pipelineLabel.plural} onChange={e => setPipelineLabel(v => ({ ...v, plural: e.target.value }))} placeholder="Pipelines" />
                </div>
              </div>
              <p className="text-[11px] text-surface-400">{t('settings.term_pipeline_examples')}</p>
            </div>
          </div>

          <button onClick={saveTerminology} disabled={saving} className="btn-primary mt-6">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? t('settings.saved') : t('settings.save_terminology')}
          </button>
        </div>
      )}

      {/* ==================== CUSTOM FIELDS TAB ==================== */}
      {tab === 'fields' && (
        <div className="space-y-4">
          <div>
            <h2 className="font-semibold text-surface-900 mb-1">{t('settings.custom_fields')}</h2>
            <p className="text-xs text-surface-500">{t('settings.custom_fields_desc')}</p>
          </div>

          {/* Entity toggle */}
          <div className="flex gap-2 p-1 bg-surface-100 rounded-xl w-fit">
            {(['deal', 'contact'] as const).map(entity => (
              <button key={entity} onClick={() => setFieldEntity(entity)}
                className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  fieldEntity === entity ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500 hover:text-surface-700')}>
                {entity === 'deal' ? `${dealLabel.singular} Fields` : `${contactLabel.singular} Fields`}
              </button>
            ))}
          </div>

          <div className="card p-6">
            <div className="space-y-3 mb-4">
              {customFields.filter(f => f.entity === fieldEntity).map(field => (
                <div key={field.id} className="flex items-start gap-3 p-3 bg-surface-50 rounded-xl border border-surface-100">
                  <GripVertical className="w-4 h-4 text-surface-300 flex-shrink-0 mt-2.5 cursor-grab" />
                  <div className="flex-1 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input value={field.label} onChange={e => updateField(field.id, 'label', e.target.value)}
                        placeholder={t('settings.field_name_placeholder')} className="input text-sm" />
                      <select value={field.type} onChange={e => updateField(field.id, 'type', e.target.value)} className="input text-sm">
                        {FIELD_TYPES.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                      </select>
                    </div>
                    {field.type === 'select' && (
                      <input value={(field.options || []).join(', ')}
                        onChange={e => updateField(field.id, 'options', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                        placeholder="Option 1, Option 2, Option 3"
                        className="input text-xs" />
                    )}
                  </div>
                  <button onClick={() => removeField(field.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-surface-300 hover:text-red-500 transition-colors mt-1.5">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {customFields.filter(f => f.entity === fieldEntity).length === 0 && (
                <div className="text-center py-8 border-2 border-dashed border-surface-200 rounded-xl">
                  <Database className="w-8 h-8 text-surface-300 mx-auto mb-2" />
                  <p className="text-sm text-surface-500 font-medium">{t('settings.no_custom_fields')}</p>
                  <p className="text-xs text-surface-400 mt-0.5">{t('settings.no_custom_fields_hint')}</p>
                </div>
              )}
            </div>

            <button onClick={addField} className="btn-ghost btn-sm w-full justify-center border border-dashed border-surface-200 mb-4">
              <Plus className="w-3.5 h-3.5" /> {t('settings.add_field')}
            </button>

            {customFields.filter(f => f.entity === fieldEntity).length > 0 && (
              <button onClick={saveFields} disabled={saving} className="btn-primary">
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                {saved ? t('settings.saved') : t('settings.save_fields')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ==================== BRAND TAB ==================== */}
      {tab === 'brand' && (
        <div className="card p-6">
          <h2 className="font-semibold text-surface-900 mb-1">{t('settings.brand')}</h2>
          <p className="text-xs text-surface-500 mb-6">{t('settings.brand_desc')}</p>
          <div className="space-y-6">
            <div>
              <label className="label">{t('settings.workspace_name')}</label>
              <input className="input" value={workspaceName} onChange={e => setWorkspaceName(e.target.value)} placeholder="My Company" />
            </div>
            <div>
              <label className="label">{t('settings.brand_logo')}</label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-surface-200 flex items-center justify-center overflow-hidden bg-surface-50 relative">
                  {logoUrl ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-2" /> : <Upload className="w-8 h-8 text-surface-300" />}
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
                <div>
                  <p className="text-sm font-medium text-surface-700">{t('settings.upload_logo')}</p>
                  <p className="text-xs text-surface-400 mt-0.5">PNG, JPG, SVG (max 2MB)</p>
                  {logoUrl && <button onClick={() => setLogoUrl('')} className="text-xs text-red-500 hover:text-red-600 mt-1 font-medium">{t('common.delete')}</button>}
                </div>
              </div>
            </div>
            <div>
              <label className="label">{t('settings.brand_color')}</label>
              <div className="flex items-center gap-3 flex-wrap">
                {BRAND_COLORS.map(color => (
                  <button key={color} onClick={() => setPrimaryColor(color)}
                    className={cn('w-10 h-10 rounded-xl transition-all border-2', primaryColor === color ? 'border-surface-900 scale-110 shadow-lg' : 'border-transparent hover:scale-105')}
                    style={{ backgroundColor: color }} />
                ))}
                <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-10 h-10 rounded-xl cursor-pointer border-2 border-surface-200" />
              </div>
            </div>
            {/* Custom Domain */}
            <div>
              <label className="label">{t('settings.custom_domain')}</label>
              <input className="input" value={customDomain} onChange={e => setCustomDomain(e.target.value)} placeholder="crm.mycompany.com" />
              <p className="text-[11px] text-surface-400 mt-1">{t('settings.custom_domain_hint')}</p>
            </div>

            {/* Favicon URL */}
            <div>
              <label className="label">{t('settings.favicon_url')}</label>
              <input className="input" value={faviconUrl} onChange={e => setFaviconUrl(e.target.value)} placeholder="https://mycompany.com/favicon.ico" />
              <p className="text-[11px] text-surface-400 mt-1">{t('settings.favicon_url_hint')}</p>
            </div>

            {/* Custom Login Message */}
            <div>
              <label className="label">{t('settings.custom_login_msg')}</label>
              <textarea className="input resize-none" rows={3} value={loginMessage} onChange={e => setLoginMessage(e.target.value)} />
              <p className="text-[11px] text-surface-400 mt-1">{t('settings.custom_login_msg_hint')}</p>
            </div>

            {/* Powered by Toggle */}
            <div className="flex items-center justify-between p-4 bg-surface-50 rounded-xl border border-surface-100">
              <div>
                <p className="text-sm font-semibold text-surface-900">{t('settings.show_powered_by')}</p>
                <p className="text-xs text-surface-400 mt-0.5">{t('settings.show_powered_by_hint')}</p>
              </div>
              <button onClick={() => setPoweredByVisible(!poweredByVisible)}
                className={cn('relative w-11 h-6 rounded-full transition-colors', poweredByVisible ? 'bg-brand-600' : 'bg-surface-300')}>
                <span className={cn('absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform', poweredByVisible ? 'translate-x-5.5 left-0.5' : 'left-0.5')} />
              </button>
            </div>

            <button onClick={saveBrand} disabled={saving} className="btn-primary">
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              {saved ? t('settings.saved') : t('settings.save_changes')}
            </button>
          </div>
        </div>
      )}

      {/* ==================== LANGUAGE TAB ==================== */}
      {tab === 'language' && (
        <div className="card p-6">
          <h2 className="font-semibold text-surface-900 mb-1">{t('settings.language')}</h2>
          <p className="text-xs text-surface-500 mb-6">{t('settings.language_select')}</p>
          <div className="space-y-2">
            {LOCALES.map(loc => (
              <button key={loc.code} onClick={() => handleLanguageChange(loc.code)}
                className={cn('w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left',
                  locale === loc.code ? 'border-brand-500 bg-brand-50' : 'border-surface-200 hover:border-surface-300')}>
                <span className="text-2xl">{loc.flag}</span>
                <p className={cn('font-semibold text-sm flex-1', locale === loc.code ? 'text-brand-700' : 'text-surface-800')}>{loc.name}</p>
                {locale === loc.code && <CheckCircle2 className="w-5 h-5 text-brand-600" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ==================== WHATSAPP BOT TAB ==================== */}
      {tab === 'whatsapp_bot' && (
        <div className="card p-6">
          <h2 className="font-semibold text-surface-900 mb-1">{t('settings.wabot_title')}</h2>
          <p className="text-xs text-surface-500 mb-6">{t('settings.wabot_desc')}</p>

          <div className="space-y-6">
            {/* Enable toggle */}
            <div className="flex items-center justify-between p-4 bg-surface-50 rounded-xl border border-surface-100">
              <div>
                <p className="text-sm font-semibold text-surface-900">{t('settings.enable_bot')}</p>
                <p className="text-xs text-surface-400 mt-0.5">{t('settings.enable_bot_hint')}</p>
              </div>
              <button onClick={() => setBotEnabled(!botEnabled)}
                className={cn('relative w-11 h-6 rounded-full transition-colors', botEnabled ? 'bg-brand-600' : 'bg-surface-300')}>
                <span className={cn('absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform', botEnabled ? 'translate-x-5.5 left-0.5' : 'left-0.5')} />
              </button>
            </div>

            {/* Greeting message */}
            <div>
              <label className="label">{t('settings.greeting_message')}</label>
              <textarea
                className="input resize-none"
                rows={3}
                value={botGreeting}
                onChange={e => setBotGreeting(e.target.value)}
              />
              <p className="text-[11px] text-surface-400 mt-1">{t('settings.greeting_hint')}</p>
            </div>

            {/* Qualification questions */}
            <div>
              <label className="label">{t('settings.qualification_questions')}</label>
              <p className="text-[11px] text-surface-400 mb-2">{t('settings.qualification_questions_hint')}</p>
              <div className="space-y-2 mb-3">
                {botQuestions.map((q, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-surface-400 font-bold w-5 text-right">{i + 1}.</span>
                    <input
                      className="input flex-1"
                      value={q}
                      onChange={e => {
                        const updated = [...botQuestions]
                        updated[i] = e.target.value
                        setBotQuestions(updated)
                      }}
                      placeholder="e.g. What product are you interested in?"
                    />
                    <button
                      onClick={() => setBotQuestions(botQuestions.filter((_, idx) => idx !== i))}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-surface-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setBotQuestions([...botQuestions, ''])}
                className="btn-ghost btn-sm w-full justify-center border border-dashed border-surface-200">
                <Plus className="w-3.5 h-3.5" /> {t('settings.add_question')}
              </button>
            </div>

            {/* Qualify keyword */}
            <div>
              <label className="label">{t('settings.qualify_keyword')}</label>
              <input
                className="input"
                value={botQualifyKeyword}
                onChange={e => setBotQualifyKeyword(e.target.value)}
              />
              <p className="text-[11px] text-surface-400 mt-1">{t('settings.qualify_keyword_hint')}</p>
            </div>

            {/* AI Auto-Reply Section */}
            <div className="border-t border-surface-200 pt-6 mt-6">
              <h3 className="font-semibold text-surface-900 mb-1">{t('settings.ai_autoreply')}</h3>
              <p className="text-xs text-surface-500 mb-4">{t('settings.ai_autoreply_desc')}</p>

              {/* AI Enable toggle */}
              <div className="flex items-center justify-between p-4 bg-surface-50 rounded-xl border border-surface-100 mb-4">
                <div>
                  <p className="text-sm font-semibold text-surface-900">{t('settings.enable_ai')}</p>
                  <p className="text-xs text-surface-400 mt-0.5">{t('settings.enable_ai_hint')}</p>
                </div>
                <button onClick={() => setAiEnabled(!aiEnabled)}
                  className={cn('relative w-11 h-6 rounded-full transition-colors', aiEnabled ? 'bg-brand-600' : 'bg-surface-300')}>
                  <span className={cn('absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform', aiEnabled ? 'translate-x-5.5 left-0.5' : 'left-0.5')} />
                </button>
              </div>

              {aiEnabled && (
                <div className="space-y-4">
                  {/* Custom instructions */}
                  <div>
                    <label className="label">{t('settings.ai_custom_instructions')}</label>
                    <textarea
                      className="input resize-none"
                      rows={4}
                      value={aiInstructions}
                      onChange={e => setAiInstructions(e.target.value)}
                      placeholder={t('settings.ai_instructions_placeholder')}
                    />
                    <p className="text-[11px] text-surface-400 mt-1">{t('settings.ai_instructions_hint')}</p>
                  </div>

                  {/* Confidence threshold */}
                  <div>
                    <label className="label">{t('settings.ai_threshold')}</label>
                    <select
                      className="input"
                      value={aiThreshold}
                      onChange={e => setAiThreshold(e.target.value as 'high' | 'medium' | 'all')}
                    >
                      <option value="high">{t('settings.ai_threshold_high')}</option>
                      <option value="medium">{t('settings.ai_threshold_medium')}</option>
                      <option value="all">{t('settings.ai_threshold_all')}</option>
                    </select>
                    <p className="text-[11px] text-surface-400 mt-1">{t('settings.ai_threshold_hint')}</p>
                  </div>

                  {/* Info box */}
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                    <p className="text-xs text-blue-700 font-medium mb-1">{t('settings.how_ai_works')}</p>
                    <ul className="text-[11px] text-blue-600 space-y-1 list-disc list-inside">
                      <li>AI reads the last 10 messages for context and generates a natural reply</li>
                      <li>For contacts with <strong>active deals</strong>, AI will notify you instead of replying — your rep handles those</li>
                      <li>Medium-confidence replies are sent but you also get a notification to review</li>
                      <li>Low-confidence messages are never sent — you get a notification to respond manually</li>
                      <li>WhatsApp is treated as the primary channel — AI understands voice calls happen here too</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>

            <button onClick={saveBotConfig} disabled={saving} className="btn-primary">
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              {saved ? t('settings.saved') : t('settings.save_bot_config')}
            </button>
          </div>
        </div>
      )}

      {/* ==================== LEAD ROUTING TAB ==================== */}
      {tab === 'lead_routing' && (
        <div className="card p-6">
          <h2 className="font-semibold text-surface-900 mb-1">{t('settings.routing_title')}</h2>
          <p className="text-xs text-surface-500 mb-6">{t('settings.routing_desc')}</p>

          <div className="space-y-6">
            {/* Enable toggle */}
            <div className="flex items-center justify-between p-4 bg-surface-50 rounded-xl border border-surface-100">
              <div>
                <p className="text-sm font-semibold text-surface-900">{t('settings.enable_routing')}</p>
                <p className="text-xs text-surface-400 mt-0.5">{t('settings.enable_routing_hint')}</p>
              </div>
              <button onClick={() => setRoutingEnabled(!routingEnabled)}
                className={cn('relative w-11 h-6 rounded-full transition-colors', routingEnabled ? 'bg-brand-600' : 'bg-surface-300')}>
                <span className={cn('absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform', routingEnabled ? 'translate-x-5.5 left-0.5' : 'left-0.5')} />
              </button>
            </div>

            {/* Mode selector */}
            <div>
              <label className="label">{t('settings.routing_mode')}</label>
              <div className="flex gap-2 p-1 bg-surface-100 rounded-xl w-fit">
                {([
                  { id: 'round_robin', label: t('settings.mode_round_robin') },
                  { id: 'least_loaded', label: t('settings.mode_least_loaded') },
                  { id: 'smart', label: t('settings.mode_smart') },
                  { id: 'manual', label: t('settings.mode_manual') },
                ] as const).map(mode => (
                  <button key={mode.id} onClick={() => setRoutingMode(mode.id)}
                    className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all',
                      routingMode === mode.id ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500 hover:text-surface-700')}>
                    {mode.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-surface-400 mt-2">
                {routingMode === 'round_robin' && t('settings.mode_round_robin_desc')}
                {routingMode === 'least_loaded' && t('settings.mode_least_loaded_desc')}
                {routingMode === 'smart' && t('settings.mode_smart_desc')}
                {routingMode === 'manual' && t('settings.mode_manual_desc')}
              </p>
            </div>

            {/* Team member selector */}
            <div>
              <label className="label">{t('settings.team_in_rotation')}</label>
              <p className="text-[11px] text-surface-400 mb-3">{t('settings.team_in_rotation_hint')}</p>
              <div className="space-y-2">
                {teamProfiles.length === 0 && (
                  <div className="text-center py-6 border-2 border-dashed border-surface-200 rounded-xl">
                    <Users className="w-8 h-8 text-surface-300 mx-auto mb-2" />
                    <p className="text-sm text-surface-500 font-medium">{t('settings.no_team_found')}</p>
                    <p className="text-xs text-surface-400 mt-0.5">{t('settings.no_team_found_hint')}</p>
                  </div>
                )}
                {teamProfiles.map(profile => (
                  <label key={profile.id}
                    className={cn('flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                      routingReps.includes(profile.id) ? 'border-brand-500 bg-brand-50' : 'border-surface-200 hover:border-surface-300')}>
                    <input
                      type="checkbox"
                      checked={routingReps.includes(profile.id)}
                      onChange={() => toggleRoutingRep(profile.id)}
                      className="w-4 h-4 accent-brand-600"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-surface-900">{profile.full_name || 'Unnamed'}</p>
                      {profile.email && <p className="text-xs text-surface-400">{profile.email}</p>}
                    </div>
                    {routingReps.includes(profile.id) && (
                      <CheckCircle2 className="w-4 h-4 text-brand-600 flex-shrink-0" />
                    )}
                  </label>
                ))}
              </div>
            </div>

            {/* Smart routing: per-rep config */}
            {routingMode === 'smart' && routingReps.length > 0 && (
              <div>
                <label className="label">{t('settings.rep_config_smart')}</label>
                <p className="text-[11px] text-surface-400 mb-3">{t('settings.rep_config_smart_hint')}</p>
                <div className="space-y-3">
                  {routingReps.map(repId => {
                    const profile = teamProfiles.find(p => p.id === repId)
                    const rc = routingRepConfigs[repId] || { services: '', startHour: 9, endHour: 18 }
                    return (
                      <div key={repId} className="p-3 rounded-xl border border-surface-200 space-y-2">
                        <p className="text-sm font-semibold text-surface-900">{profile?.full_name || 'Rep'}</p>
                        <div>
                          <label className="text-[11px] text-surface-500">{t('settings.service_keywords')}</label>
                          <input className="input text-xs" placeholder="e.g. immigration, visa, legal" value={rc.services}
                            onChange={e => setRoutingRepConfigs(prev => ({ ...prev, [repId]: { ...rc, services: e.target.value } }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[11px] text-surface-500">{t('settings.start_hour')}</label>
                            <select className="input text-xs" value={rc.startHour}
                              onChange={e => setRoutingRepConfigs(prev => ({ ...prev, [repId]: { ...rc, startHour: parseInt(e.target.value) } }))}>
                              {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[11px] text-surface-500">{t('settings.end_hour')}</label>
                            <select className="input text-xs" value={rc.endHour}
                              onChange={e => setRoutingRepConfigs(prev => ({ ...prev, [repId]: { ...rc, endHour: parseInt(e.target.value) } }))}>
                              {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-3">
                  <label className="text-[11px] text-surface-500">{t('settings.fallback_rep')}</label>
                  <select className="input text-xs" value={routingFallback} onChange={e => setRoutingFallback(e.target.value)}>
                    <option value="">{t('settings.first_available')}</option>
                    {routingReps.map(id => {
                      const p = teamProfiles.find(tp => tp.id === id)
                      return <option key={id} value={id}>{p?.full_name || id}</option>
                    })}
                  </select>
                </div>
              </div>
            )}

            {/* Current rotation status */}
            {routingEnabled && routingReps.length > 0 && (
              <div className="p-4 bg-brand-50 rounded-xl border border-brand-200">
                <p className="text-[10px] font-semibold text-brand-600 uppercase tracking-wide mb-1">{t('settings.rotation_status')}</p>
                <p className="text-sm font-medium text-brand-900">{t('settings.next_lead_goes_to')}: <span className="font-bold">{getNextRepName()}</span></p>
                <p className="text-xs text-brand-600 mt-0.5">{routingReps.length} {t('settings.reps_in_rotation')}</p>
              </div>
            )}

            {/* Auto-enroll non-responders in sequence */}
            <div className="border-t border-surface-100 pt-5">
              <h3 className="font-semibold text-surface-900 mb-1">{t('settings.auto_followup')}</h3>
              <p className="text-xs text-surface-400 mb-4">{t('settings.auto_followup_desc')}</p>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-surface-900">{t('settings.enable_auto_followup')}</p>
                  <p className="text-[11px] text-surface-400">{t('settings.enable_auto_followup_hint')}</p>
                </div>
                <button onClick={() => setAutoSequenceEnabled(!autoSequenceEnabled)}
                  className={cn('relative w-11 h-6 rounded-full transition-colors', autoSequenceEnabled ? 'bg-brand-600' : 'bg-surface-300')}>
                  <span className={cn('absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform', autoSequenceEnabled ? 'translate-x-5.5 left-0.5' : 'left-0.5')} />
                </button>
              </div>
              {autoSequenceEnabled && (
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] text-surface-500">{t('settings.followup_sequence')}</label>
                    <select className="input text-xs" value={autoSequenceId} onChange={e => setAutoSequenceId(e.target.value)}>
                      <option value="">{t('settings.select_sequence')}</option>
                      {sequences.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    {sequences.length === 0 && <p className="text-[10px] text-amber-500 mt-1">{t('settings.create_sequence_first')}</p>}
                  </div>
                  <div>
                    <label className="text-[11px] text-surface-500">{t('settings.wait_hours')}</label>
                    <input type="number" className="input text-xs w-32" value={autoSequenceHours} min={1} max={168}
                      onChange={e => setAutoSequenceHours(parseInt(e.target.value) || 24)} />
                  </div>
                </div>
              )}
            </div>

            <button onClick={saveRoutingConfig} disabled={saving} className="btn-primary">
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              {saved ? t('settings.saved') : t('settings.save_routing_config')}
            </button>
          </div>
        </div>
      )}

      {/* ==================== TEAM TAB ==================== */}
      {tab === 'team' && (
        <div className="card p-6">
          <h2 className="font-semibold text-surface-900 mb-1">{t('settings.team_members')}</h2>
          <p className="text-sm text-surface-500 mb-4">{t('settings.team_desc')}</p>
          <div className="p-8 text-center border-2 border-dashed border-surface-200 rounded-xl">
            <Users className="w-10 h-10 text-surface-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-surface-600">{t('settings.team_members')}</p>
            <p className="text-xs text-surface-400 mt-1">{t('settings.team_coming')}</p>
          </div>
        </div>
      )}
    </div>
  )
}
