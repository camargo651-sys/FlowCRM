'use client'
import { DbRow } from '@/types'
import { toast } from 'sonner'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft, UserPlus, DollarSign, MessageCircle, User, X,
  ExternalLink, Phone, Mail, Clock, AlertCircle, CheckCircle,
  Send, ChevronDown, ChevronUp, Link2, Tag, Hash, FileText
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getActiveWorkspace } from '@/lib/get-active-workspace'

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📸', facebook: '📘', tiktok: '🎵', linkedin: '💼', twitter: '🐦', youtube: '📺', other: '🌐',
}
const STATUS_STYLES: Record<string, string> = {
  new: 'badge-blue', contacted: 'badge-yellow', qualified: 'badge-violet', converted: 'badge-green', discarded: 'badge-gray', incomplete: 'badge-orange',
}

interface WhatsAppMessage {
  id: string; wamid: string; from_number: string; to_number: string;
  direction: 'inbound' | 'outbound'; message_type: string;
  body: string | null; status: string; received_at: string;
}

interface ActivityRow {
  id: string; type: string; title: string; notes?: string;
  due_date?: string; done: boolean; created_at: string;
  metadata?: DbRow; user_id?: string;
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
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

export default function LeadDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()

  const [lead, setLead] = useState<DbRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState<DbRow[]>([])
  const [currentUserId, setCurrentUserId] = useState('')

  // Convert to Deal modal
  const [showDealModal, setShowDealModal] = useState(false)
  const [dealForm, setDealForm] = useState({ title: '', value: '', pipeline_id: '', stage_id: '' })
  const [pipelines, setPipelines] = useState<DbRow[]>([])
  const [stages, setStages] = useState<DbRow[]>([])

  // Assign dropdown
  const [showAssign, setShowAssign] = useState(false)
  const assignRef = useRef<HTMLDivElement>(null)

  // Notes
  const [noteText, setNoteText] = useState('')
  const [noteSending, setNoteSending] = useState(false)

  // Activities (for converted leads with contact_id)
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const notesEndRef = useRef<HTMLDivElement>(null)

  // WhatsApp
  const [waMessages, setWaMessages] = useState<WhatsAppMessage[]>([])
  const [waExpanded, setWaExpanded] = useState(false)
  const [waSendText, setWaSendText] = useState('')
  const [waSending, setWaSending] = useState(false)
  const waInputRef = useRef<HTMLInputElement>(null)

  // Related leads
  const [relatedLeads, setRelatedLeads] = useState<DbRow[]>([])

  // Converted info
  const [convertedContact, setConvertedContact] = useState<DbRow | null>(null)
  const [convertedDeal, setConvertedDeal] = useState<DbRow | null>(null)

  // Profile map for note authors
  const [profileMap, setProfileMap] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUserId(user.id)

    const { data: leadData } = await supabase.from('social_leads').select('*').eq('id', id).single()
    if (!leadData) { setLoading(false); return }
    setLead(leadData)

    const wsId = leadData.workspace_id

    // Load pipelines, stages, profiles in parallel
    const [pipelinesRes, stagesRes, profilesRes] = await Promise.all([
      supabase.from('pipelines').select('*').eq('workspace_id', wsId).order('order_index'),
      supabase.from('pipeline_stages').select('*').eq('workspace_id', wsId).order('order_index'),
      supabase.from('profiles').select('id, full_name, email').eq('workspace_id', wsId),
    ])
    setPipelines(pipelinesRes.data || [])
    setStages(stagesRes.data || [])
    setProfiles(profilesRes.data || [])

    // Build profile map
    if (profilesRes.data) {
      const map: Record<string, string> = {}
      profilesRes.data.forEach((p: DbRow) => { map[p.id] = p.full_name || p.email || 'Unknown' })
      setProfileMap(map)
    }

    // Load related leads (same author_username or platform)
    if (leadData.author_username) {
      const { data: related } = await supabase.from('social_leads').select('id, author_name, author_username, platform, status, created_at, source_type')
        .eq('workspace_id', wsId)
        .eq('author_username', leadData.author_username)
        .neq('id', leadData.id)
        .order('created_at', { ascending: false })
        .limit(10)
      setRelatedLeads(related || [])
    }

    // If converted, load contact and deal info
    if (leadData.contact_id) {
      const [contactRes, activitiesRes, waRes] = await Promise.all([
        supabase.from('contacts').select('id, name, email, phone').eq('id', leadData.contact_id).single(),
        supabase.from('activities').select('*').eq('contact_id', leadData.contact_id).order('created_at', { ascending: false }),
        supabase.from('whatsapp_messages').select('id, wamid, from_number, to_number, direction, message_type, body, status, received_at')
          .eq('contact_id', leadData.contact_id).order('received_at', { ascending: true }).limit(100),
      ])
      if (contactRes.data) setConvertedContact(contactRes.data)
      setActivities(activitiesRes.data || [])
      setWaMessages(waRes.data || [])
    }

    if (leadData.deal_id) {
      const { data: dealData } = await supabase.from('deals').select('id, title, value, status').eq('id', leadData.deal_id).single()
      if (dealData) setConvertedDeal(dealData)
    }

    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  // Close assign dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (showAssign && assignRef.current && !assignRef.current.contains(e.target as Node)) {
        setShowAssign(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showAssign])

  // Auto-scroll notes
  useEffect(() => {
    notesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activities])

  const getAssigneeName = (userId: string | null) => {
    if (!userId) return null
    const profile = profiles.find(p => p.id === userId)
    return profile?.full_name || profile?.email || 'Unknown'
  }

  const updateStatus = async (status: string) => {
    if (!lead) return
    if (status === 'qualified' || status === 'converted') {
      try {
        const res = await fetch('/api/leads/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId: lead.id, status }),
        })
        const data = await res.json()
        if (!data.success) { toast.error(data.error || 'Failed'); return }
      } catch { toast.error('Failed'); return }
    } else {
      await supabase.from('social_leads').update({ status }).eq('id', lead.id)
    }
    toast.success(`Lead marked as ${status}`)
    load()
  }

  const convertToContact = async () => {
    if (!lead) return
    const { data: contact } = await supabase.from('contacts').insert({
      workspace_id: lead.workspace_id, name: lead.author_name,
      notes: `From ${lead.platform}: ${lead.message || ''}`,
      tags: [lead.platform, 'social-lead'],
      type: 'person',
    }).select('id').single()

    if (contact) {
      await supabase.from('social_leads').update({ status: 'converted', contact_id: contact.id }).eq('id', lead.id)
      toast.success(`${lead.author_name} converted to contact`)
      load()
    }
  }

  const openDealModal = () => {
    if (!lead) return
    setDealForm({
      title: lead.message ? lead.message.slice(0, 80) : `Deal from ${lead.author_name}`,
      value: '',
      pipeline_id: pipelines[0]?.id || '',
      stage_id: stages.filter((s: DbRow) => s.pipeline_id === pipelines[0]?.id)[0]?.id || '',
    })
    setShowDealModal(true)
  }

  const convertToDeal = async () => {
    if (!lead || !dealForm.pipeline_id || !dealForm.stage_id) return

    // Create contact if not already converted
    let contactId = lead.contact_id
    if (!contactId) {
      const { data: contact } = await supabase.from('contacts').insert({
        workspace_id: lead.workspace_id, name: lead.author_name,
        notes: `From ${lead.platform}: ${lead.message || ''}`,
        tags: [lead.platform, 'social-lead'],
        type: 'person',
      }).select('id').single()
      if (!contact) return
      contactId = contact.id
    }

    const { data: deal } = await supabase.from('deals').insert({
      workspace_id: lead.workspace_id,
      title: dealForm.title || `Deal from ${lead.author_name}`,
      value: dealForm.value ? parseFloat(dealForm.value) : null,
      pipeline_id: dealForm.pipeline_id,
      stage_id: dealForm.stage_id,
      contact_id: contactId,
      owner_id: currentUserId,
    }).select('id').single()

    await supabase.from('social_leads').update({
      status: 'converted',
      contact_id: contactId,
      deal_id: deal?.id || null,
    }).eq('id', lead.id)

    toast.success(`${lead.author_name} converted to contact + deal`)
    setShowDealModal(false)
    load()
  }

  const assignLead = async (userId: string | null) => {
    if (!lead) return
    await supabase.from('social_leads').update({ assigned_to: userId }).eq('id', lead.id)
    toast.success(userId ? 'Lead assigned' : 'Lead unassigned')
    setShowAssign(false)
    load()
  }

  // Notes: parse lead.notes as entries or add new
  const parseNotes = (notesStr: string | null): { text: string; at: string }[] => {
    if (!notesStr) return []
    try {
      const parsed = JSON.parse(notesStr)
      if (Array.isArray(parsed)) return parsed
    } catch {}
    // Plain string note
    return notesStr ? [{ text: notesStr, at: lead?.created_at || new Date().toISOString() }] : []
  }

  const sendNote = async () => {
    if (!noteText.trim() || !lead) return
    setNoteSending(true)

    if (lead.contact_id) {
      // Add as activity note
      const { data } = await supabase.from('activities').insert([{
        workspace_id: lead.workspace_id,
        contact_id: lead.contact_id,
        type: 'note',
        title: noteText.trim(),
        notes: null,
        done: false,
      }]).select().single()
      if (data) setActivities(prev => [data, ...prev])
    } else {
      // Save to lead.notes as JSON array
      const existing = parseNotes(lead.notes)
      const updated = [...existing, { text: noteText.trim(), at: new Date().toISOString() }]
      await supabase.from('social_leads').update({ notes: JSON.stringify(updated) }).eq('id', lead.id)
      setLead((prev: DbRow | null) => prev ? { ...prev, notes: JSON.stringify(updated) } : null)
    }

    setNoteText('')
    setNoteSending(false)
  }

  const handleWaSend = async () => {
    if (!waSendText.trim() || !lead?.contact_id) return
    setWaSending(true)
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: lead.contact_id, message: waSendText.trim() }),
      })
      if (res.ok) {
        const { message: stored } = await res.json()
        if (stored) setWaMessages(prev => [...prev, stored])
        setWaSendText('')
      }
    } catch {}
    setWaSending(false)
  }

  // Helpers
  const getLeadPhone = (): string | null => lead?.metadata?.phone || null
  const getLeadEmail = (): string | null => lead?.metadata?.email || null

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>
  if (!lead) return <div className="flex items-center justify-center h-64"><p className="text-surface-500">Lead not found</p></div>

  const days = daysSince(lead.created_at)
  const hours = Math.floor((Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60))
  const ageColor = days < 1 ? 'bg-green-100 text-green-700' : days <= 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
  const ageLabel = days < 1 ? `${hours}h` : `${days}d`
  const phone = getLeadPhone()
  const email = getLeadEmail()
  const leadNotes = parseNotes(lead.notes)
  const noteActivities = activities.filter(a => a.type === 'note').sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  return (
    <div className="animate-fade-in">
      {/* Back button */}
      <button onClick={() => router.push('/leads')} className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700 mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Leads
      </button>

      {/* TWO-COLUMN LAYOUT */}
      <div className="flex flex-col lg:flex-row gap-6">

        {/* LEFT COLUMN (60%) */}
        <div className="w-full lg:w-[60%] space-y-6">

          {/* 1. Header card */}
          <div className="card p-6">
            <div className="flex items-start gap-4">
              <span className="text-3xl">{PLATFORM_ICONS[lead.platform] || '🌐'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-surface-900">{lead.author_name}</h1>
                  {lead.author_username && <span className="text-sm text-surface-400">@{lead.author_username}</span>}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-100 text-surface-600">
                    {PLATFORM_ICONS[lead.platform] || '🌐'} {lead.platform}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-100 text-surface-500">
                    {lead.source_type}
                  </span>
                  <span className={cn('badge text-[10px]', STATUS_STYLES[lead.status])}>{lead.status}</span>
                  {lead.assigned_to && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full font-semibold">
                      <User className="w-2.5 h-2.5" /> {getAssigneeName(lead.assigned_to)}
                    </span>
                  )}
                </div>
                {lead.post_url && (
                  <a href={lead.post_url} target="_blank" className="flex items-center gap-1 text-xs text-brand-600 hover:underline mt-2">
                    <ExternalLink className="w-3 h-3" /> View original post
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* 2. KPI Stats Bar */}
          <div className="card p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-bold', ageColor)}>
                  {hours >= 24 && days > 3 && <AlertCircle className="w-3.5 h-3.5" />}
                  {ageLabel}
                </span>
                <p className="text-[10px] text-surface-400 font-semibold uppercase mt-1">Lead Age</p>
              </div>
              <div className="text-center">
                <span className={cn('badge text-xs', STATUS_STYLES[lead.status])}>{lead.status}</span>
                <p className="text-[10px] text-surface-400 font-semibold uppercase mt-1">Status</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-surface-700">{PLATFORM_ICONS[lead.platform]} {lead.platform}</p>
                <p className="text-[10px] text-surface-400 font-semibold uppercase mt-0.5">{lead.source_type}</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-surface-700">
                  {lead.assigned_to ? getAssigneeName(lead.assigned_to) : <span className="text-surface-300">Unassigned</span>}
                </p>
                <p className="text-[10px] text-surface-400 font-semibold uppercase mt-0.5">Assigned To</p>
              </div>
            </div>
          </div>

          {/* 3. Quick Actions Bar */}
          <div className="flex flex-wrap gap-2">
            {lead.status !== 'converted' && lead.status !== 'discarded' && (
              <button onClick={convertToContact} className="btn-primary btn-sm">
                <UserPlus className="w-3.5 h-3.5" /> Convert to Contact
              </button>
            )}
            {lead.status !== 'converted' && lead.status !== 'discarded' && pipelines.length > 0 && (
              <button onClick={openDealModal} className="btn-secondary btn-sm">
                <DollarSign className="w-3.5 h-3.5" /> Convert to Deal
              </button>
            )}
            {phone && (
              <button onClick={() => { setWaExpanded(true); setTimeout(() => waInputRef.current?.focus(), 100) }} className="btn-sm bg-green-600 text-white text-xs rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5" /> Send WhatsApp
              </button>
            )}
            <div className="relative" ref={assignRef}>
              <button onClick={() => setShowAssign(!showAssign)} className="btn-secondary btn-sm">
                <User className="w-3.5 h-3.5" /> Assign
              </button>
              {showAssign && (
                <div className="absolute left-0 top-9 z-30 bg-white border border-surface-200 rounded-xl shadow-lg py-1 min-w-[180px]">
                  <button onClick={() => assignLead(null)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-surface-50">Unassign</button>
                  <button onClick={() => assignLead(currentUserId)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-surface-50 font-medium">Assign to me</button>
                  <div className="border-t border-surface-100 my-1" />
                  {profiles.filter(p => p.id !== currentUserId).map(p => (
                    <button key={p.id} onClick={() => assignLead(p.id)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-surface-50">
                      {p.full_name || p.email}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {lead.status !== 'qualified' && lead.status !== 'converted' && lead.status !== 'discarded' && (
              <button onClick={() => updateStatus('qualified')} className="btn-secondary btn-sm">
                <CheckCircle className="w-3.5 h-3.5" /> Qualify
              </button>
            )}
            {lead.status !== 'discarded' && lead.status !== 'converted' && (
              <button onClick={() => updateStatus('discarded')} className="btn-sm text-xs rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5 border border-red-200 text-red-600 hover:bg-red-50">
                <X className="w-3.5 h-3.5" /> Discard
              </button>
            )}
          </div>

          {/* 4. Lead Message */}
          {lead.message && (
            <div className="card p-5">
              <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-3">Original Message</h3>
              <p className="text-sm text-surface-700 whitespace-pre-wrap leading-relaxed">{lead.message}</p>
              <p className="text-[10px] text-surface-300 mt-3">{new Date(lead.captured_at || lead.created_at).toLocaleString()}</p>
            </div>
          )}

          {/* 5. Metadata Section */}
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-3">Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-green-500" />
                  <a href={`tel:${phone}`} className="text-sm text-surface-700 hover:text-brand-600">{phone}</a>
                </div>
              )}
              {email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-blue-500" />
                  <a href={`mailto:${email}`} className="text-sm text-surface-700 hover:text-brand-600">{email}</a>
                </div>
              )}
              {lead.post_url && (
                <div className="flex items-center gap-2">
                  <Link2 className="w-3.5 h-3.5 text-surface-400" />
                  <a href={lead.post_url} target="_blank" className="text-sm text-brand-600 hover:underline truncate">{lead.post_url}</a>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-surface-400" />
                <span className="text-sm text-surface-600">{lead.platform} / {lead.source_type}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-surface-400" />
                <span className="text-sm text-surface-600">Created {new Date(lead.created_at).toLocaleString()}</span>
              </div>
              {lead.author_username && (
                <div className="flex items-center gap-2">
                  <Hash className="w-3.5 h-3.5 text-surface-400" />
                  <span className="text-sm text-surface-600">@{lead.author_username}</span>
                </div>
              )}
            </div>

            {/* Additional metadata */}
            {lead.metadata && Object.keys(lead.metadata).filter(k => k !== 'phone' && k !== 'email' && k !== 'has_phone').length > 0 && (
              <div className="mt-4 pt-4 border-t border-surface-100">
                <h4 className="text-[10px] font-semibold text-surface-400 uppercase tracking-wide mb-2">Additional Data</h4>
                <div className="space-y-1">
                  {Object.entries(lead.metadata).filter(([k]) => k !== 'phone' && k !== 'email' && k !== 'has_phone').map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-[11px] text-surface-400 font-medium min-w-[80px]">{key}:</span>
                      <span className="text-[11px] text-surface-600">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Duplicate/additional messages */}
            {lead.metadata?.additional_messages && Array.isArray(lead.metadata.additional_messages) && (
              <div className="mt-4 pt-4 border-t border-surface-100">
                <h4 className="text-[10px] font-semibold text-surface-400 uppercase tracking-wide mb-2">Additional Messages (duplicates)</h4>
                <div className="space-y-2">
                  {lead.metadata.additional_messages.map((msg: string, i: number) => (
                    <p key={i} className="text-xs text-surface-600 bg-surface-50 rounded-lg p-2">{msg}</p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 6. Converted Info */}
          {lead.status === 'converted' && (convertedContact || convertedDeal) && (
            <div className="card p-5 bg-green-50 border-green-200">
              <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" /> Converted
              </h3>
              <div className="space-y-2">
                {convertedContact && (
                  <button onClick={() => router.push(`/contacts/${convertedContact.id}`)} className="flex items-center gap-2 text-sm text-green-700 hover:text-green-900 transition-colors">
                    <UserPlus className="w-3.5 h-3.5" />
                    Contact: <span className="font-semibold">{convertedContact.name}</span>
                  </button>
                )}
                {convertedDeal && (
                  <button onClick={() => router.push(`/deals`)} className="flex items-center gap-2 text-sm text-green-700 hover:text-green-900 transition-colors">
                    <DollarSign className="w-3.5 h-3.5" />
                    Deal: <span className="font-semibold">{convertedDeal.title}</span>
                    {convertedDeal.value && <span className="text-xs">({convertedDeal.value})</span>}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN (40%, sticky) */}
        <div className="w-full lg:w-[40%]">
          <div className="lg:sticky lg:top-6 space-y-6">

            {/* 1. Notes Chat Feed */}
            <div className="card flex flex-col" style={{ maxHeight: '400px' }}>
              <div className="p-4 border-b border-surface-100">
                <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Notes
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[120px]">
                {/* Show activity notes if converted, else lead notes */}
                {lead.contact_id && noteActivities.length > 0 ? (
                  noteActivities.map(note => (
                    <div key={note.id} className="flex flex-col">
                      <div className="bg-brand-50 rounded-xl px-3 py-2 max-w-[90%]">
                        <p className="text-xs text-surface-700">{note.title}</p>
                      </div>
                      <span className="text-[9px] text-surface-300 mt-0.5 px-1">
                        {profileMap[note.user_id || ''] || 'System'} · {timeAgo(note.created_at)}
                      </span>
                    </div>
                  ))
                ) : leadNotes.length > 0 ? (
                  leadNotes.map((n, i) => (
                    <div key={i} className="flex flex-col">
                      <div className="bg-amber-50 rounded-xl px-3 py-2 max-w-[90%]">
                        <p className="text-xs text-surface-700">{n.text}</p>
                      </div>
                      <span className="text-[9px] text-surface-300 mt-0.5 px-1">{timeAgo(n.at)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-surface-300 text-center py-6">No notes yet</p>
                )}
                <div ref={notesEndRef} />
              </div>
              <div className="p-3 border-t border-surface-100 flex gap-2">
                <input
                  className="input text-xs flex-1"
                  placeholder="Add a note..."
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendNote() } }}
                />
                <button onClick={sendNote} disabled={noteSending || !noteText.trim()} className="btn-primary btn-sm px-3">
                  <Send className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* 2. WhatsApp Chat (collapsible) */}
            {(phone || lead.contact_id) && (
              <div className="card">
                <button onClick={() => setWaExpanded(!waExpanded)} className="w-full flex items-center justify-between p-4">
                  <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5 text-green-600" /> WhatsApp
                    {waMessages.length > 0 && <span className="ml-1 text-[10px] text-surface-300">({waMessages.length})</span>}
                  </h3>
                  {waExpanded ? <ChevronUp className="w-4 h-4 text-surface-400" /> : <ChevronDown className="w-4 h-4 text-surface-400" />}
                </button>
                {waExpanded && (
                  <div>
                    <div className="px-4 pb-3 space-y-2 max-h-[300px] overflow-y-auto">
                      {waMessages.length === 0 ? (
                        <p className="text-xs text-surface-300 text-center py-4">No messages yet. Start a conversation.</p>
                      ) : (
                        waMessages.map(msg => (
                          <div key={msg.id} className={cn('flex', msg.direction === 'outbound' ? 'justify-end' : 'justify-start')}>
                            <div className={cn(
                              'max-w-[80%] rounded-xl px-3 py-1.5 text-xs',
                              msg.direction === 'outbound' ? 'bg-green-100 text-green-900' : 'bg-surface-100 text-surface-700'
                            )}>
                              {msg.body && <p>{msg.body}</p>}
                              <p className={cn('text-[9px] mt-0.5', msg.direction === 'outbound' ? 'text-green-600' : 'text-surface-400')}>
                                {new Date(msg.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    {lead.contact_id && (
                      <div className="p-3 border-t border-surface-100 flex gap-2">
                        <input
                          ref={waInputRef}
                          className="input text-xs flex-1"
                          placeholder="Type a message..."
                          value={waSendText}
                          onChange={e => setWaSendText(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleWaSend() } }}
                        />
                        <button onClick={handleWaSend} disabled={waSending || !waSendText.trim()} className="btn-sm bg-green-600 text-white rounded-lg px-3">
                          <Send className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 3. Related Leads */}
            {relatedLeads.length > 0 && (
              <div className="card p-4">
                <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-3">Related Leads</h3>
                <div className="space-y-2">
                  {relatedLeads.map(rl => (
                    <button key={rl.id} onClick={() => router.push(`/leads/${rl.id}`)} className="w-full text-left flex items-center gap-2 p-2 rounded-lg hover:bg-surface-50 transition-colors">
                      <span className="text-sm">{PLATFORM_ICONS[rl.platform] || '🌐'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-surface-700 truncate">{rl.author_name}</p>
                        <p className="text-[10px] text-surface-400">{rl.source_type} · {timeAgo(rl.created_at)}</p>
                      </div>
                      <span className={cn('badge text-[9px]', STATUS_STYLES[rl.status])}>{rl.status}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Deal Modal */}
      {showDealModal && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100">
              <h2 className="font-semibold text-surface-900">Convert to Contact + Deal</h2>
              <button onClick={() => setShowDealModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-3 bg-surface-50 rounded-xl border border-surface-100">
                <p className="text-xs text-surface-500">Converting lead:</p>
                <p className="text-sm font-bold text-surface-900">{lead.author_name}</p>
              </div>
              <div>
                <label className="label">Deal Title</label>
                <input className="input" value={dealForm.title} onChange={e => setDealForm(f => ({ ...f, title: e.target.value }))} placeholder="Deal title" />
              </div>
              <div>
                <label className="label">Deal Value</label>
                <input className="input" type="number" value={dealForm.value} onChange={e => setDealForm(f => ({ ...f, value: e.target.value }))} placeholder="0.00" />
              </div>
              <div>
                <label className="label">Pipeline</label>
                <select className="input" value={dealForm.pipeline_id} onChange={e => {
                  const pid = e.target.value
                  setDealForm(f => ({ ...f, pipeline_id: pid, stage_id: stages.filter((s: DbRow) => s.pipeline_id === pid)[0]?.id || '' }))
                }}>
                  {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Stage</label>
                <select className="input" value={dealForm.stage_id} onChange={e => setDealForm(f => ({ ...f, stage_id: e.target.value }))}>
                  {stages.filter((s: DbRow) => s.pipeline_id === dealForm.pipeline_id).map((s: DbRow) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowDealModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={convertToDeal} disabled={!dealForm.pipeline_id || !dealForm.stage_id} className="btn-primary flex-1">Create Contact + Deal</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
