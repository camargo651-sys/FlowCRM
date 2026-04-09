'use client'
import { toast } from 'sonner'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, GripVertical, Save, Kanban, Palette, Users, Globe, Upload, CheckCircle2, Type, Database, ChevronDown, ChevronRight, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/context'
import { LOCALES } from '@/lib/i18n/translations'
import type { PipelineStage } from '@/types'

const STAGE_COLORS = ['#6172f3','#8b5cf6','#ec4899','#f97316','#f59e0b','#10b981','#06b6d4','#64748b']
const BRAND_COLORS = ['#6172f3','#8b5cf6','#ec4899','#ef4444','#f97316','#f59e0b','#10b981','#06b6d4','#3b82f6','#64748b']
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
  const [tab, setTab] = useState<'pipelines' | 'terminology' | 'fields' | 'brand' | 'language' | 'team' | 'whatsapp_bot'>('pipelines')
  const [pipelines, setPipelines] = useState<(Pipeline & { stages: PipelineStage[] })[]>([])
  const [expandedPipeline, setExpandedPipeline] = useState<string | null>(null)
  const [companies, setCompanies] = useState<CompanyContact[]>([])
  const [workspaceId, setWorkspaceId] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#6172f3')
  const [logoUrl, setLogoUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

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

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: ws } = await supabase.from('workspaces').select('*').eq('owner_id', user.id).single()
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)
    setWorkspaceName(ws.name)
    setPrimaryColor(ws.primary_color || '#6172f3')
    setLogoUrl(ws.logo_url || '')

    // Load WhatsApp bot config
    if (ws.whatsapp_bot_config) {
      const bot = ws.whatsapp_bot_config as { enabled: boolean; greeting: string; questions: string[]; qualify_keyword: string }
      setBotEnabled(bot.enabled ?? false)
      if (bot.greeting) setBotGreeting(bot.greeting)
      if (bot.questions) setBotQuestions(bot.questions)
      if (bot.qualify_keyword) setBotQualifyKeyword(bot.qualify_keyword)
    }

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
        workspace_id: ws.id, name: 'Sales Pipeline', color: '#6172f3', order_index: 0,
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
    await supabase.from('workspaces').update({ name: workspaceName, primary_color: primaryColor, logo_url: logoUrl || null }).eq('id', workspaceId)
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
      },
    }).eq('id', workspaceId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const TABS = [
    { id: 'pipelines', label: pipelineLabel.plural, icon: Kanban },
    { id: 'terminology', label: 'Terminology', icon: Type },
    { id: 'fields', label: 'Custom Fields', icon: Database },
    { id: 'brand', label: t('settings.brand'), icon: Palette },
    { id: 'language', label: t('settings.language'), icon: Globe },
    { id: 'team', label: t('settings.team'), icon: Users },
    { id: 'whatsapp_bot', label: 'WhatsApp Bot', icon: MessageCircle },
  ] as const

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in max-w-3xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('settings.title')}</h1>
          <p className="page-subtitle">{t('settings.subtitle')}</p>
        </div>
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
              <h2 className="font-semibold text-surface-900">Your {pipelineLabel.plural}</h2>
              <p className="text-xs text-surface-500 mt-0.5">Create multiple {pipelineLabel.plural.toLowerCase()} for different workflows (e.g., Sales, Projects, Support)</p>
            </div>
            <button onClick={addPipeline} className="btn-secondary btn-sm"><Plus className="w-3.5 h-3.5" /> Add {pipelineLabel.singular}</button>
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
                <span className="text-xs text-surface-400 font-medium">{pipeline.stages.length} stages</span>
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
                      <label className="text-[10px] font-semibold text-surface-400 uppercase tracking-wide">Assigned Client (optional)</label>
                      <select className="input mt-1.5 text-sm" value={pipeline.contact_id || ''}
                        onChange={e => updatePipelineClient(pipeline.id, e.target.value)}>
                        <option value="">No client — general pipeline</option>
                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <p className="text-[11px] text-surface-400 mt-1">Link this pipeline to a specific client. Useful for agencies managing multiple accounts.</p>
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
                            <span className="text-[10px] font-semibold text-emerald-600 uppercase">Won</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={stage.lost_stage} onChange={e => updateStage(pipeline.id, stage.id, 'lost_stage', e.target.checked)} className="w-3.5 h-3.5 accent-red-500" />
                            <span className="text-[10px] font-semibold text-red-500 uppercase">Lost</span>
                          </label>
                          <button onClick={() => removeStage(pipeline.id, stage.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-surface-300 hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-5 mt-1 flex-wrap">
                        <span className="text-[9px] text-surface-400 font-semibold uppercase">Require:</span>
                        {[
                          { key: 'value', label: 'Value' },
                          { key: 'contact', label: 'Contact' },
                          { key: 'close_date', label: 'Close date' },
                          { key: 'probability', label: 'Probability' },
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
                    <Plus className="w-3.5 h-3.5" /> Add Stage
                  </button>
                </div>
              )}
            </div>
          ))}

          <button onClick={savePipelines} disabled={saving} className="btn-primary">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? t('settings.saved') : 'Save All Pipelines'}
          </button>
        </div>
      )}

      {/* ==================== TERMINOLOGY TAB ==================== */}
      {tab === 'terminology' && (
        <div className="card p-6">
          <h2 className="font-semibold text-surface-900 mb-1">Customize Terminology</h2>
          <p className="text-xs text-surface-500 mb-6">Rename the core entities to match how your business works. These labels appear throughout the entire CRM.</p>

          <div className="space-y-6">
            <div className="p-4 bg-surface-50 rounded-xl space-y-3">
              <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wide">What do you call your opportunities / sales?</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Singular</label>
                  <input className="input" value={dealLabel.singular} onChange={e => setDealLabel(v => ({ ...v, singular: e.target.value }))} placeholder="Deal" />
                </div>
                <div>
                  <label className="label">Plural</label>
                  <input className="input" value={dealLabel.plural} onChange={e => setDealLabel(v => ({ ...v, plural: e.target.value }))} placeholder="Deals" />
                </div>
              </div>
              <p className="text-[11px] text-surface-400">Examples: Deal/Deals, Property/Properties, Order/Orders, Project/Projects, Tender/Tenders, Lead/Leads</p>
            </div>

            <div className="p-4 bg-surface-50 rounded-xl space-y-3">
              <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wide">What do you call your contacts / clients?</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Singular</label>
                  <input className="input" value={contactLabel.singular} onChange={e => setContactLabel(v => ({ ...v, singular: e.target.value }))} placeholder="Contact" />
                </div>
                <div>
                  <label className="label">Plural</label>
                  <input className="input" value={contactLabel.plural} onChange={e => setContactLabel(v => ({ ...v, plural: e.target.value }))} placeholder="Contacts" />
                </div>
              </div>
              <p className="text-[11px] text-surface-400">Examples: Contact/Contacts, Client/Clients, Patient/Patients, Student/Students, Customer/Customers</p>
            </div>

            <div className="p-4 bg-surface-50 rounded-xl space-y-3">
              <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wide">What do you call your workflow views?</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Singular</label>
                  <input className="input" value={pipelineLabel.singular} onChange={e => setPipelineLabel(v => ({ ...v, singular: e.target.value }))} placeholder="Pipeline" />
                </div>
                <div>
                  <label className="label">Plural</label>
                  <input className="input" value={pipelineLabel.plural} onChange={e => setPipelineLabel(v => ({ ...v, plural: e.target.value }))} placeholder="Pipelines" />
                </div>
              </div>
              <p className="text-[11px] text-surface-400">Examples: Pipeline/Pipelines, Board/Boards, Workflow/Workflows, Process/Processes</p>
            </div>
          </div>

          <button onClick={saveTerminology} disabled={saving} className="btn-primary mt-6">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? t('settings.saved') : 'Save Terminology'}
          </button>
        </div>
      )}

      {/* ==================== CUSTOM FIELDS TAB ==================== */}
      {tab === 'fields' && (
        <div className="space-y-4">
          <div>
            <h2 className="font-semibold text-surface-900 mb-1">Custom Fields</h2>
            <p className="text-xs text-surface-500">Add fields specific to your business. These appear in your forms when creating or editing {dealLabel.plural.toLowerCase()} and {contactLabel.plural.toLowerCase()}.</p>
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
                        placeholder="Field name" className="input text-sm" />
                      <select value={field.type} onChange={e => updateField(field.id, 'type', e.target.value)} className="input text-sm">
                        {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
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
                  <p className="text-sm text-surface-500 font-medium">No custom fields yet</p>
                  <p className="text-xs text-surface-400 mt-0.5">Add fields that are specific to your business</p>
                </div>
              )}
            </div>

            <button onClick={addField} className="btn-ghost btn-sm w-full justify-center border border-dashed border-surface-200 mb-4">
              <Plus className="w-3.5 h-3.5" /> Add Field
            </button>

            {customFields.filter(f => f.entity === fieldEntity).length > 0 && (
              <button onClick={saveFields} disabled={saving} className="btn-primary">
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                {saved ? t('settings.saved') : 'Save Fields'}
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
          <h2 className="font-semibold text-surface-900 mb-1">WhatsApp Bot Auto-Reply</h2>
          <p className="text-xs text-surface-500 mb-6">Automatically greet new contacts and ask qualification questions when they send their first message.</p>

          <div className="space-y-6">
            {/* Enable toggle */}
            <div className="flex items-center justify-between p-4 bg-surface-50 rounded-xl border border-surface-100">
              <div>
                <p className="text-sm font-semibold text-surface-900">Enable Bot Auto-Reply</p>
                <p className="text-xs text-surface-400 mt-0.5">When enabled, new contacts receive an automatic greeting on their first message</p>
              </div>
              <button onClick={() => setBotEnabled(!botEnabled)}
                className={cn('relative w-11 h-6 rounded-full transition-colors', botEnabled ? 'bg-brand-600' : 'bg-surface-300')}>
                <span className={cn('absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform', botEnabled ? 'translate-x-5.5 left-0.5' : 'left-0.5')} />
              </button>
            </div>

            {/* Greeting message */}
            <div>
              <label className="label">Greeting Message</label>
              <textarea
                className="input resize-none"
                rows={3}
                value={botGreeting}
                onChange={e => setBotGreeting(e.target.value)}
                placeholder="Hi! Thanks for contacting us. Let me ask a few questions to help you better."
              />
              <p className="text-[11px] text-surface-400 mt-1">This message is sent first when a new contact writes for the first time.</p>
            </div>

            {/* Qualification questions */}
            <div>
              <label className="label">Qualification Questions</label>
              <p className="text-[11px] text-surface-400 mb-2">These are sent as a numbered list right after the greeting.</p>
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
                <Plus className="w-3.5 h-3.5" /> Add Question
              </button>
            </div>

            {/* Qualify keyword */}
            <div>
              <label className="label">Qualify Keyword (optional)</label>
              <input
                className="input"
                value={botQualifyKeyword}
                onChange={e => setBotQualifyKeyword(e.target.value)}
                placeholder="e.g. interested"
              />
              <p className="text-[11px] text-surface-400 mt-1">If set, leads that reply with this keyword are auto-marked as qualified.</p>
            </div>

            <button onClick={saveBotConfig} disabled={saving} className="btn-primary">
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              {saved ? t('settings.saved') : 'Save Bot Configuration'}
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
