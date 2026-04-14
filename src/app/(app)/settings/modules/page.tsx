'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getActiveWorkspace } from '@/lib/get-active-workspace'
import { useI18n } from '@/lib/i18n/context'

const MODULES = [
  { key: 'crm', label: 'CRM / Sales', desc: 'Pipeline, contacts, deals, quotes', icon: '🔀', default: true },
  { key: 'invoicing', label: 'Invoicing', desc: 'Create and track invoices, payments', icon: '🧾', default: true },
  { key: 'inventory', label: 'Inventory', desc: 'Products, stock, categories', icon: '📦', default: true },
  { key: 'purchasing', label: 'Purchasing', desc: 'Purchase orders, suppliers', icon: '🚛', default: false },
  { key: 'manufacturing', label: 'Manufacturing', desc: 'BOMs, work orders, production', icon: '🏭', default: false },
  { key: 'accounting', label: 'Accounting', desc: 'Chart of accounts, journal entries', icon: '📒', default: false },
  { key: 'hr', label: 'HR & Payroll', desc: 'Employees, departments, payslips', icon: '👔', default: false },
  { key: 'expenses', label: 'Expenses', desc: 'Expense reports, reimbursements', icon: '💰', default: false },
  { key: 'ecommerce', label: 'E-commerce', desc: 'Online store, orders', icon: '🛒', default: false },
  { key: 'pos', label: 'Point of Sale', desc: 'Cashier, barcode, receipts', icon: '💳', default: false },
  { key: 'automations', label: 'Automations', desc: 'Workflow rules, triggers', icon: '⚡', default: true },
]

export default function ModulesPage() {
  const { t } = useI18n()
  const supabase = createClient()
  const [enabled, setEnabled] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [workspaceId, setWorkspaceId] = useState('')

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const ws = await getActiveWorkspace(supabase, user.id, 'id, enabled_modules')
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)

    // If no config yet, use defaults
    const savedModules = (ws as { enabled_modules?: Record<string, boolean> }).enabled_modules
    if (savedModules && typeof savedModules === 'object') {
      setEnabled(savedModules)
    } else {
      const defaults: Record<string, boolean> = {}
      MODULES.forEach(m => { defaults[m.key] = m.default })
      setEnabled(defaults)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const toggle = (key: string) => {
    if (key === 'crm') return // CRM always enabled
    setEnabled(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const enableAll = () => {
    const all: Record<string, boolean> = {}
    MODULES.forEach(m => { all[m.key] = true })
    setEnabled(all)
  }

  const saveModules = async () => {
    setSaving(true)
    await supabase.from('workspaces').update({ enabled_modules: enabled }).eq('id', workspaceId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    // Reload page to update sidebar
    window.location.reload()
  }

  const enabledCount = Object.values(enabled).filter(Boolean).length

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in max-w-3xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('pages.modules')}</h1>
          <p className="text-sm text-surface-500 mt-0.5">{enabledCount} / {MODULES.length} {t('settings.mod.modules_enabled')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={enableAll} className="btn-secondary btn-sm">{t('settings.mod.enable_all')}</button>
          <button onClick={saveModules} disabled={saving} className="btn-primary btn-sm">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? t('settings.mod.saved_excl') : t('action.save')}
          </button>
        </div>
      </div>

      <p className="text-xs text-surface-500 mb-6">{t('settings.mod.desc')}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {MODULES.map(mod => {
          const isEnabled = enabled[mod.key] || false
          const isLocked = mod.key === 'crm'
          return (
            <button key={mod.key} onClick={() => toggle(mod.key)} disabled={isLocked}
              className={cn(
                'card p-4 text-left transition-all border-2',
                isEnabled ? 'border-brand-500 bg-brand-50/30' : 'border-surface-100 hover:border-surface-200',
                isLocked && 'opacity-75 cursor-default'
              )}>
              <div className="flex items-start gap-3">
                <span className="text-2xl">{mod.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-surface-900">{mod.label}</h3>
                    {isLocked && <span className="text-[9px] px-1.5 py-0.5 bg-surface-200 text-surface-500 rounded-full font-semibold">{t('settings.mod.required_badge')}</span>}
                  </div>
                  <p className="text-[11px] text-surface-500 mt-0.5">{mod.desc}</p>
                </div>
                <div className={cn('w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all',
                  isEnabled ? 'bg-brand-600 border-brand-600' : 'border-surface-300')}>
                  {isEnabled && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
