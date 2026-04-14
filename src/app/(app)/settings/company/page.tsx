'use client'
import { toast } from 'sonner'
import { DbRow } from '@/types'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Building2, Save, CheckCircle2, Globe, DollarSign, FileText, Key, Plus, Trash2, Eye, EyeOff, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getActiveWorkspace } from '@/lib/get-active-workspace'
import { useI18n } from '@/lib/i18n/context'

const CURRENCIES = ['USD','EUR','GBP','COP','MXN','BRL','ARS','CLP','PEN','CAD','AUD','JPY','CNY','INR']
const TIMEZONES = ['America/Bogota','America/Mexico_City','America/Lima','America/Buenos_Aires','America/Sao_Paulo','America/New_York','America/Chicago','America/Los_Angeles','Europe/London','Europe/Madrid','Europe/Berlin','Asia/Tokyo','Asia/Shanghai']
const DATE_FORMATS = ['MM/DD/YYYY','DD/MM/YYYY','YYYY-MM-DD','DD.MM.YYYY']

export default function CompanySettingsPage() {
  const { t } = useI18n()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tab, setTab] = useState<'company'|'billing'|'api'|'danger'>('company')
  const [form, setForm] = useState<Record<string, string>>({})
  const [apiKeys, setApiKeys] = useState<DbRow[]>([])
  const [newKeyName, setNewKeyName] = useState('')
  const [generatedKey, setGeneratedKey] = useState('')

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const ws = await getActiveWorkspace(supabase, user.id, '*')
    if (!ws) { setLoading(false); return }
    setForm(ws)

    // Load API keys
    try {
      const res = await fetch('/api/v1/api-keys')
      if (res.ok) {
        const { data } = await res.json()
        setApiKeys(data || [])
      }
    } catch {}

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const saveSettings = async () => {
    setSaving(true)
    await supabase.from('workspaces').update({
      company_name: form.company_name || null,
      tax_id: form.tax_id || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      country: form.country || null,
      zip_code: form.zip_code || null,
      phone: form.phone || null,
      email: form.email || null,
      website: form.website || null,
      default_currency: form.default_currency || 'USD',
      default_tax_rate: parseFloat(form.default_tax_rate) || 0,
      fiscal_year_start: parseInt(form.fiscal_year_start) || 1,
      date_format: form.date_format || 'MM/DD/YYYY',
      timezone: form.timezone || 'America/Bogota',
      invoice_prefix: form.invoice_prefix || 'INV',
      quote_prefix: form.quote_prefix || 'Q',
      po_prefix: form.po_prefix || 'PO',
      invoice_notes: form.invoice_notes || null,
      invoice_terms: form.invoice_terms || null,
    }).eq('id', form.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const [resetting, setResetting] = useState(false)
  const resetDatabase = async () => {
    const input = prompt(t('settings.co.reset_confirm_prompt'))
    if (input !== 'RESET') return
    const emailConfirm = prompt(t('settings.co.reset_email_prompt'))
    if (!emailConfirm) return
    setResetting(true)
    const res = await fetch('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: 'RESET', confirmEmail: emailConfirm }) })
    if (res.ok) {
      toast.success(t('settings.co.reset_complete'))
      setTimeout(() => { window.location.href = '/dashboard' }, 1000)
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || t('settings.co.reset_failed'))
    }
    setResetting(false)
  }

  const createApiKey = async () => {
    if (!newKeyName) return
    const res = await fetch('/api/v1/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newKeyName }),
    })
    if (res.ok) {
      const { data } = await res.json()
      setGeneratedKey(data.key)
      setNewKeyName('')
      load()
    }
  }

  const revokeKey = async (id: string) => {
    await fetch('/api/v1/api-keys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }))

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in max-w-4xl">
      <div className="page-header">
        <div><h1 className="page-title">{t('pages.company')}</h1><p className="text-sm text-surface-500 mt-0.5">{t('settings.co.desc')}</p></div>
      </div>

      <div className="segmented-control mb-8">
        {[{ id: 'company', label: t('settings.co.company_info') }, { id: 'billing', label: t('settings.co.billing_tax') }, { id: 'api', label: t('settings.co.api_keys') }, { id: 'danger', label: t('settings.co.danger_zone') }].map(tab2 => (
          <button key={tab2.id} onClick={() => setTab(tab2.id as 'company'|'billing'|'api'|'danger')}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all', tab === tab2.id ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500')}>
            {tab2.label}
          </button>
        ))}
      </div>

      {/* COMPANY INFO */}
      {tab === 'company' && (
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="font-semibold text-surface-900 mb-4 flex items-center gap-2"><Building2 className="w-4 h-4" /> {t('settings.co.business_info')}</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">{t('settings.co.company_name')}</label><input className="input" value={form.company_name || ''} onChange={e => set('company_name', e.target.value)} /></div>
                <div><label className="label">{t('settings.co.tax_id')}</label><input className="input" value={form.tax_id || ''} onChange={e => set('tax_id', e.target.value)} placeholder="e.g. 900.123.456-7" /></div>
              </div>
              <div><label className="label">{t('settings.co.address')}</label><input className="input" value={form.address || ''} onChange={e => set('address', e.target.value)} /></div>
              <div className="grid grid-cols-4 gap-4">
                <div><label className="label">{t('settings.co.city')}</label><input className="input" value={form.city || ''} onChange={e => set('city', e.target.value)} /></div>
                <div><label className="label">{t('settings.co.state')}</label><input className="input" value={form.state || ''} onChange={e => set('state', e.target.value)} /></div>
                <div><label className="label">{t('settings.co.country')}</label><input className="input" value={form.country || ''} onChange={e => set('country', e.target.value)} /></div>
                <div><label className="label">{t('settings.co.zip')}</label><input className="input" value={form.zip_code || ''} onChange={e => set('zip_code', e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="label">{t('settings.co.phone')}</label><input className="input" value={form.phone || ''} onChange={e => set('phone', e.target.value)} /></div>
                <div><label className="label">{t('settings.co.email')}</label><input className="input" type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} /></div>
                <div><label className="label">{t('settings.co.website')}</label><input className="input" value={form.website || ''} onChange={e => set('website', e.target.value)} /></div>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-surface-900 mb-4 flex items-center gap-2"><Globe className="w-4 h-4" /> {t('settings.co.regional')}</h3>
            <div className="grid grid-cols-3 gap-4">
              <div><label className="label">{t('settings.co.timezone')}</label>
                <select className="input" value={form.timezone || ''} onChange={e => set('timezone', e.target.value)}>
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
              <div><label className="label">{t('settings.co.date_format')}</label>
                <select className="input" value={form.date_format || ''} onChange={e => set('date_format', e.target.value)}>
                  {DATE_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div><label className="label">{t('settings.co.fiscal_year_start')}</label>
                <select className="input" value={form.fiscal_year_start || 1} onChange={e => set('fiscal_year_start', e.target.value)}>
                  {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <button onClick={saveSettings} disabled={saving} className="btn-primary">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? t('settings.co.saved_excl') : t('settings.co.save_settings')}
          </button>
        </div>
      )}

      {/* BILLING & TAX */}
      {tab === 'billing' && (
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="font-semibold text-surface-900 mb-4 flex items-center gap-2"><DollarSign className="w-4 h-4" /> {t('settings.co.currency_tax')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">{t('settings.co.default_currency')}</label>
                <select className="input" value={form.default_currency || 'USD'} onChange={e => set('default_currency', e.target.value)}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="label">{t('settings.co.default_tax_rate')}</label>
                <input className="input" type="number" step="0.01" value={form.default_tax_rate || 0} onChange={e => set('default_tax_rate', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-surface-900 mb-4 flex items-center gap-2"><FileText className="w-4 h-4" /> {t('settings.co.doc_prefixes')}</h3>
            <div className="grid grid-cols-3 gap-4">
              <div><label className="label">{t('settings.co.invoice_prefix')}</label><input className="input" value={form.invoice_prefix || 'INV'} onChange={e => set('invoice_prefix', e.target.value)} /></div>
              <div><label className="label">{t('settings.co.quote_prefix')}</label><input className="input" value={form.quote_prefix || 'Q'} onChange={e => set('quote_prefix', e.target.value)} /></div>
              <div><label className="label">{t('settings.co.po_prefix')}</label><input className="input" value={form.po_prefix || 'PO'} onChange={e => set('po_prefix', e.target.value)} /></div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-surface-900 mb-4">{t('settings.co.default_invoice_text')}</h3>
            <div className="space-y-4">
              <div><label className="label">{t('settings.co.default_notes')}</label>
                <textarea className="input resize-none" rows={2} value={form.invoice_notes || ''} onChange={e => set('invoice_notes', e.target.value)} placeholder="e.g. Thank you for your business!" />
              </div>
              <div><label className="label">{t('settings.co.default_terms')}</label>
                <textarea className="input resize-none" rows={3} value={form.invoice_terms || ''} onChange={e => set('invoice_terms', e.target.value)} placeholder="e.g. Payment due within 30 days..." />
              </div>
            </div>
          </div>

          <button onClick={saveSettings} disabled={saving} className="btn-primary">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? t('settings.co.saved_excl') : t('settings.co.save_settings')}
          </button>
        </div>
      )}

      {/* API KEYS */}
      {tab === 'api' && (
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="font-semibold text-surface-900 mb-2 flex items-center gap-2"><Key className="w-4 h-4" /> {t('settings.co.api_keys')}</h3>
            <p className="text-xs text-surface-500 mb-4">{t('settings.co.api_keys_desc')}</p>

            {generatedKey && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-4">
                <p className="text-xs font-semibold text-emerald-800 mb-1">{t('settings.co.new_key_created')}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-white p-2 rounded-lg font-mono text-surface-800 border border-emerald-200 select-all">{generatedKey}</code>
                  <button onClick={() => { navigator.clipboard.writeText(generatedKey); }} className="btn-secondary btn-sm"><Copy className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            )}

            <div className="flex gap-2 mb-4">
              <input className="input flex-1" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder={t('settings.co.key_name_placeholder')} />
              <button onClick={createApiKey} disabled={!newKeyName} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> {t('settings.co.create_key')}</button>
            </div>

            {apiKeys.length > 0 ? (
              <div className="space-y-2">
                {apiKeys.map(key => (
                  <div key={key.id} className="flex items-center justify-between p-3 bg-surface-50 rounded-xl">
                    <div>
                      <p className="text-sm font-semibold text-surface-800">{key.name}</p>
                      <p className="text-[10px] text-surface-400 font-mono">{key.key_prefix} · Created {new Date(key.created_at).toLocaleDateString()}{key.last_used_at ? ` · Last used ${new Date(key.last_used_at).toLocaleDateString()}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn('badge text-[10px]', key.active ? 'badge-green' : 'badge-red')}>{key.active ? t('settings.co.active') : t('settings.co.revoked')}</span>
                      {key.active && <button onClick={() => revokeKey(key.id)} className="text-surface-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-surface-400 text-center py-6">{t('settings.co.no_keys')}</p>
            )}
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-surface-900 mb-2">{t('settings.co.api_docs')}</h3>
            <p className="text-xs text-surface-500 mb-3">{t('settings.co.api_docs_desc')}</p>
            <div className="space-y-1 font-mono text-xs">
              {[
                'GET /api/v1/contacts', 'GET /api/v1/deals', 'GET /api/v1/products',
                'GET /api/v1/invoices', 'GET /api/v1/payments', 'GET /api/v1/quotes',
                'GET /api/v1/purchase-orders', 'GET /api/v1/suppliers',
                'GET /api/v1/employees', 'GET /api/v1/departments',
                'GET /api/v1/accounts', 'GET /api/v1/journal-entries',
              ].map(ep => (
                <div key={ep} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-surface-50">
                  <span className="text-emerald-600 font-bold">GET</span>
                  <span className="text-surface-700">{ep.replace('GET ', '')}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-surface-400 mt-3">All endpoints also support POST, PUT, DELETE. Use <code className="bg-surface-100 px-1 rounded">Authorization: Bearer flw_...</code> header.</p>
          </div>
        </div>
      )}

      {tab === 'danger' && (
        <div className="space-y-6">
          <div className="card p-6 border-red-200">
            <h3 className="font-semibold text-red-700 mb-2">{t('settings.co.reset_db')}</h3>
            <p className="text-xs text-surface-500 mb-4">{t('settings.co.reset_db_desc')}</p>
            <p className="text-xs text-red-500 font-semibold mb-4">{t('settings.co.cannot_undo')}</p>
            <button onClick={resetDatabase} disabled={resetting}
              className="px-6 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors text-sm">
              {resetting ? t('settings.co.resetting') : t('settings.co.reset_all')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
