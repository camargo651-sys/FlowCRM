'use client'
import { Pin, PinOff } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Note {
  id: string
  workspace_id: string
  author_id?: string | null
  title?: string | null
  content: string
  tags?: string[] | null
  pinned?: boolean
  contact_id?: string | null
  deal_id?: string | null
  ticket_id?: string | null
  color?: string | null
  archived?: boolean
  created_at: string
  updated_at: string
}

interface NoteCardProps {
  note: Note
  onClick?: (note: Note) => void
  onTogglePin?: (note: Note) => void
  authorName?: string
  className?: string
}

const URL_RE = /(https?:\/\/[^\s]+)/g

function renderContent(text: string) {
  const parts = text.split(URL_RE)
  return parts.map((part, i) => {
    if (URL_RE.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="text-brand-600 hover:underline break-all"
        >
          {part}
        </a>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  return d.toLocaleDateString()
}

export default function NoteCard({ note, onClick, onTogglePin, authorName, className }: NoteCardProps) {
  const bg = note.color || '#fef3c7'
  return (
    <div
      onClick={() => onClick?.(note)}
      className={cn(
        'group relative rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer border border-black/5 break-inside-avoid mb-4',
        className,
      )}
      style={{ backgroundColor: bg }}
    >
      {onTogglePin && (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            onTogglePin(note)
          }}
          className={cn(
            'absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-lg transition-opacity',
            note.pinned ? 'opacity-100 text-amber-700' : 'opacity-0 group-hover:opacity-100 text-surface-500 hover:bg-black/5',
          )}
          title={note.pinned ? 'Unpin' : 'Pin'}
        >
          {note.pinned ? <Pin className="w-3.5 h-3.5 fill-current" /> : <PinOff className="w-3.5 h-3.5" />}
        </button>
      )}

      {note.title && <h3 className="font-bold text-surface-900 text-sm mb-1.5 pr-7">{note.title}</h3>}

      <p className="text-xs text-surface-700 whitespace-pre-wrap line-clamp-[6] leading-relaxed">
        {renderContent(note.content)}
      </p>

      {note.tags && note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {note.tags.map(tag => (
            <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-black/10 text-surface-700 font-semibold">
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-black/10">
        <span className="text-[10px] text-surface-600 truncate">
          {authorName || 'You'}
        </span>
        <span className="text-[10px] text-surface-500">{timeAgo(note.updated_at)}</span>
      </div>
    </div>
  )
}
