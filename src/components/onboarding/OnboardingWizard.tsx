'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Zap, Palette, Globe, CheckCircle2, ArrowRight, ArrowLeft, Upload, Sparkles, Building2 } from 'lucide-react'
import { LOCALES, type Locale } from '@/lib/i18n/translations'
import { INDUSTRY_LIST, getTemplate, type IndustryTemplate } from '@/lib/industry-templates'
import { useI18n } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

const TEAM_SIZES = ['Solo', '2-5', '6-15', '16-50', '51-200', '200+']
const BRAND_COLORS = ['#0891B2','#8b5cf6','#ec4899','#ef4444','#f97316','#f59e0b','#10b981','#06b6d4','#3b82f6','#64748b']

interface OnboardingWizardProps {
  workspaceId: string
  workspaceName: string
  onComplete: () => void
}

export default function OnboardingWizard({ workspaceId, workspaceName, onComplete }: OnboardingWizardProps) {
  const supabase = createClient()
  const { t, setLocale, locale } = useI18n()
  const [step, setStep] = useState(1)
  const [companyName, setCompanyName] = useState(workspaceName || '')
  const [industryKey, setIndustryKey] = useState('')
  const [teamSize, setTeamSize] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#0891B2')
  const [selectedLocale, setSelectedLocale] = useState<Locale>(locale)
  const [logoUrl, setLogoUrl] = useState('')
  const [saving, setSaving] = useState(false)

  const selectedTemplate = industryKey ? getTemplate(industryKey) : null

  const [enabledModules, setEnabledModules] = useState<Record<string, boolean>>({
    crm: true, invoicing: true, inventory: true, purchasing: false,
    manufacturing: false, accounting: false, hr: false, expenses: false,
    ecommerce: false, pos: false, automations: true,
  })
  const [initialModule, setInitialModule] = useState<string | null>(null)

  // Read initial_module from signup metadata and pre-select it
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      const mod = data.user?.user_metadata?.initial_module as string | undefined
      if (!cancelled && mod) {
        setInitialModule(mod)
        setEnabledModules(prev => ({ ...prev, [mod]: true }))
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const MODULES_LIST = [
    { key: 'crm', label: 'CRM / Sales', icon: '🔀', locked: true },
    { key: 'invoicing', label: 'Invoicing', icon: '🧾' },
    { key: 'inventory', label: 'Inventory', icon: '📦' },
    { key: 'pos', label: 'Point of Sale', icon: '💳' },
    { key: 'ecommerce', label: 'E-commerce', icon: '🛒' },
    { key: 'purchasing', label: 'Purchasing', icon: '🚛' },
    { key: 'manufacturing', label: 'Manufacturing', icon: '🏭' },
    { key: 'accounting', label: 'Accounting', icon: '📒' },
    { key: 'hr', label: 'HR & Payroll', icon: '👔' },
    { key: 'expenses', label: 'Expenses', icon: '💰' },
    { key: 'automations', label: 'Automations', icon: '⚡' },
  ]

  const steps = [
    { num: 1, title: t('onboarding.step1_title'), icon: Building2 },
    { num: 2, title: t('onboarding.modules_title') || 'Modules', icon: Sparkles },
    { num: 3, title: t('onboarding.step2_title'), icon: Palette },
    { num: 4, title: t('onboarding.step3_title'), icon: Globe },
    { num: 5, title: t('onboarding.step4_title'), icon: CheckCircle2 },
  ]

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

  const applyTemplate = async (template: IndustryTemplate) => {
    // 1. Create or get pipeline
    const pipelineRes = await supabase.from('pipelines').select('id').eq('workspace_id', workspaceId).limit(1)
    const pipeline = { data: pipelineRes.data?.[0] || null }
    let pipelineId: string

    if (pipeline.data) {
      pipelineId = pipeline.data.id
      // Delete existing stages to replace with template
      await supabase.from('pipeline_stages').delete().eq('workspace_id', workspaceId)
    } else {
      const { data } = await supabase.from('pipelines').insert([{
        workspace_id: workspaceId, name: 'Sales Pipeline', color: primaryColor, order_index: 0,
      }]).select('id').single()
      pipelineId = data!.id
    }

    // 2. Create industry-specific stages
    const stages = template.stages.map((s, i) => ({
      pipeline_id: pipelineId,
      workspace_id: workspaceId,
      name: s.name,
      order_index: i,
      color: s.color,
      win_stage: s.win || false,
      lost_stage: s.lost || false,
    }))
    await supabase.from('pipeline_stages').insert(stages)

    // 3. Create custom field definitions
    if (template.customFields.length > 0) {
      const fields = template.customFields.map((f, i) => ({
        workspace_id: workspaceId,
        entity: f.entity,
        label: f.label,
        key: f.key,
        type: f.type,
        options: f.options || null,
        required: false,
        order_index: i,
      }))
      await supabase.from('custom_field_defs').insert(fields)
    }
  }

  const handleFinish = async () => {
    setSaving(true)

    const template = getTemplate(industryKey || 'generic')

    // Apply industry template (stages, custom fields)
    await applyTemplate(template)

    // Apply automations via API
    try {
      await fetch('/api/workspace/apply-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateKey: industryKey || 'generic', initial_module: initialModule }),
      })
    } catch {}

    // Save workspace settings
    await supabase.from('workspaces').update({
      name: companyName,
      primary_color: primaryColor,
      logo_url: logoUrl || null,
      industry: industryKey,
      team_size: teamSize,
      language: selectedLocale,
      terminology: {
        deal: template.dealLabel,
        contact: template.contactLabel,
      },
      enabled_modules: enabledModules,
      onboarding_completed: true,
    }).eq('id', workspaceId)

    setLocale(selectedLocale)
    setSaving(false)
    onComplete()
  }

  return (
    <div className="fixed inset-0 bg-surface-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-slide-up max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-600 to-brand-700 p-8 text-white flex-shrink-0">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl">Tracktio</span>
          </div>
          <h1 className="text-2xl font-bold">{t('onboarding.welcome')}</h1>
          <p className="text-white/70 text-sm mt-1">{t('onboarding.subtitle')}</p>
          {initialModule && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur border border-white/20 text-xs font-semibold">
              <Sparkles className="w-3 h-3" />
              <span>Starting with: {initialModule}</span>
            </div>
          )}
        </div>

        {/* Step indicator */}
        <div className="px-8 pt-6 flex-shrink-0">
          <div className="flex items-center gap-2">
            {steps.map((s, i) => (
              <div key={s.num} className="flex items-center gap-2 flex-1">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all flex-shrink-0',
                  step >= s.num ? 'bg-brand-600 text-white' : 'bg-surface-100 text-surface-400'
                )}>
                  {step > s.num ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                </div>
                {i < steps.length - 1 && (
                  <div className={cn('h-0.5 flex-1 rounded-full transition-all', step > s.num ? 'bg-brand-600' : 'bg-surface-100')} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto flex-1">
          {/* Step 1: Company + Industry */}
          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <label className="label">{t('onboarding.company_name')}</label>
                <input className="input" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Acme Corp" />
              </div>

              <div>
                <label className="label">{t('onboarding.business_type') || 'What best describes your business?'}</label>
                <p className="text-xs text-surface-400 mb-3">{t('onboarding.business_type_desc') || 'We\'ll tailor your pipeline, fields, and automations to match'}</p>
                <div className="grid grid-cols-2 gap-2">
                  {INDUSTRY_LIST.map(ind => (
                    <button key={ind.key} onClick={() => setIndustryKey(ind.key)}
                      className={cn('flex items-start gap-3 p-3 rounded-xl border text-left transition-all',
                        industryKey === ind.key
                          ? 'border-brand-500 bg-brand-50'
                          : 'border-surface-200 hover:border-surface-300')}>
                      <span className="text-xl flex-shrink-0">{ind.icon}</span>
                      <div className="min-w-0">
                        <p className={cn('text-sm font-semibold', industryKey === ind.key ? 'text-brand-700' : 'text-surface-800')}>
                          {ind.name}
                        </p>
                        <p className="text-[11px] text-surface-400 mt-0.5 line-clamp-1">{ind.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">{t('onboarding.team_size')}</label>
                <div className="flex gap-2 flex-wrap">
                  {TEAM_SIZES.map(size => (
                    <button key={size} onClick={() => setTeamSize(size)}
                      className={cn('px-4 py-2 rounded-xl text-sm font-medium border transition-all',
                        teamSize === size
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-surface-200 text-surface-600 hover:border-surface-300')}>
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Modules */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <p className="text-sm text-surface-500">{t('onboarding.modules_desc') || 'Select the tools you need. You can always adjust this later in Settings.'}</p>
              <div className="grid grid-cols-2 gap-2 max-h-[40vh] overflow-y-auto">
                {MODULES_LIST.map(mod => {
                  const isOn = enabledModules[mod.key] || false
                  const isInitial = initialModule === mod.key
                  return (
                    <button key={mod.key} onClick={() => !mod.locked && setEnabledModules(prev => ({ ...prev, [mod.key]: !prev[mod.key] }))}
                      disabled={mod.locked}
                      className={cn('p-3 rounded-xl text-left transition-all border-2',
                        isOn ? 'border-brand-500 bg-brand-50/30' : 'border-surface-100 hover:border-surface-200',
                        isInitial && 'ring-2 ring-emerald-400 ring-offset-1',
                        mod.locked && 'opacity-60')}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{mod.icon}</span>
                        <span className="text-xs font-semibold text-surface-800">{mod.label}</span>
                        {mod.locked && <span className="text-[8px] px-1 py-0.5 bg-surface-200 rounded-full text-surface-500">Required</span>}
                        {isInitial && <span className="text-[8px] px-1 py-0.5 bg-emerald-100 rounded-full text-emerald-700 font-bold">PICKED</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
              <button onClick={() => setEnabledModules(prev => {
                const all: Record<string, boolean> = {}
                MODULES_LIST.forEach(m => { all[m.key] = true })
                return all
              })} className="text-xs text-brand-600 font-semibold hover:underline">{t('onboarding.enable_all') || 'Enable all modules'}</button>
            </div>
          )}

          {/* Step 3: Brand */}
          {step === 3 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <label className="label">{t('onboarding.logo')}</label>
                <div className="border-2 border-dashed border-surface-200 rounded-2xl p-8 text-center hover:border-brand-300 transition-colors cursor-pointer relative">
                  <input type="file" accept="image/*" onChange={handleLogoUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer" />
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-20 h-20 object-contain mx-auto rounded-xl" />
                  ) : (
                    <>
                      <Upload className="w-10 h-10 text-surface-300 mx-auto mb-3" />
                      <p className="text-sm font-medium text-surface-600">{t('onboarding.upload')}</p>
                      <p className="text-xs text-surface-400 mt-1">{t('onboarding.formats')}</p>
                    </>
                  )}
                </div>
              </div>
              <div>
                <label className="label">{t('onboarding.primary_color')}</label>
                <div className="flex items-center gap-3 flex-wrap">
                  {BRAND_COLORS.map(color => (
                    <button key={color} onClick={() => setPrimaryColor(color)}
                      className={cn('w-10 h-10 rounded-xl transition-all border-2',
                        primaryColor === color ? 'border-surface-900 scale-110 shadow-lg' : 'border-transparent hover:scale-105')}
                      style={{ backgroundColor: color }} />
                  ))}
                  <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                    className="w-10 h-10 rounded-xl cursor-pointer border-2 border-surface-200" />
                </div>

                {/* Preview */}
                <div className="mt-4 p-4 rounded-xl border border-surface-100" style={{ backgroundColor: primaryColor + '10' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: primaryColor }}>
                      {logoUrl ? <img src={logoUrl} alt="" className="w-6 h-6 object-contain" /> : <Zap className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-bold text-sm" style={{ color: primaryColor }}>{companyName || 'Your Company'}</p>
                      <p className="text-xs text-surface-400">{selectedTemplate?.dealLabel.plural || 'Deals'} · {selectedTemplate?.contactLabel.plural || 'Contacts'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Language */}
          {step === 4 && (
            <div className="space-y-4 animate-fade-in">
              <p className="text-sm text-surface-500">{t('settings.language_select')}</p>
              <div className="space-y-2">
                {LOCALES.map(loc => (
                  <button key={loc.code} onClick={() => setSelectedLocale(loc.code)}
                    className={cn(
                      'w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left',
                      selectedLocale === loc.code
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-surface-200 hover:border-surface-300'
                    )}>
                    <span className="text-2xl">{loc.flag}</span>
                    <p className={cn('font-semibold text-sm flex-1', selectedLocale === loc.code ? 'text-brand-700' : 'text-surface-800')}>
                      {loc.name}
                    </p>
                    {selectedLocale === loc.code && <CheckCircle2 className="w-5 h-5 text-brand-600" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Summary */}
          {step === 5 && (
            <div className="animate-fade-in">
              <div className="text-center mb-6">
                <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-10 h-10 text-emerald-500" />
                </div>
                <h2 className="text-2xl font-bold text-surface-900">{t('onboarding.ready_title')}</h2>
                <p className="text-surface-500 text-sm mt-1">{t('onboarding.ready_desc')}</p>
              </div>

              {/* What will be configured */}
              {selectedTemplate && (
                <div className="space-y-4">
                  <div className="p-4 bg-surface-50 rounded-xl">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xl">{selectedTemplate.icon}</span>
                      <div>
                        <p className="font-bold text-sm text-surface-900">{companyName}</p>
                        <p className="text-xs text-surface-400">{selectedTemplate.name} · {teamSize}</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span className="text-surface-600">
                          <strong>{selectedTemplate.stages.length} pipeline stages</strong> configured for {selectedTemplate.name.toLowerCase()}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span className="text-surface-600">
                          <strong>{selectedTemplate.customFields.length} custom fields</strong> specific to your industry
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span className="text-surface-600">
                          Terminology: <strong>{selectedTemplate.dealLabel.plural}</strong> instead of Deals, <strong>{selectedTemplate.contactLabel.plural}</strong> instead of Contacts
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span className="text-surface-600">
                          <strong>{selectedTemplate.automations.length} automation suggestions</strong> ready to activate
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stages preview */}
                  <div className="p-4 bg-surface-50 rounded-xl">
                    <p className="text-xs font-semibold text-surface-500 uppercase mb-2">Your Pipeline</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTemplate.stages.map(s => (
                        <span key={s.name} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white border border-surface-100">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 pb-8 flex items-center justify-between flex-shrink-0">
          <div>
            {step > 1 && (
              <button onClick={() => setStep(step - 1)} className="btn-ghost">
                <ArrowLeft className="w-4 h-4" /> {t('onboarding.back')}
              </button>
            )}
            {step === 1 && (
              <button onClick={handleFinish} className="text-sm text-surface-400 hover:text-surface-600 transition-colors">
                {t('onboarding.skip')}
              </button>
            )}
          </div>
          <div>
            {step < 5 ? (
              <button onClick={() => setStep(step + 1)}
                disabled={step === 1 && !companyName}
                className="btn-primary">
                {t('onboarding.next')} <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={handleFinish} disabled={saving} className="btn-primary btn-lg">
                {saving
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Sparkles className="w-4 h-4" />}
                {t('onboarding.finish')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
