'use client'
import { useState } from 'react'
import { X } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { MODULES, type ModuleDef } from './Sidebar'
import TracktioIcons from '@/components/icons/TracktioIcons'
import { useI18n } from '@/lib/i18n/context'
import Link from 'next/link'

const ICON_MAP: Record<string, (p: { className?: string }) => React.ReactNode> = {
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

// Bottom tab bar shows these 4 + More
const TAB_KEYS = ['home', 'sales', 'inbox', 'marketing']

function getModuleHref(mod: ModuleDef): string {
  if (mod.directLink) return mod.directLink
  return mod.items[0]?.href || '/dashboard'
}

function hrefPath(href: string): string {
  const q = href.indexOf('?')
  return q >= 0 ? href.slice(0, q) : href
}

function findActiveModule(pathname: string): string {
  for (const mod of MODULES) {
    if (mod.directLink && (pathname === mod.directLink || pathname.startsWith(mod.directLink + '/'))) return mod.key
    if (mod.items.some(i => {
      const p = hrefPath(i.href)
      return pathname === p || pathname.startsWith(p + '/')
    })) return mod.key
  }
  return 'home'
}

export default function MobileNav({ children }: { children: React.ReactNode }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const [moduleDrawer, setModuleDrawer] = useState<ModuleDef | null>(null)
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useI18n()
  const activeModule = findActiveModule(pathname)

  const isTabActive = (key: string) => activeModule === key

  const handleTab = (key: string) => {
    setMoreOpen(false)
    setModuleDrawer(null)
    if (key === '__more__') { setMoreOpen(true); return }
    const mod = MODULES.find(m => m.key === key)
    if (!mod) return
    // If module has sub-items, show drawer. If directLink, navigate.
    if (mod.directLink) { router.push(mod.directLink); return }
    if (mod.items.length <= 1) { router.push(getModuleHref(mod)); return }
    setModuleDrawer(mod)
  }

  const handleModuleItem = (href: string) => {
    router.push(href)
    setModuleDrawer(null)
    setMoreOpen(false)
  }

  return (
    <>
      {/* Desktop sidebar — only visible on md+ */}
      <div className="hidden md:block">
        {children}
      </div>

      {/* ─── Mobile Bottom Tab Bar ─── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-surface-100" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center justify-around px-1 py-1">
          {TAB_KEYS.map(key => {
            const mod = MODULES.find(m => m.key === key)
            if (!mod) return null
            const active = isTabActive(key)
            const Renderer = ICON_MAP[key]
            return (
              <button key={key} onClick={() => handleTab(key)}
                className={cn('flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-colors min-w-[60px]',
                  active ? 'text-brand-600' : 'text-surface-400')}>
                {Renderer && Renderer({ className: cn('w-5 h-5', active && 'text-brand-600') })}
                <span className="text-[10px] font-medium">{t(mod.label)}</span>
              </button>
            )
          })}
          {/* More button */}
          <button onClick={() => handleTab('__more__')}
            className={cn('flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-colors min-w-[60px]',
              moreOpen ? 'text-brand-600' : 'text-surface-400')}>
            <TracktioIcons.Add className="w-5 h-5" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </div>

      {/* ─── Module Sub-items Drawer ─── */}
      {moduleDrawer && (
        <div className="md:hidden fixed inset-0 z-50 animate-fade-in" onClick={() => setModuleDrawer(null)}>
          <div className="absolute inset-0 bg-surface-900/40 backdrop-blur-[2px]" />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-modal animate-slide-up"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-surface-200 rounded-full mx-auto mt-3" />
            <div className="flex items-center justify-between px-5 pt-3 pb-2">
              <div className="flex items-center gap-2">
                {ICON_MAP[moduleDrawer.icon]?.({ className: 'w-5 h-5 text-brand-600' })}
                <h3 className="font-bold text-surface-900">{t(moduleDrawer.label)}</h3>
              </div>
              <button onClick={() => setModuleDrawer(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100">
                <X className="w-4 h-4 text-surface-500" />
              </button>
            </div>
            <div className="px-4 pb-6 space-y-1">
              {moduleDrawer.items.map(item => (
                <button key={item.href} onClick={() => handleModuleItem(item.href)}
                  className={cn('w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                    pathname === item.href || pathname.startsWith(item.href + '/')
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-surface-700 hover:bg-surface-50')}>
                  {t(item.label)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── More Sheet ─── */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 animate-fade-in" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-surface-900/40 backdrop-blur-[2px]" />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-modal animate-slide-up"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-surface-200 rounded-full mx-auto mt-3 mb-4" />
            <div className="px-4 pb-6 grid grid-cols-4 gap-3">
              {MODULES.filter(m => m.key !== 'home').map(mod => {
                const Renderer = ICON_MAP[mod.icon]
                const active = isTabActive(mod.key)
                return (
                  <button key={mod.key} onClick={() => {
                    setMoreOpen(false)
                    if (mod.directLink) { router.push(mod.directLink); return }
                    if (mod.items.length <= 1) { router.push(getModuleHref(mod)); return }
                    setModuleDrawer(mod)
                  }}
                    className="flex flex-col items-center gap-1.5 py-2">
                    <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center transition-colors',
                      active ? 'bg-brand-50 text-brand-600' : 'bg-surface-50 text-surface-500')}>
                      {Renderer ? Renderer({ className: 'w-6 h-6' }) : <span className="text-xl">{mod.icon}</span>}
                    </div>
                    <span className={cn('text-[11px] font-medium', active ? 'text-brand-600' : 'text-surface-600')}>{t(mod.label)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
