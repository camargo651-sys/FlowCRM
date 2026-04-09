'use client'
import { useState, useEffect, useRef } from 'react'
import { Plus, X, TrendingUp, User, Receipt, FileText, CheckSquare, Package } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const ACTIONS = [
  { icon: TrendingUp, label: 'Deal', url: '/pipeline?new=1', color: 'bg-emerald-500' },
  { icon: User, label: 'Contact', url: '/contacts?new=1', color: 'bg-brand-500' },
  { icon: Receipt, label: 'Invoice', url: '/invoices?new=1', color: 'bg-violet-500' },
  { icon: FileText, label: 'Quote', url: '/quotes?new=1', color: 'bg-amber-500' },
  { icon: CheckSquare, label: 'Task', url: '/tasks?new=1', color: 'bg-blue-500' },
  { icon: Package, label: 'Product', url: '/inventory?new=1', color: 'bg-rose-500' },
]

export default function QuickCreate() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Keyboard shortcut: C to create (when not in input)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setOpen(o => !o)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const go = (url: string) => {
    router.push(url)
    setOpen(false)
  }

  return (
    <div ref={ref} className="fixed bottom-6 right-6 z-40 hidden lg:block">
      {/* Action menu */}
      {open && (
        <div className="absolute bottom-16 right-0 w-48 bg-white rounded-2xl shadow-modal border border-surface-100 overflow-hidden animate-scale-in">
          <p className="px-4 py-2 text-[10px] font-bold text-surface-400 uppercase tracking-widest">Create new</p>
          {ACTIONS.map(a => (
            <button key={a.label} onClick={() => go(a.url)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 transition-colors">
              <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center text-white', a.color)}>
                <a.icon className="w-3 h-3" />
              </div>
              {a.label}
            </button>
          ))}
        </div>
      )}

      {/* FAB */}
      <button onClick={() => setOpen(o => !o)}
        className={cn(
          'w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-200',
          open
            ? 'bg-surface-900 rotate-45 shadow-xl'
            : 'bg-brand-600 hover:bg-brand-700 shadow-brand-600/30 hover:shadow-brand-600/50 hover:scale-105'
        )}>
        <Plus className="w-5 h-5 text-white" />
      </button>
    </div>
  )
}
