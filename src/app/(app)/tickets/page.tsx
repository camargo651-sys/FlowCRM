'use client'
import { DbRow } from '@/types'
import { useI18n } from '@/lib/i18n/context'
import { toast } from 'sonner'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Ticket, X, MessageCircle, Clock, AlertTriangle, StickyNote, UserCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getActiveWorkspace } from '@/lib/get-active-workspace'

const STATUS_STYLES: Record<string, string> = {
  open: 'badge-blue', in_progress: 'badge-yellow', waiting: 'badge-gray',
  resolved: 'badge-green', closed: 'badge-gray',
}
const PRIORITY_STYLES: Record<string, string> = {
  low: 'text-surface-400', medium: 'text-blue-600', high: 'text-amber-600', urgent: 'text-red-600',
}
const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

function getSlaColor(createdAt: string): { label: string; color: string } {
  const hours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60)
  if (hours < 4) return { label: `${Math.floor(hours)}h`, color: 'bg-emerald-100 text-emerald-700' }
  if (hours < 24) return { label: `${Math.floor(hours)}h`, color: 'bg-amber-100 text-amber-700' }
  const days = Math.floor(hours / 24)
  return { label: days > 0 ? `${days}d ${Math.floor(hours % 24)}h` : `${Math.floor(hours)}h`, color: 'bg-red-100 text-red-700' }
}

interface TicketForm { subject: string; description: string; priority: string; contact_id: string; category: string; assigned_to: string }

export default function TicketsPage() {
  const supabase = createClient()
  const { t } = useI18n()
  const [tickets, setTickets] = useState<DbRow[]>([])
  const [contacts, setContacts] = useState<DbRow[]>([])
  const [members, setMembers] = useState<DbRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [workspaceId, setWorkspaceId] = useState('')
  const [form, setForm] = useState<TicketForm>({ subject: '', description: '', priority: 'medium', contact_id: '', category: '', assigned_to: '' })
  const [saving, setSaving] = useState(false)
  const [detailTicket, setDetailTicket] = useState<DbRow | null>(null)
  const [internalNotes, setInternalNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const ws = await getActiveWorkspace(supabase, user.id, 'id')
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)
    const [ticketsRes, contactsRes, membersRes] = await Promise.all([
      supabase.from('tickets').select('*, contacts(name)').eq('workspace_id', ws.id).order('created_at', { ascending: false }),
      supabase.from('contacts').select('id, name').eq('workspace_id', ws.id).order('name'),
      supabase.from('profiles').select('id, full_name, email').eq('workspace_id', ws.id),
    ])
    // Sort by priority then date
    const sorted = (ticketsRes.data || []).sort((a: DbRow, b: DbRow) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 2
      const pb = PRIORITY_ORDER[b.priority] ?? 2
      if (pa !== pb) return pa - pb
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    setTickets(sorted)
    setContacts(contactsRes.data || [])
    setMembers(membersRes.data || [])
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
      assigned_to: form.assigned_to || null,
    })
    setForm({ subject: '', description: '', priority: 'medium', contact_id: '', category: '', assigned_to: '' })
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
    if (detailTicket?.id === id) {
      setDetailTicket(prev => prev ? { ...prev, status } : null)
    }
  }

  const assignTicket = async (id: string, userId: string) => {
    await supabase.from('tickets').update({ assigned_to: userId || null }).eq('id', id)
    toast.success('Ticket assigned')
    load()
  }

  const saveInternalNotes = async () => {
    if (!detailTicket) return
    setSavingNotes(true)
    await supabase.from('tickets').update({ internal_notes: internalNotes }).eq('id', detailTicket.id)
    setDetailTicket(prev => prev ? { ...prev, internal_notes: internalNotes } : null)
    setSavingNotes(false)
    toast.success('Notes saved')
  }

  const openDetail = (ticket: DbRow) => {
    setDetailTicket(ticket)
    setInternalNotes(ticket.internal_notes || '')
  }

  const filtered = tickets.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false
    if (search && !t.ticket_number.toLowerCase().includes(search.toLowerCase()) && !t.subject.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const openCount = tickets.filter(t => t.status === 'open').length
  const urgentCount = tickets.filter(t => t.priority === 'urgent' && t.status !== 'closed').length

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  const getMemberName = (id: string) => {
    const m = members.find(m => m.id === id)
    return m ? (m.full_name || m.email) : null
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">{t('tickets.title')}</h1><p className="text-sm text-surface-500 mt-0.5">{tickets.length} tickets · {openCount} open</p></div>
        <button onClick={() => setShowNew(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New Ticket</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="card p-4 flex items-center gap-3"><div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center"><Ticket className="w-4 h-4 text-blue-600" /></div><div><p className="text-lg font-bold">{openCount}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Open</p></div></div>
        <div className="card p-4 flex items-center gap-3"><div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center"><Clock className="w-4 h-4 text-amber-600" /></div><div><p className="text-lg font-bold">{tickets.filter(t => t.status === 'in_progress').length}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">In Progress</p></div></div>
        <div className="card p-4 flex items-center gap-3"><div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center"><MessageCircle className="w-4 h-4 text-emerald-600" /></div><div><p className="text-lg font-bold">{tickets.filter(t => t.status === 'resolved').length}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Resolved</p></div></div>
        {urgentCount > 0 && <div className="card p-4 flex items-center gap-3 border-red-200"><div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center"><AlertTriangle className="w-4 h-4 text-red-600" /></div><div><p className="text-lg font-bold text-red-600">{urgentCount}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Urgent</p></div></div>}
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" /><input className="input pl-9 text-xs" placeholder="Search tickets..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <select className="input w-auto text-xs" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Status</option><option value="open">Open</option><option value="in_progress">In Progress</option><option value="waiting">Waiting</option><option value="resolved">Resolved</option><option value="closed">Closed</option>
        </select>
        <select className="input w-auto text-xs" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option value="all">All Priority</option><option value="urgent">Urgent</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-16"><Ticket className="w-10 h-10 text-surface-300 mx-auto mb-3" /><p className="text-surface-500">No tickets found</p></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(ticket => {
            const sla = getSlaColor(ticket.created_at)
            const assignee = ticket.assigned_to ? getMemberName(ticket.assigned_to) : null
            return (
              <div key={ticket.id} className="card p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => openDetail(ticket)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[10px] font-mono text-surface-400">{ticket.ticket_number}</span>
                    <span className={cn('text-xs font-bold capitalize', PRIORITY_STYLES[ticket.priority])}>{ticket.priority}</span>
                    <span className={cn('badge text-[10px]', STATUS_STYLES[ticket.status])}>{ticket.status.replace('_', ' ')}</span>
                    {/* SLA badge */}
                    {ticket.status !== 'closed' && ticket.status !== 'resolved' && (
                      <span className={cn('badge text-[10px] font-mono', sla.color)}>{sla.label}</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-surface-800">{ticket.subject}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {ticket.contacts?.name && <p className="text-xs text-surface-400">{ticket.contacts.name}</p>}
                    {assignee && <span className="text-xs text-brand-600 flex items-center gap-1"><UserCheck className="w-3 h-3" />{assignee}</span>}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  {ticket.status === 'open' && <button onClick={() => updateStatus(ticket.id, 'in_progress')} className="btn-secondary btn-sm text-[10px]">Start</button>}
                  {ticket.status === 'in_progress' && <button onClick={() => updateStatus(ticket.id, 'resolved')} className="btn-sm bg-emerald-600 text-white text-[10px] rounded-lg px-2 py-1">Resolve</button>}
                  {ticket.status === 'resolved' && <button onClick={() => updateStatus(ticket.id, 'closed')} className="btn-ghost btn-sm text-[10px]">Close</button>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* New Ticket Modal */}
      {showNew && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100">
              <h2 className="font-semibold text-surface-900">New Ticket</h2>
              <button onClick={() => setShowNew(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="label">Subject *</label><input className="input" value={form.subject} onChange={e => setForm((f: TicketForm) => ({ ...f, subject: e.target.value }))} /></div>
              <div><label className="label">Description</label><textarea className="input resize-none" rows={3} value={form.description} onChange={e => setForm((f: TicketForm) => ({ ...f, description: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Priority</label>
                  <select className="input" value={form.priority} onChange={e => setForm((f: TicketForm) => ({ ...f, priority: e.target.value }))}>
                    <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
                  </select>
                </div>
                <div><label className="label">Contact</label>
                  <select className="input" value={form.contact_id} onChange={e => setForm((f: TicketForm) => ({ ...f, contact_id: e.target.value }))}>
                    <option value="">None</option>
                    {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Category</label><input className="input" value={form.category} onChange={e => setForm((f: TicketForm) => ({ ...f, category: e.target.value }))} placeholder="e.g. Billing, Technical" /></div>
                <div><label className="label">Assign to</label>
                  <select className="input" value={form.assigned_to} onChange={e => setForm((f: TicketForm) => ({ ...f, assigned_to: e.target.value }))}>
                    <option value="">Unassigned</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowNew(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={createTicket} disabled={!form.subject || saving} className="btn-primary flex-1">Create Ticket</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Detail Modal */}
      {detailTicket && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-lg animate-slide-up max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-surface-100">
              <div>
                <h2 className="font-semibold text-surface-900">{detailTicket.subject}</h2>
                <p className="text-xs text-surface-400 font-mono">{detailTicket.ticket_number}</p>
              </div>
              <button onClick={() => setDetailTicket(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Status + Priority */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('badge text-[10px]', STATUS_STYLES[detailTicket.status])}>{detailTicket.status.replace('_', ' ')}</span>
                <span className={cn('text-xs font-bold capitalize', PRIORITY_STYLES[detailTicket.priority])}>{detailTicket.priority}</span>
                {detailTicket.category && <span className="badge badge-gray text-[10px]">{detailTicket.category}</span>}
                {detailTicket.status !== 'closed' && detailTicket.status !== 'resolved' && (
                  <span className={cn('badge text-[10px] font-mono', getSlaColor(detailTicket.created_at).color)}>
                    SLA: {getSlaColor(detailTicket.created_at).label}
                  </span>
                )}
              </div>

              {/* Description */}
              {detailTicket.description && (
                <div>
                  <label className="label">Description</label>
                  <p className="text-sm text-surface-600 whitespace-pre-wrap">{detailTicket.description}</p>
                </div>
              )}

              {/* Contact */}
              {detailTicket.contacts?.name && (
                <div>
                  <label className="label">Contact</label>
                  <p className="text-sm text-surface-600">{detailTicket.contacts.name}</p>
                </div>
              )}

              {/* Timeline */}
              <div>
                <label className="label">Timeline</label>
                <div className="space-y-1 text-xs text-surface-500">
                  <p>Created: {new Date(detailTicket.created_at).toLocaleString()}</p>
                  {detailTicket.first_response_at && <p>First response: {new Date(detailTicket.first_response_at).toLocaleString()}</p>}
                  {detailTicket.resolved_at && <p>Resolved: {new Date(detailTicket.resolved_at).toLocaleString()}</p>}
                  {detailTicket.updated_at && <p>Last updated: {new Date(detailTicket.updated_at).toLocaleString()}</p>}
                </div>
              </div>

              {/* Assign to team member */}
              <div>
                <label className="label">Assigned to</label>
                <select className="input text-sm" value={detailTicket.assigned_to || ''} onChange={e => { assignTicket(detailTicket.id, e.target.value); setDetailTicket(prev => prev ? { ...prev, assigned_to: e.target.value || null } : null) }}>
                  <option value="">Unassigned</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
                </select>
              </div>

              {/* Status actions */}
              <div className="flex gap-2">
                {detailTicket.status === 'open' && <button onClick={() => updateStatus(detailTicket.id, 'in_progress')} className="btn-secondary btn-sm text-xs flex-1">Start Working</button>}
                {detailTicket.status === 'in_progress' && <button onClick={() => updateStatus(detailTicket.id, 'resolved')} className="btn-sm bg-emerald-600 text-white text-xs rounded-lg px-3 py-1.5 flex-1">Mark Resolved</button>}
                {detailTicket.status === 'resolved' && <button onClick={() => updateStatus(detailTicket.id, 'closed')} className="btn-ghost btn-sm text-xs flex-1">Close Ticket</button>}
              </div>

              {/* Internal Notes */}
              <div className="border-t border-surface-100 pt-4">
                <label className="label flex items-center gap-1"><StickyNote className="w-3.5 h-3.5" /> Internal Notes (team only)</label>
                <textarea
                  className="input resize-none text-sm"
                  rows={3}
                  placeholder="Add internal notes visible only to team..."
                  value={internalNotes}
                  onChange={e => setInternalNotes(e.target.value)}
                />
                <button onClick={saveInternalNotes} disabled={savingNotes} className="btn-secondary btn-sm text-xs mt-2">
                  {savingNotes ? 'Saving...' : 'Save Notes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
