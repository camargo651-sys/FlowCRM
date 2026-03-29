'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, CheckSquare, Square, Calendar, Search, X, AlarmClock } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import type { Activity } from '@/types'

const TYPES = ['call','email','meeting','note','task'] as const
const TYPE_COLORS: Record<string, string> = {
  call: 'bg-blue-50 text-blue-600',
  email: 'bg-violet-50 text-violet-600',
  meeting: 'bg-emerald-50 text-emerald-600',
  note: 'bg-amber-50 text-amber-600',
  task: 'bg-surface-100 text-surface-600',
}

function NewTaskModal({ onClose, onSave, workspaceId }: { onClose: () => void; onSave: (a: Partial<Activity>) => void; workspaceId: string }) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<typeof TYPES[number]>('task')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({ title, type, due_date: dueDate || undefined, notes: notes || undefined, done: false, workspace_id: workspaceId })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
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
              <select className="input" value={type} onChange={e => setType(e.target.value as any)}>
                {TYPES.map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Due date</label>
              <div className="relative"><Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400" />
                <input className="input pl-8" type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input resize-none" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes..." />
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
  const supabase = createClient()
  const [tasks, setTasks] = useState<Activity[]>([])
  const [workspaceId, setWorkspaceId] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'done' | 'overdue'>('pending')
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)
    const { data } = await supabase.from('activities').select('*').eq('workspace_id', ws.id).order('due_date', { ascending: true })
    setTasks(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async (data: Partial<Activity>) => {
    const { data: created } = await supabase.from('activities').insert([data]).select().single()
    if (created) setTasks(prev => [...prev, created])
  }

  const toggleDone = async (task: Activity) => {
    const updated = { ...task, done: !task.done }
    await supabase.from('activities').update({ done: updated.done }).eq('id', task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? updated : t))
  }

  const now = new Date()
  const filtered = tasks.filter(t => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase())
    const isOverdue = !t.done && t.due_date && new Date(t.due_date) < now
    if (filter === 'pending') return matchSearch && !t.done
    if (filter === 'done') return matchSearch && t.done
    if (filter === 'overdue') return matchSearch && isOverdue
    return matchSearch
  })

  const overdue = tasks.filter(t => !t.done && t.due_date && new Date(t.due_date) < now).length

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="text-sm text-surface-500 mt-0.5">{tasks.filter(t => !t.done).length} pending{overdue > 0 ? ` · ${overdue} overdue` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input className="input pl-9 w-48 text-xs" placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={() => setShowNew(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New Task</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1 mb-6">
        {([['all', `All (${tasks.length})`], ['pending', `Pending (${tasks.filter(t => !t.done).length})`], ['overdue', `Overdue (${overdue})`], ['done', `Done (${tasks.filter(t => t.done).length})`]] as const).map(([f, label]) => (
          <button key={f} onClick={() => setFilter(f as any)}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-all', filter === f ? (f === 'overdue' ? 'bg-red-600 text-white' : 'bg-brand-600 text-white') : 'text-surface-500 hover:bg-surface-100')}>
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-14 h-14 bg-surface-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <CheckSquare className="w-7 h-7 text-surface-400" />
          </div>
          <p className="text-surface-600 font-medium mb-1">{filter === 'done' ? 'No completed tasks' : 'No tasks here'}</p>
          <p className="text-surface-400 text-sm mb-4">
            {filter === 'pending' ? 'You\'re all caught up!' : 'Create your first task'}
          </p>
          {filter !== 'done' && <button onClick={() => setShowNew(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New Task</button>}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task, i) => {
            const isOverdue = !task.done && task.due_date && new Date(task.due_date) < now
            return (
              <div key={task.id}
                className={cn('card p-4 flex items-start gap-3 animate-fade-in transition-all', task.done && 'opacity-60')}
                style={{ animationDelay: `${i * 20}ms` }}>
                <button onClick={() => toggleDone(task)} className="mt-0.5 flex-shrink-0 text-surface-400 hover:text-brand-600 transition-colors">
                  {task.done ? <CheckSquare className="w-5 h-5 text-emerald-500" /> : <Square className="w-5 h-5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium text-surface-800', task.done && 'line-through text-surface-400')}>{task.title}</p>
                  {task.notes && <p className="text-xs text-surface-400 mt-0.5 truncate">{task.notes}</p>}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={cn('badge text-[10px]', TYPE_COLORS[task.type])}>{task.type}</span>
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

      {showNew && <NewTaskModal workspaceId={workspaceId} onClose={() => setShowNew(false)} onSave={handleCreate} />}
    </div>
  )
}
