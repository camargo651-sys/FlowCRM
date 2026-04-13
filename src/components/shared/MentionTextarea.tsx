'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export interface MentionUser {
  id: string
  name: string
}

interface MentionTextareaProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  users: MentionUser[]
  className?: string
  rows?: number
  onKeyDownExtra?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  disabled?: boolean
}

// A textarea with a simple @mention dropdown. Inserts mentions as
// `@[Name](userId)` so they can later be parsed/rendered.
export default function MentionTextarea({
  value,
  onChange,
  placeholder,
  users,
  className,
  rows = 3,
  onKeyDownExtra,
  disabled,
}: MentionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const [triggerStart, setTriggerStart] = useState<number | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? users.filter(u => u.name.toLowerCase().includes(q))
      : users
    return list.slice(0, 8)
  }, [users, query])

  useEffect(() => {
    if (activeIdx >= filtered.length) setActiveIdx(0)
  }, [filtered, activeIdx])

  const detectMention = useCallback((text: string, caret: number) => {
    // Walk back from the caret until we hit whitespace or '@'.
    let i = caret - 1
    while (i >= 0) {
      const ch = text[i]
      if (ch === '@') {
        // Ensure '@' is at start or after whitespace
        if (i === 0 || /\s/.test(text[i - 1])) {
          setTriggerStart(i)
          setQuery(text.slice(i + 1, caret))
          setOpen(true)
          return
        }
        break
      }
      if (/\s/.test(ch)) break
      i--
    }
    setOpen(false)
    setTriggerStart(null)
    setQuery('')
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value
    onChange(next)
    detectMention(next, e.target.selectionStart ?? next.length)
  }

  const insertMention = (user: MentionUser) => {
    if (triggerStart == null) return
    const ta = textareaRef.current
    const caret = ta?.selectionStart ?? value.length
    const before = value.slice(0, triggerStart)
    const after = value.slice(caret)
    const token = `@[${user.name}](${user.id}) `
    const next = before + token + after
    onChange(next)
    setOpen(false)
    setTriggerStart(null)
    setQuery('')
    // Restore caret after the inserted token
    requestAnimationFrame(() => {
      if (ta) {
        const pos = (before + token).length
        ta.focus()
        ta.setSelectionRange(pos, pos)
      }
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (open && filtered.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx(i => (i + 1) % filtered.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx(i => (i - 1 + filtered.length) % filtered.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(filtered[activeIdx])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        return
      }
    }
    onKeyDownExtra?.(e)
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={className || 'input w-full'}
      />
      {open && filtered.length > 0 && (
        <div className="card absolute left-0 bottom-full mb-1 z-30 min-w-[200px] max-h-56 overflow-y-auto p-1 shadow-lg">
          {filtered.map((u, idx) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={e => {
                e.preventDefault()
                insertMention(u)
              }}
              onMouseEnter={() => setActiveIdx(idx)}
              className={
                'w-full text-left px-3 py-1.5 rounded-lg text-sm ' +
                (idx === activeIdx
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-surface-700 hover:bg-surface-50')
              }
            >
              <span className="font-semibold">@{u.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
