'use client'
import { useI18n } from '@/lib/i18n/context'
import { toast } from 'sonner'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, Plus, X, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CalendarEvent {
  id: string; title: string; type: string; due_date: string; done: boolean; contact_id?: string;
  contacts?: any;
}

export default function CalendarPage() {
  const supabase = createClient()
  const { t } = useI18n()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [workspaceId, setWorkspaceId] = useState('')
  const [form, setForm] = useState({ title: '', type: 'task', due_date: '', due_time: '' })

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date().toISOString().split('T')[0]
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)

    const startOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const endOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-${daysInMonth}`

    const { data } = await supabase.from('activities')
      .select('id, title, type, due_date, done, contact_id, contacts(name)')
      .eq('workspace_id', ws.id)
      .gte('due_date', startOfMonth)
      .lte('due_date', endOfMonth + 'T23:59:59')
      .order('due_date')

    setEvents(data || [])
    setLoading(false)
  }, [year, month, daysInMonth])

  useEffect(() => { load() }, [load])

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))
  const goToday = () => setCurrentDate(new Date())

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter(e => e.due_date?.startsWith(dateStr))
  }

  const createEvent = async () => {
    if (!form.title || !form.due_date) return
    const dueDate = form.due_time ? `${form.due_date}T${form.due_time}:00` : `${form.due_date}T09:00:00`
    await supabase.from('activities').insert({
      workspace_id: workspaceId, title: form.title, type: form.type,
      due_date: dueDate, done: false,
    })
    setForm({ title: '', type: 'task', due_date: '', due_time: '' })
    setShowNew(false)
    toast.success('Event created')
    load()
  }

  const toggleDone = async (id: string, done: boolean) => {
    await supabase.from('activities').update({ done: !done }).eq('id', id)
    load()
  }

  const TYPE_COLORS: Record<string, string> = {
    task: 'bg-brand-500', call: 'bg-emerald-500', email: 'bg-blue-500',
    meeting: 'bg-violet-500', note: 'bg-amber-500', whatsapp: 'bg-green-500',
  }

  const days = []
  for (let i = 0; i < firstDay; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) days.push(d)

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <h1 className="page-title">{t('calendar.title')}</h1>
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="w-8 h-8 rounded-lg hover:bg-surface-100 flex items-center justify-center"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-semibold text-surface-700 min-w-[160px] text-center">{monthName}</span>
            <button onClick={nextMonth} className="w-8 h-8 rounded-lg hover:bg-surface-100 flex items-center justify-center"><ChevronRight className="w-4 h-4" /></button>
            <button onClick={goToday} className="btn-ghost btn-sm text-[10px] ml-2">Today</button>
          </div>
        </div>
        <button onClick={() => { setShowNew(true); setForm(f => ({ ...f, due_date: selectedDate || today })) }} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New Event</button>
      </div>

      {/* Calendar grid */}
      <div className="card overflow-hidden">
        <div className="grid grid-cols-7">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="px-2 py-2 text-[10px] font-semibold text-surface-400 text-center border-b border-surface-100 uppercase">{d}</div>
          ))}
          {days.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-surface-50 bg-surface-25" />
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const dayEvents = getEventsForDay(day)
            const isToday = dateStr === today
            const isSelected = dateStr === selectedDate

            return (
              <div key={day} onClick={() => setSelectedDate(dateStr)}
                className={cn('min-h-[80px] border-b border-r border-surface-50 p-1 cursor-pointer transition-colors hover:bg-surface-50',
                  isSelected && 'bg-brand-50/50', isToday && 'bg-amber-50/30')}>
                <div className={cn('text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full',
                  isToday ? 'bg-brand-600 text-white' : 'text-surface-600')}>
                  {day}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map(ev => (
                    <div key={ev.id} onClick={e => { e.stopPropagation(); toggleDone(ev.id, ev.done) }}
                      className={cn('text-[9px] px-1 py-0.5 rounded truncate cursor-pointer',
                        ev.done ? 'line-through text-surface-400 bg-surface-100' : 'text-white',
                        !ev.done && (TYPE_COLORS[ev.type] || 'bg-surface-500'))}>
                      {ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && <div className="text-[8px] text-surface-400 px-1">+{dayEvents.length - 3} more</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Selected day events */}
      {selectedDate && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-surface-700 mb-2">
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h3>
          <div className="space-y-1">
            {getEventsForDay(parseInt(selectedDate.split('-')[2])).map(ev => (
              <div key={ev.id} className="card p-3 flex items-center gap-3">
                <button onClick={() => toggleDone(ev.id, ev.done)}
                  className={cn('w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0',
                    ev.done ? 'bg-emerald-500 border-emerald-500' : 'border-surface-300')}>
                  {ev.done && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </button>
                <div className={cn('w-2 h-2 rounded-full flex-shrink-0', TYPE_COLORS[ev.type] || 'bg-surface-400')} />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-xs font-medium', ev.done && 'line-through text-surface-400')}>{ev.title}</p>
                  {ev.contacts?.name && <p className="text-[10px] text-surface-400">{ev.contacts.name}</p>}
                </div>
                <span className="text-[10px] text-surface-300 capitalize">{ev.type}</span>
                <span className="text-[10px] text-surface-300">{ev.due_date ? new Date(ev.due_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
              </div>
            ))}
            {getEventsForDay(parseInt(selectedDate.split('-')[2])).length === 0 && (
              <p className="text-xs text-surface-400 py-4 text-center">No events</p>
            )}
          </div>
        </div>
      )}

      {/* New event modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-sm animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100">
              <h2 className="font-semibold text-surface-900">New Event</h2>
              <button onClick={() => setShowNew(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="label">Title *</label><input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Date</label><input type="date" className="input" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
                <div><label className="label">Time</label><input type="time" className="input" value={form.due_time} onChange={e => setForm(f => ({ ...f, due_time: e.target.value }))} /></div>
              </div>
              <div><label className="label">Type</label>
                <div className="flex gap-1">
                  {['task', 'call', 'email', 'meeting', 'note'].map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                      className={cn('flex-1 py-1.5 rounded-lg text-[10px] font-medium capitalize transition-all',
                        form.type === t ? 'bg-brand-600 text-white' : 'bg-surface-100 text-surface-500')}>{t}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowNew(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={createEvent} disabled={!form.title || !form.due_date} className="btn-primary flex-1">Create</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
