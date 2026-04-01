'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Zap, LayoutDashboard, Users, Kanban, CheckSquare, BarChart2, Settings, LogOut,
  ChevronDown, ChevronRight, Plug, FileText, Package, UserPlus, Receipt, Truck,
  BookOpen, Briefcase, PieChart, ShoppingCart, Shield, Code, CreditCard, Factory,
  ShoppingBag
} from 'lucide-react'
import NotificationBell from './NotificationBell'
import WorkspaceSwitcher from './WorkspaceSwitcher'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cn, getInitials } from '@/lib/utils'
import { useState } from 'react'
import { useWorkspace } from '@/lib/workspace-context'
import { useI18n } from '@/lib/i18n/context'

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
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [userPermissions, setUserPermissions] = useState<Record<string, string[]> | null>(null)
  const [enabledModules, setEnabledModules] = useState<string[] | null>(null)
  const { template, logoUrl, primaryColor, name: wsName } = useWorkspace()
  const { t } = useI18n()

  const displayName = wsName || workspaceName || 'Tracktio'

  // Load user role permissions + workspace enabled modules
  useState(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Get user's role
        const { data: profile } = await supabase.from('profiles').select('role, custom_role_id').eq('id', user.id).single()

        if (profile?.custom_role_id) {
          // Load custom role permissions from DB
          const { data: customRole } = await supabase.from('custom_roles').select('permissions').eq('id', profile.custom_role_id).single()
          if (customRole?.permissions) setUserPermissions(customRole.permissions as any)
        } else if (profile?.role === 'admin') {
          // Admin sees everything
          setUserPermissions(null)
        }

        // Load workspace enabled modules
        const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
        if (ws) {
          // Check if workspace has module config (future feature)
          // For now, all modules enabled
        }
      } catch {}
    }
    load()
  })

  const toggleSection = (key: string) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))

  // Check if section has active item
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const sectionActive = (items: { href: string }[]) => items.some(i => isActive(i.href))

  // Map routes to RBAC modules — used to filter sidebar based on role
  const ROUTE_MODULE: Record<string, string> = {
    '/pipeline': 'crm', '/contacts': 'crm', '/quotes': 'crm',
    '/invoices': 'invoicing', '/pos': 'pos', '/store-orders': 'ecommerce',
    '/inventory': 'inventory', '/purchasing': 'purchasing', '/manufacturing': 'manufacturing',
    '/accounting': 'accounting', '/expenses': 'expenses', '/reports': 'reports',
    '/hr': 'hr', '/tasks': 'crm', '/analytics': 'reports',
    '/roles': 'settings', '/team': 'team', '/integrations': 'settings',
    '/automations': 'automations', '/api-docs': 'settings', '/audit-log': 'settings',
    '/settings': 'settings', '/settings/company': 'settings',
  }

  const canAccess = (href: string) => {
    if (!userPermissions) return true // null = admin, sees everything
    const mod = ROUTE_MODULE[href]
    if (!mod) return true // no module = always visible (dashboard)
    return userPermissions[mod]?.includes('view') || false
  }

  const SECTIONS = [
    { key: 'main', label: '', items: [
      { href: '/dashboard', icon: LayoutDashboard, label: t('nav.dashboard') },
    ]},
    { key: 'sales', label: 'Sales', items: [
      { href: '/pipeline', icon: Kanban, label: template.dealLabel.plural },
      { href: '/contacts', icon: Users, label: template.contactLabel.plural },
      { href: '/quotes', icon: FileText, label: 'Quotes' },
      { href: '/invoices', icon: Receipt, label: 'Invoices' },
      { href: '/pos', icon: ShoppingCart, label: 'POS' },
      { href: '/store-orders', icon: ShoppingBag, label: 'E-commerce' },
    ]},
    { key: 'operations', label: 'Operations', items: [
      { href: '/inventory', icon: Package, label: 'Inventory' },
      { href: '/purchasing', icon: Truck, label: 'Purchasing' },
      { href: '/manufacturing', icon: Factory, label: 'Manufacturing' },
    ]},
    { key: 'finance', label: 'Finance', items: [
      { href: '/accounting', icon: BookOpen, label: 'Accounting' },
      { href: '/expenses', icon: CreditCard, label: 'Expenses' },
      { href: '/reports', icon: PieChart, label: 'Reports' },
    ]},
    { key: 'people', label: 'People', items: [
      { href: '/hr', icon: Briefcase, label: 'HR' },
      { href: '/tasks', icon: CheckSquare, label: t('nav.tasks') },
      { href: '/analytics', icon: BarChart2, label: t('nav.analytics') },
    ]},
    { key: 'config', label: 'Configuration', items: [
      { href: '/settings', icon: Settings, label: 'General' },
      { href: '/settings/company', icon: Briefcase, label: 'Company' },
      { href: '/roles', icon: Shield, label: 'Roles' },
      { href: '/team', icon: UserPlus, label: 'Team' },
      { href: '/integrations', icon: Plug, label: 'Integrations' },
      { href: '/automations', icon: Zap, label: 'Automations' },
      { href: '/api-docs', icon: Code, label: 'API' },
      { href: '/audit-log', icon: Shield, label: 'Audit Log' },
    ]},
  ]

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <aside className="w-56 h-screen bg-white border-r border-surface-100 flex flex-col flex-shrink-0 sticky top-0">
      {/* Logo */}
      <div className="p-3 border-b border-surface-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-white"
            style={{ backgroundColor: primaryColor || '#6172f3' }}>
            {logoUrl ? <img src={logoUrl} alt="" className="w-4 h-4 object-contain" /> : <Zap className="w-3.5 h-3.5" />}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-surface-900 text-xs truncate">{displayName}</p>
            <WorkspaceSwitcher currentName={displayName} currentColor={primaryColor || '#6172f3'} />
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto no-scrollbar">
        {SECTIONS.map(section => {
          // Filter items based on user role permissions
          const visibleItems = section.items.filter(item => canAccess(item.href))
          if (visibleItems.length === 0 && section.label) return null

          const isCollapsed = collapsed[section.key] !== undefined ? collapsed[section.key] : false
          return (
            <div key={section.key} className="mb-1">
              {section.label && (
                <button onClick={() => toggleSection(section.key)}
                  className="w-full flex items-center justify-between px-2 py-1 text-[9px] uppercase tracking-wider font-bold text-surface-400 hover:text-surface-600">
                  <span>{section.label}</span>
                  {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
              {!isCollapsed && (
                <div className="space-y-0.5">
                  {visibleItems.map(({ href, icon: Icon, label }) => (
                    <Link key={href} href={href}
                      className={cn(
                        'flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-all',
                        isActive(href)
                          ? 'bg-brand-50 text-brand-700 font-semibold'
                          : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'
                      )}>
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="p-2 border-t border-surface-100">
        <div className="flex items-center justify-end mb-1 px-1">
          <NotificationBell />
        </div>

        <div className="relative">
          <button onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-50 transition-colors">
            <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0" style={{ backgroundColor: primaryColor || '#6172f3' }}>
              {getInitials(userName || userEmail)}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-[10px] font-semibold text-surface-800 truncate">{userName || 'User'}</p>
              <p className="text-[9px] text-surface-400 truncate">{userEmail}</p>
            </div>
          </button>

          {userMenuOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-surface-100 rounded-xl shadow-lg overflow-hidden animate-fade-in z-50">
              <button onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors">
                <LogOut className="w-3.5 h-3.5" /> {t('nav.signout')}
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
