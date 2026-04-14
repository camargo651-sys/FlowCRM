'use client'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { Plus, Search, StickyNote, Pin, Archive, User, Tag as TagIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import NoteCard, { type Note } from '@/components/shared/NoteCard'
import NoteEditorModal from '@/components/shared/NoteEditorModal'
import { toast } from 'sonner'
import EmptyState from '@/components/shared/EmptyState'

type Filter = 'all' | 'pinned' | 'mine' | 'archived'

export default function WorkspaceNotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filter === 'pinned') params.set('pinned', 'true')
    if (filter === 'mine') params.set('mine', 'true')
    if (filter === 'archived') params.set('archived', 'true')
    if (activeTag) params.set('tag', activeTag)
    if (search.trim()) params.set('search', search.trim())

    try {
      const res = await fetch(`/api/notes?${params.toString()}`)
      const data = await res.json()
      setNotes(data.notes || [])
      if (data.user_id) setCurrentUserId(data.user_id)
    } catch {
      setNotes([])
    } finally {
      setLoading(false)
    }
  }, [filter, activeTag, search])

  useEffect(() => { load() }, [load])

  const allTags = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const n of notes) {
      for (const t of n.tags || []) counts[t] = (counts[t] || 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [notes])

  const openNew = () => {
    setEditingNote(null)
    setEditorOpen(true)
  }

  const openEdit = (note: Note) => {
    setEditingNote(note)
    setEditorOpen(true)
  }

  const handleSaved = (note: Note) => {
    setNotes(prev => {
      const idx = prev.findIndex(n => n.id === note.id)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = note
        return copy
      }
      return [note, ...prev]
    })
  }

  const handleDeleted = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  const togglePin = async (note: Note) => {
    const newPinned = !note.pinned
    setNotes(prev => prev.map(n => n.id === note.id ? { ...n, pinned: newPinned } : n))
    try {
      await fetch(`/api/notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned: newPinned }),
      })
    } catch {
      toast.error('Failed to update')
      setNotes(prev => prev.map(n => n.id === note.id ? { ...n, pinned: note.pinned } : n))
    }
  }

  const filtersList: { key: Filter; label: string; icon: any }[] = [
    { key: 'all', label: 'All notes', icon: StickyNote },
    { key: 'pinned', label: 'Pinned', icon: Pin },
    { key: 'mine', label: 'Mine', icon: User },
    { key: 'archived', label: 'Archived', icon: Archive },
  ]

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Notes</h1>
          <p className="text-sm text-surface-500 mt-0.5">{notes.length} note{notes.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <aside className="lg:w-56 flex-shrink-0 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400" />
            <input
              className="input pl-9 text-xs"
              placeholder="Search notes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            {filtersList.map(f => {
              const Icon = f.icon
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors text-left',
                    filter === f.key ? 'bg-brand-50 text-brand-700' : 'text-surface-600 hover:bg-surface-100',
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {f.label}
                </button>
              )
            })}
          </div>

          {allTags.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-surface-400 uppercase tracking-wider mb-2 px-3 flex items-center gap-1">
                <TagIcon className="w-3 h-3" /> Tags
              </p>
              <div className="space-y-0.5">
                {activeTag && (
                  <button
                    onClick={() => setActiveTag(null)}
                    className="w-full text-left px-3 py-1.5 text-xs text-brand-600 hover:bg-surface-100 rounded-lg"
                  >
                    Clear filter
                  </button>
                )}
                {allTags.map(([tag, count]) => (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(tag)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors',
                      activeTag === tag ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-surface-600 hover:bg-surface-100',
                    )}
                  >
                    <span className="truncate">#{tag}</span>
                    <span className="text-[10px] text-surface-400">{count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Notes grid */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
            </div>
          ) : notes.length === 0 ? (
            <EmptyState
              icon={<StickyNote className="w-7 h-7" />}
              title="Capture ideas, meetings, anything"
              description="Notes live with your contacts and deals. Start with your first one."
              action={{ label: 'New note', onClick: openNew, icon: <Plus className="w-3.5 h-3.5" /> }}
            />
          ) : (
            <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
              {notes.map(note => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onClick={openEdit}
                  onTogglePin={togglePin}
                  authorName={note.author_id === currentUserId ? 'You' : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={openNew}
        className="fixed bottom-6 right-6 lg:bottom-24 lg:right-24 z-30 w-14 h-14 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-600/30 hover:shadow-brand-600/50 hover:scale-105 transition-all flex items-center justify-center"
        title="New note"
      >
        <Plus className="w-6 h-6" />
      </button>

      {editorOpen && (
        <NoteEditorModal
          note={editingNote}
          onClose={() => setEditorOpen(false)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
