'use client'
import { useState } from 'react'
import { Menu, LayoutDashboard, Kanban, Users, Plus, MoreHorizontal, X, Receipt, Package, BarChart2, Settings, Briefcase } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Home' },
  { href: '/pipeline', icon: Kanban, label: 'Deals' },
  { href: '__create__', icon: Plus, label: 'New' },
  { href: '/contacts', icon: Users, label: 'Contacts' },
  { href: '__more__', icon: MoreHorizontal, label: 'More' },
]

const MORE_ITEMS = [
  { href: '/invoices', icon: Receipt, label: 'Invoices' },
  { href: '/inventory', icon: Package, label: 'Inventory' },
  { href: '/hr', icon: Briefcase, label: 'HR' },
  { href: '/analytics', icon: BarChart2, label: 'Analytics' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

const CREATE_ITEMS = [
  { href: '/pipeline?new=1', label: 'New Deal', icon: Kanban, color: 'bg-emerald-500' },
  { href: '/contacts?new=1', label: 'New Contact', icon: Users, color: 'bg-brand-500' },
  { href: '/invoices?new=1', label: 'New Invoice', icon: Receipt, color: 'bg-violet-500' },
  { href: '/tasks?new=1', label: 'New Task', icon: BarChart2, color: 'bg-amber-500' },
]

export default function MobileNav({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  const handleTab = (href: string) => {
    if (href === '__more__') { setMoreOpen(true); setCreateOpen(false); return }
    if (href === '__create__') { setCreateOpen(true); setMoreOpen(false); return }
    router.push(href)
    setMoreOpen(false)
    setCreateOpen(false)
  }

  const isActive = (href: string) => {
    if (href.startsWith('__')) return false
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <>
      {/* Desktop sidebar - always visible */}
      <div className="hidden lg:block">
        {children}
      </div>

      {/* Mobile: hamburger for full sidebar */}
      <button onClick={() => setSidebarOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 w-10 h-10 bg-white/90 backdrop-blur-sm border border-surface-200 rounded-xl flex items-center justify-center shadow-card">
        <Menu className="w-5 h-5 text-surface-600" />
      </button>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 animate-fade-in">
          <div className="absolute inset-0 bg-surface-900/40 backdrop-blur-[2px]" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-64 animate-slide-in-right shadow-modal" onClick={() => setSidebarOpen(false)}>
            {children}
          </div>
        </div>
      )}

      {/* Mobile bottom tab bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-surface-100 safe-area-bottom">
        <div className="flex items-center justify-around px-2 py-1.5">
          {TABS.map(tab => {
            const active = isActive(tab.href)
            const isCreate = tab.href === '__create__'
            return (
              <button key={tab.href} onClick={() => handleTab(tab.href)}
                className={cn('flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-colors min-w-[56px]',
                  isCreate ? '' : active ? 'text-brand-600' : 'text-surface-400')}>
                {isCreate ? (
                  <div className="w-10 h-10 -mt-4 bg-brand-600 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-600/30">
                    <Plus className="w-5 h-5 text-white" />
                  </div>
                ) : (
                  <>
                    <tab.icon className={cn('w-5 h-5', active && 'text-brand-600')} />
                    <span className={cn('text-[10px] font-medium', active && 'text-brand-600')}>{tab.label}</span>
                  </>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* More sheet */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-50 animate-fade-in" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-surface-900/40 backdrop-blur-[2px]" />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-modal animate-slide-up safe-area-bottom" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-surface-200 rounded-full mx-auto mt-3 mb-4" />
            <div className="px-4 pb-6 grid grid-cols-4 gap-4">
              {MORE_ITEMS.map(item => (
                <button key={item.href} onClick={() => { router.push(item.href); setMoreOpen(false) }}
                  className="flex flex-col items-center gap-1.5 py-2">
                  <div className="w-12 h-12 bg-surface-50 rounded-2xl flex items-center justify-center">
                    <item.icon className="w-5 h-5 text-surface-600" />
                  </div>
                  <span className="text-[11px] text-surface-600 font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create sheet */}
      {createOpen && (
        <div className="lg:hidden fixed inset-0 z-50 animate-fade-in" onClick={() => setCreateOpen(false)}>
          <div className="absolute inset-0 bg-surface-900/40 backdrop-blur-[2px]" />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-modal animate-slide-up safe-area-bottom" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-surface-200 rounded-full mx-auto mt-3 mb-2" />
            <p className="px-5 py-2 text-xs font-bold text-surface-400 uppercase tracking-wider">Create new</p>
            <div className="px-4 pb-6 space-y-1">
              {CREATE_ITEMS.map(item => (
                <button key={item.href} onClick={() => { router.push(item.href); setCreateOpen(false) }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-surface-50 transition-colors">
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center text-white', item.color)}>
                    <item.icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-surface-800">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
