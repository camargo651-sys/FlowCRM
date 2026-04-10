'use client'
import { useState, useEffect, useCallback } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { useWorkspace } from '@/lib/workspace-context'
import { CreditCard, Check, ExternalLink, Sparkles, Package, Download, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { getActiveWorkspace } from '@/lib/get-active-workspace'

// ─── Module-based pricing ───────────────────────────────────────
interface ModulePricing {
  key: string
  name: string
  price: number
  description: string
  icon: string
  free?: boolean
}

const MODULE_PRICING: ModulePricing[] = [
  { key: 'sales', name: 'Sales & CRM', price: 0, description: 'Pipeline, contacts, quotes, leads, sequences', icon: '\u{1F500}', free: true },
  { key: 'finance', name: 'Finance', price: 19, description: 'Invoicing, accounting, expenses, reports', icon: '\u{1F9FE}' },
  { key: 'operations', name: 'Operations', price: 19, description: 'Inventory, purchasing, manufacturing, POS', icon: '\u{1F4E6}' },
  { key: 'people', name: 'People & HR', price: 14, description: 'HR, payroll, leave, tasks, calendar', icon: '\u{1F465}' },
  { key: 'support', name: 'Support', price: 9, description: 'Tickets, contracts, SLA tracking', icon: '\u{1F3AB}' },
  { key: 'whatsapp', name: 'WhatsApp Business', price: 14, description: 'WA inbox, bot, AI auto-reply, campaigns', icon: '\u{1F4AC}' },
  { key: 'ai', name: 'AI Features', price: 19, description: 'AI scoring, auto-reply, insights, analytics', icon: '\u{2728}' },
  { key: 'analytics', name: 'BI & Analytics', price: 9, description: 'BI dashboard, custom reports, data viz', icon: '\u{1F4CA}' },
]

const BUNDLE_PRICE = 79
const INDIVIDUAL_TOTAL = MODULE_PRICING.reduce((sum, m) => sum + m.price, 0)

// Map billing module keys to workspace.enabled_modules keys
const MODULE_KEY_MAP: Record<string, string[]> = {
  sales: ['crm'],
  finance: ['invoicing', 'accounting', 'expenses'],
  operations: ['inventory', 'purchasing', 'manufacturing', 'pos', 'ecommerce'],
  people: ['hr'],
  support: ['crm'], // tickets are under CRM currently
  whatsapp: ['crm'],
  ai: ['crm'],
  analytics: ['crm'],
}

export default function BillingPage() {
  const { t } = useI18n()
  const { plan: currentPlan, enabledModules } = useWorkspace()
  const [loading, setLoading] = useState<string | null>(null)
  const [installedModules, setInstalledModules] = useState<Set<string>>(new Set(['sales']))
  const [workspaceId, setWorkspaceId] = useState('')
  const supabase = createClient()

  // Load installed state from workspace enabled_modules
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const ws = await getActiveWorkspace(supabase, user.id, 'id, enabled_modules')
      if (!ws) return
      setWorkspaceId(ws.id)

      const mods = (ws as { enabled_modules?: Record<string, boolean> }).enabled_modules
      if (mods && typeof mods === 'object') {
        const installed = new Set<string>(['sales']) // Sales always installed
        // Map enabled workspace modules back to billing module keys
        for (const [billingKey, wsKeys] of Object.entries(MODULE_KEY_MAP)) {
          if (wsKeys.some(k => mods[k] === true)) {
            installed.add(billingKey)
          }
        }
        setInstalledModules(installed)
      }
    }
    load()
  }, [])

  const isInstalled = (key: string) => installedModules.has(key)

  const handleInstallToggle = async (mod: ModulePricing) => {
    if (mod.free) return // Can't uninstall free module
    setLoading(mod.key)

    const newInstalled = new Set(installedModules)
    if (newInstalled.has(mod.key)) {
      newInstalled.delete(mod.key)
    } else {
      newInstalled.add(mod.key)
    }

    // Build the new enabled_modules map
    const enabledMap: Record<string, boolean> = { crm: true } // CRM always on
    Array.from(newInstalled).forEach(installedKey => {
      const wsKeys = MODULE_KEY_MAP[installedKey]
      if (wsKeys) {
        wsKeys.forEach(k => { enabledMap[k] = true })
      }
    })

    // If it's a paid module, redirect to Stripe
    if (!isInstalled(mod.key) && mod.price > 0) {
      try {
        const res = await fetch('/api/payments/stripe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ module: mod.key, modules: Array.from(newInstalled) }),
        })
        const data = await res.json()
        if (data.url) {
          window.location.href = data.url
          return
        }
      } catch {
        // fall through to local update
      }
    }

    // Update workspace
    if (workspaceId) {
      await supabase.from('workspaces').update({ enabled_modules: enabledMap }).eq('id', workspaceId)
    }

    setInstalledModules(newInstalled)
    setLoading(null)
  }

  const handleBundleUpgrade = async () => {
    setLoading('bundle')
    try {
      const res = await fetch('/api/payments/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'bundle', modules: MODULE_PRICING.map(m => m.key) }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
        return
      }
    } catch {
      // handle silently
    } finally {
      setLoading(null)
    }
  }

  const monthlyTotal = MODULE_PRICING.filter(m => installedModules.has(m.key)).reduce((sum, m) => sum + m.price, 0)
  const installedCount = installedModules.size

  return (
    <div className="animate-fade-in max-w-5xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav.billing')}</h1>
          <p className="page-subtitle">Install modules to expand your workspace</p>
        </div>
      </div>

      {/* Current Plan Summary */}
      <div className="card p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-surface-900">Your Plan</p>
              <p className="text-xs text-surface-500">
                {installedCount} module{installedCount !== 1 ? 's' : ''} installed
                {' '}&middot;{' '}
                <span className="font-bold text-brand-600">${monthlyTotal}/mo</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {currentPlan && currentPlan !== 'free' && (
              <a href="/api/payments/stripe?action=portal" className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1">
                Manage Subscription <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Bundle Banner */}
      <div className="card p-5 mb-6 bg-gradient-to-r from-brand-600 to-brand-700 text-white border-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5" />
              <h3 className="font-bold text-base">All Modules Bundle</h3>
            </div>
            <p className="text-sm text-white/80">
              Get every module for{' '}
              <span className="font-bold text-white">${BUNDLE_PRICE}/mo</span>
              {' '}instead of ${INDIVIDUAL_TOTAL}/mo.
              {' '}Save ${INDIVIDUAL_TOTAL - BUNDLE_PRICE}/mo.
            </p>
          </div>
          <button
            onClick={handleBundleUpgrade}
            disabled={!!loading}
            className="px-6 py-2.5 bg-white text-brand-700 rounded-xl text-sm font-bold hover:bg-white/90 transition-colors shadow-sm flex-shrink-0"
          >
            {loading === 'bundle' ? (
              <div className="w-4 h-4 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto" />
            ) : (
              'Get Bundle'
            )}
          </button>
        </div>
      </div>

      {/* Module Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {MODULE_PRICING.map(mod => {
          const installed = isInstalled(mod.key)
          return (
            <div
              key={mod.key}
              className={cn(
                'card p-5 flex flex-col relative transition-all border-2',
                installed ? 'border-green-400 bg-green-50/30' : 'border-surface-100 hover:border-surface-200'
              )}
            >
              {/* Installed badge */}
              {installed && (
                <div className="absolute -top-2.5 right-3">
                  <span className="bg-green-500 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" /> Installed
                  </span>
                </div>
              )}

              {mod.free && !installed && (
                <div className="absolute -top-2.5 right-3">
                  <span className="bg-brand-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                    Free
                  </span>
                </div>
              )}

              <div className="mb-3">
                <span className="text-3xl">{mod.icon}</span>
              </div>

              <h3 className="text-sm font-bold text-surface-900 mb-1">{mod.name}</h3>
              <p className="text-[11px] text-surface-500 mb-4 flex-1">{mod.description}</p>

              <div className="mb-3">
                {mod.free ? (
                  <span className="text-lg font-extrabold text-green-600">Free</span>
                ) : (
                  <>
                    <span className="text-lg font-extrabold text-surface-900">${mod.price}</span>
                    <span className="text-xs text-surface-400">/mo</span>
                  </>
                )}
              </div>

              {mod.free ? (
                <div className="w-full py-2 px-4 rounded-xl bg-green-50 text-green-700 text-xs font-semibold text-center border border-green-200">
                  Always Included
                </div>
              ) : installed ? (
                <button
                  onClick={() => handleInstallToggle(mod)}
                  disabled={!!loading}
                  className="w-full py-2 px-4 rounded-xl bg-surface-100 text-surface-500 text-xs font-semibold text-center hover:bg-red-50 hover:text-red-600 hover:border-red-200 border border-surface-200 transition-colors"
                >
                  {loading === mod.key ? (
                    <div className="w-4 h-4 border-2 border-surface-200 border-t-surface-500 rounded-full animate-spin mx-auto" />
                  ) : (
                    'Uninstall'
                  )}
                </button>
              ) : (
                <button
                  onClick={() => handleInstallToggle(mod)}
                  disabled={!!loading}
                  className="w-full py-2 px-4 rounded-xl bg-brand-600 text-white text-xs font-bold text-center hover:bg-brand-700 transition-colors shadow-sm flex items-center justify-center gap-1.5"
                >
                  {loading === mod.key ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      Install
                    </>
                  )}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Free Tier Info */}
      <div className="card mt-8 p-5">
        <h2 className="font-semibold text-surface-900 mb-3">Free Tier</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-surface-400 text-xs">Modules</p>
            <p className="font-semibold text-surface-900">1 (Sales)</p>
          </div>
          <div>
            <p className="text-surface-400 text-xs">Users</p>
            <p className="font-semibold text-surface-900">1</p>
          </div>
          <div>
            <p className="text-surface-400 text-xs">Contacts</p>
            <p className="font-semibold text-surface-900">100</p>
          </div>
          <div>
            <p className="text-surface-400 text-xs">Includes</p>
            <p className="font-semibold text-surface-900">Pipeline + Contacts + Quotes + Leads</p>
          </div>
        </div>
      </div>
    </div>
  )
}
