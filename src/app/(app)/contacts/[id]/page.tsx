'use client'
import { DbRow } from '@/types'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft, Mail, Phone, Building2, Globe, MapPin, Edit2, Save, X,
  Plus, FileText, TrendingUp, CheckSquare, Clock, MessageCircle,
  DollarSign, Calendar, User, Send, CheckCircle2, XCircle, Trash2,
  ArrowDownLeft, ArrowUpRight
} from 'lucide-react'
import { formatCurrency, getInitials, cn, formatDate } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace-context'

interface ContactDetail {
  id: string; workspace_id: string; type: string; name: string;
  email?: string; phone?: string; company_name?: string; job_title?: string;
  website?: string; address?: string; notes?: string; tags?: string[];
  custom_fields?: DbRow; created_at: string; updated_at: string;
}

interface DealRow {
  id: string; title: string; value?: number; status: string;
  created_at: string; pipeline_stages?: { name: string; color: string };
}

interface QuoteRow {
  id: string; quote_number: string; title: string; total: number;
  status: string; created_at: string;
}

interface ActivityRow {
  id: string; type: string; title: string; notes?: string;
  due_date?: string; done: boolean; created_at: string;
  metadata?: DbRow;
}

interface EmailMessage {
  id: string; subject: string; snippet: string; from_address: string;
  from_name: string; to_addresses: { email: string; name: string }[];
  direction: 'inbound' | 'outbound'; received_at: string;
  is_read: boolean; thread_id: string;
}

interface WhatsAppMessage {
  id: string; wamid: string; from_number: string; to_number: string;
  direction: 'inbound' | 'outbound'; message_type: string;
  body: string | null; status: string; received_at: string;
}

interface CallLog {
  id: string; provider: string; direction: string; duration_seconds: number;
  transcript: string | null; summary: string | null; sentiment: string | null;
  key_topics: string[]; next_actions: string[]; started_at: string;
  recording_url: string | null;
}

const ACTIVITY_ICONS: Record<string, typeof Phone> = {
  call: Phone, email: Mail, meeting: Calendar, note: FileText, task: CheckSquare, whatsapp: MessageCircle,
}
const ACTIVITY_COLORS: Record<string, string> = {
  call: 'bg-emerald-50 text-emerald-600', email: 'bg-blue-50 text-blue-600',
  meeting: 'bg-violet-50 text-violet-600', note: 'bg-amber-50 text-amber-600',
  task: 'bg-surface-100 text-surface-600', whatsapp: 'bg-green-50 text-green-600',
}

export default function ContactDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()
  const { template, customFields: wsCustomFields } = useWorkspace()

  const [contact, setContact] = useState<ContactDetail | null>(null)
  const [deals, setDeals] = useState<DealRow[]>([])
  const [quotes, setQuotes] = useState<QuoteRow[]>([])
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [emails, setEmails] = useState<EmailMessage[]>([])
  const [waMessages, setWaMessages] = useState<WhatsAppMessage[]>([])
  const [callLogs, setCallLogs] = useState<CallLog[]>([])
  const [waSendText, setWaSendText] = useState('')
  const [waSending, setWaSending] = useState(false)
  const [tab, setTab] = useState<'overview' | 'deals' | 'quotes' | 'activities' | 'emails' | 'whatsapp'>('overview')
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState<Partial<ContactDetail>>({})
  const [showNewActivity, setShowNewActivity] = useState(false)
  const [showNewDeal, setShowNewDeal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // New activity form
  const [actType, setActType] = useState('task')
  const [actTitle, setActTitle] = useState('')
  const [actNotes, setActNotes] = useState('')
  const [actDue, setActDue] = useState('')

  // New deal form
  const [dealTitle, setDealTitle] = useState('')
  const [dealValue, setDealValue] = useState('')
  const [stages, setStages] = useState<{ id: string; name: string }[]>([])
  const [dealStageId, setDealStageId] = useState('')

  const load = useCallback(async () => {
    const [contactRes, dealsRes, quotesRes, activitiesRes] = await Promise.all([
      supabase.from('contacts').select('*').eq('id', id).single(),
      supabase.from('deals').select('id, title, value, status, created_at').eq('contact_id', id).order('created_at', { ascending: false }),
      supabase.from('quotes').select('id, quote_number, title, total, status, created_at').eq('contact_id', id).order('created_at', { ascending: false }),
      supabase.from('activities').select('*').eq('contact_id', id).order('created_at', { ascending: false }),
    ])

    if (contactRes.data) {
      setContact(contactRes.data)
      setEditData(contactRes.data)

      // Load stages for new deal form
      const { data: stagesData } = await supabase.from('pipeline_stages').select('id, name').eq('workspace_id', contactRes.data.workspace_id).order('order_index').limit(20)
      setStages(stagesData || [])
      if (stagesData?.[0]) setDealStageId(stagesData[0].id)
    }

    setDeals(dealsRes.data || [])
    setQuotes(quotesRes.data || [])
    setActivities(activitiesRes.data || [])

    // Load synced emails for this contact
    const { data: emailsData } = await supabase
      .from('email_messages')
      .select('id, subject, snippet, from_address, from_name, to_addresses, direction, received_at, is_read, thread_id')
      .eq('contact_id', id)
      .order('received_at', { ascending: false })
      .limit(50)
    setEmails(emailsData || [])

    // Load WhatsApp messages
    const { data: waData } = await supabase
      .from('whatsapp_messages')
      .select('id, wamid, from_number, to_number, direction, message_type, body, status, received_at')
      .eq('contact_id', id)
      .order('received_at', { ascending: true })
      .limit(100)
    setWaMessages(waData || [])

    // Load call logs
    const { data: callData } = await supabase
      .from('call_logs')
      .select('id, provider, direction, duration_seconds, transcript, summary, sentiment, key_topics, next_actions, started_at, recording_url')
      .eq('contact_id', id)
      .order('started_at', { ascending: false })
      .limit(30)
    setCallLogs(callData || [])

    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  const saveContact = async () => {
    setSaving(true)
    await supabase.from('contacts').update(editData).eq('id', id)
    setContact(prev => prev ? { ...prev, ...editData } : null)
    setEditing(false)
    setSaving(false)
  }

  const createActivity = async () => {
    if (!actTitle || !contact) return
    const { data } = await supabase.from('activities').insert([{
      workspace_id: contact.workspace_id, contact_id: id, type: actType,
      title: actTitle, notes: actNotes || null, due_date: actDue || null, done: false,
    }]).select().single()
    if (data) setActivities(prev => [data, ...prev])
    setActTitle(''); setActNotes(''); setActDue(''); setShowNewActivity(false)
  }

  const toggleActivity = async (actId: string, done: boolean) => {
    await supabase.from('activities').update({ done: !done }).eq('id', actId)
    setActivities(prev => prev.map(a => a.id === actId ? { ...a, done: !done } : a))
  }

  const createDeal = async () => {
    if (!dealTitle || !contact) return
    const { data } = await supabase.from('deals').insert([{
      workspace_id: contact.workspace_id, contact_id: id, title: dealTitle,
      value: dealValue ? parseFloat(dealValue) : null, stage_id: dealStageId,
      status: 'open', currency: 'USD', order_index: 0,
    }]).select('id, title, value, status, created_at').single()
    if (data) setDeals(prev => [data, ...prev])
    setDealTitle(''); setDealValue(''); setShowNewDeal(false)
  }

  const handleWaSend = async () => {
    if (!waSendText.trim() || !contact) return
    setWaSending(true)
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: id, message: waSendText.trim() }),
      })
      if (res.ok) {
        const { message: stored } = await res.json()
        if (stored) setWaMessages(prev => [...prev, stored])
        setWaSendText('')
      }
    } catch {}
    setWaSending(false)
  }

  const contactCustomFields = wsCustomFields.filter(f => f.entity === 'contact')

  // Build timeline from all sources
  const timeline = [
    ...deals.map(d => ({ type: 'deal' as const, date: d.created_at, data: d })),
    ...quotes.map(q => ({ type: 'quote' as const, date: q.created_at, data: q })),
    ...activities.filter(a => a.type !== 'email').map(a => ({ type: 'activity' as const, date: a.created_at, data: a })),
    ...emails.map(e => ({ type: 'email' as const, date: e.received_at, data: e })),
    ...callLogs.map(c => ({ type: 'call_log' as const, date: c.started_at, data: c })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  if (loading || !contact) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  const AVATAR_COLORS = ['bg-brand-500','bg-violet-500','bg-emerald-500','bg-amber-500','bg-rose-500','bg-cyan-500']
  const avatarColor = AVATAR_COLORS[contact.name.charCodeAt(0) % AVATAR_COLORS.length]

  return (
    <div className="animate-fade-in max-w-5xl">
      {/* Back button */}
      <button onClick={() => router.push('/contacts')} className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700 mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to {template.contactLabel.plural}
      </button>

      {/* Header card */}
      <div className="card p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className={`avatar-lg ${avatarColor} text-lg`}>{getInitials(contact.name)}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-surface-900">{contact.name}</h1>
              <span className={cn('badge text-[10px]', contact.type === 'company' ? 'badge-blue' : 'badge-gray')}>{contact.type}</span>
            </div>
            {contact.job_title && <p className="text-sm text-surface-500 mt-0.5">{contact.job_title}{contact.company_name ? ` at ${contact.company_name}` : ''}</p>}
            <div className="flex flex-wrap gap-4 mt-3">
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-xs text-brand-600 hover:underline">
                  <Mail className="w-3.5 h-3.5" /> {contact.email}
                </a>
              )}
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className="flex items-center gap-1.5 text-xs text-surface-600">
                  <Phone className="w-3.5 h-3.5" /> {contact.phone}
                </a>
              )}
              {contact.website && (
                <a href={contact.website} target="_blank" className="flex items-center gap-1.5 text-xs text-surface-600 hover:text-brand-600">
                  <Globe className="w-3.5 h-3.5" /> {contact.website}
                </a>
              )}
            </div>
          </div>
          <button onClick={() => setEditing(true)} className="btn-secondary btn-sm">
            <Edit2 className="w-3.5 h-3.5" /> Edit
          </button>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-6 gap-3 mt-5 pt-5 border-t border-surface-100">
          <div className="text-center">
            <p className="text-lg font-bold text-surface-900">{deals.length}</p>
            <p className="text-[10px] text-surface-400 font-semibold uppercase">{template.dealLabel.plural}</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-surface-900">{formatCurrency(deals.filter(d => d.status === 'won').reduce((s, d) => s + (d.value || 0), 0))}</p>
            <p className="text-[10px] text-surface-400 font-semibold uppercase">Won Revenue</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-surface-900">{quotes.length}</p>
            <p className="text-[10px] text-surface-400 font-semibold uppercase">Quotes</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-surface-900">{emails.length}</p>
            <p className="text-[10px] text-surface-400 font-semibold uppercase">Emails</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-surface-900">{waMessages.length}</p>
            <p className="text-[10px] text-surface-400 font-semibold uppercase">WhatsApp</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-surface-900">{activities.filter(a => !a.done).length}</p>
            <p className="text-[10px] text-surface-400 font-semibold uppercase">Open Tasks</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="segmented-control mb-8">
        {[
          { id: 'overview', label: 'Timeline', count: timeline.length },
          { id: 'deals', label: template.dealLabel.plural, count: deals.length },
          { id: 'quotes', label: 'Quotes', count: quotes.length },
          { id: 'activities', label: 'Activities', count: activities.filter(a => a.type !== 'email').length },
          { id: 'emails', label: 'Emails', count: emails.length },
          { id: 'whatsapp', label: 'WhatsApp', count: waMessages.length },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
            className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t.id ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500 hover:text-surface-700')}>
            {t.label}
            <span className="text-[10px] bg-surface-200/50 px-1.5 py-0.5 rounded-full">{t.count}</span>
          </button>
        ))}
      </div>

      {/* ====== TIMELINE TAB ====== */}
      {tab === 'overview' && (
        <div className="space-y-3">
          <div className="flex gap-2 mb-4">
            <button onClick={() => setShowNewActivity(true)} className="btn-secondary btn-sm"><Plus className="w-3.5 h-3.5" /> Activity</button>
            <button onClick={() => setShowNewDeal(true)} className="btn-secondary btn-sm"><Plus className="w-3.5 h-3.5" /> {template.dealLabel.singular}</button>
            <button onClick={() => router.push(`/quotes?contact=${id}`)} className="btn-secondary btn-sm"><Plus className="w-3.5 h-3.5" /> Quote</button>
          </div>

          {timeline.length === 0 && (
            <div className="text-center py-12 card p-6">
              <Clock className="w-10 h-10 text-surface-300 mx-auto mb-3" />
              <p className="text-surface-600 font-medium">No activity yet</p>
              <p className="text-xs text-surface-400 mt-1">Create a {template.dealLabel.singular.toLowerCase()}, quote, or activity to start the timeline</p>
            </div>
          )}

          {timeline.map((item, i) => (
            <div key={`${item.type}-${item.data.id}`} className="flex gap-3">
              {/* Timeline line */}
              <div className="flex flex-col items-center">
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                  item.type === 'deal' ? 'bg-brand-50 text-brand-600' :
                  item.type === 'quote' ? 'bg-violet-50 text-violet-600' :
                  item.type === 'call_log' ? 'bg-orange-50 text-orange-600' :
                  item.type === 'email' ? ((item.data as EmailMessage).direction === 'inbound' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600') :
                  ACTIVITY_COLORS[(item.data as ActivityRow).type] || 'bg-surface-100 text-surface-500')}>
                  {item.type === 'deal' && <TrendingUp className="w-4 h-4" />}
                  {item.type === 'quote' && <FileText className="w-4 h-4" />}
                  {item.type === 'call_log' && <Phone className="w-4 h-4" />}
                  {item.type === 'email' && ((item.data as EmailMessage).direction === 'inbound' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />)}
                  {item.type === 'activity' && (() => {
                    const Icon = ACTIVITY_ICONS[(item.data as ActivityRow).type] || CheckSquare
                    return <Icon className="w-4 h-4" />
                  })()}
                </div>
                {i < timeline.length - 1 && <div className="w-0.5 flex-1 bg-surface-100 my-1" />}
              </div>

              {/* Content */}
              <div className="card p-4 flex-1 mb-1">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-surface-800">
                      {item.type === 'deal' && `${template.dealLabel.singular}: ${(item.data as DealRow).title}`}
                      {item.type === 'quote' && `Quote: ${(item.data as QuoteRow).title}`}
                      {item.type === 'activity' && (item.data as ActivityRow).title}
                      {item.type === 'email' && (item.data as EmailMessage).subject}
                      {item.type === 'call_log' && `Call (${Math.floor((item.data as CallLog).duration_seconds / 60)}m ${(item.data as CallLog).duration_seconds % 60}s)`}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-surface-400">{new Date(item.date).toLocaleDateString()} · {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {item.type === 'deal' && (
                        <>
                          {(item.data as DealRow).value && <span className="text-xs font-semibold text-surface-700">{formatCurrency((item.data as DealRow).value!)}</span>}
                          <span className={cn('badge text-[9px]',
                            (item.data as DealRow).status === 'won' ? 'badge-green' :
                            (item.data as DealRow).status === 'lost' ? 'badge-red' : 'badge-blue')}>
                            {(item.data as DealRow).status}
                          </span>
                        </>
                      )}
                      {item.type === 'quote' && (
                        <>
                          <span className="text-xs font-semibold text-surface-700">{formatCurrency((item.data as QuoteRow).total)}</span>
                          <span className={cn('badge text-[9px]',
                            (item.data as QuoteRow).status === 'accepted' ? 'badge-green' :
                            (item.data as QuoteRow).status === 'rejected' ? 'badge-red' :
                            (item.data as QuoteRow).status === 'sent' ? 'badge-blue' : 'badge-gray')}>
                            {(item.data as QuoteRow).status}
                          </span>
                        </>
                      )}
                      {item.type === 'activity' && (
                        <span className={cn('badge text-[9px]', (item.data as ActivityRow).done ? 'badge-green' : 'badge-gray')}>
                          {(item.data as ActivityRow).done ? 'Done' : (item.data as ActivityRow).type}
                        </span>
                      )}
                      {item.type === 'email' && (
                        <>
                          <span className="text-xs text-surface-500">
                            {(item.data as EmailMessage).direction === 'inbound'
                              ? `From: ${(item.data as EmailMessage).from_name || (item.data as EmailMessage).from_address}`
                              : `To: ${(item.data as EmailMessage).to_addresses?.[0]?.name || (item.data as EmailMessage).to_addresses?.[0]?.email || ''}`}
                          </span>
                          <span className={cn('badge text-[9px]',
                            (item.data as EmailMessage).direction === 'inbound' ? 'badge-blue' : 'badge-green')}>
                            {(item.data as EmailMessage).direction === 'inbound' ? 'Received' : 'Sent'}
                          </span>
                        </>
                      )}
                      {item.type === 'call_log' && (
                        <>
                          {(item.data as CallLog).sentiment && (
                            <span className={cn('badge text-[9px]',
                              (item.data as CallLog).sentiment === 'positive' ? 'badge-green' :
                              (item.data as CallLog).sentiment === 'negative' ? 'badge-red' : 'badge-gray')}>
                              {(item.data as CallLog).sentiment}
                            </span>
                          )}
                          {(item.data as CallLog).key_topics?.slice(0, 2).map((t, i) => (
                            <span key={i} className="badge badge-blue text-[9px]">{t}</span>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                  {item.type === 'activity' && (
                    <button onClick={() => toggleActivity(item.data.id, (item.data as ActivityRow).done)}
                      className={cn('w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                        (item.data as ActivityRow).done ? 'bg-emerald-500 border-emerald-500' : 'border-surface-300 hover:border-brand-400')}>
                      {(item.data as ActivityRow).done && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </button>
                  )}
                </div>
                {item.type === 'activity' && (item.data as ActivityRow).notes && (
                  <p className="text-xs text-surface-500 mt-2">{(item.data as ActivityRow).notes}</p>
                )}
                {item.type === 'email' && (item.data as EmailMessage).snippet && (
                  <p className="text-xs text-surface-500 mt-2 line-clamp-2">{(item.data as EmailMessage).snippet}</p>
                )}
                {item.type === 'call_log' && (item.data as CallLog).summary && (
                  <div className="mt-2">
                    <p className="text-xs text-surface-500">{(item.data as CallLog).summary}</p>
                    {(item.data as CallLog).next_actions?.length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        {(item.data as CallLog).next_actions.map((a, i) => (
                          <p key={i} className="text-[10px] text-brand-600 font-medium">→ {a}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ====== DEALS TAB ====== */}
      {tab === 'deals' && (
        <div>
          <button onClick={() => setShowNewDeal(true)} className="btn-primary btn-sm mb-4">
            <Plus className="w-3.5 h-3.5" /> New {template.dealLabel.singular}
          </button>
          {deals.length === 0 ? (
            <div className="text-center py-12 card p-6">
              <TrendingUp className="w-10 h-10 text-surface-300 mx-auto mb-3" />
              <p className="text-surface-600 font-medium">No {template.dealLabel.plural.toLowerCase()} yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {deals.map(deal => (
                <div key={deal.id} className="card p-4 flex items-center justify-between hover:shadow-card-hover transition-all cursor-pointer">
                  <div className="flex items-center gap-3">
                    {deal.pipeline_stages && (
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: deal.pipeline_stages.color }} />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-surface-800">{deal.title}</p>
                      <p className="text-xs text-surface-400">{deal.pipeline_stages?.name} · {new Date(deal.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {deal.value && <span className="text-sm font-bold text-surface-900">{formatCurrency(deal.value)}</span>}
                    <span className={cn('badge text-[10px]',
                      deal.status === 'won' ? 'badge-green' : deal.status === 'lost' ? 'badge-red' : 'badge-blue')}>
                      {deal.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ====== QUOTES TAB ====== */}
      {tab === 'quotes' && (
        <div>
          <button onClick={() => router.push(`/quotes?contact=${id}`)} className="btn-primary btn-sm mb-4">
            <Plus className="w-3.5 h-3.5" /> New Quote
          </button>
          {quotes.length === 0 ? (
            <div className="text-center py-12 card p-6">
              <FileText className="w-10 h-10 text-surface-300 mx-auto mb-3" />
              <p className="text-surface-600 font-medium">No quotes yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {quotes.map(quote => (
                <div key={quote.id} onClick={() => router.push(`/quotes?edit=${quote.id}`)}
                  className="card p-4 flex items-center justify-between hover:shadow-card-hover transition-all cursor-pointer">
                  <div>
                    <p className="text-sm font-semibold text-surface-800">{quote.title}</p>
                    <p className="text-xs text-surface-400">{quote.quote_number} · {new Date(quote.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-surface-900">{formatCurrency(quote.total)}</span>
                    <span className={cn('badge text-[10px]',
                      quote.status === 'accepted' ? 'badge-green' : quote.status === 'rejected' ? 'badge-red' :
                      quote.status === 'sent' ? 'badge-blue' : 'badge-gray')}>
                      {quote.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ====== ACTIVITIES TAB ====== */}
      {tab === 'activities' && (
        <div>
          <button onClick={() => setShowNewActivity(true)} className="btn-primary btn-sm mb-4">
            <Plus className="w-3.5 h-3.5" /> New Activity
          </button>
          {activities.length === 0 ? (
            <div className="text-center py-12 card p-6">
              <CheckSquare className="w-10 h-10 text-surface-300 mx-auto mb-3" />
              <p className="text-surface-600 font-medium">No activities yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activities.map(act => {
                const Icon = ACTIVITY_ICONS[act.type] || CheckSquare
                return (
                  <div key={act.id} className="card p-4 flex items-center gap-3">
                    <button onClick={() => toggleActivity(act.id, act.done)}
                      className={cn('w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                        act.done ? 'bg-emerald-500 border-emerald-500' : 'border-surface-300 hover:border-brand-400')}>
                      {act.done && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </button>
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', ACTIVITY_COLORS[act.type])}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium', act.done ? 'line-through text-surface-400' : 'text-surface-800')}>{act.title}</p>
                      {act.notes && <p className="text-xs text-surface-400 truncate">{act.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {act.due_date && (
                        <span className={cn('text-xs font-medium',
                          !act.done && new Date(act.due_date) < new Date() ? 'text-red-500' : 'text-surface-400')}>
                          {new Date(act.due_date).toLocaleDateString()}
                        </span>
                      )}
                      <span className={cn('badge text-[9px]', act.done ? 'badge-green' : 'badge-gray')}>{act.type}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ====== WHATSAPP TAB ====== */}
      {tab === 'whatsapp' && (
        <div className="card overflow-hidden" style={{ maxHeight: '70vh' }}>
          {waMessages.length === 0 ? (
            <div className="text-center py-12 px-6">
              <MessageCircle className="w-10 h-10 text-surface-300 mx-auto mb-3" />
              <p className="text-surface-600 font-medium">No WhatsApp messages</p>
              <p className="text-xs text-surface-400 mt-1">Connect WhatsApp in Integrations to auto-capture conversations</p>
            </div>
          ) : (
            <>
              {/* Chat messages */}
              <div className="p-4 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(70vh - 72px)' }}>
                {waMessages.map(msg => (
                  <div key={msg.id} className={cn('flex', msg.direction === 'outbound' ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm',
                      msg.direction === 'outbound'
                        ? 'bg-[#DCF8C6] rounded-tr-sm'
                        : 'bg-white border border-surface-100 rounded-tl-sm')}>
                      <p className="text-sm text-surface-800 whitespace-pre-wrap">{msg.body || `[${msg.message_type}]`}</p>
                      <div className="flex items-center justify-end gap-1.5 mt-1">
                        <span className="text-[10px] text-surface-400">
                          {new Date(msg.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {msg.direction === 'outbound' && (
                          <span className={cn('text-[10px]',
                            msg.status === 'read' ? 'text-blue-500' :
                            msg.status === 'delivered' ? 'text-surface-400' : 'text-surface-300')}>
                            {msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : msg.status === 'failed' ? '!' : '✓'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Send message */}
              {contact?.phone && (
                <div className="p-3 border-t border-surface-100 bg-surface-50 flex gap-2">
                  <input
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
                    className="btn-primary btn-sm px-4" style={{ backgroundColor: '#25D366' }}>
                    {waSending
                      ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <Send className="w-4 h-4" />}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ====== EMAILS TAB ====== */}
      {tab === 'emails' && (
        <div>
          {emails.length === 0 ? (
            <div className="text-center py-12 card p-6">
              <Mail className="w-10 h-10 text-surface-300 mx-auto mb-3" />
              <p className="text-surface-600 font-medium">No emails synced</p>
              <p className="text-xs text-surface-400 mt-1">Connect Gmail or Outlook in Integrations to auto-sync emails</p>
            </div>
          ) : (
            <div className="space-y-2">
              {emails.map(email => (
                <div key={email.id} className="card p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                      email.direction === 'inbound' ? 'bg-blue-50' : 'bg-emerald-50')}>
                      {email.direction === 'inbound'
                        ? <ArrowDownLeft className="w-4 h-4 text-blue-600" />
                        : <ArrowUpRight className="w-4 h-4 text-emerald-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-surface-800 truncate">{email.subject}</p>
                        <span className={cn('badge text-[9px] flex-shrink-0',
                          email.direction === 'inbound' ? 'badge-blue' : 'badge-green')}>
                          {email.direction === 'inbound' ? 'Received' : 'Sent'}
                        </span>
                      </div>
                      <p className="text-xs text-surface-500 mt-0.5">
                        {email.direction === 'inbound'
                          ? `From: ${email.from_name || email.from_address}`
                          : `To: ${email.to_addresses?.[0]?.name || email.to_addresses?.[0]?.email || ''}`}
                        {' · '}{new Date(email.received_at).toLocaleDateString()} {new Date(email.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {email.snippet && (
                        <p className="text-xs text-surface-400 mt-1.5 line-clamp-2">{email.snippet}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ====== NEW ACTIVITY MODAL ====== */}
      {showNewActivity && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100">
              <h2 className="font-semibold text-surface-900">New Activity</h2>
              <button onClick={() => setShowNewActivity(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex gap-1 p-1 bg-surface-100 rounded-xl">
                {['task','call','email','meeting','note'].map(t => (
                  <button key={t} onClick={() => setActType(t)}
                    className={cn('flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition-all',
                      actType === t ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500')}>
                    {t}
                  </button>
                ))}
              </div>
              <div>
                <label className="label">Title *</label>
                <input className="input" value={actTitle} onChange={e => setActTitle(e.target.value)} placeholder="e.g. Follow up call" />
              </div>
              <div>
                <label className="label">Due date</label>
                <input type="datetime-local" className="input" value={actDue} onChange={e => setActDue(e.target.value)} />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input resize-none" rows={2} value={actNotes} onChange={e => setActNotes(e.target.value)} placeholder="Additional notes..." />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowNewActivity(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={createActivity} disabled={!actTitle} className="btn-primary flex-1">Create</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====== NEW DEAL MODAL ====== */}
      {showNewDeal && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100">
              <h2 className="font-semibold text-surface-900">New {template.dealLabel.singular}</h2>
              <button onClick={() => setShowNewDeal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Title *</label>
                <input className="input" value={dealTitle} onChange={e => setDealTitle(e.target.value)} placeholder={`${template.dealLabel.singular} title`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Value</label>
                  <input className="input" type="number" value={dealValue} onChange={e => setDealValue(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label className="label">Stage</label>
                  <select className="input" value={dealStageId} onChange={e => setDealStageId(e.target.value)}>
                    {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowNewDeal(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={createDeal} disabled={!dealTitle} className="btn-primary flex-1">Create</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====== EDIT CONTACT MODAL ====== */}
      {editing && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-lg animate-slide-up max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-surface-100 flex-shrink-0">
              <h2 className="font-semibold text-surface-900">Edit {template.contactLabel.singular}</h2>
              <button onClick={() => setEditing(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="label">Name</label>
                <input className="input" value={editData.name || ''} onChange={e => setEditData(v => ({ ...v, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Email</label>
                  <input className="input" type="email" value={editData.email || ''} onChange={e => setEditData(v => ({ ...v, email: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input className="input" type="tel" value={editData.phone || ''} onChange={e => setEditData(v => ({ ...v, phone: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Company</label>
                  <input className="input" value={editData.company_name || ''} onChange={e => setEditData(v => ({ ...v, company_name: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Job Title</label>
                  <input className="input" value={editData.job_title || ''} onChange={e => setEditData(v => ({ ...v, job_title: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Website</label>
                <input className="input" value={editData.website || ''} onChange={e => setEditData(v => ({ ...v, website: e.target.value }))} />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input resize-none" rows={3} value={editData.notes || ''} onChange={e => setEditData(v => ({ ...v, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-surface-100 flex-shrink-0">
              <button onClick={() => setEditing(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={saveContact} disabled={saving} className="btn-primary flex-1">
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
