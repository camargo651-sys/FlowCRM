'use client'
import { DbRow } from '@/types'
import { useI18n } from '@/lib/i18n/context'
import { toast } from 'sonner'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, X, UserPlus, MessageCircle, ArrowRight, ExternalLink, DollarSign, User, MoreHorizontal, Phone, Mail, AlarmClock, TrendingUp, Clock, AlertCircle, CheckCircle, StickyNote } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getActiveWorkspace } from '@/lib/get-active-workspace'
import BulkActions from '@/components/shared/BulkActions'

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📸', facebook: '📘', tiktok: '🎵', linkedin: '💼', twitter: '🐦', youtube: '📺', other: '🌐',
}
const STATUS_STYLES: Record<string, string> = {
  new: 'badge-blue', contacted: 'badge-yellow', qualified: 'badge-violet', converted: 'badge-green', discarded: 'badge-gray', incomplete: 'badge-orange',
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

function LeadAgeBadge({ createdAt, status }: { createdAt: string; status: string }) {
  const days = daysSince(createdAt)
  const hours = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60))
  const color = days < 1 ? 'bg-green-100 text-green-700' : days <= 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
  const label = days < 1 ? `${hours}h` : `${days}d`
  const showAlarm = status === 'new' && hours >= 24
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium', color)}>
      {showAlarm && <AlarmClock className="w-2.5 h-2.5" />}
      {label}
    </span>
  )
}

export default function LeadsPage() {
  const supabase = createClient()
  const router = useRouter()
  const { t } = useI18n()
  const [leads, setLeads] = useState<DbRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPlatform, setFilterPlatform] = useState('all')
  const [workspaceId, setWorkspaceId] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ author_name: '', author_username: '', platform: 'instagram', source_type: 'comment', message: '', post_url: '' })

  // Feature 2: Convert to Deal
  const [showDealModal, setShowDealModal] = useState<DbRow | null>(null)
  const [dealForm, setDealForm] = useState({ title: '', value: '', pipeline_id: '', stage_id: '' })
  const [pipelines, setPipelines] = useState<DbRow[]>([])
  const [stages, setStages] = useState<DbRow[]>([])

  // Feature 3: Lead Assignment
  const [currentUserId, setCurrentUserId] = useState('')
  const [currentUserName, setCurrentUserName] = useState('')
  const [filterAssignment, setFilterAssignment] = useState('all')
  const [profiles, setProfiles] = useState<DbRow[]>([])

  // Improvement 1: Bulk Actions
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Improvement 7: Actions Dropdown
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Improvement 8: Lead Notes
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUserId(user.id)
    const ws = await getActiveWorkspace(supabase, user.id, 'id')
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)
    const { data } = await supabase.from('social_leads').select('*').eq('workspace_id', ws.id).order('created_at', { ascending: false })
    setLeads(data || [])

    // Load pipelines & stages for Convert to Deal
    const { data: pipelinesData } = await supabase.from('pipelines').select('*').eq('workspace_id', ws.id).order('order_index')
    setPipelines(pipelinesData || [])
    if (pipelinesData && pipelinesData.length > 0) {
      const { data: stagesData } = await supabase.from('pipeline_stages').select('*').eq('workspace_id', ws.id).order('order_index')
      setStages(stagesData || [])
    }

    // Load profiles for assignment
    const { data: profilesData } = await supabase.from('profiles').select('id, full_name, email').eq('workspace_id', ws.id)
    setProfiles(profilesData || [])
    const myProfile = (profilesData || []).find((p: DbRow) => p.id === user.id)
    if (myProfile) setCurrentUserName(myProfile.full_name || myProfile.email || 'Me')

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Improvement 6: Supabase Realtime
  useEffect(() => {
    if (!workspaceId) return
    const channel = supabase
      .channel('leads-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'social_leads',
        filter: `workspace_id=eq.${workspaceId}`,
      }, (payload) => {
        const newLead = payload.new as DbRow
        setLeads(prev => [newLead, ...prev])
        toast.success(`New lead: ${newLead.author_name || 'Unknown'}`)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [workspaceId])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (openMenu && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [openMenu])

  const createLead = async () => {
    if (!form.author_name) return
    const { data: newLead } = await supabase.from('social_leads').insert({
      workspace_id: workspaceId, ...form,
    }).select('id').single()
    setForm({ author_name: '', author_username: '', platform: 'instagram', source_type: 'comment', message: '', post_url: '' })
    setShowNew(false)
    toast.success('Lead added')
    // Route the new lead to a rep if routing is enabled
    if (newLead) {
      try {
        await fetch('/api/leads/route-lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId: newLead.id }) })
      } catch {}
    }
    load()
  }

  const updateStatus = async (id: string, status: string) => {
    // Use API route for qualified/converted to fire automation triggers
    if (status === 'qualified' || status === 'converted') {
      try {
        const res = await fetch('/api/leads/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId: id, status }),
        })
        const data = await res.json()
        if (!data.success) {
          toast.error(data.error || 'Failed to update status')
          return
        }
      } catch {
        toast.error('Failed to update status')
        return
      }
    } else {
      await supabase.from('social_leads').update({ status }).eq('id', id)
    }
    toast.success(`Lead marked as ${status}`)
    load()
  }

  const convertToContact = async (lead: DbRow) => {
    const { data: contact } = await supabase.from('contacts').insert({
      workspace_id: workspaceId, name: lead.author_name,
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

  const openDealModal = (lead: DbRow) => {
    setDealForm({
      title: lead.message ? lead.message.slice(0, 80) : `Deal from ${lead.author_name}`,
      value: '',
      pipeline_id: pipelines[0]?.id || '',
      stage_id: stages.filter(s => s.pipeline_id === pipelines[0]?.id)[0]?.id || '',
    })
    setShowDealModal(lead)
  }

  const convertToDeal = async () => {
    if (!showDealModal || !dealForm.pipeline_id || !dealForm.stage_id) return
    const lead = showDealModal

    // 1. Create contact (same as convertToContact)
    const { data: contact } = await supabase.from('contacts').insert({
      workspace_id: workspaceId, name: lead.author_name,
      notes: `From ${lead.platform}: ${lead.message || ''}`,
      tags: [lead.platform, 'social-lead'],
      type: 'person',
    }).select('id').single()

    if (!contact) return

    // 2. Create deal linked to contact
    const { data: deal } = await supabase.from('deals').insert({
      workspace_id: workspaceId,
      title: dealForm.title || `Deal from ${lead.author_name}`,
      value: dealForm.value ? parseFloat(dealForm.value) : null,
      pipeline_id: dealForm.pipeline_id,
      stage_id: dealForm.stage_id,
      contact_id: contact.id,
      owner_id: currentUserId,
    }).select('id').single()

    // 3. Update lead as converted with both IDs
    await supabase.from('social_leads').update({
      status: 'converted',
      contact_id: contact.id,
      deal_id: deal?.id || null,
    }).eq('id', lead.id)

    toast.success(`${lead.author_name} converted to contact + deal`)
    setShowDealModal(null)
    load()
  }

  const assignLead = async (leadId: string, userId: string | null) => {
    await supabase.from('social_leads').update({ assigned_to: userId }).eq('id', leadId)
    toast.success(userId ? 'Lead assigned' : 'Lead unassigned')
    load()
  }

  const getAssigneeName = (userId: string | null) => {
    if (!userId) return null
    const profile = profiles.find(p => p.id === userId)
    return profile?.full_name || profile?.email || 'Unknown'
  }

  // Improvement 8: Save note
  const saveNote = async (leadId: string) => {
    await supabase.from('social_leads').update({ notes: noteText || null }).eq('id', leadId)
    setEditingNote(null)
    setNoteText('')
    toast.success('Note saved')
    load()
  }

  // Improvement 1: Bulk actions
  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const bulkDiscard = async () => {
    const ids = Array.from(selected)
    for (const id of ids) {
      await supabase.from('social_leads').update({ status: 'discarded' }).eq('id', id)
    }
    toast.success(`${selected.size} leads discarded`)
    setSelected(new Set())
    load()
  }

  const bulkAssignToMe = async () => {
    const ids = Array.from(selected)
    for (const id of ids) {
      await supabase.from('social_leads').update({ assigned_to: currentUserId }).eq('id', id)
    }
    toast.success(`${selected.size} leads assigned to you`)
    setSelected(new Set())
    load()
  }

  const bulkConvert = async () => {
    const ids = Array.from(selected)
    for (const id of ids) {
      const lead = leads.find(l => l.id === id)
      if (lead && lead.status !== 'converted') {
        await convertToContact(lead)
      }
    }
    toast.success(`Bulk conversion complete`)
    setSelected(new Set())
    load()
  }

  // Helpers
  const getLeadPhone = (lead: DbRow): string | null => {
    return lead.metadata?.phone || null
  }

  const getLeadEmail = (lead: DbRow): string | null => {
    return lead.metadata?.email || null
  }

  const hasPhone = (lead: DbRow): boolean => {
    return !!(lead.metadata?.phone || lead.metadata?.has_phone)
  }

  const filtered = leads.filter(l => {
    if (filterStatus !== 'all' && l.status !== filterStatus) return false
    if (filterPlatform !== 'all' && l.platform !== filterPlatform) return false
    if (filterAssignment === 'mine' && l.assigned_to !== currentUserId) return false
    if (filterAssignment === 'unassigned' && l.assigned_to) return false
    if (search && !l.author_name?.toLowerCase().includes(search.toLowerCase()) && !l.message?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const newCount = leads.filter(l => l.status === 'new').length
  const platforms = Array.from(new Set(leads.map(l => l.platform)))

  // Improvement 3: Conversion Stats
  const totalLeads = leads.length
  const convertedCount = leads.filter(l => l.status === 'converted').length
  const conversionRate = totalLeads > 0 ? ((convertedCount / totalLeads) * 100).toFixed(1) : '0'
  const qualifiedCount = leads.filter(l => l.status === 'qualified').length
  const unattendedCount = leads.filter(l => l.status === 'new').length

  // Avg response time: average time from created_at to when status changed from 'new'
  // We approximate by looking at non-new leads' updated_at vs created_at
  const respondedLeads = leads.filter(l => l.status !== 'new' && l.status !== 'discarded' && l.updated_at && l.created_at)
  const avgResponseMs = respondedLeads.length > 0
    ? respondedLeads.reduce((acc, l) => acc + (new Date(l.updated_at).getTime() - new Date(l.created_at).getTime()), 0) / respondedLeads.length
    : 0
  const avgResponseHours = Math.round(avgResponseMs / (1000 * 60 * 60))

  const allFilteredSelected = filtered.length > 0 && filtered.every(l => selected.has(l.id))

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(l => l.id)))
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">{t('leads.title')}</h1><p className="text-sm text-surface-500 mt-0.5">{leads.length} leads · {newCount} new</p></div>
        <button onClick={() => setShowNew(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> Add Lead</button>
      </div>

      {/* Platform stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <div className="card p-4 flex items-center gap-3"><span className="text-2xl">📸</span><div><p className="text-lg font-bold">{leads.filter(l => l.platform === 'instagram').length}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Instagram</p></div></div>
        <div className="card p-4 flex items-center gap-3"><span className="text-2xl">📘</span><div><p className="text-lg font-bold">{leads.filter(l => l.platform === 'facebook').length}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Facebook</p></div></div>
        <div className="card p-4 flex items-center gap-3"><span className="text-2xl">🎵</span><div><p className="text-lg font-bold">{leads.filter(l => l.platform === 'tiktok').length}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">TikTok</p></div></div>
        <div className="card p-4 flex items-center gap-3"><span className="text-2xl">💼</span><div><p className="text-lg font-bold">{leads.filter(l => l.platform === 'linkedin').length}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">LinkedIn</p></div></div>
      </div>

      {/* Improvement 3: Conversion Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="card p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center"><TrendingUp className="w-4 h-4 text-green-600" /></div>
          <div><p className="text-lg font-bold">{conversionRate}%</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Conversion Rate</p></div>
        </div>
        <div className="card p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center"><Clock className="w-4 h-4 text-blue-600" /></div>
          <div><p className="text-lg font-bold">{avgResponseHours}h</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Avg Response Time</p></div>
        </div>
        <div className="card p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center"><AlertCircle className="w-4 h-4 text-orange-600" /></div>
          <div><p className="text-lg font-bold">{unattendedCount}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">New (unattended)</p></div>
        </div>
        <div className="card p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center"><CheckCircle className="w-4 h-4 text-violet-600" /></div>
          <div><p className="text-lg font-bold">{qualifiedCount}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Qualified</p></div>
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" /><input className="input pl-9 text-xs" placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <select className="input w-auto text-xs" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Status</option><option value="new">New</option><option value="contacted">Contacted</option><option value="qualified">Qualified</option><option value="converted">Converted</option><option value="discarded">Discarded</option><option value="incomplete">Incomplete (no phone)</option>
        </select>
        <select className="input w-auto text-xs" value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}>
          <option value="all">All Platforms</option>
          {platforms.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="input w-auto text-xs" value={filterAssignment} onChange={e => setFilterAssignment(e.target.value)}>
          <option value="all">All Leads</option>
          <option value="mine">My Leads</option>
          <option value="unassigned">Unassigned</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-16">
          <MessageCircle className="w-10 h-10 text-surface-300 mx-auto mb-3" />
          <p className="text-surface-600 font-medium mb-1">No social leads yet</p>
          <p className="text-xs text-surface-400 mb-4">Leads appear here when captured from social media comments, DMs, or added manually</p>
          <p className="text-[10px] text-surface-300">Webhook: <code className="bg-surface-100 px-1 rounded">your-domain.com/api/webhooks/social</code></p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Improvement 1: Select all header */}
          <div className="flex items-center gap-2 px-1 mb-1">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={toggleSelectAll}
              className="w-3.5 h-3.5 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-[10px] text-surface-400 font-medium">Select all ({filtered.length})</span>
          </div>

          {filtered.map(lead => {
            const phone = getLeadPhone(lead)
            const email = getLeadEmail(lead)
            const leadHasPhone = hasPhone(lead)

            return (
            <div key={lead.id} onClick={() => router.push(`/leads/${lead.id}`)} className={cn('card p-4 flex items-start gap-3 cursor-pointer hover:shadow-md transition-shadow', selected.has(lead.id) && 'ring-2 ring-brand-300 bg-brand-50/30')}>
              {/* Improvement 1: Checkbox */}
              <input
                type="checkbox"
                checked={selected.has(lead.id)}
                onChange={() => toggleSelect(lead.id)}
                onClick={e => e.stopPropagation()}
                className="w-3.5 h-3.5 mt-1 rounded border-surface-300 text-brand-600 focus:ring-brand-500 flex-shrink-0"
              />
              <span className="text-xl mt-0.5">{PLATFORM_ICONS[lead.platform] || '🌐'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-sm font-bold text-surface-900">{lead.author_name}</span>
                  {lead.author_username && <span className="text-[10px] text-surface-400">@{lead.author_username}</span>}
                  <span className={cn('badge text-[10px]', STATUS_STYLES[lead.status])}>{lead.status}</span>
                  <span className="text-[10px] text-surface-300">{lead.source_type}</span>
                  {/* Improvement 4: Phone/Email badges */}
                  {phone && (
                    <a href={`tel:${phone}`} className="inline-flex items-center gap-0.5 text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full hover:bg-green-100 transition-colors">
                      <Phone className="w-2.5 h-2.5" /> {phone}
                    </a>
                  )}
                  {!phone && leadHasPhone && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full">
                      <Phone className="w-2.5 h-2.5" /> Has phone
                    </span>
                  )}
                  {email && (
                    <a href={`mailto:${email}`} className="inline-flex items-center gap-0.5 text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full hover:bg-blue-100 transition-colors">
                      <Mail className="w-2.5 h-2.5" /> {email}
                    </a>
                  )}
                </div>
                {lead.message && <p className="text-xs text-surface-600 line-clamp-2">{lead.message}</p>}

                {/* Improvement 8: Show existing notes */}
                {lead.notes && editingNote !== lead.id && (
                  <p className="text-[11px] text-surface-400 italic mt-1">{lead.notes}</p>
                )}

                {/* Improvement 8: Inline note editor */}
                {editingNote === lead.id && (
                  <div className="mt-2 flex gap-1.5" onClick={e => e.stopPropagation()}>
                    <textarea
                      className="input text-xs resize-none flex-1"
                      rows={2}
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      placeholder="Add an internal note..."
                      autoFocus
                    />
                    <div className="flex flex-col gap-1">
                      <button onClick={() => saveNote(lead.id)} className="btn-primary btn-sm text-[10px] px-2 py-1">Save</button>
                      <button onClick={() => setEditingNote(null)} className="btn-ghost btn-sm text-[10px] px-2 py-1">Cancel</button>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[10px] text-surface-300">{new Date(lead.created_at).toLocaleString()}</span>
                  {/* Improvement 2: Lead Age */}
                  <LeadAgeBadge createdAt={lead.created_at} status={lead.status} />
                  {lead.post_url && <a href={lead.post_url} target="_blank" className="text-[10px] text-brand-600 hover:underline flex items-center gap-0.5"><ExternalLink className="w-2.5 h-2.5" /> View post</a>}
                  {lead.assigned_to && (
                    <span className="text-[10px] text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5">
                      <User className="w-2.5 h-2.5" /> {getAssigneeName(lead.assigned_to)}
                    </span>
                  )}
                  {/* Improvement 8: Add note link */}
                  {editingNote !== lead.id && (
                    <button
                      onClick={() => { setEditingNote(lead.id); setNoteText(lead.notes || '') }}
                      className="text-[10px] text-surface-400 hover:text-surface-600 flex items-center gap-0.5 transition-colors"
                    >
                      <StickyNote className="w-2.5 h-2.5" /> {lead.notes ? 'Edit note' : 'Add note'}
                    </button>
                  )}
                </div>
              </div>

              {/* Improvement 7: Actions - Convert visible, rest in dropdown */}
              <div className="flex gap-1 flex-shrink-0 items-center relative" onClick={e => e.stopPropagation()} ref={openMenu === lead.id ? menuRef : undefined}>
                {/* Improvement 5: WhatsApp button */}
                {(phone || leadHasPhone) && (
                  <button
                    onClick={() => {
                      if (lead.contact_id) {
                        window.location.href = `/whatsapp?contact=${lead.contact_id}`
                      } else {
                        // Convert first, then redirect
                        convertToContact(lead).then(() => {
                          // After conversion, the lead will have contact_id; reload to get it
                          toast.info('Contact created. Opening WhatsApp...')
                        })
                      }
                    }}
                    className="btn-sm bg-green-600 text-white text-[10px] rounded-lg px-2 py-1 inline-flex items-center gap-1"
                    title="WhatsApp"
                  >
                    <MessageCircle className="w-3 h-3" />
                    <span className="hidden md:inline">WA</span>
                  </button>
                )}

                {/* Primary action: Convert (hidden on mobile, goes into dropdown) */}
                {lead.status !== 'converted' && lead.status !== 'discarded' && (
                  <button onClick={() => convertToContact(lead)} className="btn-sm bg-brand-600 text-white text-[10px] rounded-lg px-2 py-1 items-center gap-1 hidden md:inline-flex"><UserPlus className="w-3 h-3" /> Convert</button>
                )}

                {/* More actions dropdown */}
                <button
                  onClick={() => setOpenMenu(openMenu === lead.id ? null : lead.id)}
                  className="btn-ghost btn-sm p-1 rounded-lg hover:bg-surface-100"
                >
                  <MoreHorizontal className="w-4 h-4 text-surface-500" />
                </button>

                {openMenu === lead.id && (
                  <div className="absolute right-0 top-8 z-30 bg-white border border-surface-200 rounded-xl shadow-lg py-1 min-w-[160px]">
                    {/* Convert (visible on mobile in dropdown) */}
                    {lead.status !== 'converted' && lead.status !== 'discarded' && (
                      <button onClick={() => { convertToContact(lead); setOpenMenu(null) }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-surface-50 flex items-center gap-2 md:hidden">
                        <UserPlus className="w-3 h-3" /> Convert to Contact
                      </button>
                    )}
                    {lead.status === 'new' && (
                      <button onClick={() => { updateStatus(lead.id, 'contacted'); setOpenMenu(null) }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-surface-50 flex items-center gap-2">
                        <ArrowRight className="w-3 h-3" /> Mark Contacted
                      </button>
                    )}
                    {(lead.status === 'new' || lead.status === 'contacted') && (
                      <button onClick={() => { updateStatus(lead.id, 'qualified'); setOpenMenu(null) }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-surface-50 flex items-center gap-2">
                        <CheckCircle className="w-3 h-3" /> Qualify
                      </button>
                    )}
                    {lead.status !== 'converted' && lead.status !== 'discarded' && pipelines.length > 0 && (
                      <button onClick={() => { openDealModal(lead); setOpenMenu(null) }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-surface-50 flex items-center gap-2">
                        <DollarSign className="w-3 h-3" /> Convert to Deal
                      </button>
                    )}
                    {lead.status !== 'converted' && lead.status !== 'discarded' && (
                      <>
                        <div className="border-t border-surface-100 my-1" />
                        <button onClick={() => { assignLead(lead.id, currentUserId); setOpenMenu(null) }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-surface-50 flex items-center gap-2">
                          <User className="w-3 h-3" /> Assign to me
                        </button>
                        {profiles.filter(p => p.id !== currentUserId).map(p => (
                          <button key={p.id} onClick={() => { assignLead(lead.id, p.id); setOpenMenu(null) }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-surface-50 flex items-center gap-2 pl-7">
                            {p.full_name || p.email}
                          </button>
                        ))}
                      </>
                    )}
                    {lead.status !== 'discarded' && lead.status !== 'converted' && (
                      <>
                        <div className="border-t border-surface-100 my-1" />
                        <button onClick={() => { updateStatus(lead.id, 'discarded'); setOpenMenu(null) }} className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 flex items-center gap-2">
                          <X className="w-3 h-3" /> Discard
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )})}
        </div>
      )}

      {/* Improvement 1: Bulk Actions Bar */}
      <BulkActions
        count={selected.size}
        onClear={() => setSelected(new Set())}
        onDelete={bulkDiscard}
      >
        <button onClick={bulkAssignToMe} className="flex items-center gap-1.5 text-xs font-medium hover:text-brand-300 transition-colors px-1">
          <User className="w-3.5 h-3.5" /> Assign to me
        </button>
        <button onClick={bulkConvert} className="flex items-center gap-1.5 text-xs font-medium hover:text-green-300 transition-colors px-1">
          <UserPlus className="w-3.5 h-3.5" /> Convert all
        </button>
      </BulkActions>

      {showNew && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100">
              <h2 className="font-semibold text-surface-900">Add Lead Manually</h2>
              <button onClick={() => setShowNew(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Name *</label><input className="input" value={form.author_name} onChange={e => setForm(f => ({ ...f, author_name: e.target.value }))} /></div>
                <div><label className="label">Username</label><input className="input" value={form.author_username} onChange={e => setForm(f => ({ ...f, author_username: e.target.value }))} placeholder="@username" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Platform</label>
                  <select className="input" value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
                    <option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="tiktok">TikTok</option><option value="linkedin">LinkedIn</option><option value="twitter">Twitter/X</option><option value="youtube">YouTube</option><option value="other">Other</option>
                  </select>
                </div>
                <div><label className="label">Source</label>
                  <select className="input" value={form.source_type} onChange={e => setForm(f => ({ ...f, source_type: e.target.value }))}>
                    <option value="comment">Comment</option><option value="dm">DM</option><option value="mention">Mention</option><option value="form">Form</option><option value="ad">Ad</option><option value="manual">Manual</option>
                  </select>
                </div>
              </div>
              <div><label className="label">Message</label><textarea className="input resize-none" rows={3} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} /></div>
              <div><label className="label">Post URL</label><input className="input" value={form.post_url} onChange={e => setForm(f => ({ ...f, post_url: e.target.value }))} placeholder="https://..." /></div>
              <div className="flex gap-2">
                <button onClick={() => setShowNew(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={createLead} disabled={!form.author_name} className="btn-primary flex-1">Add Lead</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showDealModal && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100">
              <h2 className="font-semibold text-surface-900">Convert to Contact + Deal</h2>
              <button onClick={() => setShowDealModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-3 bg-surface-50 rounded-xl border border-surface-100">
                <p className="text-xs text-surface-500">Converting lead:</p>
                <p className="text-sm font-bold text-surface-900">{showDealModal.author_name}</p>
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
                  setDealForm(f => ({ ...f, pipeline_id: pid, stage_id: stages.filter(s => s.pipeline_id === pid)[0]?.id || '' }))
                }}>
                  {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Stage</label>
                <select className="input" value={dealForm.stage_id} onChange={e => setDealForm(f => ({ ...f, stage_id: e.target.value }))}>
                  {stages.filter(s => s.pipeline_id === dealForm.pipeline_id).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowDealModal(null)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={convertToDeal} disabled={!dealForm.pipeline_id || !dealForm.stage_id} className="btn-primary flex-1">Create Contact + Deal</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
