'use client'
import { useState, useEffect, useRef } from 'react'
import { Plus, CheckSquare, X, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { getActiveWorkspace } from '@/lib/get-active-workspace'
import { cn } from '@/lib/utils'

type Member = { id: string; name?: string; full_name?: string; email?: string }

interface QuickTaskButtonProps {
  contactId?: string
  dealId?: string
  ticketId?: string
  defaultAssignee?: string
  size?: 'sm' | 'md'
  variant?: 'icon' | 'full'
  label?: string
  className?: string
}

export default function QuickTaskButton({
  contactId,
  dealId,
  ticketId,
  defaultAssignee,
  size = 'sm',
  variant = 'full',
  label,
  className,
}: QuickTaskButtonProps) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal')
  const [notes, setNotes] = useState('')
  const [assignedTo, setAssignedTo] = useState(defaultAssignee || '')
  const [members, setMembers] = useState<Member[]>([])
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (!open || members.length > 0) return
    fetch('/api/team')
      .then(r => r.json())
      .then(d => setMembers(d.users || []))
      .catch(() => {})
  }, [open, members.length])

  const reset = () => {
    setTitle('')
    setDueDate('')
    setPriority('normal')
    setNotes('')
    setAssignedTo(defaultAssignee || '')
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const ws = await getActiveWorkspace(supabase, user.id, 'id')
      if (!ws) throw new Error('No workspace')

      // activities table uses 'medium' (not 'normal') in some places, but allows free text.
      // We map normal -> medium for consistency with TasksPage filters.
      const mappedPriority = priority === 'normal' ? 'medium' : priority

      const payload: Record<string, any> = {
        workspace_id: ws.id,
        type: 'task',
        title: title.trim(),
        done: false,
        priority: mappedPriority,
        owner_id: user.id,
      }
      if (dueDate) payload.due_date = new Date(dueDate).toISOString()
      if (notes.trim()) payload.notes = notes.trim()
      if (assignedTo) payload.assigned_to = assignedTo
      if (contactId) payload.contact_id = contactId
      if (dealId) payload.deal_id = dealId
      if (ticketId) payload.metadata = { ...(payload.metadata || {}), ticket_id: ticketId }

      const { data, error } = await supabase.from('activities').insert(payload).select().single()
      if (error) throw error

      toast.success('Task created')
      window.dispatchEvent(new CustomEvent('tracktio:task-created', { detail: data }))
      reset()
      setOpen(false)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create task')
    } finally {
      setSaving(false)
    }
  }

  const isIcon = variant === 'icon'
  const btnClass = isIcon
    ? cn(
        'flex items-center justify-center rounded-lg hover:bg-surface-100 text-surface-500 transition-colors',
        size === 'sm' ? 'w-7 h-7' : 'w-9 h-9',
        className,
      )
    : cn(
        size === 'sm' ? 'btn-secondary btn-sm' : 'btn-secondary',
        'gap-1.5',
        className,
      )

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={btnClass}
        title={label || 'Add task'}
      >
        <CheckSquare className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        {!isIcon && <span>{label || 'Task'}</span>}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-modal border border-surface-100 z-50 animate-scale-in"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100">
            <p className="text-sm font-semibold text-surface-900 flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-brand-600" /> New task
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-surface-100"
            >
              <X className="w-3.5 h-3.5 text-surface-500" />
            </button>
          </div>
          <form onSubmit={handleSave} className="p-4 space-y-3">
            <div>
              <input
                autoFocus
                className="input text-sm"
                placeholder="Task title *"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400 pointer-events-none" />
                <input
                  type="date"
                  className="input text-xs pl-8"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                />
              </div>
              <select
                className="input text-xs"
                value={priority}
                onChange={e => setPriority(e.target.value as any)}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            {members.length > 0 && (
              <select
                className="input text-xs"
                value={assignedTo}
                onChange={e => setAssignedTo(e.target.value)}
              >
                <option value="">Unassigned</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.full_name || m.email}
                  </option>
                ))}
              </select>
            )}
            <textarea
              className="input text-xs resize-none"
              rows={2}
              placeholder="Notes (optional)"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-secondary btn-sm flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !title.trim()}
                className="btn-primary btn-sm flex-1 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                Add task
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
