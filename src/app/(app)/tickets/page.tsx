'use client'
import { toast } from 'sonner'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Ticket, X, MessageCircle, Clock, User, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

const STATUS_STYLES: Record<string, string> = {
  open: 'badge-blue', in_progress: 'badge-yellow', waiting: 'badge-gray',
  resolved: 'badge-green', closed: 'badge-gray',
}
const PRIORITY_STYLES: Record<string, string> = {
  low: 'text-surface-400', medium: 'text-blue-600', high: 'text-amber-600', urgent: 'text-red-600',
}

export default function TicketsPage() {
  const supabase = createClient()
  const [tickets, setTickets] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [workspaceId, setWorkspaceId] = useState('')
  const [form, setForm] = useState<any>({ subject: '', description: '', priority: 'medium', contact_id: '', category: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)
    const [ticketsRes, contactsRes] = await Promise.all([
      supabase.from('tickets').select('*, contacts(name)').eq('workspace_id', ws.id).order('created_at', { ascending: false }),
      supabase.from('contacts').select('id, name').eq('workspace_id', ws.id).order('name'),
    ])
    setTickets(ticketsRes.data || [])
    setContacts(contactsRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const createTicket = async () => {
    if (!form.subject) return
    setSaving(true)
    const num = tickets.length + 1
    await supabase.from('tickets').insert({
      workspace_id: workspaceId, ticket_number: `TK-${String(num).padStart(4, '0')}`,
      subject: form.subject, description: form.description || null,
      priority: form.priority, contact_id: form.contact_id || null,
      category: form.category || null,
    })
    setForm({ subject: '', description: '', priority: 'medium', contact_id: '', category: '' })
    setShowNew(false); setSaving(false)
    toast.success('Ticket created')
    load()
  }

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('tickets').update({
      status,
      ...(status === 'resolved' ? { resolved_at: new Date().toISOString() } : {}),
    }).eq('id', id)
    toast.success(`Ticket ${status.replace('_', ' ')}`)
    load()
  }

  const filtered = tickets.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false
    if (search && !t.ticket_number.toLowerCase().includes(search.toLowerCase()) && !t.subject.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const openCount = tickets.filter(t => t.status === 'open').length
  const urgentCount = tickets.filter(t => t.priority === 'urgent' && t.status !== 'closed').length

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Service Tickets</h1><p className="text-sm text-surface-500 mt-0.5">{tickets.length} tickets · {openCount} open</p></div>
        <button onClick={() => setShowNew(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New Ticket</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="card p-4 flex items-center gap-3"><div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center"><Ticket className="w-4 h-4 text-blue-600" /></div><div><p className="text-lg font-bold">{openCount}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Open</p></div></div>
        <div className="card p-4 flex items-center gap-3"><div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center"><Clock className="w-4 h-4 text-amber-600" /></div><div><p className="text-lg font-bold">{tickets.filter(t => t.status === 'in_progress').length}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">In Progress</p></div></div>
        <div className="card p-4 flex items-center gap-3"><div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center"><MessageCircle className="w-4 h-4 text-emerald-600" /></div><div><p className="text-lg font-bold">{tickets.filter(t => t.status === 'resolved').length}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Resolved</p></div></div>
        {urgentCount > 0 && <div className="card p-4 flex items-center gap-3 border-red-200"><div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center"><AlertTriangle className="w-4 h-4 text-red-600" /></div><div><p className="text-lg font-bold text-red-600">{urgentCount}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Urgent</p></div></div>}
      </div>

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" /><input className="input pl-9 text-xs" placeholder="Search tickets..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <select className="input w-auto text-xs" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All</option><option value="open">Open</option><option value="in_progress">In Progress</option><option value="waiting">Waiting</option><option value="resolved">Resolved</option><option value="closed">Closed</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-16"><Ticket className="w-10 h-10 text-surface-300 mx-auto mb-3" /><p className="text-surface-500">No tickets yet</p></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(ticket => (
            <div key={ticket.id} className="card p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono text-surface-400">{ticket.ticket_number}</span>
                  <span className={cn('text-xs font-bold capitalize', PRIORITY_STYLES[ticket.priority])}>{ticket.priority}</span>
                  <span className={cn('badge text-[10px]', STATUS_STYLES[ticket.status])}>{ticket.status.replace('_', ' ')}</span>
                </div>
                <p className="text-sm font-semibold text-surface-800">{ticket.subject}</p>
                {ticket.contacts?.name && <p className="text-xs text-surface-400 mt-0.5">{ticket.contacts.name}</p>}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {ticket.status === 'open' && <button onClick={() => updateStatus(ticket.id, 'in_progress')} className="btn-secondary btn-sm text-[10px]">Start</button>}
                {ticket.status === 'in_progress' && <button onClick={() => updateStatus(ticket.id, 'resolved')} className="btn-sm bg-emerald-600 text-white text-[10px] rounded-lg px-2 py-1">Resolve</button>}
                {ticket.status === 'resolved' && <button onClick={() => updateStatus(ticket.id, 'closed')} className="btn-ghost btn-sm text-[10px]">Close</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100">
              <h2 className="font-semibold text-surface-900">New Ticket</h2>
              <button onClick={() => setShowNew(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="label">Subject *</label><input className="input" value={form.subject} onChange={e => setForm((f: any) => ({ ...f, subject: e.target.value }))} /></div>
              <div><label className="label">Description</label><textarea className="input resize-none" rows={3} value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Priority</label>
                  <select className="input" value={form.priority} onChange={e => setForm((f: any) => ({ ...f, priority: e.target.value }))}>
                    <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
                  </select>
                </div>
                <div><label className="label">Contact</label>
                  <select className="input" value={form.contact_id} onChange={e => setForm((f: any) => ({ ...f, contact_id: e.target.value }))}>
                    <option value="">None</option>
                    {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="label">Category</label><input className="input" value={form.category} onChange={e => setForm((f: any) => ({ ...f, category: e.target.value }))} placeholder="e.g. Billing, Technical, General" /></div>
              <div className="flex gap-2">
                <button onClick={() => setShowNew(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={createTicket} disabled={!form.subject || saving} className="btn-primary flex-1">Create Ticket</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
