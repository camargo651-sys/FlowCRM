'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Zap, LogOut, ChevronDown, Search, Plus,
} from 'lucide-react'
import NotificationBell from './NotificationBell'
import ThemeToggle from '@/components/shared/ThemeToggle'
import WorkspaceSwitcher from './WorkspaceSwitcher'
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
  items: ModuleItem[]
  /** Maps to workspace.enabled_modules keys that make this module visible */
  enableKeys?: string[]
}

export const MODULES: ModuleDef[] = [
  {
    key: 'home', icon: '\u{1F3E0}', label: 'Home', always: true,
    items: [{ href: '/dashboard', label: 'Dashboard' }],
  },
  {
    key: 'sales', icon: '\u{1F500}', label: 'Sales',
    enableKeys: ['crm'],
    items: [
      { href: '/pipeline', label: 'Pipeline' },
      { href: '/contacts', label: 'Contacts' },
      { href: '/quotes', label: 'Quotes' },
      { href: '/leads', label: 'Leads' },
      { href: '/campaigns', label: 'Campaigns' },
      { href: '/whatsapp-campaigns', label: 'WA Campaigns' },
      { href: '/whatsapp', label: 'WA Inbox' },
      { href: '/sequences', label: 'Sequences' },
      { href: '/contracts', label: 'Contracts' },
    ],
  },
  {
    key: 'finance', icon: '\u{1F9FE}', label: 'Finance',
    enableKeys: ['invoicing', 'accounting', 'expenses'],
    items: [
      { href: '/invoices', label: 'Invoices' },
      { href: '/accounting', label: 'Accounting' },
      { href: '/expenses', label: 'Expenses' },
      { href: '/reports', label: 'Reports' },
      { href: '/reports/custom', label: 'Custom Reports' },
    ],
  },
  {
    key: 'operations', icon: '\u{1F4E6}', label: 'Operations',
    enableKeys: ['inventory', 'purchasing', 'manufacturing', 'pos', 'ecommerce'],
    items: [
      { href: '/inventory', label: 'Inventory' },
      { href: '/purchasing', label: 'Purchasing' },
      { href: '/manufacturing', label: 'Manufacturing' },
      { href: '/pos', label: 'POS' },
      { href: '/store-orders', label: 'E-commerce' },
    ],
  },
  {
    key: 'people', icon: '\u{1F465}', label: 'People',
    enableKeys: ['hr'],
    items: [
      { href: '/hr', label: 'HR' },
      { href: '/tasks', label: 'Tasks' },
      { href: '/calendar', label: 'Calendar' },
      { href: '/bi', label: 'Analytics' },
    ],
  },
  {
    key: 'support', icon: '\u{1F3AB}', label: 'Support',
    enableKeys: ['crm'],
    items: [
      { href: '/tickets', label: 'Tickets' },
    ],
  },
  {
    key: 'settings', icon: '\u{2699}\u{FE0F}', label: 'Settings', always: true,
    items: [
      { href: '/settings', label: 'General' },
      { href: '/settings/company', label: 'Company' },
      { href: '/settings/modules', label: 'Modules' },
      { href: '/settings/form-builder', label: 'Form Builder' },
      { href: '/settings/templates', label: 'Templates' },
      { href: '/settings/widget', label: 'Web Widget' },
      { href: '/roles', label: 'Roles' },
      { href: '/team', label: 'Team' },
      { href: '/integrations', label: 'Integrations' },
      { href: '/automations', label: 'Automations' },
      { href: '/billing', label: 'Billing' },
      { href: '/templates-marketplace', label: 'Marketplace' },
      { href: '/import', label: 'Import' },
      { href: '/api-docs', label: 'API Docs' },
      { href: '/audit-log', label: 'Audit Log' },
    ],
  },
]

// ─── Helpers ────────────────────────────────────────────────────

/** Find which module owns the current pathname */
function findActiveModule(pathname: string): string {
  for (const mod of MODULES) {
    if (mod.items.some(i => pathname === i.href || pathname.startsWith(i.href + '/'))) {
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

  // Active module — derived from pathname, with localStorage persistence
  const pathnameModule = findActiveModule(pathname)
  const [selectedModule, setSelectedModule] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('tracktio_active_module') || pathnameModule
    }
    return pathnameModule
  })

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

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const visibleModules = MODULES.filter(m => isModuleVisible(m, enabledModules))
  const activeModuleDef = MODULES.find(m => m.key === selectedModule) || MODULES[0]

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <aside className="h-screen flex flex-shrink-0 sticky top-0">
      {/* ─── Left Icon Rail ─── */}
      <div className="w-[60px] h-full bg-surface-900 flex flex-col items-center py-3 flex-shrink-0">
        {/* Workspace logo */}
        <div className="mb-4">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm cursor-pointer"
            style={{ backgroundColor: primaryColor || '#6172f3' }}
            title={displayName}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="" className="w-5 h-5 object-contain" />
            ) : (
              <Zap className="w-4 h-4" />
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
                onClick={() => handleSelectModule(mod.key)}
                title={mod.label}
                className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all duration-150 relative group',
                  isSelected
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'text-surface-400 hover:bg-surface-700 hover:text-white'
                )}
              >
                <span className="text-base leading-none">{mod.icon}</span>
                {/* Tooltip */}
                <span className="absolute left-full ml-2 px-2 py-1 bg-surface-800 text-white text-[11px] font-medium rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg">
                  {mod.label}
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
              onClick={() => handleSelectModule('settings')}
              title="Settings"
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all duration-150 relative group',
                selectedModule === 'settings'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-surface-400 hover:bg-surface-700 hover:text-white'
              )}
            >
              <span className="text-base leading-none">{'\u{2699}\u{FE0F}'}</span>
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
            <Plus className="w-4 h-4" />
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
            style={{ backgroundColor: primaryColor || '#6172f3' }}
          >
            {getInitials(userName || userEmail)}
            <span className="absolute left-full ml-2 px-2 py-1 bg-surface-800 text-white text-[11px] font-medium rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-lg">
              {userName || userEmail}
            </span>
          </button>
        </div>
      </div>

      {/* ─── Sub-navigation Panel ─── */}
      <div className="w-[180px] h-full bg-white dark:bg-surface-50 border-r border-surface-100/80 flex flex-col">
        {/* Module title + workspace switcher */}
        <div className="px-3 py-4 flex-shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{activeModuleDef.icon}</span>
            <p className="font-bold text-surface-900 text-sm truncate leading-tight">{activeModuleDef.label}</p>
          </div>
          <WorkspaceSwitcher currentName={displayName} currentColor={primaryColor || '#6172f3'} />
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
              const mod = ROUTE_TO_MODULE[href]
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
                  <span className="truncate flex-1">{label}</span>
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
