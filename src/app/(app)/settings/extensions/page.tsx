'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Plug, Check, ChevronDown, ChevronRight, Eye, EyeOff, ExternalLink, X } from 'lucide-react'
import { getCategories, getProvidersByCategory, getProviderDef, type ServiceCategory, type ProviderDef } from '@/lib/providers/registry'
import { cn } from '@/lib/utils'
import { getActiveWorkspace } from '@/lib/get-active-workspace'
import { useI18n } from '@/lib/i18n/context'

interface SavedProvider {
  category: string
  provider_key: string
  config: Record<string, string>
  enabled: boolean
}

export default function ExtensionsPage() {
  const { t } = useI18n()
  const supabase = createClient()
  const [workspaceId, setWorkspaceId] = useState('')
  const [savedProviders, setSavedProviders] = useState<SavedProvider[]>([])
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [configuring, setConfiguring] = useState<ProviderDef | null>(null)
  const [configForm, setConfigForm] = useState<Record<string, string>>({})
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  const categories = getCategories()

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const ws = await getActiveWorkspace(supabase, user.id, 'id, providers')
    if (!ws) return
    setWorkspaceId(ws.id)
    if (ws.providers && Array.isArray(ws.providers)) {
      setSavedProviders(ws.providers as SavedProvider[])
    }
  }, [])

  useEffect(() => { load() }, [load])

  const getActiveForCategory = (category: string) => {
    return savedProviders.find(p => p.category === category && p.enabled)
  }

  const startConfigure = (provider: ProviderDef) => {
    const existing = savedProviders.find(p => p.provider_key === provider.key)
    setConfigForm(existing?.config || {})
    setConfiguring(provider)
    setShowSecrets({})
  }

  const saveProvider = async () => {
    if (!configuring) return
    setSaving(true)

    const updated = savedProviders.filter(p => p.category !== configuring.category)
    updated.push({
      category: configuring.category,
      provider_key: configuring.key,
      config: configForm,
      enabled: true,
    })

    await supabase.from('workspaces').update({ providers: updated }).eq('id', workspaceId)
    setSavedProviders(updated)
    setConfiguring(null)
    setSaving(false)
    toast.success(`${configuring.name} ${t('settings.ext.connected_msg')}`)
  }

  const disconnectProvider = async (category: string) => {
    const updated = savedProviders.filter(p => p.category !== category)
    await supabase.from('workspaces').update({ providers: updated }).eq('id', workspaceId)
    setSavedProviders(updated)
    toast.success(t('settings.ext.disconnected_msg'))
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('settings.ext.title')}</h1>
          <p className="text-sm text-surface-500 mt-0.5">{t('settings.ext.desc')}</p>
        </div>
      </div>

      <div className="space-y-3">
        {categories.map(cat => {
          const providers = getProvidersByCategory(cat.key)
          const active = getActiveForCategory(cat.key)
          const activeDef = active ? getProviderDef(active.provider_key) : null
          const isExpanded = expandedCategory === cat.key

          return (
            <div key={cat.key} className="card overflow-hidden">
              <button
                onClick={() => setExpandedCategory(isExpanded ? null : cat.key)}
                className="w-full flex items-center gap-4 p-5 hover:bg-surface-50/50 transition-colors text-left"
              >
                <span className="text-2xl">{cat.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-surface-900">{cat.label}</h3>
                    {activeDef && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                        <Check className="w-2.5 h-2.5" /> {activeDef.name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-surface-400 mt-0.5">{cat.description}</p>
                </div>
                {isExpanded ? <ChevronDown className="w-4 h-4 text-surface-400" /> : <ChevronRight className="w-4 h-4 text-surface-400" />}
              </button>

              {isExpanded && (
                <div className="px-5 pb-5 border-t border-surface-100 pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {providers.map(provider => {
                      const isActive = active?.provider_key === provider.key
                      return (
                        <div key={provider.key}
                          className={cn('p-4 rounded-xl border-2 transition-all',
                            isActive ? 'border-emerald-400 bg-emerald-50/30' : 'border-surface-100 hover:border-surface-200')}>
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2.5">
                              <span className="text-xl">{provider.logo}</span>
                              <div>
                                <p className="text-sm font-bold text-surface-900">{provider.name}</p>
                                {provider.freeTier && <p className="text-[10px] text-emerald-600 font-medium">{provider.freeTier}</p>}
                              </div>
                            </div>
                            {isActive && <Check className="w-4 h-4 text-emerald-500" />}
                          </div>
                          <p className="text-xs text-surface-500 mb-3">{provider.description}</p>
                          <div className="flex items-center gap-2">
                            {isActive ? (
                              <button onClick={() => disconnectProvider(cat.key)}
                                className="btn-ghost btn-sm text-xs text-red-500 hover:text-red-600">
                                {t('settings.ext.disconnect')}
                              </button>
                            ) : (
                              <button onClick={() => startConfigure(provider)}
                                className="btn-primary btn-sm text-xs">
                                {provider.requiredKeys.length === 0 ? t('settings.ext.activate') : t('settings.ext.configure')}
                              </button>
                            )}
                            {provider.website && (
                              <a href={provider.website} target="_blank" rel="noopener noreferrer"
                                className="btn-ghost btn-sm text-xs">
                                <ExternalLink className="w-3 h-3" /> {t('settings.ext.website')}
                              </a>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Configuration modal */}
      {configuring && (
        <div className="modal-overlay" onClick={() => setConfiguring(null)}>
          <div className="modal-panel max-w-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">{configuring.logo}</span>
                <h2 className="font-semibold text-surface-900">{t('settings.ext.configure_title')} {configuring.name}</h2>
              </div>
              <button onClick={() => setConfiguring(null)} className="modal-close"><X className="w-4 h-4" /></button>
            </div>
            <div className="modal-body space-y-4">
              {configuring.requiredKeys.length === 0 ? (
                <p className="text-sm text-surface-500">{t('settings.ext.no_config')}</p>
              ) : (
                configuring.requiredKeys.map(field => (
                  <div key={field.key}>
                    <label className="label">{field.label}</label>
                    <div className="relative">
                      <input
                        type={field.secret && !showSecrets[field.key] ? 'password' : 'text'}
                        className="input pr-10"
                        placeholder={field.placeholder}
                        value={configForm[field.key] || ''}
                        onChange={e => setConfigForm(f => ({ ...f, [field.key]: e.target.value }))}
                      />
                      {field.secret && (
                        <button type="button"
                          onClick={() => setShowSecrets(s => ({ ...s, [field.key]: !s[field.key] }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600">
                          {showSecrets[field.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
              {configuring.website && (
                <p className="text-xs text-surface-400">
                  {t('settings.ext.get_keys_at')}{' '}
                  <a href={configuring.website} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
                    {configuring.website.replace('https://', '')}
                  </a>
                </p>
              )}
            </div>
            <div className="modal-footer justify-end">
              <button onClick={() => setConfiguring(null)} className="btn-secondary">{t('settings.ext.cancel')}</button>
              <button onClick={saveProvider} disabled={saving} className="btn-primary">
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : t('settings.ext.save_activate')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
