'use client'
import { toast } from 'sonner'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, CheckSquare, Square, Calendar, Search, X, AlarmClock, UserCheck, Repeat, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import BulkActions from '@/components/shared/BulkActions'
import type { Activity } from '@/types'
import type { DbRow } from '@/types'
import { getActiveWorkspace } from '@/lib/get-active-workspace'
import { useI18n } from '@/lib/i18n/context'
import EmptyState from '@/components/shared/EmptyState'

const TYPES = ['call','email','meeting','note','task'] as const
const TYPE_COLORS: Record<string, string> = {
  call: 'bg-blue-50 text-blue-600',
  email: 'bg-violet-50 text-violet-600',
  meeting: 'bg-emerald-50 text-emerald-600',
  note: 'bg-amber-50 text-amber-600',
  task: 'bg-surface-100 text-surface-600',
}
const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-surface-100 text-surface-500',
  medium: 'bg-blue-50 text-blue-600',
  high: 'bg-amber-50 text-amber-700',
  urgent: 'bg-red-50 text-red-700',
}
const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

function NewTaskModal({ onClose, onSave, workspaceId, members }: { onClose: () => void; onSave: (a: Partial<Activity>) => void; workspaceId: string; members: DbRow[] }) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<typeof TYPES[number]>('task')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [priority, setPriority] = useState('medium')
  const [assignedTo, setAssignedTo] = useState('')
  const [recurring, setRecurring] = useState(false)
  const [recurrenceInterval, setRecurrenceInterval] = useState<'daily' | 'weekly' | 'monthly'>('weekly')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const metadata: Record<string, any> = {}
    if (recurring) {
      metadata.recurring = true
      metadata.recurrence_interval = recurrenceInterval
    }
    onSave({
      title, type,
      due_date: dueDate || undefined,
      notes: notes || undefined,
      done: false,
      workspace_id: workspaceId,
      priority,
      assigned_to: assignedTo || undefined,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    } as Partial<Activity>)
    onClose()
  }

  return (
    <div className="modal-overlay">
      <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-surface-100">
          <h2 className="font-semibold text-surface-900">New Task</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="label">Task title *</label>
            <input className="input" required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Follow up with Jane" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select className="input" value={type} onChange={e => setType(e.target.value as typeof TYPES[number])}>
                {TYPES.map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="input" value={priority} onChange={e => setPriority(e.target.value)}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Due date</label>
              <div className="relative"><Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400" />
                <input className="input pl-8" type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">Assign to</label>
              <select className="input" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
                <option value="">Unassigned</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input resize-none" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes..." />
          </div>
          {/* Recurring */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} className="rounded border-surface-300" />
              <Repeat className="w-3.5 h-3.5 text-surface-500" />
              Repeat
            </label>
            {recurring && (
              <select className="input w-auto text-xs" value={recurrenceInterval} onChange={e => setRecurrenceInterval(e.target.value as any)}>
                <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
              </select>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1">Create Task</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function TasksPage() {
  const { t } = useI18n()
  const supabase = createClient()
  const [tasks, setTasks] = useState<Activity[]>([])
  const [members, setMembers] = useState<DbRow[]>([])
  const [workspaceId, setWorkspaceId] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'done' | 'overdue'>('pending')
  const [filterType, setFilterType] = useState('all')
  const [filterAssignee, setFilterAssignee] = useState('all')
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const ws = await getActiveWorkspace(supabase, user.id, 'id')
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)
    const [tasksRes, membersRes] = await Promise.all([
      supabase.from('activities').select('*').eq('workspace_id', ws.id).order('due_date', { ascending: true }),
      supabase.from('profiles').select('id, full_name, email').eq('workspace_id', ws.id),
    ])
    setTasks(tasksRes.data || [])
    setMembers(membersRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Refresh when a task is created elsewhere via QuickTaskButton
  useEffect(() => {
    const handler = () => { load() }
    window.addEventListener('tracktio:task-created', handler as EventListener)
    return () => window.removeEventListener('tracktio:task-created', handler as EventListener)
  }, [load])

  const handleCreate = async (data: Partial<Activity>) => {
    const { data: created } = await supabase.from('activities').insert([data]).select().single()
    if (created) setTasks(prev => [...prev, created])
  }

  const toggleDone = async (task: Activity) => {
    const updated = { ...task, done: !task.done }
    await supabase.from('activities').update({ done: updated.done }).eq('id', task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? updated : t))

    // If completing a recurring task, create next occurrence
    if (!task.done && task.metadata?.recurring && task.metadata?.recurrence_interval) {
      const interval = task.metadata.recurrence_interval as string
      let nextDue: Date | null = null
      if (task.due_date) {
        nextDue = new Date(task.due_date)
        if (interval === 'daily') nextDue.setDate(nextDue.getDate() + 1)
        else if (interval === 'weekly') nextDue.setDate(nextDue.getDate() + 7)
        else if (interval === 'monthly') nextDue.setMonth(nextDue.getMonth() + 1)
      } else {
        nextDue = new Date()
        if (interval === 'daily') nextDue.setDate(nextDue.getDate() + 1)
        else if (interval === 'weekly') nextDue.setDate(nextDue.getDate() + 7)
        else if (interval === 'monthly') nextDue.setMonth(nextDue.getMonth() + 1)
      }
      const { data: newTask } = await supabase.from('activities').insert([{
        workspace_id: task.workspace_id,
        type: task.type,
        title: task.title,
        notes: task.notes,
        due_date: nextDue.toISOString(),
        done: false,
        priority: task.priority,
        assigned_to: task.assigned_to,
        metadata: task.metadata,
      }]).select().single()
      if (newTask) {
        setTasks(prev => [...prev, newTask])
        toast.success('Next recurring task created')
      }
    }
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const bulkComplete = async () => {
    if (selected.size === 0) return
    const ids = Array.from(selected)
    // For recurring tasks, handle each individually
    const recurringTasks = tasks.filter(t => ids.includes(t.id) && !t.done && t.metadata?.recurring)
    for (const task of recurringTasks) {
      await toggleDone(task)
    }
    // Update non-recurring in bulk
    const nonRecurringIds = ids.filter(id => !recurringTasks.find(t => t.id === id))
    if (nonRecurringIds.length > 0) {
      await supabase.from('activities').update({ done: true }).in('id', nonRecurringIds)
      setTasks(prev => prev.map(t => nonRecurringIds.includes(t.id) ? { ...t, done: true } : t))
    }
    setSelected(new Set())
    toast.success(`${ids.length} task(s) completed`)
  }

  const bulkDelete = async () => {
    if (selected.size === 0) return
    if (!confirm(`Delete ${selected.size} task(s)?`)) return
    const ids = Array.from(selected)
    await supabase.from('activities').delete().in('id', ids)
    setTasks(prev => prev.filter(t => !ids.includes(t.id)))
    setSelected(new Set())
    toast.success(`${ids.length} task(s) deleted`)
  }

  const now = new Date()

  // Sort: overdue first, then by priority, then by due date
  const sortedTasks = [...tasks].sort((a, b) => {
    const aOverdue = !a.done && a.due_date && new Date(a.due_date) < now ? 1 : 0
    const bOverdue = !b.done && b.due_date && new Date(b.due_date) < now ? 1 : 0
    if (aOverdue !== bOverdue) return bOverdue - aOverdue
    const pa = PRIORITY_ORDER[a.priority || 'medium'] ?? 2
    const pb = PRIORITY_ORDER[b.priority || 'medium'] ?? 2
    if (pa !== pb) return pa - pb
    if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    if (a.due_date) return -1
    if (b.due_date) return 1
    return 0
  })

  const filtered = sortedTasks.filter(t => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase())
    const isOverdue = !t.done && t.due_date && new Date(t.due_date) < now
    if (filter === 'pending' && t.done) return false
    if (filter === 'done' && !t.done) return false
    if (filter === 'overdue' && !isOverdue) return false
    if (filterType !== 'all' && t.type !== filterType) return false
    if (filterAssignee !== 'all' && (t.assigned_to || '') !== filterAssignee) return false
    return matchSearch
  })

  const overdue = tasks.filter(t => !t.done && t.due_date && new Date(t.due_date) < now).length

  const getMemberName = (id: string) => {
    const m = members.find(m => m.id === id)
    return m ? (m.full_name || m.email) : null
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('pages.tasks')}</h1>
          <p className="text-sm text-surface-500 mt-0.5">{tasks.filter(t => !t.done).length} pending{overdue > 0 ? ` · ${overdue} overdue` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input className="input pl-9 w-48 text-xs" placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={() => setShowNew(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> {t('action.new')} {t('pages.tasks')}</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {([['all', `All (${tasks.length})`], ['pending', `Pending (${tasks.filter(t => !t.done).length})`], ['overdue', `Overdue (${overdue})`], ['done', `Done (${tasks.filter(t => t.done).length})`]] as const).map(([f, label]) => (
          <button key={f} onClick={() => setFilter(f as typeof filter)}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-all', filter === f ? (f === 'overdue' ? 'bg-red-600 text-white' : 'bg-brand-600 text-white') : 'text-surface-500 hover:bg-surface-100')}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-6 flex-wrap items-center">
        <select className="input w-auto text-xs" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="all">All Types</option>
          {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
        <select className="input w-auto text-xs" value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}>
          <option value="all">All Assignees</option>
          <option value="">Unassigned</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<CheckSquare className="w-7 h-7" />}
          title={filter === 'done' ? 'No completed tasks' : 'Stay on top of your day'}
          description={filter === 'pending' ? "You're all caught up! Add a task to keep moving." : 'Create tasks for follow-ups, reminders and to-dos.'}
          action={filter !== 'done' ? { label: 'Add task', onClick: () => setShowNew(true), icon: <Plus className="w-3.5 h-3.5" /> } : undefined}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((task, i) => {
            const isOverdue = !task.done && task.due_date && new Date(task.due_date) < now
            const isSelected = selected.has(task.id)
            const assigneeName = task.assigned_to ? getMemberName(task.assigned_to) : null
            const isRecurring = task.metadata?.recurring
            return (
              <div key={task.id}
                className={cn(
                  'card p-4 flex items-start gap-3 animate-fade-in transition-all',
                  task.done && 'opacity-60',
                  isOverdue && 'border-red-200 bg-red-50/30',
                  isSelected && 'ring-2 ring-brand-500',
                )}
                style={{ animationDelay: `${i * 20}ms` }}>
                {/* Selection checkbox */}
                {!task.done && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(task.id)}
                    className="mt-1 rounded border-surface-300 flex-shrink-0"
                  />
                )}
                <button onClick={() => toggleDone(task)} className="mt-0.5 flex-shrink-0 text-surface-400 hover:text-brand-600 transition-colors">
                  {task.done ? <CheckSquare className="w-5 h-5 text-emerald-500" /> : <Square className="w-5 h-5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium text-surface-800', task.done && 'line-through text-surface-400')}>{task.title}</p>
                  {task.notes && <p className="text-xs text-surface-400 mt-0.5 truncate">{task.notes}</p>}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={cn('badge text-[10px]', TYPE_COLORS[task.type])}>{task.type}</span>
                    <span className={cn('badge text-[10px]', PRIORITY_COLORS[task.priority || 'medium'])}>{task.priority || 'medium'}</span>
                    {isRecurring && <span className="badge text-[10px] bg-violet-50 text-violet-600 flex items-center gap-0.5"><Repeat className="w-2.5 h-2.5" />{task.metadata?.recurrence_interval}</span>}
                    {assigneeName && <span className="text-[10px] text-brand-600 flex items-center gap-0.5"><UserCheck className="w-3 h-3" />{assigneeName}</span>}
                    {task.due_date && (
                      <span className={cn('flex items-center gap-1 text-[10px] font-semibold', isOverdue ? 'text-red-500' : 'text-surface-400')}>
                        {isOverdue && <AlarmClock className="w-3 h-3" />}
                        {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showNew && <NewTaskModal workspaceId={workspaceId} members={members} onClose={() => setShowNew(false)} onSave={handleCreate} />}

      <BulkActions count={selected.size} onClear={() => setSelected(new Set())} onDelete={bulkDelete}>
        <button onClick={bulkComplete} className="flex items-center gap-1.5 text-xs font-medium text-emerald-300 hover:text-emerald-200 transition-colors px-1">
          <Check className="w-3.5 h-3.5" /> Mark done
        </button>
      </BulkActions>
    </div>
  )
}
