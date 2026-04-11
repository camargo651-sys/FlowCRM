'use client'
import { useState } from 'react'
import { Menu, Plus, X } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { MODULES } from './Sidebar'
import TracktioIcons from '@/components/icons/TracktioIcons'

const MOBILE_TABS = [
  { moduleKey: 'home', label: 'Home', href: '/dashboard' },
  { moduleKey: 'sales', label: 'Sales', href: '/pipeline' },
  { moduleKey: 'whatsapp', label: 'WhatsApp', href: '/whatsapp' },
  { moduleKey: 'finance', label: 'Finance', href: '/invoices' },
  { moduleKey: '__more__', label: 'More', href: '' },
]

const MORE_MODULES = MODULES.filter(m => !['home', 'sales', 'whatsapp', 'finance'].includes(m.key))

const TAB_ICONS: Record<string, (p: { className?: string }) => React.ReactNode> = {
  home: (p) => <TracktioIcons.Home {...p} />,
  sales: (p) => <TracktioIcons.Sales {...p} />,
  whatsapp: (p) => <TracktioIcons.WhatsApp {...p} />,
  finance: (p) => <TracktioIcons.Finance {...p} />,
}

export default function MobileNav({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  const isActive = (href: string) => {
    if (!href) return false
    return pathname === href || pathname.startsWith(href + '/')
  }

  const handleTab = (tab: typeof MOBILE_TABS[0]) => {
    if (tab.moduleKey === '__more__') { setMoreOpen(true); return }
    router.push(tab.href)
    setMoreOpen(false)
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
          <div className="absolute left-0 top-0 h-full w-[240px] animate-slide-in-right shadow-modal" onClick={() => setSidebarOpen(false)}>
            {children}
          </div>
        </div>
      )}

      {/* Mobile bottom tab bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-surface-100 safe-area-bottom">
        <div className="flex items-center justify-around px-2 py-1.5">
          {MOBILE_TABS.map(tab => {
            const active = isActive(tab.href)
            const isMore = tab.moduleKey === '__more__'
            const IconRenderer = TAB_ICONS[tab.moduleKey]
            return (
              <button key={tab.moduleKey} onClick={() => handleTab(tab)}
                className={cn('flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-colors min-w-[56px]',
                  active ? 'text-brand-600' : 'text-surface-400')}>
                {isMore ? (
                  <>
                    <span className="text-lg leading-none">{'\u2026'}</span>
                    <span className={cn('text-[10px] font-medium')}>{tab.label}</span>
                  </>
                ) : IconRenderer ? (
                  <>
                    {IconRenderer({ className: 'w-5 h-5' })}
                    <span className={cn('text-[10px] font-medium', active && 'text-brand-600')}>{tab.label}</span>
                  </>
                ) : (
                  <>
                    <span className="text-lg leading-none">?</span>
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
        <div className="md:hidden fixed inset-0 z-50 animate-fade-in" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-surface-900/40 backdrop-blur-[2px]" />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-modal animate-slide-up safe-area-bottom" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-surface-200 rounded-full mx-auto mt-3 mb-4" />
            <div className="px-4 pb-6 grid grid-cols-4 gap-4">
              {MORE_MODULES.map(mod => (
                <button key={mod.key} onClick={() => { if (mod.directLink) router.push(mod.directLink); else if (mod.items[0]) router.push(mod.items[0].href); setMoreOpen(false) }}
                  className="flex flex-col items-center gap-1.5 py-2">
                  <div className="w-12 h-12 bg-surface-50 rounded-2xl flex items-center justify-center">
                    <span className="text-xl">{mod.icon}</span>
                  </div>
                  <span className="text-[11px] text-surface-600 font-medium">{mod.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
