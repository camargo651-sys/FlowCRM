'use client'
import { useState, useRef, useEffect, useCallback, useMemo, KeyboardEvent, ClipboardEvent } from 'react'
import { ArrowUp, ArrowDown, Trash2, ChevronsRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export type SpreadsheetColumnType = 'text' | 'number' | 'select' | 'date'

export interface SpreadsheetColumn {
  key: string
  label: string
  type: SpreadsheetColumnType
  options?: string[]
  width?: number
}

export interface SpreadsheetRow {
  id: string
  [key: string]: unknown
}

interface InlineSpreadsheetProps {
  rows: SpreadsheetRow[]
  columns: SpreadsheetColumn[]
  onUpdate: (id: string, field: string, value: unknown) => Promise<void>
  onDelete?: (id: string) => void | Promise<void>
  emptyMessage?: string
}

type SortState = { key: string; dir: 'asc' | 'desc' } | null

export default function InlineSpreadsheet({
  rows,
  columns,
  onUpdate,
  onDelete,
  emptyMessage = 'No rows',
}: InlineSpreadsheetProps) {
  const [editing, setEditing] = useState<{ rowIdx: number; colIdx: number } | null>(null)
  const [draft, setDraft] = useState<string>('')
  const [sort, setSort] = useState<SortState>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState<string | null>(null)
  const [scrollShadow, setScrollShadow] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null)

  // Sorted rows
  const sortedRows = useMemo(() => {
    if (!sort) return rows
    const col = columns.find(c => c.key === sort.key)
    if (!col) return rows
    const out = [...rows].sort((a, b) => {
      const av = a[sort.key]
      const bv = b[sort.key]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (col.type === 'number') return (Number(av) - Number(bv))
      return String(av).localeCompare(String(bv))
    })
    if (sort.dir === 'desc') out.reverse()
    return out
  }, [rows, sort, columns])

  // Focus input when editing begins
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      if (inputRef.current instanceof HTMLInputElement) inputRef.current.select()
    }
  }, [editing])

  // Scroll shadow indicator for mobile
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handle = () => setScrollShadow(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
    handle()
    el.addEventListener('scroll', handle)
    const ro = new ResizeObserver(handle)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', handle); ro.disconnect() }
  }, [columns.length, rows.length])

  const commit = useCallback(async (rowIdx: number, colIdx: number, value: string) => {
    const row = sortedRows[rowIdx]
    const col = columns[colIdx]
    if (!row || !col) return
    const current = row[col.key]
    let parsed: unknown = value
    if (col.type === 'number') parsed = value === '' ? null : Number(value)
    if (value === '' && col.type !== 'number') parsed = null
    if (String(current ?? '') === String(parsed ?? '')) return
    setSaving(row.id + ':' + col.key)
    try {
      await onUpdate(row.id, col.key, parsed)
    } catch (e) {
      toast.error(`Failed to update: ${(e as Error).message}`)
    } finally {
      setSaving(null)
    }
  }, [sortedRows, columns, onUpdate])

  const startEdit = (rowIdx: number, colIdx: number) => {
    const row = sortedRows[rowIdx]
    const col = columns[colIdx]
    if (!row || !col) return
    setDraft(row[col.key] == null ? '' : String(row[col.key]))
    setEditing({ rowIdx, colIdx })
  }

  const moveTo = (rowIdx: number, colIdx: number) => {
    if (colIdx >= columns.length) { colIdx = 0; rowIdx++ }
    if (colIdx < 0) { colIdx = columns.length - 1; rowIdx-- }
    if (rowIdx < 0 || rowIdx >= sortedRows.length) { setEditing(null); return }
    startEdit(rowIdx, colIdx)
  }

  const handleKeyDown = async (e: KeyboardEvent<HTMLElement>) => {
    if (!editing) return
    if (e.key === 'Escape') { e.preventDefault(); setEditing(null); return }
    if (e.key === 'Enter') {
      e.preventDefault()
      await commit(editing.rowIdx, editing.colIdx, draft)
      moveTo(editing.rowIdx + 1, editing.colIdx)
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      await commit(editing.rowIdx, editing.colIdx, draft)
      moveTo(editing.rowIdx, editing.colIdx + (e.shiftKey ? -1 : 1))
    }
  }

  // Paste multi-cell
  const handlePaste = async (e: ClipboardEvent<HTMLElement>) => {
    if (!editing) return
    const text = e.clipboardData.getData('text')
    if (!text.includes('\t') && !text.includes('\n')) return // let default paste
    e.preventDefault()
    const lines = text.replace(/\r/g, '').split('\n').filter(l => l.length > 0)
    const matrix = lines.map(l => l.split('\t'))
    const startRow = editing.rowIdx
    const startCol = editing.colIdx
    setEditing(null)
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        const ri = startRow + r
        const ci = startCol + c
        if (ri >= sortedRows.length || ci >= columns.length) continue
        await commit(ri, ci, matrix[r][c])
      }
    }
    toast.success(`Pasted ${matrix.length} row${matrix.length > 1 ? 's' : ''}`)
  }

  const toggleSort = (key: string) => {
    setSort(s => {
      if (!s || s.key !== key) return { key, dir: 'asc' }
      if (s.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const toggleAll = () => {
    if (selected.size === sortedRows.length) setSelected(new Set())
    else setSelected(new Set(sortedRows.map(r => r.id)))
  }

  const bulkDelete = async () => {
    if (!onDelete || selected.size === 0) return
    if (!confirm(`Delete ${selected.size} row(s)?`)) return
    for (const id of Array.from(selected)) {
      await onDelete(id)
    }
    setSelected(new Set())
    toast.success('Rows deleted')
  }

  const renderCell = (row: SpreadsheetRow, col: SpreadsheetColumn, rowIdx: number, colIdx: number) => {
    const isEditing = editing?.rowIdx === rowIdx && editing?.colIdx === colIdx
    const isSaving = saving === row.id + ':' + col.key
    const value = row[col.key]

    if (isEditing) {
      if (col.type === 'select' && col.options) {
        return (
          <select
            ref={el => { inputRef.current = el }}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={() => { commit(rowIdx, colIdx, draft); setEditing(null) }}
            onKeyDown={handleKeyDown}
            className="w-full h-full px-2 py-1 text-xs bg-white dark:bg-surface-900 border-2 border-brand-500 rounded outline-none"
          >
            <option value=""></option>
            {col.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        )
      }
      return (
        <input
          ref={el => { inputRef.current = el }}
          type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => { commit(rowIdx, colIdx, draft); setEditing(null) }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          className="w-full h-full px-2 py-1 text-xs bg-white dark:bg-surface-900 border-2 border-brand-500 rounded outline-none"
        />
      )
    }

    const display = value == null || value === '' ? <span className="text-surface-300">—</span> : String(value)
    return (
      <div
        onClick={() => startEdit(rowIdx, colIdx)}
        className={cn(
          'w-full h-full px-2 py-1.5 text-xs cursor-cell truncate flex items-center',
          isSaving && 'bg-brand-50 dark:bg-brand-900/20'
        )}
        title={value == null ? '' : String(value)}
      >
        {display}
      </div>
    )
  }

  return (
    <div className="card p-0 overflow-hidden">
      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between px-3 py-2 bg-brand-50 dark:bg-brand-900/20 border-b border-brand-200">
          <span className="text-xs font-medium text-brand-700 dark:text-brand-300">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-2">
            {onDelete && (
              <button onClick={bulkDelete} className="btn-secondary btn-sm flex items-center gap-1 text-red-600">
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            )}
            <button onClick={() => setSelected(new Set())} className="btn-secondary btn-sm">Clear</button>
          </div>
        </div>
      )}

      <div className="relative">
        <div ref={scrollRef} className="overflow-x-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-surface-50 dark:bg-surface-800">
              <tr>
                <th className="sticky left-0 z-20 bg-surface-50 dark:bg-surface-800 w-8 px-2 py-2 border-b border-r border-surface-200 dark:border-surface-700">
                  <input
                    type="checkbox"
                    checked={sortedRows.length > 0 && selected.size === sortedRows.length}
                    onChange={toggleAll}
                    className="accent-brand-600"
                  />
                </th>
                {columns.map((col, ci) => (
                  <th
                    key={col.key}
                    style={{ width: col.width, minWidth: col.width || 120 }}
                    className={cn(
                      'px-2 py-2 text-left border-b border-r border-surface-200 dark:border-surface-700 font-bold text-surface-600 dark:text-surface-300 uppercase text-[10px] tracking-wider',
                      ci === 0 && 'sticky left-8 z-20 bg-surface-50 dark:bg-surface-800'
                    )}
                  >
                    <button onClick={() => toggleSort(col.key)} className="flex items-center gap-1 hover:text-surface-900 dark:hover:text-surface-50">
                      {col.label}
                      {sort?.key === col.key && (
                        sort.dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      )}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="p-6 text-center text-surface-400">{emptyMessage}</td>
                </tr>
              ) : (
                sortedRows.map((row, ri) => (
                  <tr key={row.id} className="hover:bg-surface-50/50 dark:hover:bg-surface-800/50">
                    <td className="sticky left-0 z-10 bg-white dark:bg-surface-900 w-8 px-2 py-0 border-b border-r border-surface-100 dark:border-surface-800 text-center">
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleSelect(row.id)}
                        className="accent-brand-600"
                      />
                    </td>
                    {columns.map((col, ci) => (
                      <td
                        key={col.key}
                        style={{ width: col.width, minWidth: col.width || 120 }}
                        className={cn(
                          'p-0 border-b border-r border-surface-100 dark:border-surface-800 align-middle h-8',
                          ci === 0 && 'sticky left-8 z-10 bg-white dark:bg-surface-900'
                        )}
                      >
                        {renderCell(row, col, ri, ci)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Scroll indicator for mobile */}
        {scrollShadow && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2 md:hidden pointer-events-none bg-surface-900/60 text-white rounded-full p-1 animate-pulse">
            <ChevronsRight className="w-3 h-3" />
          </div>
        )}
      </div>
      <div className="px-3 py-1.5 bg-surface-50 dark:bg-surface-800 border-t border-surface-200 dark:border-surface-700 text-[10px] text-surface-400">
        {sortedRows.length} rows · Click cell to edit · Tab/Enter to navigate · Esc to cancel
      </div>
    </div>
  )
}
