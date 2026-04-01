'use client'
import { useState, useRef, useEffect } from 'react'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InlineEditProps {
  value: string
  onSave: (value: string) => void
  type?: 'text' | 'email' | 'number' | 'tel'
  className?: string
  placeholder?: string
}

export default function InlineEdit({ value, onSave, type = 'text', className, placeholder }: InlineEditProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  useEffect(() => { setDraft(value) }, [value])

  const save = () => {
    if (draft !== value) onSave(draft)
    setEditing(false)
  }

  const cancel = () => {
    setDraft(value)
    setEditing(false)
  }

  if (!editing) {
    return (
      <span onClick={() => setEditing(true)}
        className={cn('cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-950 rounded px-1 -mx-1 transition-colors', !value && 'text-surface-300 italic', className)}>
        {value || placeholder || '—'}
      </span>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <input ref={inputRef} type={type}
        className="px-1.5 py-0.5 text-xs border border-brand-300 rounded outline-none focus:ring-1 focus:ring-brand-500 bg-white dark:bg-surface-800 w-full"
        value={draft} onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
        onBlur={save} />
    </div>
  )
}
