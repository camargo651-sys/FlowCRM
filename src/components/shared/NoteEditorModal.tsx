'use client'
import { useEffect, useRef, useState } from 'react'
import { X, Pin, Trash2, Save, Tag as TagIcon } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Note } from './NoteCard'

export const NOTE_COLORS = [
  '#fef3c7', // amarillo
  '#fce7f3', // rosa
  '#dbeafe', // azul
  '#dcfce7', // verde
  '#fee2e2', // rojo claro
  '#ede9fe', // morado
  '#fed7aa', // naranja
  '#e5e7eb', // gris
]

interface NoteEditorModalProps {
  note?: Note | null
  defaults?: Partial<Note>
  onClose: () => void
  onSaved?: (note: Note) => void
  onDeleted?: (id: string) => void
}

export default function NoteEditorModal({ note, defaults, onClose, onSaved, onDeleted }: NoteEditorModalProps) {
  const isEdit = !!note
  const [title, setTitle] = useState(note?.title || '')
  const [content, setContent] = useState(note?.content || '')
  const [tagsInput, setTagsInput] = useState((note?.tags || []).join(', '))
  const [color, setColor] = useState(note?.color || NOTE_COLORS[0])
  const [pinned, setPinned] = useState(note?.pinned || false)
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [content])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSave = async () => {
    if (!content.trim() && !title.trim()) {
      toast.error('Note is empty')
      return
    }
    setSaving(true)
    try {
      const tags = tagsInput.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean)
      const payload: any = {
        title: title.trim() || null,
        content,
        tags,
        color,
        pinned,
        ...defaults,
      }
      const url = isEdit ? `/api/notes/${note!.id}` : '/api/notes'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      toast.success(isEdit ? 'Note updated' : 'Note created')
      onSaved?.(data.note)
      onClose()
    } catch (e: any) {
      toast.error(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!isEdit || !note) return
    if (!confirm('Archive this note?')) return
    try {
      const res = await fetch(`/api/notes/${note.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Note archived')
      onDeleted?.(note.id)
      onClose()
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="rounded-2xl shadow-modal w-full max-w-lg animate-slide-up overflow-hidden"
        style={{ backgroundColor: color }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/10">
          <p className="text-xs font-bold uppercase tracking-wider text-surface-700">
            {isEdit ? 'Edit note' : 'New note'}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPinned(p => !p)}
              className={cn(
                'w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/10',
                pinned ? 'text-amber-700' : 'text-surface-500',
              )}
              title={pinned ? 'Unpin' : 'Pin'}
            >
              <Pin className={cn('w-3.5 h-3.5', pinned && 'fill-current')} />
            </button>
            {isEdit && (
              <button
                type="button"
                onClick={handleDelete}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/10 text-surface-500"
                title="Archive"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/10 text-surface-500"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <input
            className="w-full bg-transparent text-lg font-bold text-surface-900 placeholder:text-surface-500 outline-none"
            placeholder="Title (optional)"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <textarea
            ref={textareaRef}
            className="w-full bg-transparent text-sm text-surface-800 placeholder:text-surface-500 outline-none resize-none min-h-[120px] leading-relaxed"
            placeholder="Take a note... URLs auto-link"
            value={content}
            onChange={e => setContent(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <TagIcon className="w-3.5 h-3.5 text-surface-500" />
            <input
              className="flex-1 bg-transparent text-xs text-surface-700 placeholder:text-surface-500 outline-none"
              placeholder="tags, comma, separated"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-black/10">
          <div className="flex items-center gap-1.5">
            {NOTE_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn(
                  'w-6 h-6 rounded-full border-2 transition-all',
                  color === c ? 'border-surface-900 scale-110' : 'border-black/10',
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary btn-sm disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
