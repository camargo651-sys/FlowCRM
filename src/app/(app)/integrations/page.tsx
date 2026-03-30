'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, XCircle, ExternalLink, ChevronRight, Search, Shield, Save, X, Star, RefreshCw, Mail, Trash2, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { INTEGRATIONS_CATALOG, CATEGORIES, type IntegrationDef } from '@/lib/integrations-catalog'

interface SavedIntegration {
  key: string
  enabled: boolean
  config: Record<string, string>
}

interface EmailAccount {
  id: string
  provider: string
  email_address: string
  status: string
  last_synced_at: string | null
  created_at: string
}

export default function IntegrationsPage() {
  const supabase = createClient()
  const [workspaceId, setWorkspaceId] = useState('')
  const [saved, setSaved] = useState<Map<string, SavedIntegration>>(new Map())
  const [selected, setSelected] = useState<IntegrationDef | null>(null)
  const [config, setConfig] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [loading, setLoading] = useState(true)
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([])
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)

    const { data } = await supabase.from('integrations').select('*').eq('workspace_id', ws.id)
    const map = new Map<string, SavedIntegration>()
    ;(data || []).forEach((s: any) => map.set(s.key, { key: s.key, enabled: s.enabled, config: s.config || {} }))
    setSaved(map)

    // Load connected email accounts + linkedin accounts
    try {
      const res = await fetch('/api/email/accounts')
      if (res.ok) {
        const { accounts } = await res.json()
        setEmailAccounts(accounts || [])
      }
    } catch {}

    // Load LinkedIn accounts as email-like accounts for the OAuth UI
    try {
      const { data: liAccounts } = await supabase
        .from('linkedin_accounts')
        .select('id, status, name, email, last_synced_at, created_at')
        .eq('workspace_id', ws.id)
      if (liAccounts) {
        const mapped = liAccounts.map((a: any) => ({
          id: a.id,
          provider: 'linkedin',
          email_address: a.name || a.email || 'LinkedIn Account',
          status: a.status,
          last_synced_at: a.last_synced_at,
          created_at: a.created_at,
        }))
        setEmailAccounts(prev => [...prev, ...mapped])
      }
    } catch {}

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const selectIntegration = (def: IntegrationDef) => {
    setSelected(def)
    const existing = saved.get(def.key)
    setConfig(existing?.config || {})
  }

  const toggleIntegration = async (key: string) => {
    const current = saved.get(key)
    const newEnabled = !current?.enabled

    const { data: existing } = await supabase.from('integrations').select('id').eq('workspace_id', workspaceId).eq('key', key).single()
    if (existing) {
      await supabase.from('integrations').update({ enabled: newEnabled }).eq('id', existing.id)
    } else {
      const def = INTEGRATIONS_CATALOG.find(i => i.key === key)
      await supabase.from('integrations').insert([{ workspace_id: workspaceId, key, name: def?.name || key, enabled: newEnabled, config: {} }])
    }

    setSaved(prev => {
      const next = new Map(prev)
      next.set(key, { key, enabled: newEnabled, config: current?.config || {} })
      return next
    })
  }

  const [connectError, setConnectError] = useState('')

  const saveConfig = async () => {
    if (!selected) return
    setSaving(true)
    setConnectError('')

    // WhatsApp uses a special connect API that validates credentials
    if (selected.key === 'whatsapp') {
      try {
        const res = await fetch('/api/whatsapp/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone_number_id: config.phone_number_id,
            access_token: config.access_token,
            verify_token: config.verify_token,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          setConnectError(data.error || 'Connection failed')
          setSaving(false)
          return
        }
        setSaved(prev => {
          const next = new Map(prev)
          next.set('whatsapp', { key: 'whatsapp', enabled: true, config: { ...config, display_phone: data.display_phone } })
          return next
        })
        setSaving(false)
        setSavedMsg(true)
        setTimeout(() => setSavedMsg(false), 2000)
        return
      } catch (err: any) {
        setConnectError(err.message)
        setSaving(false)
        return
      }
    }

    const { data: existing } = await supabase.from('integrations').select('id').eq('workspace_id', workspaceId).eq('key', selected.key).single()
    if (existing) {
      await supabase.from('integrations').update({ config }).eq('id', existing.id)
    } else {
      await supabase.from('integrations').insert([{ workspace_id: workspaceId, key: selected.key, name: selected.name, enabled: false, config }])
    }

    setSaved(prev => {
      const next = new Map(prev)
      const current = next.get(selected.key)
      next.set(selected.key, { key: selected.key, enabled: current?.enabled || false, config })
      return next
    })
    setSaving(false)
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2000)
  }

  const filtered = INTEGRATIONS_CATALOG.filter(i => {
    if (category !== 'all' && i.category !== category) return false
    if (search && !i.name.toLowerCase().includes(search.toLowerCase()) && !i.description.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const connectedCount = Array.from(saved.values()).filter(s => s.enabled).length

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Integrations</h1>
          <p className="text-sm text-surface-500 mt-0.5">
            {INTEGRATIONS_CATALOG.length} available · {connectedCount} connected
          </p>
        </div>
      </div>

      {/* Search & Categories */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input type="text" placeholder="Search integrations..." value={search} onChange={e => setSearch(e.target.value)} className="input pl-9" />
        </div>
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setCategory(c.key)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all',
                category === c.key ? 'bg-brand-600 text-white' : 'text-surface-500 hover:bg-surface-100 bg-surface-50')}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cards */}
        <div className={cn('space-y-2', selected ? 'lg:col-span-1 max-h-[70vh] overflow-y-auto no-scrollbar' : 'lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 space-y-0')}>
          {filtered.map(def => {
            const isConnected = saved.get(def.key)?.enabled
            return (
              <div key={def.key} onClick={() => selectIntegration(def)}
                className={cn('card p-4 cursor-pointer transition-all hover:shadow-card-hover',
                  selected?.key === def.key && 'ring-2 ring-brand-500')}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
                    style={{ backgroundColor: def.color + '12' }}>
                    {def.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm text-surface-900 truncate">{def.name}</h3>
                      {def.popular && <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />}
                    </div>
                    <div className={cn('inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold',
                      isConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-surface-100 text-surface-400')}>
                      {isConnected ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                      {isConnected ? 'Connected' : 'Off'}
                    </div>
                    {!selected && <p className="text-xs text-surface-500 mt-1.5 line-clamp-2">{def.description}</p>}
                  </div>
                  {selected && <ChevronRight className="w-4 h-4 text-surface-300 flex-shrink-0 mt-1" />}
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12">
              <p className="text-surface-500 font-medium">No integrations match your search</p>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="lg:col-span-2 space-y-4">
            {/* Header */}
            <div className="card p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{ backgroundColor: selected.color + '12' }}>
                    {selected.icon}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-surface-900">{selected.name}</h2>
                    <p className="text-sm text-surface-500">{selected.description}</p>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="text-surface-400 hover:text-surface-600 text-sm">Close</button>
              </div>

              <div className="flex items-center justify-between p-4 bg-surface-50 rounded-xl">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-surface-400" />
                  <span className="text-sm font-medium text-surface-700">Enable {selected.name}</span>
                </div>
                <button onClick={() => toggleIntegration(selected.key)}
                  className={cn('w-11 h-6 rounded-full transition-all relative',
                    saved.get(selected.key)?.enabled ? 'bg-emerald-500' : 'bg-surface-300')}>
                  <div className={cn('w-5 h-5 bg-white rounded-full shadow-sm absolute top-0.5 transition-all',
                    saved.get(selected.key)?.enabled ? 'left-[22px]' : 'left-0.5')} />
                </button>
              </div>
            </div>

            {/* Setup */}
            <div className="card p-6">
              <h3 className="font-semibold text-surface-900 mb-1">Setup Instructions</h3>
              <p className="text-xs text-surface-500 mb-4">Follow these steps to connect {selected.name}</p>
              <div className="space-y-3">
                {selected.setupSteps.map(({ step, title, description }) => (
                  <div key={step} className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{step}</div>
                    <div>
                      <p className="text-sm font-medium text-surface-800">{title}</p>
                      <p className="text-xs text-surface-500 mt-0.5">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Config — OAuth or Manual */}
            {selected.oauthFlow ? (
              <div className="card p-6">
                <h3 className="font-semibold text-surface-900 mb-1">Connection</h3>
                <p className="text-xs text-surface-500 mb-4">
                  Connect your {selected.name} account with one click. We only request read-only access.
                </p>

                {/* Connected accounts */}
                {emailAccounts.filter(a => a.provider === selected.key).map(account => (
                  <div key={account.id} className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm font-semibold text-surface-900">{account.email_address}</span>
                      </div>
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold',
                        account.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                        account.status === 'expired' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700')}>
                        {account.status}
                      </span>
                    </div>
                    <p className="text-xs text-surface-500 mb-3">
                      {account.last_synced_at
                        ? `Last synced: ${new Date(account.last_synced_at).toLocaleString()}`
                        : 'Not synced yet'}
                    </p>
                    <div className="flex gap-2">
                      <button onClick={async () => {
                        setSyncing(true)
                        setSyncResult(null)
                        try {
                          const res = await fetch('/api/email/sync', { method: 'POST' })
                          const data = await res.json()
                          if (res.ok) {
                            const r = data.results?.[0]
                            setSyncResult(r ? `Synced ${r.messagesStored} emails, created ${r.contactsCreated} contacts` : 'Sync complete')
                            load()
                          } else {
                            setSyncResult(data.error || 'Sync failed')
                          }
                        } catch { setSyncResult('Sync failed') }
                        setSyncing(false)
                      }} disabled={syncing} className="btn-secondary btn-sm">
                        <RefreshCw className={cn('w-3.5 h-3.5', syncing && 'animate-spin')} />
                        {syncing ? 'Syncing...' : 'Sync Now'}
                      </button>
                      <button onClick={async () => {
                        if (!confirm('Disconnect this email account? Synced data will be deleted.')) return
                        await fetch('/api/email/accounts', {
                          method: 'DELETE',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ accountId: account.id }),
                        })
                        load()
                      }} className="btn-ghost btn-sm text-red-500 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                        Disconnect
                      </button>
                    </div>
                    {syncResult && (
                      <p className="text-xs text-brand-600 mt-2 font-medium">{syncResult}</p>
                    )}
                  </div>
                ))}

                {/* Connect button */}
                {emailAccounts.filter(a => a.provider === selected.key).length === 0 && (
                  <a href={selected.oauthUrl} className="btn-primary inline-flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Connect {selected.name}
                  </a>
                )}

                {/* Expired/Error reconnect */}
                {emailAccounts.filter(a => a.provider === selected.key && a.status !== 'active').length > 0 && (
                  <a href={selected.oauthUrl} className="btn-secondary inline-flex items-center gap-2 mt-2">
                    <RefreshCw className="w-4 h-4" />
                    Reconnect {selected.name}
                  </a>
                )}

                <div className="mt-4 p-3 bg-blue-50 rounded-xl">
                  <div className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-blue-800">Privacy & Security</p>
                      <p className="text-xs text-blue-600 mt-0.5">
                        We only read email metadata (sender, subject, date). We never read email bodies or attachments.
                        Tokens are encrypted at rest. You can disconnect anytime.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card p-6">
                <h3 className="font-semibold text-surface-900 mb-1">Configuration</h3>
                <p className="text-xs text-surface-500 mb-4">Enter your credentials to complete the connection</p>
                <div className="space-y-4">
                  {selected.fields.map(field => (
                    <div key={field.key}>
                      <label className="label">{field.label}</label>
                      <input type={field.type || 'text'} className="input" placeholder={field.placeholder}
                        value={config[field.key] || ''} onChange={e => setConfig(v => ({ ...v, [field.key]: e.target.value }))} />
                      {field.help && <p className="text-[11px] text-surface-400 mt-1">{field.help}</p>}
                    </div>
                  ))}
                </div>
                {connectError && (
                  <p className="text-xs text-red-500 mt-3 font-medium">{connectError}</p>
                )}
                <button onClick={saveConfig} disabled={saving} className="btn-primary mt-5">
                  {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : savedMsg ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {savedMsg ? 'Saved!' : selected.key === 'whatsapp' ? 'Connect & Verify' : 'Save Configuration'}
                </button>
                {selected.key === 'whatsapp' && saved.get('whatsapp')?.enabled && (
                  <div className="mt-4 p-3 bg-emerald-50 rounded-xl">
                    <p className="text-xs font-semibold text-emerald-800">WhatsApp Connected</p>
                    <p className="text-xs text-emerald-600 mt-0.5">
                      Phone: {saved.get('whatsapp')?.config?.display_phone || 'Connected'}. Webhook URL: <code className="bg-emerald-100 px-1 rounded">your-domain.com/api/webhooks/whatsapp</code>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
