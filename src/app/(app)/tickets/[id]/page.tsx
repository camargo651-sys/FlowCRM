'use client'
import { DbRow } from '@/types'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft, Mail, Phone, Send, X, Plus, FileText, CheckSquare,
  Clock, MessageCircle, User, ChevronDown, ChevronUp, AlertTriangle,
  Ticket, ArrowDownLeft, ArrowUpRight, Zap, UserCheck, ExternalLink,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { getActiveWorkspace } from '@/lib/get-active-workspace'
import EmailComposer from '@/components/shared/EmailComposer'
import QuickTaskButton from '@/components/shared/QuickTaskButton'
import RelatedNotes from '@/components/shared/RelatedNotes'
import { pushRecent } from '@/lib/recent/items'
import { notifyRecordChange, notifyMentions } from '@/lib/notifications/notify-change'
import { extractMentionIds } from '@/lib/mentions/parse'
import MentionTextarea from '@/components/shared/MentionTextarea'
import MentionText from '@/components/shared/MentionText'

// --- Types ---

interface TicketDetail {
  id: string; workspace_id: string; ticket_number: string; subject: string;
  description?: string; status: string; priority: string; category?: string;
  contact_id?: string; assigned_to?: string; internal_notes?: string;
  first_response_at?: string; resolved_at?: string;
  created_at: string; updated_at: string;
  contacts?: { name: string; email?: string; phone?: string };
}

interface WhatsAppMessage {
  id: string; wamid: string; from_number: string; to_number: string;
  direction: 'inbound' | 'outbound'; message_type: string;
  body: string | null; status: string; received_at: string;
}

interface EmailMessage {
  id: string; subject: string; snippet: string; from_address: string;
  from_name: string; to_addresses: { email: string; name: string }[];
  direction: 'inbound' | 'outbound'; received_at: string;
  is_read: boolean; thread_id: string;
}

interface ActivityRow {
  id: string; type: string; title: string; notes?: string;
  due_date?: string; done: boolean; created_at: string;
  user_id?: string;
}

// --- Constants ---

const STATUS_STYLES: Record<string, string> = {
  open: 'badge-blue', in_progress: 'badge-yellow', waiting: 'badge-gray',
  resolved: 'badge-green', closed: 'badge-gray',
}
const PRIORITY_BADGE: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-surface-100 text-surface-500',
}
const STATUS_OPTIONS = ['open', 'in_progress', 'resolved', 'closed'] as const
const TIMELINE_STEPS = ['open', 'in_progress', 'resolved', 'closed'] as const

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return months < 12 ? `${months}mo ago` : `${Math.floor(months / 12)}y ago`
}

function ticketAge(createdAt: string): string {
  const hours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60)
  if (hours < 1) return `${Math.floor(hours * 60)}m`
  if (hours < 24) return `${Math.floor(hours)}h`
  const days = Math.floor(hours / 24)
  return `${days}d ${Math.floor(hours % 24)}h`
}

function slaInfo(createdAt: string): { label: string; color: string } {
  const hours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60)
  if (hours < 4) return { label: `${Math.floor(hours)}h — On track`, color: 'bg-emerald-100 text-emerald-700' }
  if (hours < 24) return { label: `${Math.floor(hours)}h — At risk`, color: 'bg-amber-100 text-amber-700' }
  const days = Math.floor(hours / 24)
  return { label: `${days}d ${Math.floor(hours % 24)}h — Breached`, color: 'bg-red-100 text-red-700' }
}

// --- Component ---

export default function TicketDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()

  // Core state
  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [members, setMembers] = useState<{ id: string; full_name?: string; email?: string }[]>([])
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [emails, setEmails] = useState<EmailMessage[]>([])
  const [waMessages, setWaMessages] = useState<WhatsAppMessage[]>([])
  const [otherTickets, setOtherTickets] = useState<DbRow[]>([])
  const [loading, setLoading] = useState(true)

  // Profile map for note author names
  const [profileMap, setProfileMap] = useState<Record<string, string>>({})
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserName, setCurrentUserName] = useState('You')

  // Internal notes chat
  const [noteText, setNoteText] = useState('')
  const [noteSending, setNoteSending] = useState(false)
  const notesEndRef = useRef<HTMLDivElement>(null)

  // WhatsApp
  const [waSendText, setWaSendText] = useState('')
  const [waSending, setWaSending] = useState(false)
  const [waExpanded, setWaExpanded] = useState(true)
  const [waVisibleCount, setWaVisibleCount] = useState(30)
  const waEndRef = useRef<HTMLDivElement>(null)
  const waInputRef = useRef<HTMLInputElement>(null)

  // Email
  const [emailExpanded, setEmailExpanded] = useState(false)
  const [showEmailComposer, setShowEmailComposer] = useState(false)

  // Quick task form
  const [showNewTask, setShowNewTask] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDue, setTaskDue] = useState('')

  // --- Data Loading ---

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUserId(user.id)

    // Load ticket
    const { data: ticketData } = await supabase
      .from('tickets')
      .select('*, contacts(name, email, phone)')
      .eq('id', id)
      .single()
    if (!ticketData) { setLoading(false); return }
    setTicket(ticketData)
    pushRecent({ type: 'ticket', id: ticketData.id, label: ticketData.subject || ticketData.ticket_number || 'Ticket', href: `/tickets/${ticketData.id}` })

    const ws = ticketData.workspace_id

    // Parallel loads
    const [membersRes, activitiesRes, emailsRes, waRes, otherTicketsRes, profilesRes, profileRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email').eq('workspace_id', ws),
      ticketData.contact_id
        ? supabase.from('activities').select('*').eq('contact_id', ticketData.contact_id).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      ticketData.contact_id
        ? supabase.from('email_messages').select('id, subject, snippet, from_address, from_name, to_addresses, direction, received_at, is_read, thread_id').eq('contact_id', ticketData.contact_id).order('received_at', { ascending: false }).limit(50)
        : Promise.resolve({ data: [] }),
      ticketData.contact_id
        ? supabase.from('whatsapp_messages').select('id, wamid, from_number, to_number, direction, message_type, body, status, received_at').eq('contact_id', ticketData.contact_id).order('received_at', { ascending: true }).limit(100)
        : Promise.resolve({ data: [] }),
      ticketData.contact_id
        ? supabase.from('tickets').select('id, ticket_number, subject, status, priority, created_at').eq('contact_id', ticketData.contact_id).neq('id', id as string).order('created_at', { ascending: false }).limit(10)
        : Promise.resolve({ data: [] }),
      supabase.from('profiles').select('id, full_name, email').eq('workspace_id', ws),
      supabase.from('profiles').select('full_name, email').eq('id', user.id).single(),
    ])

    setMembers(membersRes.data || [])
    setActivities(activitiesRes.data || [])
    setEmails(emailsRes.data || [])
    setWaMessages(waRes.data || [])
    setOtherTickets(otherTicketsRes.data || [])

    if (profilesRes.data) {
      const map: Record<string, string> = {}
      profilesRes.data.forEach((p: { id: string; full_name?: string; email?: string }) => {
        map[p.id] = p.full_name || p.email || 'Unknown'
      })
      setProfileMap(map)
    }
    if (profileRes.data) {
      setCurrentUserName(profileRes.data.full_name || profileRes.data.email || 'You')
    }

    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  // Auto-scroll notes
  useEffect(() => { notesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [activities])

  // --- Actions ---

  const notifyTicketChange = (t: TicketDetail) => {
    if (!t.assigned_to || t.assigned_to === currentUserId) return
    notifyRecordChange({
      entity: 'ticket',
      entityId: t.id,
      entityTitle: t.subject,
      ownerId: t.assigned_to,
      editorId: currentUserId,
      editorName: currentUserName,
      actionUrl: `/tickets/${t.id}`,
      workspaceId: t.workspace_id,
    })
  }

  const updateStatus = async (status: string) => {
    if (!ticket) return
    await supabase.from('tickets').update({
      status,
      ...(status === 'resolved' ? { resolved_at: new Date().toISOString() } : {}),
    }).eq('id', ticket.id)
    setTicket(prev => prev ? { ...prev, status, ...(status === 'resolved' ? { resolved_at: new Date().toISOString() } : {}) } : null)
    notifyTicketChange(ticket)
  }

  const assignTicket = async (userId: string) => {
    if (!ticket) return
    await supabase.from('tickets').update({ assigned_to: userId || null }).eq('id', ticket.id)
    setTicket(prev => prev ? { ...prev, assigned_to: userId || undefined } : null)
    // Notify the new assignee (if not self) that they were assigned
    if (userId && userId !== currentUserId) {
      notifyRecordChange({
        entity: 'ticket',
        entityId: ticket.id,
        entityTitle: ticket.subject,
        ownerId: userId,
        editorId: currentUserId,
        editorName: currentUserName,
        actionUrl: `/tickets/${ticket.id}`,
        workspaceId: ticket.workspace_id,
      })
    }
  }

  const escalateTicket = async () => {
    if (!ticket) return
    await supabase.from('tickets').update({ priority: 'urgent' }).eq('id', ticket.id)
    setTicket(prev => prev ? { ...prev, priority: 'urgent' } : null)
    notifyTicketChange(ticket)
  }

  const sendNote = async () => {
    if (!noteText.trim() || !ticket) return
    setNoteSending(true)
    const raw = noteText.trim()
    const { data } = await supabase.from('activities').insert([{
      workspace_id: ticket.workspace_id,
      contact_id: ticket.contact_id || null,
      type: 'note',
      title: raw,
      notes: null,
      done: false,
    }]).select().single()
    if (data) setActivities(prev => [data, ...prev])
    const mentionIds = extractMentionIds(raw)
    if (mentionIds.length > 0) {
      notifyMentions({
        mentionedUserIds: mentionIds,
        entity: `ticket ${ticket.ticket_number}`,
        entityTitle: ticket.subject,
        authorId: currentUserId,
        authorName: currentUserName,
        excerpt: raw.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1').slice(0, 140),
        actionUrl: `/tickets/${ticket.id}`,
        workspaceId: ticket.workspace_id,
      })
    }
    setNoteText('')
    setNoteSending(false)
  }

  // Mention-capable users from loaded members
  const mentionUsers = members.map(m => ({ id: m.id, name: m.full_name || m.email || 'Unknown' }))

  const createTask = async () => {
    if (!taskTitle.trim() || !ticket) return
    await supabase.from('activities').insert([{
      workspace_id: ticket.workspace_id,
      contact_id: ticket.contact_id || null,
      type: 'task',
      title: taskTitle.trim(),
      due_date: taskDue || null,
      done: false,
    }])
    setTaskTitle('')
    setTaskDue('')
    setShowNewTask(false)
    load()
  }

  const handleWaSend = async () => {
    if (!waSendText.trim() || !ticket?.contact_id) return
    setWaSending(true)
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: ticket.contact_id, message: waSendText.trim() }),
      })
      if (res.ok) {
        const { message: stored } = await res.json()
        if (stored) setWaMessages(prev => [...prev, stored])
        setWaSendText('')
      }
    } catch {}
    setWaSending(false)
  }

  // --- Computed ---

  const getMemberName = (userId: string | undefined) => {
    if (!userId) return null
    const m = members.find(m => m.id === userId)
    return m ? (m.full_name || m.email || null) : null
  }

  const noteActivities = activities
    .filter(a => a.type === 'note')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const visibleWaMessages = waMessages.slice(Math.max(0, waMessages.length - waVisibleCount))
  const hasMoreWa = waMessages.length > waVisibleCount

  // Timeline: figure out which steps are completed
  const statusIndex = TIMELINE_STEPS.indexOf(ticket?.status as typeof TIMELINE_STEPS[number])

  if (loading || !ticket) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    )
  }

  const sla = slaInfo(ticket.created_at)
  const isActive = ticket.status !== 'closed' && ticket.status !== 'resolved'

  return (
    <div className="animate-fade-in">
      {/* Back button */}
      <button onClick={() => router.push('/tickets')}
        className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700 mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Tickets
      </button>

      {/* Mobile floating button to jump to interaction hub */}
      <button
        onClick={() => document.getElementById('interaction-hub')?.scrollIntoView({ behavior: 'smooth' })}
        className="lg:hidden fixed bottom-24 right-4 z-40 bg-brand-600 text-white rounded-2xl px-4 py-2.5 shadow-lg flex items-center gap-2 active:scale-95 transition-transform"
      >
        <MessageCircle className="w-4 h-4" />
        <span className="text-sm font-medium">Chat</span>
      </button>

      {/* ====== TWO-COLUMN LAYOUT ====== */}
      <div className="flex flex-col lg:flex-row gap-6">

        {/* ====== LEFT COLUMN (60%) ====== */}
        <div className="w-full lg:w-[60%] space-y-6">

          {/* 1. Header Card */}
          <div className="card p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs font-mono text-surface-400">{ticket.ticket_number}</span>
                  <span className={cn('badge text-[10px]', STATUS_STYLES[ticket.status])}>{ticket.status.replace('_', ' ')}</span>
                  <span className={cn('badge text-[10px] font-bold capitalize', PRIORITY_BADGE[ticket.priority])}>{ticket.priority}</span>
                  {ticket.category && <span className="badge badge-gray text-[10px]">{ticket.category}</span>}
                </div>
                <h1 className="text-xl font-bold text-surface-900">{ticket.subject}</h1>
                <div className="flex items-center gap-4 mt-2 text-xs text-surface-500">
                  {ticket.contacts?.name && (
                    <button onClick={() => router.push(`/contacts/${ticket.contact_id}`)}
                      className="flex items-center gap-1 text-brand-600 hover:underline">
                      <User className="w-3.5 h-3.5" /> {ticket.contacts.name}
                    </button>
                  )}
                  {getMemberName(ticket.assigned_to) && (
                    <span className="flex items-center gap-1 text-surface-600">
                      <UserCheck className="w-3.5 h-3.5" /> {getMemberName(ticket.assigned_to)}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {formatDate(ticket.created_at)}
                  </span>
                </div>
              </div>
              <div className="flex-shrink-0">
                <QuickTaskButton ticketId={ticket.id} contactId={ticket.contact_id || undefined} size="sm" />
              </div>
            </div>
          </div>

          <RelatedNotes ticketId={ticket.id} contactId={ticket.contact_id || undefined} />

          {/* 2. KPI Stats Bar */}
          <div className="card p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="text-center">
                <p className="text-lg font-bold text-surface-900">{ticketAge(ticket.created_at)}</p>
                <p className="text-[10px] text-surface-400 font-semibold uppercase">Ticket Age</p>
              </div>
              <div className="text-center">
                {isActive ? (
                  <span className={cn('inline-block px-2.5 py-1 rounded-full text-xs font-bold', sla.color)}>{sla.label}</span>
                ) : (
                  <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-surface-100 text-surface-500">N/A</span>
                )}
                <p className="text-[10px] text-surface-400 font-semibold uppercase mt-1">SLA Status</p>
              </div>
              <div className="text-center">
                <span className={cn('inline-block px-2.5 py-1 rounded-full text-xs font-bold capitalize', PRIORITY_BADGE[ticket.priority])}>
                  {ticket.priority}
                </span>
                <p className="text-[10px] text-surface-400 font-semibold uppercase mt-1">Priority</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-surface-700">
                  {getMemberName(ticket.assigned_to) || 'Unassigned'}
                </p>
                <p className="text-[10px] text-surface-400 font-semibold uppercase">Assigned To</p>
              </div>
            </div>
          </div>

          {/* 3. Quick Actions Bar */}
          <div className="flex flex-wrap gap-2">
            {/* Change Status */}
            <select
              value={ticket.status}
              onChange={e => updateStatus(e.target.value)}
              className="input w-auto text-xs"
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>

            {/* Assign */}
            <select
              value={ticket.assigned_to || ''}
              onChange={e => assignTicket(e.target.value)}
              className="input w-auto text-xs"
            >
              <option value="">Unassigned</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
              ))}
            </select>

            {/* Escalate */}
            {ticket.priority !== 'urgent' && (
              <button onClick={escalateTicket} className="btn-sm bg-red-600 text-white text-xs rounded-lg px-3 py-1.5 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" /> Escalate
              </button>
            )}

            {/* Send Email */}
            {ticket.contacts?.email && (
              <button onClick={() => setShowEmailComposer(true)} className="btn-secondary btn-sm">
                <Send className="w-3.5 h-3.5" /> Send Email
              </button>
            )}

            {/* Send WhatsApp */}
            {ticket.contacts?.phone && (
              <button onClick={() => { setWaExpanded(true); setTimeout(() => waInputRef.current?.focus(), 100) }}
                className="btn-secondary btn-sm">
                <MessageCircle className="w-3.5 h-3.5" /> Send WhatsApp
              </button>
            )}

            {/* Create Task */}
            <button onClick={() => setShowNewTask(true)} className="btn-secondary btn-sm">
              <CheckSquare className="w-3.5 h-3.5" /> Create Task
            </button>
          </div>

          {/* 4. Description */}
          {ticket.description && (
            <div className="card p-5">
              <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-2">
                <FileText className="w-3.5 h-3.5 inline mr-1" /> Description
              </h3>
              <p className="text-sm text-surface-700 whitespace-pre-wrap">{ticket.description}</p>
            </div>
          )}

          {/* 5. Timeline */}
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-4">
              <Clock className="w-3.5 h-3.5 inline mr-1" /> Status Timeline
            </h3>
            <div className="flex items-center gap-0">
              {TIMELINE_STEPS.map((step, i) => {
                const reached = i <= statusIndex
                const isCurrent = i === statusIndex
                return (
                  <div key={step} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all',
                        isCurrent ? 'border-brand-600 bg-brand-600 text-white scale-110' :
                        reached ? 'border-emerald-500 bg-emerald-500 text-white' :
                        'border-surface-200 bg-white text-surface-400'
                      )}>
                        {i + 1}
                      </div>
                      <p className={cn('text-[10px] mt-1 capitalize font-medium',
                        isCurrent ? 'text-brand-700' : reached ? 'text-emerald-600' : 'text-surface-400')}>
                        {step.replace('_', ' ')}
                      </p>
                      {/* Show dates if known */}
                      {step === 'open' && (
                        <p className="text-[9px] text-surface-400">{new Date(ticket.created_at).toLocaleDateString()}</p>
                      )}
                      {step === 'resolved' && ticket.resolved_at && (
                        <p className="text-[9px] text-surface-400">{new Date(ticket.resolved_at).toLocaleDateString()}</p>
                      )}
                    </div>
                    {i < TIMELINE_STEPS.length - 1 && (
                      <div className={cn('h-0.5 flex-1 min-w-[20px]',
                        i < statusIndex ? 'bg-emerald-500' : 'bg-surface-200')} />
                    )}
                  </div>
                )
              })}
            </div>
            {/* Extra timestamps */}
            <div className="mt-4 space-y-1 text-xs text-surface-500">
              <p>Created: {new Date(ticket.created_at).toLocaleString()}</p>
              {ticket.first_response_at && <p>First response: {new Date(ticket.first_response_at).toLocaleString()}</p>}
              {ticket.resolved_at && <p>Resolved: {new Date(ticket.resolved_at).toLocaleString()}</p>}
              {ticket.updated_at && <p>Last updated: {new Date(ticket.updated_at).toLocaleString()}</p>}
            </div>
          </div>

          {/* 6. Related Records */}
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-3">
              <ExternalLink className="w-3.5 h-3.5 inline mr-1" /> Related Records
            </h3>

            {/* Contact link */}
            {ticket.contacts?.name && (
              <div className="mb-3">
                <p className="text-[10px] text-surface-400 font-semibold uppercase mb-1">Contact</p>
                <button onClick={() => router.push(`/contacts/${ticket.contact_id}`)}
                  className="text-sm text-brand-600 hover:underline font-medium flex items-center gap-1">
                  <User className="w-3.5 h-3.5" /> {ticket.contacts.name}
                  {ticket.contacts.email && <span className="text-surface-400 font-normal">({ticket.contacts.email})</span>}
                </button>
              </div>
            )}

            {/* Other tickets from same contact */}
            {otherTickets.length > 0 && (
              <div>
                <p className="text-[10px] text-surface-400 font-semibold uppercase mb-1">Other Tickets from this Contact</p>
                <div className="space-y-1.5">
                  {otherTickets.map(t => (
                    <div key={t.id}
                      onClick={() => router.push(`/tickets/${t.id}`)}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface-50 cursor-pointer transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-mono text-surface-400">{t.ticket_number}</span>
                        <p className="text-sm font-medium text-surface-800 truncate">{t.subject}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className={cn('badge text-[9px]', STATUS_STYLES[t.status] || 'badge-gray')}>{t.status.replace('_', ' ')}</span>
                        <span className="text-[10px] text-surface-400">{timeAgo(t.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!ticket.contacts?.name && otherTickets.length === 0 && (
              <p className="text-sm text-surface-400 py-4 text-center">No related records</p>
            )}
          </div>

        </div>
        {/* END LEFT COLUMN */}

        {/* ====== RIGHT COLUMN (40%) - Sticky Interaction Hub ====== */}
        <div id="interaction-hub" className="w-full lg:w-[40%]">
          <div className="lg:sticky lg:top-4 space-y-4">

            {/* Internal Notes Feed (chat-style) */}
            <div className="card overflow-hidden flex flex-col" style={{ maxHeight: '50vh' }}>
              <div className="px-4 py-3 border-b border-surface-100 bg-amber-50 flex-shrink-0">
                <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                  <FileText className="w-3.5 h-3.5 inline mr-1" /> Internal Notes ({noteActivities.length})
                  <span className="ml-2 text-[9px] font-normal normal-case text-amber-500">Team only</span>
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[120px] bg-amber-50/30">
                {noteActivities.length === 0 && (
                  <p className="text-sm text-surface-400 text-center py-8">No internal notes yet. Start the conversation.</p>
                )}
                {noteActivities.map(note => {
                  const authorName = note.user_id ? (profileMap[note.user_id] || currentUserName) : currentUserName
                  return (
                    <div key={note.id} className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-full bg-amber-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <User className="w-3 h-3 text-amber-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="bg-amber-100/60 rounded-2xl rounded-tl-sm px-3 py-2">
                          <p className="text-sm text-surface-800 whitespace-pre-wrap">
                            <MentionText text={note.title} />
                          </p>
                          {note.notes && <p className="text-xs text-surface-500 mt-1">{note.notes}</p>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 px-1">
                          <span className="text-[10px] text-surface-400 font-medium">{authorName}</span>
                          <span className="text-[10px] text-surface-300">{timeAgo(note.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={notesEndRef} />
              </div>

              <div className="p-3 border-t border-amber-200 bg-amber-50 flex gap-2 flex-shrink-0">
                <div className="flex-1">
                  <MentionTextarea
                    value={noteText}
                    onChange={setNoteText}
                    users={mentionUsers}
                    placeholder="Add an internal note... (usa @ para mencionar)"
                    rows={1}
                    className="input w-full resize-none"
                    onKeyDownExtra={e => {
                      if (e.key === 'Enter' && !e.shiftKey && noteText.trim()) {
                        e.preventDefault()
                        sendNote()
                      }
                    }}
                  />
                </div>
                <button onClick={sendNote} disabled={noteSending || !noteText.trim()}
                  className="btn-primary btn-sm px-3">
                  {noteSending
                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* WhatsApp Chat (collapsible) */}
            <div className="card overflow-hidden">
              <button
                onClick={() => setWaExpanded(!waExpanded)}
                className="w-full px-4 py-3 border-b border-surface-100 bg-surface-50 flex items-center justify-between hover:bg-surface-100 transition-colors">
                <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
                  <MessageCircle className="w-3.5 h-3.5 inline mr-1 text-green-600" /> WhatsApp ({waMessages.length} messages)
                </h3>
                {waExpanded ? <ChevronUp className="w-4 h-4 text-surface-400" /> : <ChevronDown className="w-4 h-4 text-surface-400" />}
              </button>

              {waExpanded && (
                <>
                  {waMessages.length === 0 ? (
                    <div className="text-center py-8 px-4">
                      <MessageCircle className="w-8 h-8 text-surface-300 mx-auto mb-2" />
                      <p className="text-sm text-surface-500">No WhatsApp messages</p>
                      {ticket.contacts?.phone && (
                        <button onClick={() => waInputRef.current?.focus()}
                          className="btn-primary btn-sm mt-3" style={{ backgroundColor: '#25D366' }}>
                          <Send className="w-3.5 h-3.5" /> Start conversation
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="p-4 space-y-2.5 overflow-y-auto" style={{ maxHeight: '40vh' }}>
                        {hasMoreWa && (
                          <button onClick={() => setWaVisibleCount(prev => prev + 30)}
                            className="text-xs text-brand-600 hover:underline font-medium w-full text-center py-1">
                            Load more messages
                          </button>
                        )}
                        {visibleWaMessages.map(msg => (
                          <div key={msg.id} className={cn('flex', msg.direction === 'outbound' ? 'justify-end' : 'justify-start')}>
                            <div className={cn('max-w-[80%] rounded-2xl px-3.5 py-2 shadow-sm',
                              msg.direction === 'outbound'
                                ? 'bg-[#DCF8C6] rounded-tr-sm'
                                : 'bg-white border border-surface-100 rounded-tl-sm')}>
                              <p className="text-sm text-surface-800 whitespace-pre-wrap">{msg.body || `[${msg.message_type}]`}</p>
                              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                                <span className="text-[10px] text-surface-400">
                                  {new Date(msg.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {msg.direction === 'outbound' && (
                                  <span className={cn('text-[10px]',
                                    msg.status === 'read' ? 'text-blue-500' :
                                    msg.status === 'delivered' ? 'text-surface-400' : 'text-surface-300')}>
                                    {msg.status === 'read' ? '\u2713\u2713' : msg.status === 'delivered' ? '\u2713\u2713' : msg.status === 'failed' ? '!' : '\u2713'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        <div ref={waEndRef} />
                      </div>

                      {ticket.contacts?.phone && (
                        <div className="p-3 border-t border-surface-100 bg-surface-50 flex gap-2">
                          <input
                            ref={waInputRef}
                            type="text"
                            className="input flex-1"
                            placeholder="Type a message..."
                            value={waSendText}
                            onChange={e => setWaSendText(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && !e.shiftKey && waSendText.trim()) {
                                e.preventDefault()
                                handleWaSend()
                              }
                            }}
                          />
                          <button onClick={handleWaSend} disabled={waSending || !waSendText.trim()}
                            className="btn-primary btn-sm px-3" style={{ backgroundColor: '#25D366' }}>
                            {waSending
                              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              : <Send className="w-4 h-4" />}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            {/* Email History (collapsible) */}
            <div className="card overflow-hidden">
              <button
                onClick={() => setEmailExpanded(!emailExpanded)}
                className="w-full px-4 py-3 border-b border-surface-100 bg-surface-50 flex items-center justify-between hover:bg-surface-100 transition-colors">
                <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
                  <Mail className="w-3.5 h-3.5 inline mr-1 text-blue-600" /> Emails ({emails.length})
                </h3>
                {emailExpanded ? <ChevronUp className="w-4 h-4 text-surface-400" /> : <ChevronDown className="w-4 h-4 text-surface-400" />}
              </button>

              {emailExpanded && (
                <div className="max-h-[40vh] overflow-y-auto">
                  {emails.length === 0 ? (
                    <div className="text-center py-6 px-4">
                      <Mail className="w-8 h-8 text-surface-300 mx-auto mb-2" />
                      <p className="text-sm text-surface-500">No emails synced</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-surface-100">
                      {emails.map(email => (
                        <div key={email.id} className="px-4 py-3 hover:bg-surface-50 transition-colors">
                          <div className="flex items-center gap-2">
                            <div className={cn('w-5 h-5 rounded flex items-center justify-center flex-shrink-0',
                              email.direction === 'inbound' ? 'bg-blue-50' : 'bg-emerald-50')}>
                              {email.direction === 'inbound'
                                ? <ArrowDownLeft className="w-3 h-3 text-blue-600" />
                                : <ArrowUpRight className="w-3 h-3 text-emerald-600" />}
                            </div>
                            <p className="text-sm font-medium text-surface-800 truncate flex-1">{email.subject}</p>
                            <span className="text-[10px] text-surface-400 flex-shrink-0">{timeAgo(email.received_at)}</span>
                          </div>
                          {email.snippet && (
                            <p className="text-[11px] text-surface-400 mt-1 line-clamp-1 pl-7">{email.snippet}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
        {/* END RIGHT COLUMN */}

      </div>
      {/* END TWO-COLUMN LAYOUT */}

      {/* ====== QUICK TASK MODAL ====== */}
      {showNewTask && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100">
              <h2 className="font-semibold text-surface-900">Create Task for Ticket</h2>
              <button onClick={() => setShowNewTask(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100">
                <X className="w-4 h-4 text-surface-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Task Title *</label>
                <input className="input" value={taskTitle} onChange={e => setTaskTitle(e.target.value)}
                  placeholder={`e.g. Follow up on ${ticket.ticket_number}`} />
              </div>
              <div>
                <label className="label">Due Date</label>
                <input className="input" type="date" value={taskDue} onChange={e => setTaskDue(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowNewTask(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={createTask} disabled={!taskTitle.trim()} className="btn-primary flex-1">Create Task</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====== EMAIL COMPOSER ====== */}
      {showEmailComposer && ticket.contacts?.email && (
        <EmailComposer
          contactId={ticket.contact_id!}
          contactEmail={ticket.contacts.email}
          contactName={ticket.contacts.name}
          replyTo={{ subject: `Re: ${ticket.subject}` }}
          onSent={() => { setShowEmailComposer(false); load() }}
          onClose={() => setShowEmailComposer(false)}
        />
      )}
    </div>
  )
}
