'use client'
import { Trash2, Tag, Download, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BulkActionsProps {
  count: number
  onDelete?: () => void
  onExport?: () => void
  onTag?: (tag: string) => void
  onClear: () => void
}

export default function BulkActions({ count, onDelete, onExport, onTag, onClear }: BulkActionsProps) {
  if (count === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-slide-up">
      <div className="bg-surface-900 text-white rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4">
        <span className="text-sm font-semibold">{count} selected</span>
        <div className="w-px h-5 bg-surface-700" />
        {onExport && (
          <button onClick={onExport} className="flex items-center gap-1.5 text-xs font-medium hover:text-brand-300 transition-colors">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        )}
        {onTag && (
          <button onClick={() => {
            const tag = prompt('Enter tag name:')
            if (tag) onTag(tag)
          }} className="flex items-center gap-1.5 text-xs font-medium hover:text-brand-300 transition-colors">
            <Tag className="w-3.5 h-3.5" /> Tag
          </button>
        )}
        {onDelete && (
          <button onClick={onDelete} className="flex items-center gap-1.5 text-xs font-medium text-red-400 hover:text-red-300 transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        )}
        <div className="w-px h-5 bg-surface-700" />
        <button onClick={onClear} className="text-surface-400 hover:text-white"><X className="w-4 h-4" /></button>
      </div>
    </div>
  )
}
