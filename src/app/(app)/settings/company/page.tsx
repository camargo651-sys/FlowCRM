'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Building2, Save, CheckCircle2, Globe, DollarSign, FileText, Key, Plus, Trash2, Eye, EyeOff, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

const CURRENCIES = ['USD','EUR','GBP','COP','MXN','BRL','ARS','CLP','PEN','CAD','AUD','JPY','CNY','INR']
const TIMEZONES = ['America/Bogota','America/Mexico_City','America/Lima','America/Buenos_Aires','America/Sao_Paulo','America/New_York','America/Chicago','America/Los_Angeles','Europe/London','Europe/Madrid','Europe/Berlin','Asia/Tokyo','Asia/Shanghai']
const DATE_FORMATS = ['MM/DD/YYYY','DD/MM/YYYY','YYYY-MM-DD','DD.MM.YYYY']

export default function CompanySettingsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tab, setTab] = useState<'company'|'billing'|'api'|'danger'>('company')
  const [form, setForm] = useState<any>({})
  const [apiKeys, setApiKeys] = useState<any[]>([])
  const [newKeyName, setNewKeyName] = useState('')
  const [generatedKey, setGeneratedKey] = useState('')

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: ws } = await supabase.from('workspaces').select('*').eq('owner_id', user.id).single()
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
    const input = prompt('Type RESET to confirm. This will delete ALL data in your workspace.')
    if (input !== 'RESET') return
    setResetting(true)
    const res = await fetch('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: 'RESET' }) })
    if (res.ok) {
      alert('Database reset complete. The page will reload.')
      window.location.href = '/dashboard'
    } else {
      alert('Reset failed')
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

  const set = (key: string, val: any) => setForm((f: any) => ({ ...f, [key]: val }))

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in max-w-4xl">
      <div className="page-header">
        <div><h1 className="page-title">Company Settings</h1><p className="text-sm text-surface-500 mt-0.5">Configure your business details</p></div>
      </div>

      <div className="flex gap-1 mb-6 p-1 bg-surface-100 rounded-xl w-fit">
        {[{ id: 'company', label: 'Company Info' }, { id: 'billing', label: 'Billing & Tax' }, { id: 'api', label: 'API Keys' }, { id: 'danger', label: 'Danger Zone' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all', tab === t.id ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* COMPANY INFO */}
      {tab === 'company' && (
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="font-semibold text-surface-900 mb-4 flex items-center gap-2"><Building2 className="w-4 h-4" /> Business Information</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Company Name</label><input className="input" value={form.company_name || ''} onChange={e => set('company_name', e.target.value)} /></div>
                <div><label className="label">Tax ID / NIT / RUT</label><input className="input" value={form.tax_id || ''} onChange={e => set('tax_id', e.target.value)} placeholder="e.g. 900.123.456-7" /></div>
              </div>
              <div><label className="label">Address</label><input className="input" value={form.address || ''} onChange={e => set('address', e.target.value)} /></div>
              <div className="grid grid-cols-4 gap-4">
                <div><label className="label">City</label><input className="input" value={form.city || ''} onChange={e => set('city', e.target.value)} /></div>
                <div><label className="label">State</label><input className="input" value={form.state || ''} onChange={e => set('state', e.target.value)} /></div>
                <div><label className="label">Country</label><input className="input" value={form.country || ''} onChange={e => set('country', e.target.value)} /></div>
                <div><label className="label">Zip Code</label><input className="input" value={form.zip_code || ''} onChange={e => set('zip_code', e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="label">Phone</label><input className="input" value={form.phone || ''} onChange={e => set('phone', e.target.value)} /></div>
                <div><label className="label">Email</label><input className="input" type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} /></div>
                <div><label className="label">Website</label><input className="input" value={form.website || ''} onChange={e => set('website', e.target.value)} /></div>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-surface-900 mb-4 flex items-center gap-2"><Globe className="w-4 h-4" /> Regional Settings</h3>
            <div className="grid grid-cols-3 gap-4">
              <div><label className="label">Timezone</label>
                <select className="input" value={form.timezone || ''} onChange={e => set('timezone', e.target.value)}>
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
              <div><label className="label">Date Format</label>
                <select className="input" value={form.date_format || ''} onChange={e => set('date_format', e.target.value)}>
                  {DATE_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div><label className="label">Fiscal Year Start</label>
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
            {saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      )}

      {/* BILLING & TAX */}
      {tab === 'billing' && (
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="font-semibold text-surface-900 mb-4 flex items-center gap-2"><DollarSign className="w-4 h-4" /> Currency & Tax</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Default Currency</label>
                <select className="input" value={form.default_currency || 'USD'} onChange={e => set('default_currency', e.target.value)}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="label">Default Tax Rate (%)</label>
                <input className="input" type="number" step="0.01" value={form.default_tax_rate || 0} onChange={e => set('default_tax_rate', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-surface-900 mb-4 flex items-center gap-2"><FileText className="w-4 h-4" /> Document Prefixes</h3>
            <div className="grid grid-cols-3 gap-4">
              <div><label className="label">Invoice Prefix</label><input className="input" value={form.invoice_prefix || 'INV'} onChange={e => set('invoice_prefix', e.target.value)} /></div>
              <div><label className="label">Quote Prefix</label><input className="input" value={form.quote_prefix || 'Q'} onChange={e => set('quote_prefix', e.target.value)} /></div>
              <div><label className="label">PO Prefix</label><input className="input" value={form.po_prefix || 'PO'} onChange={e => set('po_prefix', e.target.value)} /></div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-surface-900 mb-4">Default Invoice Text</h3>
            <div className="space-y-4">
              <div><label className="label">Default Notes (appears on all invoices)</label>
                <textarea className="input resize-none" rows={2} value={form.invoice_notes || ''} onChange={e => set('invoice_notes', e.target.value)} placeholder="e.g. Thank you for your business!" />
              </div>
              <div><label className="label">Default Terms & Conditions</label>
                <textarea className="input resize-none" rows={3} value={form.invoice_terms || ''} onChange={e => set('invoice_terms', e.target.value)} placeholder="e.g. Payment due within 30 days..." />
              </div>
            </div>
          </div>

          <button onClick={saveSettings} disabled={saving} className="btn-primary">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      )}

      {/* API KEYS */}
      {tab === 'api' && (
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="font-semibold text-surface-900 mb-2 flex items-center gap-2"><Key className="w-4 h-4" /> API Keys</h3>
            <p className="text-xs text-surface-500 mb-4">Use API keys to access the Tracktio REST API (v1) from external applications.</p>

            {generatedKey && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-4">
                <p className="text-xs font-semibold text-emerald-800 mb-1">New API key created — copy it now (won't be shown again):</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-white p-2 rounded-lg font-mono text-surface-800 border border-emerald-200 select-all">{generatedKey}</code>
                  <button onClick={() => { navigator.clipboard.writeText(generatedKey); }} className="btn-secondary btn-sm"><Copy className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            )}

            <div className="flex gap-2 mb-4">
              <input className="input flex-1" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="Key name (e.g. Zapier, Mobile App)" />
              <button onClick={createApiKey} disabled={!newKeyName} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> Create Key</button>
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
                      <span className={cn('badge text-[10px]', key.active ? 'badge-green' : 'badge-red')}>{key.active ? 'Active' : 'Revoked'}</span>
                      {key.active && <button onClick={() => revokeKey(key.id)} className="text-surface-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-surface-400 text-center py-6">No API keys yet</p>
            )}
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-surface-900 mb-2">API Documentation</h3>
            <p className="text-xs text-surface-500 mb-3">All endpoints support pagination, search, and filtering.</p>
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
            <h3 className="font-semibold text-red-700 mb-2">Reset Database</h3>
            <p className="text-xs text-surface-500 mb-4">
              This will permanently delete ALL data in your workspace: contacts, deals, products, invoices, employees, and everything else.
              Your account and workspace settings will be preserved. You'll go through onboarding again.
            </p>
            <p className="text-xs text-red-500 font-semibold mb-4">This action cannot be undone.</p>
            <button onClick={resetDatabase} disabled={resetting}
              className="px-6 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors text-sm">
              {resetting ? 'Resetting...' : 'Reset All Data'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
