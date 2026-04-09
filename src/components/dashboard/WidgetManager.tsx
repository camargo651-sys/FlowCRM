'use client'
import { useState, useEffect } from 'react'
import { Settings2, Eye, EyeOff, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

const WIDGETS = [
  { key: 'kpis', label: 'Industry KPIs', default: true },
  { key: 'ai', label: 'AI Command Center', default: true },
  { key: 'modules', label: 'Module Overview', default: true },
  { key: 'actions', label: 'Quick Actions', default: true },
]

const STORAGE_KEY = 'tracktio_dashboard_widgets'

function getConfig(): Record<string, boolean> {
  if (typeof window === 'undefined') return {}
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  const defaults: Record<string, boolean> = {}
  WIDGETS.forEach(w => { defaults[w.key] = w.default })
  return defaults
}

export function useWidgets() {
  const [config, setConfig] = useState<Record<string, boolean>>(() => getConfig())

  useEffect(() => {
    setConfig(getConfig())
  }, [])

  const toggle = (key: string) => {
    setConfig(prev => {
      const updated = { ...prev, [key]: !prev[key] }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }

  const isVisible = (key: string) => config[key] !== false

  return { config, toggle, isVisible }
}

interface WidgetManagerProps {
  config: Record<string, boolean>
  toggle: (key: string) => void
}

export default function WidgetManager({ config, toggle }: WidgetManagerProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="btn-ghost btn-sm text-xs text-surface-400 hover:text-surface-600">
        <Settings2 className="w-3.5 h-3.5" /> Customize
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-float border border-surface-100 z-40 animate-scale-in overflow-hidden">
            <p className="px-4 py-2.5 text-[10px] font-bold text-surface-400 uppercase tracking-widest border-b border-surface-100">
              Dashboard widgets
            </p>
            {WIDGETS.map(w => {
              const visible = config[w.key] !== false
              return (
                <button key={w.key} onClick={() => toggle(w.key)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-50 transition-colors text-left">
                  {visible ? (
                    <Eye className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 text-surface-300 flex-shrink-0" />
                  )}
                  <span className={cn('text-sm', visible ? 'text-surface-800' : 'text-surface-400')}>{w.label}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
