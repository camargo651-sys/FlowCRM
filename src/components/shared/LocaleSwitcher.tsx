'use client'
import { useState, useRef, useEffect } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { LOCALES, type Locale } from '@/lib/i18n/translations'
import { ChevronDown, Globe } from 'lucide-react'

type Variant = 'light' | 'dark'

export default function LocaleSwitcher({ variant = 'light', className = '' }: { variant?: Variant; className?: string }) {
  const { locale, setLocale } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const current = LOCALES.find(l => l.code === locale) || LOCALES[1]

  const btnCls =
    variant === 'dark'
      ? 'bg-surface-900/60 border-surface-700 text-surface-200 hover:border-surface-500 hover:text-white'
      : 'bg-white border-surface-200 text-surface-700 hover:border-surface-300 hover:text-surface-900'

  const menuCls =
    variant === 'dark'
      ? 'bg-surface-900 border-surface-700'
      : 'bg-white border-surface-200'

  const itemBase =
    variant === 'dark'
      ? 'text-surface-300 hover:bg-surface-800 hover:text-white'
      : 'text-surface-700 hover:bg-surface-50 hover:text-surface-900'

  const itemActive =
    variant === 'dark'
      ? 'bg-surface-800 text-white'
      : 'bg-brand-50 text-brand-700'

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${btnCls}`}
        aria-label="Change language"
      >
        <Globe className="w-3.5 h-3.5 opacity-70" />
        <span className="text-sm leading-none">{current.flag}</span>
        <span className="uppercase tracking-wide">{current.code}</span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
      {open && (
        <div className={`absolute right-0 mt-2 w-44 rounded-xl border shadow-xl z-50 py-1 ${menuCls}`}>
          {LOCALES.map(l => (
            <button
              key={l.code}
              type="button"
              onClick={() => { setLocale(l.code as Locale); setOpen(false) }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors ${l.code === locale ? itemActive : itemBase}`}
            >
              <span className="text-base leading-none">{l.flag}</span>
              <span className="flex-1 text-left">{l.name}</span>
              <span className="uppercase opacity-60 text-[10px]">{l.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
