'use client'
import { useRef, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import VariablePicker from './VariablePicker'

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
  rows?: number
  className?: string
}

export default function VariableInput({
  value,
  onChange,
  placeholder,
  multiline = false,
  rows = 3,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const [inlineOpen, setInlineOpen] = useState(false)
  // Track where the slash was typed so we can remove it on insert.
  const slashPosRef = useRef<number | null>(null)

  const insertAtCursor = useCallback(
    (text: string) => {
      const el = inputRef.current
      if (!el) {
        onChange((value || '') + text)
        return
      }
      const start = el.selectionStart ?? value.length
      const end = el.selectionEnd ?? value.length
      // If a slash command opened the picker, replace the slash itself.
      let from = start
      let to = end
      if (slashPosRef.current !== null) {
        from = slashPosRef.current
        to = slashPosRef.current + 1
        slashPosRef.current = null
      }
      const next = value.slice(0, from) + text + value.slice(to)
      onChange(next)
      // Restore caret after React update.
      requestAnimationFrame(() => {
        if (!inputRef.current) return
        const pos = from + text.length
        inputRef.current.focus()
        try {
          inputRef.current.setSelectionRange(pos, pos)
        } catch {}
      })
    },
    [value, onChange],
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const next = e.target.value
    const caret = e.target.selectionStart ?? next.length
    // Detect a freshly typed `/` (the char immediately before the caret was added).
    if (next.length === value.length + 1 && next[caret - 1] === '/') {
      slashPosRef.current = caret - 1
      setInlineOpen(true)
    }
    onChange(next)
  }

  const handleInsert = (variable: string) => {
    insertAtCursor(variable)
    setInlineOpen(false)
  }

  const commonProps = {
    value,
    placeholder,
    onChange: handleChange,
    className: cn('input', className),
  }

  return (
    <div className="relative">
      <div className="absolute -top-1 right-1 z-10">
        <VariablePicker onInsert={handleInsert} />
      </div>
      {multiline ? (
        <textarea
          {...commonProps}
          ref={el => {
            inputRef.current = el
          }}
          rows={rows}
          className={cn('input resize-none pr-20', className)}
        />
      ) : (
        <input
          {...commonProps}
          ref={el => {
            inputRef.current = el
          }}
          className={cn('input pr-20', className)}
        />
      )}
      {inlineOpen && (
        <div className="absolute left-2 top-full z-50">
          <VariablePicker
            trigger="inline"
            open={inlineOpen}
            onOpenChange={setInlineOpen}
            onInsert={handleInsert}
          />
        </div>
      )}
    </div>
  )
}
