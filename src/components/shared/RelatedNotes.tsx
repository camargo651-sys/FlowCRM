'use client'
import { useEffect, useState, useCallback } from 'react'
import { Plus, StickyNote } from 'lucide-react'
import NoteCard, { type Note } from './NoteCard'
import NoteEditorModal from './NoteEditorModal'

interface RelatedNotesProps {
  contactId?: string
  dealId?: string
  ticketId?: string
  title?: string
}

export default function RelatedNotes({ contactId, dealId, ticketId, title = 'Notes' }: RelatedNotesProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Note | null>(null)

  const params = new URLSearchParams()
  if (contactId) params.set('contact_id', contactId)
  if (dealId) params.set('deal_id', dealId)
  if (ticketId) params.set('ticket_id', ticketId)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/notes?${params.toString()}`)
      const data = await res.json()
      setNotes(data.notes || [])
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId, dealId, ticketId])

  useEffect(() => { load() }, [load])

  const handleSaved = (note: Note) => {
    setNotes(prev => {
      const idx = prev.findIndex(n => n.id === note.id)
      if (idx >= 0) {
        const c = [...prev]; c[idx] = note; return c
      }
      return [note, ...prev]
    })
  }
  const handleDeleted = (id: string) => setNotes(prev => prev.filter(n => n.id !== id))

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wide flex items-center gap-1">
          <StickyNote className="w-3.5 h-3.5 inline text-amber-600" /> {title} ({notes.length})
        </h3>
        <button
          onClick={() => { setEditing(null); setEditorOpen(true) }}
          className="btn-secondary btn-sm text-[11px]"
        >
          <Plus className="w-3 h-3" /> Add note
        </button>
      </div>

      {loading ? (
        <div className="text-xs text-surface-400 py-4 text-center">Loading...</div>
      ) : notes.length === 0 ? (
        <p className="text-xs text-surface-400 py-3 text-center">No notes yet</p>
      ) : (
        <div className="columns-1 sm:columns-2 gap-3">
          {notes.map(n => (
            <NoteCard
              key={n.id}
              note={n}
              onClick={(note) => { setEditing(note); setEditorOpen(true) }}
            />
          ))}
        </div>
      )}

      {editorOpen && (
        <NoteEditorModal
          note={editing}
          defaults={{
            contact_id: contactId || null,
            deal_id: dealId || null,
            ticket_id: ticketId || null,
          }}
          onClose={() => setEditorOpen(false)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
