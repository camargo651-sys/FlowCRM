'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Zap, LogOut, ChevronDown, Search, Plus,
} from 'lucide-react'
import TracktioIcons from '@/components/icons/TracktioIcons'
import NotificationBell from './NotificationBell'
import ThemeToggle from '@/components/shared/ThemeToggle'
import WorkspaceSwitcher from './WorkspaceSwitcher'
import RecentItems from './RecentItems'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cn, getInitials } from '@/lib/utils'
import { useState, useEffect, useCallback } from 'react'
import { useWorkspace } from '@/lib/workspace-context'
import { useI18n } from '@/lib/i18n/context'
import { usePlan } from '@/lib/pricing/use-plan'
import { ROUTE_TO_MODULE } from '@/lib/pricing/gate'

// ─── Module definitions ─────────────────────────────────────────
export interface ModuleItem {
  href: string
  label: string
}

export interface ModuleDef {
  key: string
  icon: string
  label: string
  always?: boolean
  directLink?: string // If set, clicking navigates here instead of opening sub-nav
  items: ModuleItem[]
  /** Maps to workspace.enabled_modules keys that make this module visible */
  enableKeys?: string[]
}

/** Labels stored as i18n keys — resolved at render time via t() */
export const MODULES: ModuleDef[] = [
  {
    key: 'home', icon: 'home', label: 'nav.dashboard', always: true,
    directLink: '/dashboard',
    items: [],
  },
  {
    key: 'sales', icon: 'sales', label: 'section.sales',
    enableKeys: ['crm'],
    items: [
      { href: '/pipeline', label: 'nav.pipeline' },
      { href: '/contacts', label: 'nav.contacts' },
      { href: '/contacts?type=company', label: 'nav.companies' },
      { href: '/quotes', label: 'nav.quotes' },
      { href: '/contracts', label: 'nav.contracts' },
      { href: '/tasks', label: 'nav.my_activities' },
    ],
  },
  {
    key: 'marketing', icon: 'marketing', label: 'nav.marketing',
    enableKeys: ['crm'],
    items: [
      { href: '/leads', label: 'nav.leads' },
      { href: '/campaigns', label: 'nav.campaigns' },
      { href: '/whatsapp-campaigns', label: 'nav.wa_campaigns' },
      { href: '/sequences', label: 'nav.sequences' },
      { href: '/forms', label: 'nav.forms' },
      { href: '/templates-marketplace', label: 'nav.templates' },
    ],
  },
  {
    key: 'inbox', icon: 'inbox', label: 'nav.inbox',
    enableKeys: ['crm'],
    items: [
      { href: '/whatsapp', label: 'nav.wa_inbox' },
      { href: '/inbox/email', label: 'nav.email_inbox' },
      { href: '/inbox/sms', label: 'nav.sms_inbox' },
      { href: '/reports/calls', label: 'nav.calls_log' },
    ],
  },
  {
    key: 'commerce', icon: 'commerce', label: 'nav.commerce',
    enableKeys: ['pos', 'ecommerce'],
    items: [
      { href: '/pos', label: 'nav.pos' },
      { href: '/store-orders', label: 'nav.ecommerce' },
      { href: '/commerce/catalog', label: 'nav.catalog' },
      { href: '/commerce/discounts', label: 'nav.discounts' },
    ],
  },
  {
    key: 'operations', icon: 'operations', label: 'section.operations',
    enableKeys: ['inventory', 'purchasing', 'manufacturing'],
    items: [
      { href: '/inventory', label: 'nav.inventory' },
      { href: '/purchasing', label: 'nav.purchasing' },
      { href: '/purchasing?view=suppliers', label: 'nav.suppliers' },
      { href: '/manufacturing', label: 'nav.manufacturing' },
    ],
  },
  {
    key: 'finance', icon: 'finance', label: 'section.finance',
    enableKeys: ['invoicing', 'accounting', 'expenses'],
    items: [
      { href: '/invoices', label: 'nav.invoices' },
      { href: '/expenses', label: 'nav.expenses' },
      { href: '/accounting', label: 'nav.accounting' },
      { href: '/finance/payments', label: 'nav.payments' },
      { href: '/finance/subscriptions', label: 'nav.subscriptions' },
      { href: '/finance/taxes', label: 'nav.taxes' },
    ],
  },
  {
    key: 'insights', icon: 'insights', label: 'nav.insights',
    always: true,
    items: [
      { href: '/reports', label: 'nav.reports' },
      { href: '/reports/custom', label: 'nav.custom_reports' },
      { href: '/bi', label: 'nav.bi' },
      { href: '/reports/calls', label: 'nav.calls_log' },
      { href: '/reports/lost-deals', label: 'nav.lost_deals' },
      { href: '/reports/forecast', label: 'nav.forecast' },
      { href: '/insights/quotas', label: 'nav.quotas' },
    ],
  },
  {
    key: 'people', icon: 'people', label: 'section.people',
    enableKeys: ['hr'],
    items: [
      { href: '/hr', label: 'nav.hr' },
      { href: '/hr?tab=payroll', label: 'nav.payroll' },
      { href: '/hr?tab=time-off', label: 'nav.time_off' },
      { href: '/hr?tab=org-chart', label: 'nav.org_chart' },
    ],
  },
  {
    key: 'support', icon: 'support', label: 'nav.tickets',
    enableKeys: ['crm'],
    items: [
      { href: '/tickets', label: 'nav.tickets' },
      { href: '/support/sla', label: 'nav.sla' },
      { href: '/support/knowledge-base', label: 'nav.knowledge_base' },
      { href: '/portal', label: 'nav.client_portals' },
    ],
  },
  {
    key: 'workspace', icon: 'workspace', label: 'nav.workspace',
    always: true,
    items: [
      { href: '/calendar', label: 'nav.calendar' },
      { href: '/tasks', label: 'nav.tasks' },
      { href: '/inter-dept-requests', label: 'nav.inter_dept' },
      { href: '/workspace/notes', label: 'nav.notes' },
      { href: '/workspace/scheduler', label: 'nav.scheduler' },
      { href: '/workspace/approvals', label: 'nav.approvals' },
    ],
  },
  {
    key: 'settings', icon: 'settings', label: 'nav.settings',
    always: true,
    items: [
      // General
      { href: '/settings', label: 'nav.general' },
      { href: '/settings/company', label: 'nav.company' },
      { href: '/settings/modules', label: 'nav.modules' },
      // Customization
      { href: '/settings/form-builder', label: 'nav.form_builder' },
      { href: '/settings/templates', label: 'nav.templates' },
      { href: '/settings/widget', label: 'nav.widget' },
      { href: '/settings/loss-reasons', label: 'nav.loss_reasons' },
      { href: '/settings/quotas', label: 'nav.quotas_settings' },
      { href: '/settings/data-quality', label: 'Data Quality' },
      { href: '/settings/stage-conditions', label: 'nav.stage_conditions' },
      { href: '/settings/approvals', label: 'nav.approvals' },
      // Permissions
      { href: '/roles', label: 'nav.roles' },
      { href: '/settings/field-permissions', label: 'nav.field_permissions' },
      { href: '/settings/security', label: 'nav.security' },
      { href: '/team', label: 'nav.team' },
      // Automations
      { href: '/automations', label: 'nav.automations' },
      // Integrations
      { href: '/integrations', label: 'nav.integrations' },
      // Billing
      { href: '/billing', label: 'nav.billing' },
      // Developer
      { href: '/api-docs', label: 'nav.api_docs' },
      { href: '/settings/api-keys', label: 'nav.api_keys' },
      { href: '/settings/webhooks', label: 'nav.webhooks' },
      // Data
      { href: '/import', label: 'nav.import' },
      { href: '/audit-log', label: 'nav.audit_log' },
    ],
  },
]

// ─── Helpers ────────────────────────────────────────────────────

/** Map icon keys to Tracktio brand SVG components */
const ICON_MAP: Record<string, (props: { className?: string }) => React.ReactNode> = {
  home: (p) => <TracktioIcons.Home {...p} />,
  sales: (p) => <TracktioIcons.Sales {...p} />,
  marketing: (p) => <TracktioIcons.Marketing {...p} />,
  inbox: (p) => <TracktioIcons.Inbox {...p} />,
  whatsapp: (p) => <TracktioIcons.WhatsApp {...p} />,
  commerce: (p) => <TracktioIcons.Commerce {...p} />,
  finance: (p) => <TracktioIcons.Finance {...p} />,
  insights: (p) => <TracktioIcons.Insights {...p} />,
  operations: (p) => <TracktioIcons.Operations {...p} />,
  people: (p) => <TracktioIcons.People {...p} />,
  support: (p) => <TracktioIcons.Support {...p} />,
  workspace: (p) => <TracktioIcons.Workspace {...p} />,
  settings: (p) => <TracktioIcons.Settings {...p} />,
}

/** Strip query string from an href for pathname matching */
function hrefPath(href: string): string {
  const q = href.indexOf('?')
  return q >= 0 ? href.slice(0, q) : href
}

function ModuleIcon({ icon, className }: { icon: string; className?: string }) {
  const Renderer = ICON_MAP[icon]
  if (Renderer) return <>{Renderer({ className })}</>
  return <span className={className}>{icon}</span>
}

/** Find which module owns the current pathname */
function findActiveModule(pathname: string): string {
  for (const mod of MODULES) {
    if (mod.directLink && (pathname === mod.directLink || pathname.startsWith(mod.directLink + '/'))) {
      return mod.key
    }
    if (mod.items.some(i => {
      const p = hrefPath(i.href)
      return pathname === p || pathname.startsWith(p + '/')
    })) {
      return mod.key
    }
  }
  return 'home'
}

/** Check if a module is visible given the enabled_modules map */
function isModuleVisible(mod: ModuleDef, enabledModules: Record<string, boolean>): boolean {
  if (mod.always) return true
  if (!mod.enableKeys) return true
  // If no modules configured at all, show everything
  const hasAnyConfig = Object.keys(enabledModules).length > 0
  if (!hasAnyConfig) return true
  // Module is visible if ANY of its enableKeys are true
  return mod.enableKeys.some(k => enabledModules[k] === true)
}

// ─── Component ──────────────────────────────────────────────────

interface SidebarProps {
  userEmail: string
  userName: string
  workspaceName: string
}

export default function Sidebar({ userEmail, userName, workspaceName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const { template, logoUrl, primaryColor, name: wsName, enabledModules } = useWorkspace()
  const { t } = useI18n()
  const planGate = usePlan()

  const displayName = wsName || workspaceName || 'Tracktio'

  // Active module — always derive from pathname to avoid hydration mismatch
  const pathnameModule = findActiveModule(pathname)
  const [selectedModule, setSelectedModule] = useState<string>(pathnameModule)

  // Keep selectedModule in sync when pathname changes
  useEffect(() => {
    setSelectedModule(pathnameModule)
    if (typeof window !== 'undefined') {
      localStorage.setItem('tracktio_active_module', pathnameModule)
    }
  }, [pathnameModule])

  const handleSelectModule = useCallback((key: string) => {
    setSelectedModule(key)
    if (typeof window !== 'undefined') {
      localStorage.setItem('tracktio_active_module', key)
    }
  }, [])

  const isActive = (href: string) => {
    const p = hrefPath(href)
    return pathname === p || pathname.startsWith(p + '/')
  }

  const visibleModules = MODULES.filter(m => isModuleVisible(m, enabledModules))
  const activeModuleDef = MODULES.find(m => m.key === selectedModule) || MODULES[0]

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <aside className="hidden md:flex h-screen flex-shrink-0 sticky top-0">
      {/* ─── Left Icon Rail ─── */}
      <div className="w-[60px] h-full bg-surface-900 flex flex-col items-center py-3 flex-shrink-0">
        {/* Workspace logo */}
        <div className="mb-4">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm cursor-pointer"
            style={{ backgroundColor: primaryColor || '#0891B2' }}
            title={displayName}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="" className="w-5 h-5 object-contain" />
            ) : (
              <TracktioIcons.Logo className="w-9 h-9 text-brand-600" />
            )}
          </div>
        </div>

        {/* Module icons */}
        <div className="flex-1 flex flex-col items-center gap-1 overflow-y-auto no-scrollbar">
          {visibleModules.filter(m => m.key !== 'settings').map(mod => {
            const isSelected = selectedModule === mod.key
            return (
              <button
                key={mod.key}
                data-tour={mod.key}
                onClick={() => {
                  if (mod.directLink) { router.push(mod.directLink) }
                  handleSelectModule(mod.key)
                }}
                title={t(mod.label)}
                className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all duration-150 relative group',
                  isSelected
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'text-surface-400 hover:bg-surface-700 hover:text-white'
                )}
              >
                <ModuleIcon icon={mod.icon} className="w-5 h-5" />
                {/* Tooltip */}
                <span className="absolute left-full ml-2 px-2 py-1 bg-surface-800 text-white text-[11px] font-medium rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg">
                  {t(mod.label)}
                </span>
              </button>
            )
          })}
        </div>

        {/* Bottom section: settings + add module + user */}
        <div className="flex flex-col items-center gap-1 mt-2">
          {/* Settings module */}
          {visibleModules.find(m => m.key === 'settings') && (
            <button
              data-tour="settings"
              onClick={() => handleSelectModule('settings')}
              title="Settings"
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all duration-150 relative group',
                selectedModule === 'settings'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-surface-400 hover:bg-surface-700 hover:text-white'
              )}
            >
              <ModuleIcon icon="settings" className="w-5 h-5" />
              <span className="absolute left-full ml-2 px-2 py-1 bg-surface-800 text-white text-[11px] font-medium rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg">
                Settings
              </span>
            </button>
          )}

          {/* Add module button */}
          <Link
            href="/settings/modules"
            title="Add Module"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-surface-500 hover:bg-surface-700 hover:text-white transition-all duration-150 relative group"
          >
            <TracktioIcons.Add className="w-5 h-5" />
            <span className="absolute left-full ml-2 px-2 py-1 bg-surface-800 text-white text-[11px] font-medium rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg">
              Add Module
            </span>
          </Link>

          {/* Notification bell */}
          <div className="mt-1">
            <NotificationBell />
          </div>

          {/* User avatar */}
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            title={userName || userEmail}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 shadow-sm mt-1 relative group"
            style={{ backgroundColor: primaryColor || '#0891B2' }}
          >
            {getInitials(userName || userEmail)}
            <span className="absolute left-full ml-2 px-2 py-1 bg-surface-800 text-white text-[11px] font-medium rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg">
              {userName || userEmail}
            </span>
          </button>
        </div>
      </div>

      {/* ─── Sub-navigation Panel ─── */}
      <div className="hidden lg:flex w-[180px] h-full bg-white dark:bg-surface-50 border-r border-surface-100/80 flex-col">
        {/* Module title + workspace switcher */}
        <div className="px-3 py-4 flex-shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <ModuleIcon icon={activeModuleDef.icon} className="w-4 h-4 text-brand-600" />
            <p className="font-bold text-surface-900 text-sm truncate leading-tight">{t(activeModuleDef.label)}</p>
          </div>
          <WorkspaceSwitcher currentName={displayName} currentColor={primaryColor || '#0891B2'} />
        </div>

        {/* Search trigger */}
        <div className="px-2.5 mb-2">
          <button
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
            aria-label="Search"
            className="w-full flex items-center gap-2 px-2 py-[6px] rounded-lg text-[12px] text-surface-400 hover:bg-surface-50 hover:text-surface-600 transition-all duration-150 group"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="kbd text-[9px] hidden sm:flex">{'\u{2318}'}K</kbd>
          </button>
        </div>

        {/* Sub-nav items */}
        <nav className="flex-1 px-2.5 py-1 overflow-y-auto no-scrollbar">
          <div className="space-y-0.5">
            {activeModuleDef.items.map(({ href, label }) => {
              const mod = ROUTE_TO_MODULE[hrefPath(href)]
              const locked = mod ? planGate.isLocked(mod) : false
              return (
                <Link
                  key={href}
                  href={locked ? '/pricing' : href}
                  className={cn(
                    'flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] font-medium transition-all duration-150 relative group',
                    locked
                      ? 'text-surface-300 hover:bg-surface-50'
                      : isActive(href)
                        ? 'bg-brand-50 text-brand-700 font-semibold'
                        : 'text-surface-500 hover:bg-surface-50 hover:text-surface-800'
                  )}
                >
                  {isActive(href) && !locked && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-brand-600" />
                  )}
                  <span className="truncate flex-1">{t(label)}</span>
                  {locked && (
                    <svg className="w-3 h-3 text-surface-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  )}
                </Link>
              )
            })}
          </div>
        </nav>

        {/* Recent items */}
        <RecentItems />

        {/* Bottom */}
        <div className="p-2.5 border-t border-surface-100/80 flex-shrink-0">
          <div className="flex items-center justify-end gap-0.5 mb-2">
            <ThemeToggle />
          </div>

          <div className="relative">
            {userMenuOpen && (
              <div className="absolute bottom-0 left-0 right-0 mb-1.5 bg-white border border-surface-100 rounded-xl shadow-float overflow-hidden animate-scale-in z-50">
                <div className="px-3.5 py-2 border-b border-surface-50">
                  <p className="text-xs font-semibold text-surface-800 truncate">{userName || 'User'}</p>
                  <p className="text-[10px] text-surface-400 truncate">{userEmail}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" /> {t('nav.signout')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}
