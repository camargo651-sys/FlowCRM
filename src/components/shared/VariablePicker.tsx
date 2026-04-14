'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Braces, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { VARIABLES, GROUP_META, type Variable } from '@/lib/campaigns/variables'

interface Props {
  onInsert: (variable: string) => void
  trigger?: 'button' | 'inline'
  /** When true (inline mode), the dropdown is rendered open and positioned by parent. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

export default function VariablePicker({
  onInsert,
  trigger = 'button',
  open: controlledOpen,
  onOpenChange,
  className,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v)
    if (controlledOpen === undefined) setInternalOpen(v)
  }
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current) return
      if (!rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? VARIABLES.filter(v => v.label.toLowerCase().includes(q) || v.key.toLowerCase().includes(q))
      : VARIABLES
    const out: Record<string, Variable[]> = {}
    for (const v of filtered) {
      if (!out[v.group]) out[v.group] = []
      out[v.group].push(v)
    }
    return out
  }, [query])

  const handlePick = (v: Variable) => {
    onInsert(`{{${v.key}}}`)
    setQuery('')
    setOpen(false)
  }

  const dropdown = open && (
    <div
      className={cn(
        'absolute z-50 mt-1 w-72 max-w-[92vw] sm:w-80',
        'bg-white shadow-card-hover rounded-xl border border-surface-100 overflow-hidden',
        trigger === 'inline' ? 'left-0 top-full' : 'right-0 top-full',
      )}
    >
      <div className="p-2 border-b border-surface-100 flex items-center gap-1.5">
        <Search className="w-3.5 h-3.5 text-surface-400" />
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search variables..."
          className="flex-1 text-xs bg-transparent outline-none placeholder:text-surface-400"
        />
      </div>
      <div className="max-h-72 overflow-y-auto p-2 space-y-3">
        {Object.keys(grouped).length === 0 && (
          <p className="text-[11px] text-surface-400 text-center py-4">No variables match</p>
        )}
        {(Object.keys(grouped) as Variable['group'][]).map(group => {
          const meta = GROUP_META[group]
          return (
            <div key={group}>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-surface-400 px-1 mb-1">
                {meta.icon} {meta.label}
              </div>
              <div className="flex flex-wrap gap-1">
                {grouped[group].map(v => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => handlePick(v)}
                    className={cn(
                      'inline-flex items-center px-2 py-1 rounded-md text-[11px] font-medium',
                      'border border-transparent hover:border-current/20 transition',
                      meta.color,
                    )}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  if (trigger === 'inline') {
    // Caller positions the wrapper; we just render the dropdown.
    return (
      <div ref={rootRef} className={cn('relative', className)}>
        {dropdown}
      </div>
    )
  }

  return (
    <div ref={rootRef} className={cn('relative inline-block', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold text-surface-500 hover:text-brand-600 hover:bg-brand-50 border border-surface-100 hover:border-brand-200 transition"
      >
        <Braces className="w-3 h-3" />
        Variable
      </button>
      {dropdown}
    </div>
  )
}
