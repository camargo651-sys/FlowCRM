'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Keyboard } from 'lucide-react'

const SHORTCUT_SECTIONS = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['G', 'D'], desc: 'Go to Dashboard' },
      { keys: ['G', 'P'], desc: 'Go to Pipeline' },
      { keys: ['G', 'C'], desc: 'Go to Contacts' },
      { keys: ['G', 'I'], desc: 'Go to Invoices' },
      { keys: ['G', 'N'], desc: 'Go to Inventory' },
      { keys: ['G', 'H'], desc: 'Go to HR' },
      { keys: ['G', 'S'], desc: 'Go to Settings' },
    ]
  },
  {
    title: 'Actions',
    shortcuts: [
      { keys: ['⌘', 'K'], desc: 'Open command palette' },
      { keys: ['C'], desc: 'Quick create menu' },
      { keys: ['?'], desc: 'Show this help' },
    ]
  },
  {
    title: 'Command Palette',
    shortcuts: [
      { keys: ['↑', '↓'], desc: 'Navigate results' },
      { keys: ['↵'], desc: 'Select item' },
      { keys: ['Esc'], desc: 'Close' },
    ]
  },
]

export default function KeyboardShortcuts() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let gPressed = false
    let gTimeout: NodeJS.Timeout

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return

      // ? to show shortcuts help
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setOpen(o => !o)
        return
      }

      // Escape to close
      if (e.key === 'Escape' && open) {
        setOpen(false)
        return
      }

      // G + key navigation
      if (e.key === 'g' && !e.metaKey && !e.ctrlKey) {
        gPressed = true
        clearTimeout(gTimeout)
        gTimeout = setTimeout(() => { gPressed = false }, 500)
        return
      }

      if (gPressed) {
        gPressed = false
        const routes: Record<string, string> = {
          d: '/dashboard', p: '/pipeline', c: '/contacts',
          i: '/invoices', n: '/inventory', h: '/hr', s: '/settings',
        }
        if (routes[e.key]) router.push(routes[e.key])
      }
    }

    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('keydown', handler)
      clearTimeout(gTimeout)
    }
  }, [router, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-surface-900/40 backdrop-blur-[2px]" />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-modal overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
          <div className="flex items-center gap-2.5">
            <Keyboard className="w-5 h-5 text-brand-600" />
            <h2 className="font-semibold text-surface-900">Keyboard shortcuts</h2>
          </div>
          <button onClick={() => setOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100 transition-colors">
            <X className="w-4 h-4 text-surface-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {SHORTCUT_SECTIONS.map(section => (
            <div key={section.title}>
              <p className="text-[10px] font-bold text-surface-400 uppercase tracking-widest mb-3">{section.title}</p>
              <div className="space-y-2">
                {section.shortcuts.map(s => (
                  <div key={s.desc} className="flex items-center justify-between py-1">
                    <span className="text-sm text-surface-600">{s.desc}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.map((key, i) => (
                        <span key={i}>
                          <kbd className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 bg-surface-100 rounded-md text-[11px] text-surface-600 font-mono border border-surface-200/60 shadow-sm">
                            {key}
                          </kbd>
                          {i < s.keys.length - 1 && s.keys.length === 2 && s.keys[0].length === 1 && s.keys[1].length === 1 && (
                            <span className="text-[10px] text-surface-300 mx-0.5">then</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-surface-100 bg-surface-50">
          <p className="text-[10px] text-surface-400 text-center">
            Press <kbd className="kbd">?</kbd> anytime to toggle this help
          </p>
        </div>
      </div>
    </div>
  )
}
