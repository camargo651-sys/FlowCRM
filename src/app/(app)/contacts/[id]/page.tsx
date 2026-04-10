'use client'
import { DbRow } from '@/types'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft, Mail, Phone, Building2, Globe, MapPin, Edit2, Save, X,
  Plus, FileText, TrendingUp, CheckSquare, Clock, MessageCircle,
  DollarSign, Calendar, User, Send, CheckCircle2, XCircle, Trash2,
  ArrowDownLeft, ArrowUpRight, Users, Kanban, ChevronDown, ChevronUp,
  Zap, PhoneCall, Target, AlertCircle
} from 'lucide-react'
import { formatCurrency, getInitials, cn, formatDate } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace-context'
import EmailComposer from '@/components/shared/EmailComposer'
import { computeFormulaField, FormulaConfig, describeFormula } from '@/lib/formula-engine'

interface ContactDetail {
  id: string; workspace_id: string; type: string; name: string;
  email?: string; phone?: string; company_name?: string; job_title?: string;
  website?: string; address?: string; notes?: string; tags?: string[];
  custom_fields?: DbRow; created_at: string; updated_at: string;
  social_profiles?: { instagram?: string; linkedin?: string; facebook?: string; tiktok?: string };
  owner_id?: string; engagement_score?: number; score_label?: string;
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
  user_id?: string;
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

interface SocialLead {
  id: string; platform: string; source_type: string; author_name: string;
  author_username: string; message: string | null; status: string;
  captured_at: string; created_at: string;
}

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
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

const ACTIVITY_ICONS: Record<string, typeof Phone> = {
  call: Phone, email: Mail, meeting: Calendar, note: FileText, task: CheckSquare, whatsapp: MessageCircle,
}
const ACTIVITY_COLORS: Record<string, string> = {
  call: 'bg-emerald-50 text-emerald-600', email: 'bg-blue-50 text-blue-600',
  meeting: 'bg-violet-50 text-violet-600', note: 'bg-amber-50 text-amber-600',
  task: 'bg-surface-100 text-surface-600', whatsapp: 'bg-green-50 text-green-600',
}

const AVATAR_COLORS = ['bg-brand-500','bg-violet-500','bg-emerald-500','bg-amber-500','bg-rose-500','bg-cyan-500']

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
  const [socialLeads, setSocialLeads] = useState<SocialLead[]>([])
  const [waSendText, setWaSendText] = useState('')
  const [waSending, setWaSending] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState<Partial<ContactDetail>>({})
  const [showNewActivity, setShowNewActivity] = useState(false)
  const [showNewDeal, setShowNewDeal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showEmailComposer, setShowEmailComposer] = useState(false)
  const [companyPeople, setCompanyPeople] = useState<{ id: string; name: string; job_title?: string; email?: string }[]>([])
  const [formulaValues, setFormulaValues] = useState<Record<string, number | string | null>>({})
  const [stages, setStages] = useState<{ id: string; name: string }[]>([])

  // Notes chat state
  const [noteText, setNoteText] = useState('')
  const [noteSending, setNoteSending] = useState(false)
  const notesEndRef = useRef<HTMLDivElement>(null)

  // WhatsApp collapsible
  const [waExpanded, setWaExpanded] = useState(true)
  const [waVisibleCount, setWaVisibleCount] = useState(30)
  const waEndRef = useRef<HTMLDivElement>(null)
  const waInputRef = useRef<HTMLInputElement>(null)

  // Email collapsible
  const [emailExpanded, setEmailExpanded] = useState(false)

  // Current user profile
  const [currentUserName, setCurrentUserName] = useState('You')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [profileMap, setProfileMap] = useState<Record<string, string>>({})

  // New activity form
  const [actType, setActType] = useState('task')
  const [actTitle, setActTitle] = useState('')
  const [actNotes, setActNotes] = useState('')
  const [actDue, setActDue] = useState('')

  // New deal form
  const [dealTitle, setDealTitle] = useState('')
  const [dealValue, setDealValue] = useState('')
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

      // Company hierarchy: if company, load people with matching company_name
      if (contactRes.data.type === 'company') {
        const { data: people } = await supabase
          .from('contacts')
          .select('id, name, job_title, email')
          .eq('workspace_id', contactRes.data.workspace_id)
          .eq('type', 'person')
          .eq('company_name', contactRes.data.name)
          .order('name')
          .limit(50)
        setCompanyPeople(people || [])
      } else {
        setCompanyPeople([])
      }

      // Load profiles for the workspace (for note author names)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('workspace_id', contactRes.data.workspace_id)
      if (profiles) {
        const map: Record<string, string> = {}
        profiles.forEach((p: { id: string; full_name?: string; email?: string }) => {
          map[p.id] = p.full_name || p.email || 'Unknown'
        })
        setProfileMap(map)
      }
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

    // Load social leads converted from this contact
    const { data: socialData } = await supabase
      .from('social_leads')
      .select('id, platform, source_type, author_name, author_username, message, status, captured_at, created_at')
      .eq('contact_id', id)
      .order('created_at', { ascending: false })
      .limit(50)
    setSocialLeads(socialData || [])

    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  // Load current user
  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        const { data: profile } = await supabase.from('profiles').select('full_name, email').eq('id', user.id).single()
        if (profile) setCurrentUserName(profile.full_name || profile.email || 'You')
      }
    }
    loadUser()
  }, [])

  // Auto-scroll notes to bottom
  useEffect(() => {
    notesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activities])

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

  // Send note as chat message (activity type='note')
  const sendNote = async () => {
    if (!noteText.trim() || !contact) return
    setNoteSending(true)
    const { data } = await supabase.from('activities').insert([{
      workspace_id: contact.workspace_id,
      contact_id: id,
      type: 'note',
      title: noteText.trim(),
      notes: null,
      done: false,
    }]).select().single()
    if (data) setActivities(prev => [data, ...prev])
    setNoteText('')
    setNoteSending(false)
  }

  // Log a call activity quickly
  const logCall = async () => {
    if (!contact) return
    const { data } = await supabase.from('activities').insert([{
      workspace_id: contact.workspace_id,
      contact_id: id,
      type: 'call',
      title: `Call with ${contact.name}`,
      done: true,
    }]).select().single()
    if (data) setActivities(prev => [data, ...prev])
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

  // Compute formula fields
  useEffect(() => {
    if (!contact) return
    const formulaFields = contactCustomFields.filter(f => f.type === 'formula' && f.options && f.options.length > 0)
    if (formulaFields.length === 0) return

    const compute = async () => {
      const results: Record<string, number | string | null> = {}
      for (const field of formulaFields) {
        try {
          const config = JSON.parse(field.options![0]) as FormulaConfig
          if (config.type === 'formula') {
            results[field.key] = await computeFormulaField(supabase, config, contact.id, 'contact', contact.workspace_id)
          }
        } catch {}
      }
      setFormulaValues(results)
    }
    compute()
  }, [contact, contactCustomFields.length])

  // Computed stats from existing data
  const totalDeals = deals.length
  const totalDealsValue = deals.reduce((s, d) => s + (d.value || 0), 0)
  const wonDeals = deals.filter(d => d.status === 'won')
  const wonDealsValue = wonDeals.reduce((s, d) => s + (d.value || 0), 0)
  const openQuotes = quotes.filter(q => q.status === 'draft' || q.status === 'sent')
  const openQuotesValue = openQuotes.reduce((s, q) => s + (q.total || 0), 0)
  // Outstanding invoices - approximate from accepted quotes
  const outstandingQuotes = quotes.filter(q => q.status === 'accepted')
  const outstandingValue = outstandingQuotes.reduce((s, q) => s + (q.total || 0), 0)
  // Last interaction
  const allDates = [
    ...activities.map(a => a.created_at),
    ...emails.map(e => e.received_at),
    ...waMessages.map(m => m.received_at),
    ...callLogs.map(c => c.started_at),
  ].filter(Boolean)
  const lastInteraction = allDates.length > 0
    ? allDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
    : null
  // Engagement score
  const scoreLabel = contact?.score_label || (
    contact?.engagement_score != null
      ? contact.engagement_score >= 70 ? 'hot' : contact.engagement_score >= 40 ? 'warm' : 'cold'
      : allDates.length > 10 ? 'warm' : 'cold'
  )

  // Notes (activities of type='note'), sorted oldest first for chat view
  const noteActivities = activities
    .filter(a => a.type === 'note')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  // Visible WA messages (last N)
  const visibleWaMessages = waMessages.slice(Math.max(0, waMessages.length - waVisibleCount))
  const hasMoreWa = waMessages.length > waVisibleCount

  if (loading || !contact) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  const avatarColor = AVATAR_COLORS[contact.name.charCodeAt(0) % AVATAR_COLORS.length]

  return (
    <div className="animate-fade-in">
      {/* Back button */}
      <button onClick={() => router.push('/contacts')} className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700 mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to {template.contactLabel.plural}
      </button>

      {/* ====== TWO-COLUMN LAYOUT ====== */}
      <div className="flex flex-col lg:flex-row gap-6">

        {/* ====== LEFT COLUMN (60%) ====== */}
        <div className="w-full lg:w-[60%] space-y-6">

          {/* Header card */}
          <div className="card p-6">
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
                {/* Social profile badges */}
                {contact.social_profiles && Object.keys(contact.social_profiles).some(k => (contact.social_profiles as Record<string, string>)?.[k]) && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {contact.social_profiles.instagram && (
                      <a href={contact.social_profiles.instagram.startsWith('http') ? contact.social_profiles.instagram : `https://instagram.com/${contact.social_profiles.instagram}`}
                        target="_blank" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-pink-100 text-pink-700 hover:bg-pink-200 transition-colors">
                        Instagram
                      </a>
                    )}
                    {contact.social_profiles.linkedin && (
                      <a href={contact.social_profiles.linkedin.startsWith('http') ? contact.social_profiles.linkedin : `https://linkedin.com/in/${contact.social_profiles.linkedin}`}
                        target="_blank" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors">
                        LinkedIn
                      </a>
                    )}
                    {contact.social_profiles.facebook && (
                      <a href={contact.social_profiles.facebook.startsWith('http') ? contact.social_profiles.facebook : `https://facebook.com/${contact.social_profiles.facebook}`}
                        target="_blank" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors">
                        Facebook
                      </a>
                    )}
                    {contact.social_profiles.tiktok && (
                      <a href={contact.social_profiles.tiktok.startsWith('http') ? contact.social_profiles.tiktok : `https://tiktok.com/@${contact.social_profiles.tiktok}`}
                        target="_blank" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-900 text-white hover:bg-surface-700 transition-colors">
                        TikTok
                      </a>
                    )}
                  </div>
                )}
              </div>
              <button onClick={() => setEditing(true)} className="btn-secondary btn-sm flex-shrink-0">
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </button>
            </div>
          </div>

          {/* Stats / KPIs bar */}
          <div className="card p-4">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              <div className="text-center">
                <p className="text-lg font-bold text-surface-900">{totalDeals}</p>
                <p className="text-[10px] text-surface-400 font-semibold uppercase">{template.dealLabel.plural}</p>
                <p className="text-[10px] text-surface-500">{formatCurrency(totalDealsValue)}</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-emerald-600">{wonDeals.length}</p>
                <p className="text-[10px] text-surface-400 font-semibold uppercase">Won</p>
                <p className="text-[10px] text-emerald-600">{formatCurrency(wonDealsValue)}</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-surface-900">{openQuotes.length}</p>
                <p className="text-[10px] text-surface-400 font-semibold uppercase">Open Quotes</p>
                <p className="text-[10px] text-surface-500">{formatCurrency(openQuotesValue)}</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-amber-600">{outstandingQuotes.length}</p>
                <p className="text-[10px] text-surface-400 font-semibold uppercase">Outstanding</p>
                <p className="text-[10px] text-amber-600">{formatCurrency(outstandingValue)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-surface-700">{lastInteraction ? timeAgo(lastInteraction) : 'Never'}</p>
                <p className="text-[10px] text-surface-400 font-semibold uppercase">Last Activity</p>
              </div>
              <div className="text-center">
                <span className={cn('inline-block px-2.5 py-1 rounded-full text-xs font-bold',
                  scoreLabel === 'hot' ? 'bg-red-100 text-red-700' :
                  scoreLabel === 'warm' ? 'bg-amber-100 text-amber-700' :
                  'bg-blue-100 text-blue-700')}>
                  {scoreLabel === 'hot' ? 'Hot' : scoreLabel === 'warm' ? 'Warm' : 'Cold'}
                </span>
                <p className="text-[10px] text-surface-400 font-semibold uppercase mt-1">Score</p>
              </div>
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => router.push(`/quotes?contact=${id}`)} className="btn-secondary btn-sm">
              <FileText className="w-3.5 h-3.5" /> New Quote
            </button>
            <button onClick={() => setShowNewDeal(true)} className="btn-secondary btn-sm">
              <TrendingUp className="w-3.5 h-3.5" /> New {template.dealLabel.singular}
            </button>
            <button onClick={() => { setWaExpanded(true); setTimeout(() => waInputRef.current?.focus(), 100) }} className="btn-secondary btn-sm">
              <MessageCircle className="w-3.5 h-3.5" /> Send WhatsApp
            </button>
            {contact.email && (
              <button onClick={() => setShowEmailComposer(true)} className="btn-secondary btn-sm">
                <Send className="w-3.5 h-3.5" /> Send Email
              </button>
            )}
            <button onClick={() => setShowNewActivity(true)} className="btn-secondary btn-sm">
              <CheckSquare className="w-3.5 h-3.5" /> Add Task
            </button>
            <button onClick={logCall} className="btn-secondary btn-sm">
              <PhoneCall className="w-3.5 h-3.5" /> Log Call
            </button>
          </div>

          {/* Formula / Computed Fields */}
          {contactCustomFields.filter(f => f.type === 'formula').length > 0 && (
            <div className="card p-4">
              <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-3">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-violet-200 text-violet-700 text-[8px] font-bold mr-1.5">fx</span>
                Computed Fields
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {contactCustomFields.filter(f => f.type === 'formula').map(field => {
                  const val = formulaValues[field.key]
                  const displayVal = val !== null && val !== undefined ? (typeof val === 'number' ? val.toLocaleString() : String(val)) : '...'
                  return (
                    <div key={field.key} className="p-3 rounded-xl bg-violet-50 border border-violet-100">
                      <p className="text-[10px] text-violet-500 font-medium mb-0.5">{field.label}</p>
                      <p className="text-lg font-bold text-violet-900">{displayVal}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Deals Section (compact) */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide">
                <Kanban className="w-3.5 h-3.5 inline mr-1" />
                {template.dealLabel.plural} ({deals.length})
              </h3>
              <button onClick={() => router.push('/pipeline')} className="text-[10px] text-brand-600 hover:underline font-medium">View all</button>
            </div>
            {deals.length === 0 ? (
              <p className="text-sm text-surface-400 py-4 text-center">No {template.dealLabel.plural.toLowerCase()} yet</p>
            ) : (
              <div className="space-y-1.5">
                {deals.map(deal => (
                  <div key={deal.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/pipeline?deal=${deal.id}`)}>
                    <div className="flex items-center gap-2 min-w-0">
                      {deal.pipeline_stages && (
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: deal.pipeline_stages.color }} />
                      )}
                      <p className="text-sm font-medium text-surface-800 truncate">{deal.title}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {deal.value != null && <span className="text-xs font-semibold text-surface-700">{formatCurrency(deal.value)}</span>}
                      <span className={cn('badge text-[9px]',
                        deal.status === 'won' ? 'badge-green' : deal.status === 'lost' ? 'badge-red' : 'badge-blue')}>
                        {deal.status}
                      </span>
                      <span className="text-[10px] text-surface-400">{timeAgo(deal.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quotes Section (compact) */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide">
                <FileText className="w-3.5 h-3.5 inline mr-1" />
                Quotes ({quotes.length})
              </h3>
              <button onClick={() => router.push('/quotes')} className="text-[10px] text-brand-600 hover:underline font-medium">View all</button>
            </div>
            {quotes.length === 0 ? (
              <p className="text-sm text-surface-400 py-4 text-center">No quotes yet</p>
            ) : (
              <div className="space-y-1.5">
                {quotes.map(quote => (
                  <div key={quote.id} onClick={() => router.push(`/quotes?edit=${quote.id}`)}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface-50 transition-colors cursor-pointer">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-surface-800 truncate">{quote.title}</p>
                      <p className="text-[10px] text-surface-400">{quote.quote_number} · {new Date(quote.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-xs font-semibold text-surface-700">{formatCurrency(quote.total)}</span>
                      <span className={cn('badge text-[9px]',
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

          {/* Company Hierarchy */}
          {contact.type === 'company' && companyPeople.length > 0 && (
            <div className="card p-4">
              <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-3">
                <Users className="w-3.5 h-3.5 inline mr-1" /> People at {contact.name} ({companyPeople.length})
              </h3>
              <div className="space-y-2">
                {companyPeople.map(p => (
                  <div key={p.id} onClick={() => router.push(`/contacts/${p.id}`)}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-50 cursor-pointer transition-colors">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${AVATAR_COLORS[p.name.charCodeAt(0) % AVATAR_COLORS.length]}`}>
                      {getInitials(p.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-surface-800 truncate">{p.name}</p>
                      {p.job_title && <p className="text-[10px] text-surface-400">{p.job_title}</p>}
                    </div>
                    {p.email && <p className="text-[10px] text-brand-600 ml-auto truncate">{p.email}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {contact.type === 'person' && contact.company_name && (
            <div className="card p-4">
              <p className="text-xs text-surface-500">
                Works at{' '}
                <button onClick={() => router.push(`/contacts?company=${encodeURIComponent(contact.company_name!)}`)}
                  className="text-brand-600 font-semibold hover:underline">
                  {contact.company_name}
                </button>
              </p>
            </div>
          )}

        </div>
        {/* END LEFT COLUMN */}

        {/* ====== RIGHT COLUMN (40%) - Sticky Interaction Hub ====== */}
        <div className="w-full lg:w-[40%]">
          <div className="lg:sticky lg:top-4 space-y-4">

            {/* Notes Chat Feed */}
            <div className="card overflow-hidden flex flex-col" style={{ maxHeight: '50vh' }}>
              <div className="px-4 py-3 border-b border-surface-100 bg-surface-50 flex-shrink-0">
                <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
                  <FileText className="w-3.5 h-3.5 inline mr-1" /> Notes ({noteActivities.length})
                </h3>
              </div>

              {/* Chat messages area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[120px]">
                {noteActivities.length === 0 && (
                  <p className="text-sm text-surface-400 text-center py-8">No notes yet. Start the conversation.</p>
                )}
                {noteActivities.map(note => {
                  const authorName = note.user_id ? (profileMap[note.user_id] || currentUserName) : currentUserName
                  return (
                    <div key={note.id} className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-full bg-surface-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <User className="w-3 h-3 text-surface-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="bg-surface-100 rounded-2xl rounded-tl-sm px-3 py-2">
                          <p className="text-sm text-surface-800 whitespace-pre-wrap">{note.title}</p>
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

              {/* Note input */}
              <div className="p-3 border-t border-surface-100 bg-surface-50 flex gap-2 flex-shrink-0">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="Add a note..."
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey && noteText.trim()) {
                      e.preventDefault()
                      sendNote()
                    }
                  }}
                />
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
                      {contact.phone && (
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
                          <button
                            onClick={() => setWaVisibleCount(prev => prev + 30)}
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

                      {/* Send WA message */}
                      {contact.phone && (
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

            {/* Email History (collapsible, compact) */}
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
                      <p className="text-[10px] text-surface-400 mt-1">Connect Gmail or Outlook in Integrations</p>
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

      {/* Email Composer Modal */}
      {showEmailComposer && contact.email && (
        <div className="modal-overlay">
          <div className="modal-panel max-w-lg">
            <EmailComposer
              contactId={contact.id}
              contactEmail={contact.email}
              contactName={contact.name}
              onSent={() => { load() }}
              onClose={() => setShowEmailComposer(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
