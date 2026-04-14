'use client'
import { toast } from 'sonner'
import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Filter, X, DollarSign, Calendar, User, MessageCircle, Send, ArrowLeft, Share2, ChevronDown, ChevronUp, Phone, Mail, FileText, CheckSquare, Clock, Pencil, LayoutGrid, Table2, ArrowUpDown, Check, Pause, Play, Ban, Trophy } from 'lucide-react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { formatCurrency, getInitials, cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace-context'
import { useI18n } from '@/lib/i18n/context'
import type { Deal, PipelineStage, Contact, DbRow, Profile } from '@/types'
import { getActiveWorkspace } from '@/lib/get-active-workspace'
import { validateTransition } from '@/lib/pipeline/stage-conditions'
import { notifyRecordChange, notifyMentions } from '@/lib/notifications/notify-change'
import { extractMentionIds } from '@/lib/mentions/parse'
import MentionText from '@/components/shared/MentionText'
import MentionTextarea from '@/components/shared/MentionTextarea'
import CallButton from '@/components/shared/CallButton'

interface DealWithContact extends Deal {
  contacts?: { name: string; email?: string } | null
  owner?: { full_name: string } | null
  next_task?: { title: string; due_date: string } | null
}

interface Column extends PipelineStage {
  deals: DealWithContact[]
}

interface FilterState {
  minValue: string
  maxValue: string
  assignedTo: string
  age: 'all' | 'fresh' | 'aging' | 'stale'
}

// --- NEW DEAL MODAL ---
function NewDealModal({ stages, contacts, onClose, onSave, workspaceId, customFields, template }: {
  stages: PipelineStage[], contacts: Pick<Contact, 'id' | 'name' | 'email'>[], onClose: () => void,
  onSave: (deal: Partial<Deal>) => Promise<boolean>, workspaceId: string,
  customFields: { entity: string; label: string; key: string; type: string; options?: string[] }[],
  template: { key?: string; name?: string; dealLabel: { singular: string; plural: string }; contactLabel: { singular: string; plural: string } },
}) {
  const [title, setTitle] = useState('')
  const [value, setValue] = useState('')
  const [stageId, setStageId] = useState(stages[0]?.id || '')
  const [contactId, setContactId] = useState('')
  const [closeDate, setCloseDate] = useState('')
  const [customValues, setCustomValues] = useState<DbRow>({})
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const dealFields = customFields.filter(f => f.entity === 'deal')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setSubmitError('Title is required')
      return
    }
    if (!stageId) {
      setSubmitError('Stage is required')
      return
    }
    setSubmitError(null)
    setSaving(true)
    const ok = await onSave({
      title: title.trim(), value: value ? parseFloat(value) : undefined,
      stage_id: stageId, contact_id: contactId || undefined,
      expected_close_date: closeDate || undefined,
      workspace_id: workspaceId, status: 'open', currency: 'USD', order_index: 0,
      custom_fields: Object.keys(customValues).length > 0 ? customValues : undefined,
    })
    setSaving(false)
    if (ok) onClose()
    else setSubmitError('Could not save. Check the console for details.')
  }

  return (
    <div className="modal-overlay">
      <div className="modal-panel max-w-md">
        <div className="modal-header">
          <h2>New {template.dealLabel.singular}</h2>
          <button onClick={onClose} className="modal-close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body space-y-4">
          <div>
            <label className="label">{template.dealLabel.singular} title *</label>
            <input className="input" required value={title} onChange={e => setTitle(e.target.value)}
              placeholder={template.key === 'real_estate' ? 'e.g. 3BR Apartment Downtown' : template.key === 'distribution' ? 'e.g. Weekly Order - Store #42' : 'e.g. Acme Corp - Enterprise Plan'} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Value</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400" />
                <input className="input pl-8" type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div>
              <label className="label">{template.key === 'distribution' ? 'Delivery date' : 'Close date'}</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400" />
                <input className="input pl-8" type="date" value={closeDate} onChange={e => setCloseDate(e.target.value)} />
              </div>
            </div>
          </div>
          <div>
            <label className="label">Stage</label>
            <select className="input" value={stageId} onChange={e => setStageId(e.target.value)}>
              {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{template.contactLabel.singular}</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400" />
              <select className="input pl-8" value={contactId} onChange={e => setContactId(e.target.value)}>
                <option value="">No {template.contactLabel.singular.toLowerCase()}</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Industry-specific custom fields */}
          {dealFields.length > 0 && (
            <div className="pt-2 border-t border-surface-100">
              <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wide mb-3">
                {template.name} Details
              </p>
              <div className="space-y-3">
                {dealFields.map(field => (
                  <div key={field.key}>
                    <label className="label">{field.label}</label>
                    {field.type === 'select' && field.options ? (
                      <select className="input" value={customValues[field.key] || ''}
                        onChange={e => setCustomValues(v => ({ ...v, [field.key]: e.target.value }))}>
                        <option value="">Select...</option>
                        {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : field.type === 'boolean' ? (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={customValues[field.key] || false}
                          onChange={e => setCustomValues(v => ({ ...v, [field.key]: e.target.checked }))}
                          className="w-4 h-4 accent-brand-600" />
                        <span className="text-sm text-surface-600">{field.label}</span>
                      </label>
                    ) : field.type === 'date' ? (
                      <input type="date" className="input" value={customValues[field.key] || ''}
                        onChange={e => setCustomValues(v => ({ ...v, [field.key]: e.target.value }))} />
                    ) : field.type === 'number' || field.type === 'currency' ? (
                      <input type="number" className="input" value={customValues[field.key] || ''}
                        placeholder="0"
                        onChange={e => setCustomValues(v => ({ ...v, [field.key]: e.target.value }))} />
                    ) : field.type === 'url' ? (
                      <input type="url" className="input" value={customValues[field.key] || ''}
                        placeholder="https://..."
                        onChange={e => setCustomValues(v => ({ ...v, [field.key]: e.target.value }))} />
                    ) : (
                      <input type="text" className="input" value={customValues[field.key] || ''}
                        onChange={e => setCustomValues(v => ({ ...v, [field.key]: e.target.value }))} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {submitError && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              {submitError}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={saving} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving || !title.trim()} className="btn-primary flex-1">
              {saving ? 'Saving…' : `Create ${template.dealLabel.singular}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// --- DEAL AGE HELPER ---
function getDealAgeDays(deal: DealWithContact): number {
  const ref = deal.updated_at || deal.created_at
  if (!ref) return 0
  return Math.floor((Date.now() - new Date(ref).getTime()) / (1000 * 60 * 60 * 24))
}

function DealAgeBadge({ days }: { days: number }) {
  const color = days < 7 ? 'bg-emerald-100 text-emerald-700' : days <= 14 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
  return <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded-full', color)}>{days}d</span>
}

// --- RELATIVE TIME HELPER ---
function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// --- ACTIVITY ICON HELPER ---
function ActivityIcon({ type }: { type: string }) {
  const cls = 'w-3.5 h-3.5'
  switch (type) {
    case 'call': return <Phone className={cn(cls, 'text-blue-500')} />
    case 'email': return <Mail className={cn(cls, 'text-orange-500')} />
    case 'meeting': return <Calendar className={cn(cls, 'text-violet-500')} />
    case 'task': return <CheckSquare className={cn(cls, 'text-emerald-500')} />
    case 'note': return <FileText className={cn(cls, 'text-surface-500')} />
    case 'whatsapp': return <MessageCircle className={cn(cls, 'text-green-500')} />
    default: return <FileText className={cn(cls, 'text-surface-400')} />
  }
}

// --- DEAL CARD ---
function DealCard({ deal, teamMembers, onClick }: { deal: DealWithContact; teamMembers: Pick<Profile, 'id' | 'full_name'>[]; onClick: () => void }) {
  const ageDays = getDealAgeDays(deal)
  const assignee = deal.owner_id ? teamMembers.find(m => m.id === deal.owner_id) : null

  return (
    <div onClick={onClick} className="deal-card">
      <div className="flex items-start justify-between gap-1 mb-1">
        <p className="text-sm font-semibold text-surface-800 leading-snug">{deal.title}</p>
        <div className="flex items-center gap-1 flex-shrink-0">
          {deal.probability != null && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">{deal.probability}%</span>
          )}
          <DealAgeBadge days={ageDays} />
        </div>
      </div>
      <div className="flex items-center gap-1.5 mb-2.5">
        {deal.contacts?.name && (
          <p className="text-xs text-surface-400 flex items-center gap-1">
            <span className="w-4 h-4 bg-violet-100 text-violet-600 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0">
              {getInitials(deal.contacts.name)}
            </span>
            {deal.contacts.name}
          </p>
        )}
        {assignee && (
          <span className="w-4 h-4 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0" title={assignee.full_name}>
            {getInitials(assignee.full_name)}
          </span>
        )}
      </div>
      {/* Show some custom fields on card */}
      {deal.custom_fields && typeof deal.custom_fields === 'object' && Object.keys(deal.custom_fields as object).length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {Object.entries(deal.custom_fields as DbRow).slice(0, 2).map(([key, val]) => (
            val && <span key={key} className="badge-gray text-[9px]">{String(val)}</span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          {deal.value ? (
            <span className="text-sm font-bold text-surface-900">{formatCurrency(deal.value)}</span>
          ) : (
            <span className="text-xs text-surface-300">No value set</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {deal.next_task && (
            <span className="text-[9px] text-amber-600 flex items-center gap-0.5" title={deal.next_task.title}>
              <Clock className="w-3 h-3" />
              {new Date(deal.next_task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          {deal.expected_close_date && (
            <span className="text-[10px] text-surface-400 font-medium">
              {new Date(deal.expected_close_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// --- WHATSAPP MESSAGE COMPONENT ---
interface WaMessage {
  id: string
  direction: 'inbound' | 'outbound'
  body: string
  received_at: string
}

interface ActivityItem {
  id: string
  type: string
  title: string
  created_at: string
  done: boolean
  due_date?: string
  notes?: string | null
  owner_id?: string | null
  author?: { full_name: string | null; email: string | null } | null
}

function DealWhatsApp({ deal, onClose, onUpdateDeal, onDealHoldChange, onMarkLost, onMarkWon, teamMembers, workspaceId, currentUserId, currentUserName }: {
  deal: DealWithContact; onClose: () => void;
  onUpdateDeal: (dealId: string, updates: Partial<Deal>) => void;
  onDealHoldChange?: (dealId: string, onHold: boolean) => void;
  onMarkLost?: (dealId: string, dealTitle: string, stageId: string) => void;
  onMarkWon?: (dealId: string) => void;
  teamMembers: Pick<Profile, 'id' | 'full_name'>[];
  workspaceId: string;
  currentUserId: string | null;
  currentUserName: string;
}) {
  const [showHoldModal, setShowHoldModal] = useState(false)
  const [holdProcessing, setHoldProcessing] = useState(false)

  const handlePause = async (payload: { reason: string; until: string }) => {
    setHoldProcessing(true)
    try {
      const res = await fetch(`/api/deals/${deal.id}/hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ on_hold: true, hold_reason: payload.reason, hold_until: payload.until || null }),
      })
      const j = await res.json()
      if (j.deal) {
        onUpdateDeal(deal.id, { status: 'on_hold' })
        onDealHoldChange?.(deal.id, true)
        toast.success('Deal paused')
        setShowHoldModal(false)
        onClose()
      } else {
        toast.error(j.error || 'Failed to pause')
      }
    } catch {
      toast.error('Failed to pause')
    }
    setHoldProcessing(false)
  }

  const handleResume = async () => {
    setHoldProcessing(true)
    try {
      const res = await fetch(`/api/deals/${deal.id}/hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ on_hold: false }),
      })
      const j = await res.json()
      if (j.deal) {
        onUpdateDeal(deal.id, { status: 'open' })
        onDealHoldChange?.(deal.id, false)
        toast.success('Deal resumed')
        onClose()
      } else {
        toast.error(j.error || 'Failed to resume')
      }
    } catch {
      toast.error('Failed to resume')
    }
    setHoldProcessing(false)
  }

  const supabase = createClient()
  const [messages, setMessages] = useState<WaMessage[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingMsgs, setLoadingMsgs] = useState(true)
  const [activeTab, setActiveTab] = useState<'details' | 'activity' | 'whatsapp'>('details')
  const [portalCopied, setPortalCopied] = useState(false)

  // Notes state
  const [notes, setNotes] = useState(deal.notes || '')
  const [savingNotes, setSavingNotes] = useState(false)

  // Inline edit states
  const [editingValue, setEditingValue] = useState(false)
  const [editValue, setEditValue] = useState(String(deal.value || ''))
  const [editingCloseDate, setEditingCloseDate] = useState(false)
  const [editCloseDate, setEditCloseDate] = useState(deal.expected_close_date || '')
  const [editingProbability, setEditingProbability] = useState(false)
  const [editProbability, setEditProbability] = useState(String(deal.probability ?? ''))

  // Assignment state
  const [assignedTo, setAssignedTo] = useState(deal.owner_id || '')

  // Activity feed state
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loadingActivities, setLoadingActivities] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [postingNote, setPostingNote] = useState(false)

  // Contact phone for call button
  const [contactPhone, setContactPhone] = useState<string | null>(null)
  useEffect(() => {
    if (!deal.contact_id) return
    supabase.from('contacts').select('phone').eq('id', deal.contact_id).limit(1).maybeSingle()
      .then(({ data }) => setContactPhone((data?.phone as string) || null))
  }, [deal.contact_id])

  // Next action state
  const [nextActionText, setNextActionText] = useState('')
  const [nextActionDate, setNextActionDate] = useState('')
  const [creatingAction, setCreatingAction] = useState(false)

  useEffect(() => {
    if (!deal.contact_id) { setLoadingMsgs(false); return }
    supabase
      .from('whatsapp_messages')
      .select('id, direction, body, received_at')
      .eq('contact_id', deal.contact_id)
      .order('received_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setMessages((data || []).reverse() as WaMessage[])
        setLoadingMsgs(false)
      })
  }, [deal.contact_id])

  // Load activities
  const loadActivities = useCallback(async () => {
    setLoadingActivities(true)
    let q = supabase
      .from('activities')
      .select('id, type, title, notes, owner_id, created_at, done, due_date')
      .order('created_at', { ascending: true })
      .limit(50)

    if (deal.contact_id) {
      q = q.or(`contact_id.eq.${deal.contact_id},deal_id.eq.${deal.id}`)
    } else {
      q = q.eq('deal_id', deal.id)
    }

    const { data } = await q
    const rows = (data || []) as ActivityItem[]

    // Fetch profiles for owner_ids separately (no FK dependency)
    const ownerIds = Array.from(new Set(rows.map(r => r.owner_id).filter(Boolean))) as string[]
    let profileMap: Record<string, { full_name: string | null; email: string | null }> = {}
    if (ownerIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ownerIds)
      profileMap = Object.fromEntries(
        (profs || []).map(p => [p.id as string, { full_name: (p as { full_name: string | null }).full_name, email: (p as { email: string | null }).email }])
      )
    }
    const merged = rows.map(r => ({ ...r, author: r.owner_id ? profileMap[r.owner_id] || null : null }))
    setActivities(merged)
    setLoadingActivities(false)
  }, [supabase, deal.id, deal.contact_id])

  useEffect(() => {
    loadActivities()
  }, [loadActivities])

  const saveField = async (field: string, value: unknown) => {
    await supabase.from('deals').update({ [field]: value }).eq('id', deal.id)
    onUpdateDeal(deal.id, { [field]: value })
    if (deal.owner_id && deal.owner_id !== currentUserId) {
      notifyRecordChange({
        entity: 'deal',
        entityId: deal.id,
        entityTitle: deal.title,
        ownerId: deal.owner_id,
        editorId: currentUserId,
        editorName: currentUserName,
        actionUrl: `/pipeline?deal=${deal.id}`,
        workspaceId,
      })
    }
  }

  const handleSaveNotes = async () => {
    setSavingNotes(true)
    await saveField('notes', notes)
    setSavingNotes(false)
  }

  const handleSaveValue = async () => {
    setEditingValue(false)
    const num = editValue ? parseFloat(editValue) : null
    await saveField('value', num)
  }

  const handleSaveCloseDate = async (val: string) => {
    setEditCloseDate(val)
    setEditingCloseDate(false)
    await saveField('expected_close_date', val || null)
  }

  const handleSaveProbability = async () => {
    setEditingProbability(false)
    const num = editProbability ? parseInt(editProbability) : null
    await saveField('probability', num)
  }

  const handleAssign = async (userId: string) => {
    setAssignedTo(userId)
    await saveField('owner_id', userId || null)
  }

  const handleCreateNextAction = async () => {
    if (!nextActionText.trim()) return
    setCreatingAction(true)
    const { data } = await supabase.from('activities').insert({
      type: 'task',
      title: nextActionText.trim(),
      due_date: nextActionDate || null,
      contact_id: deal.contact_id || null,
      deal_id: deal.id,
      done: false,
      workspace_id: workspaceId,
    }).select('id, type, title, created_at, done, due_date').single()
    if (data) {
      setActivities(prev => [data as ActivityItem, ...prev])
      toast.success('Follow-up created')
    }
    setNextActionText('')
    setNextActionDate('')
    setCreatingAction(false)
  }

  const handleToggleActivityDone = async (act: ActivityItem) => {
    const nextDone = !act.done
    setActivities(prev => prev.map(a => a.id === act.id ? { ...a, done: nextDone } : a))
    await supabase.from('activities').update({ done: nextDone }).eq('id', act.id)
  }

  const handlePostNote = async () => {
    const body = noteDraft.trim()
    if (!body || postingNote) return
    setPostingNote(true)
    const { error } = await supabase.from('activities').insert({
      type: 'note',
      title: 'Note',
      notes: body,
      owner_id: currentUserId,
      deal_id: deal.id,
      contact_id: deal.contact_id || null,
      done: false,
      workspace_id: workspaceId,
    })
    if (error) {
      toast.error('Failed to add note')
      setPostingNote(false)
      return
    }
    // Notify mentions
    try {
      const ids = extractMentionIds(body)
      if (ids.length > 0) {
        await notifyMentions({
          mentionedUserIds: ids,
          entity: 'deal',
          entityTitle: deal.title,
          authorId: currentUserId,
          authorName: currentUserName,
          excerpt: body.slice(0, 140),
          actionUrl: `/pipeline?deal=${deal.id}`,
          workspaceId,
        })
      }
    } catch { /* best effort */ }
    setNoteDraft('')
    await loadActivities()
    setPostingNote(false)
  }

  const sendMessage = async () => {
    if (!newMsg.trim() || !deal.contact_id) return
    setSending(true)
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: deal.contact_id, message: newMsg }),
      })
      const data = await res.json()
      if (data.success) {
        setMessages(prev => [...prev, {
          id: data.message?.id || Date.now().toString(),
          direction: 'outbound',
          body: newMsg,
          received_at: new Date().toISOString(),
        }])
        setNewMsg('')
        toast.success('Message sent')
      } else {
        toast.error(data.error || 'Failed to send')
      }
    } catch {
      toast.error('Failed to send message')
    }
    setSending(false)
  }

  const shareViaPortal = async () => {
    if (!deal.contact_id) return
    try {
      const { data: existing } = await supabase
        .from('portal_tokens')
        .select('token')
        .eq('contact_id', deal.contact_id)
        .eq('active', true)
        .single()

      let portalToken = existing?.token
      if (!portalToken) {
        portalToken = crypto.randomUUID()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const ws = await getActiveWorkspace(supabase, user.id, 'id')
        if (!ws) return
        await supabase.from('portal_tokens').insert({
          workspace_id: ws.id,
          contact_id: deal.contact_id,
          token: portalToken,
          active: true,
        })
      }

      const url = `${window.location.origin}/portal/${portalToken}`
      await navigator.clipboard.writeText(url)
      setPortalCopied(true)
      toast.success('Portal URL copied to clipboard')
      setTimeout(() => setPortalCopied(false), 2000)
    } catch {
      toast.error('Failed to create portal link')
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-panel max-w-lg">
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-100">
              <ArrowLeft className="w-4 h-4 text-surface-500" />
            </button>
            <div>
              <h2 className="text-sm font-bold text-surface-900">{deal.title}</h2>
              {deal.contacts?.name && <p className="text-[10px] text-surface-400">{deal.contacts.name}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {deal.status !== 'on_hold' && deal.status !== 'lost' && deal.status !== 'won' && (
              <button
                onClick={() => setShowHoldModal(true)}
                disabled={holdProcessing}
                title="Pause deal"
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-amber-50 text-amber-600 transition-colors disabled:opacity-50"
              >
                <Pause className="w-4 h-4" />
              </button>
            )}
            {deal.status !== 'won' && deal.status !== 'lost' && onMarkWon && (
              <button
                onClick={() => onMarkWon(deal.id)}
                title="Mark as won"
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors"
              >
                <Trophy className="w-4 h-4" />
              </button>
            )}
            {deal.status !== 'lost' && deal.status !== 'won' && onMarkLost && (
              <button
                onClick={() => onMarkLost(deal.id, deal.title, deal.stage_id)}
                title="Mark as lost"
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-600 transition-colors"
              >
                <Ban className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="modal-close"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {/* On-hold banner */}
        {deal.status === 'on_hold' && (
          <div className="mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2">
            <Pause className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-800">On Hold</p>
              {(deal as DealWithContact & { hold_reason?: string | null }).hold_reason && (
                <p className="text-[11px] text-amber-700 mt-0.5">{(deal as DealWithContact & { hold_reason?: string | null }).hold_reason}</p>
              )}
              {(deal as DealWithContact & { hold_until?: string | null }).hold_until && (
                <p className="text-[10px] text-amber-600 mt-0.5">Resume on {new Date((deal as DealWithContact & { hold_until?: string | null }).hold_until as string).toLocaleDateString()}</p>
              )}
            </div>
            <button
              onClick={handleResume}
              disabled={holdProcessing}
              className="btn-primary btn-sm flex items-center gap-1 disabled:opacity-50"
            >
              <Play className="w-3 h-3" /> Resume
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-surface-100">
          <button onClick={() => setActiveTab('details')}
            className={cn('px-4 py-2 text-xs font-semibold border-b-2 transition-colors',
              activeTab === 'details' ? 'border-brand-600 text-brand-600' : 'border-transparent text-surface-400 hover:text-surface-600')}>
            Details
          </button>
          <button onClick={() => setActiveTab('activity')}
            className={cn('px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1',
              activeTab === 'activity' ? 'border-violet-600 text-violet-600' : 'border-transparent text-surface-400 hover:text-surface-600')}>
            <CheckSquare className="w-3 h-3" /> Activity
            {activities.length > 0 && <span className="text-[9px] bg-violet-100 text-violet-700 px-1 rounded-full">{activities.length}</span>}
          </button>
          {deal.contact_id && (
            <button onClick={() => setActiveTab('whatsapp')}
              className={cn('px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1',
                activeTab === 'whatsapp' ? 'border-green-600 text-green-600' : 'border-transparent text-surface-400 hover:text-surface-600')}>
              <MessageCircle className="w-3 h-3" /> WhatsApp
              {messages.length > 0 && <span className="text-[9px] bg-green-100 text-green-700 px-1 rounded-full">{messages.length}</span>}
            </button>
          )}
          {deal.contact_id && contactPhone && (
            <div className="ml-auto pr-2 flex items-center">
              <CallButton contactId={deal.contact_id} dealId={deal.id} phone={contactPhone} contactName={deal.contacts?.name} />
            </div>
          )}
        </div>

        <div className="modal-body">
          {activeTab === 'details' && (
            <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
              {/* Editable fields grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Value - inline edit */}
                <div>
                  <p className="text-[10px] text-surface-400 font-semibold uppercase flex items-center gap-1">Value <Pencil className="w-2.5 h-2.5 opacity-50" /></p>
                  {editingValue ? (
                    <input type="number" className="input text-sm py-1 mt-0.5" autoFocus value={editValue}
                      onChange={e => setEditValue(e.target.value)} onBlur={handleSaveValue}
                      onKeyDown={e => e.key === 'Enter' && handleSaveValue()} />
                  ) : (
                    <p className="text-sm font-bold cursor-pointer hover:text-brand-600 transition-colors" onClick={() => setEditingValue(true)}>
                      {editValue ? formatCurrency(parseFloat(editValue)) : '—'}
                    </p>
                  )}
                </div>
                {/* Status - read only */}
                <div>
                  <p className="text-[10px] text-surface-400 font-semibold uppercase">Status</p>
                  <p className="text-sm font-semibold capitalize">{deal.status}</p>
                </div>
                {/* Close Date - inline edit */}
                <div>
                  <p className="text-[10px] text-surface-400 font-semibold uppercase flex items-center gap-1">Close Date <Pencil className="w-2.5 h-2.5 opacity-50" /></p>
                  {editingCloseDate ? (
                    <input type="date" className="input text-sm py-1 mt-0.5" autoFocus value={editCloseDate}
                      onChange={e => handleSaveCloseDate(e.target.value)} onBlur={() => setEditingCloseDate(false)} />
                  ) : (
                    <p className="text-sm cursor-pointer hover:text-brand-600 transition-colors" onClick={() => setEditingCloseDate(true)}>
                      {editCloseDate ? new Date(editCloseDate).toLocaleDateString() : '—'}
                    </p>
                  )}
                </div>
                {/* Contact - read only */}
                <div>
                  <p className="text-[10px] text-surface-400 font-semibold uppercase">Contact</p>
                  <p className="text-sm">{deal.contacts?.name || '—'}</p>
                </div>
                {/* Probability - inline edit */}
                <div>
                  <p className="text-[10px] text-surface-400 font-semibold uppercase flex items-center gap-1">Probability <Pencil className="w-2.5 h-2.5 opacity-50" /></p>
                  {editingProbability ? (
                    <input type="number" min="0" max="100" className="input text-sm py-1 mt-0.5" autoFocus value={editProbability}
                      onChange={e => setEditProbability(e.target.value)} onBlur={handleSaveProbability}
                      onKeyDown={e => e.key === 'Enter' && handleSaveProbability()} />
                  ) : (
                    <p className="text-sm cursor-pointer hover:text-brand-600 transition-colors" onClick={() => setEditingProbability(true)}>
                      {editProbability ? `${editProbability}%` : '—'}
                    </p>
                  )}
                </div>
                {/* Assigned To */}
                <div>
                  <p className="text-[10px] text-surface-400 font-semibold uppercase">Assigned To</p>
                  <select className="input text-sm py-1 mt-0.5" value={assignedTo} onChange={e => handleAssign(e.target.value)}>
                    <option value="">Unassigned</option>
                    {teamMembers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <p className="text-[10px] text-surface-400 font-semibold uppercase mb-1">Notes</p>
                <textarea
                  className="input text-sm min-h-[60px]"
                  placeholder="Add notes about this deal..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  onBlur={handleSaveNotes}
                />
                {savingNotes && <p className="text-[9px] text-surface-400 mt-0.5">Saving...</p>}
              </div>

              {/* Next Action / Follow-up */}
              <div className="border-t border-surface-100 pt-3">
                <p className="text-[10px] text-surface-400 font-semibold uppercase mb-2">Next Action</p>
                <div className="flex gap-2">
                  <input type="text" className="input text-xs flex-1" placeholder="Follow-up description..."
                    value={nextActionText} onChange={e => setNextActionText(e.target.value)} />
                  <input type="date" className="input text-xs w-32" value={nextActionDate}
                    onChange={e => setNextActionDate(e.target.value)} />
                  <button onClick={handleCreateNextAction} disabled={creatingAction || !nextActionText.trim()}
                    className="btn-primary btn-sm disabled:opacity-50">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {deal.contact_id && (
                <button onClick={shareViaPortal}
                  className="btn-secondary btn-sm w-full flex items-center justify-center gap-1.5 mt-3">
                  <Share2 className="w-3.5 h-3.5" />
                  {portalCopied ? 'URL Copied!' : 'Share via Portal'}
                </button>
              )}
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="flex flex-col h-[60vh]">
              <div className="flex-1 overflow-y-auto py-2 pr-1">
                {loadingActivities ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="w-6 h-6 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
                  </div>
                ) : activities.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-center">
                    <CheckSquare className="w-8 h-8 text-surface-300 mb-2" />
                    <p className="text-xs text-surface-400">No activities yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activities.map(act => {
                      const authorName = act.author?.full_name || act.author?.email || 'Usuario'
                      const initials = authorName
                        .split(' ')
                        .map(w => w[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join('')
                        .toUpperCase() || '?'
                      const typeBadgeColor =
                        act.type === 'note' ? 'bg-surface-100 text-surface-600' :
                        act.type === 'task' ? 'bg-emerald-100 text-emerald-700' :
                        act.type === 'call' ? 'bg-blue-100 text-blue-700' :
                        act.type === 'email' ? 'bg-orange-100 text-orange-700' :
                        act.type === 'meeting' ? 'bg-violet-100 text-violet-700' :
                        'bg-surface-100 text-surface-600'
                      return (
                        <div key={act.id} className="flex items-start gap-2">
                          <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                            {initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                              <span className="text-xs font-semibold text-surface-800">{authorName}</span>
                              <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase', typeBadgeColor)}>
                                {act.type}
                              </span>
                              <span className="text-[10px] text-surface-400">{relativeTime(act.created_at)}</span>
                            </div>
                            <div className="rounded-xl bg-surface-50 dark:bg-surface-800 px-3 py-2 text-xs text-surface-700 dark:text-surface-200">
                              {act.type === 'note' && act.notes ? (
                                <MentionText text={act.notes} className="whitespace-pre-wrap break-words" />
                              ) : act.type === 'task' ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleToggleActivityDone(act)}
                                    className={cn(
                                      'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                                      act.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-surface-300 bg-white'
                                    )}
                                  >
                                    {act.done && <Check className="w-3 h-3" />}
                                  </button>
                                  <span className={cn('flex-1', act.done && 'line-through text-surface-400')}>{act.title}</span>
                                  {act.due_date && (
                                    <span className="text-[9px] text-amber-600 flex items-center gap-0.5 bg-amber-50 px-1.5 py-0.5 rounded-full">
                                      <Clock className="w-3 h-3" />
                                      {new Date(act.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                  )}
                                </div>
                              ) : act.type === 'call' ? (
                                <span>📞 Llamada: {act.title}</span>
                              ) : act.type === 'email' ? (
                                <span>✉️ Email: {act.title}</span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <ActivityIcon type={act.type} />
                                  <span>{act.title}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              {/* Composer */}
              <div className="border-t border-surface-100 pt-2 mt-2">
                <MentionTextarea
                  value={noteDraft}
                  onChange={setNoteDraft}
                  users={teamMembers.map(m => ({ id: m.id, name: m.full_name || 'User' }))}
                  placeholder="Write a note... (use @ to mention)"
                  rows={2}
                  className="input text-xs w-full"
                />
                <div className="flex justify-end mt-1.5">
                  <button
                    onClick={handlePostNote}
                    disabled={postingNote || !noteDraft.trim()}
                    className="btn-primary btn-sm disabled:opacity-50"
                  >
                    {postingNote ? 'Posting...' : 'Add note'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'whatsapp' && (
            <div className="flex flex-col h-[60vh] sm:h-[380px]">
              {loadingMsgs ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-green-200 border-t-green-600 rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-center">
                  <div>
                    <MessageCircle className="w-8 h-8 text-surface-300 mx-auto mb-2" />
                    <p className="text-xs text-surface-400">No WhatsApp messages with this contact</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-2 py-2">
                  {messages.map(msg => (
                    <div key={msg.id} className={cn('flex', msg.direction === 'outbound' ? 'justify-end' : 'justify-start')}>
                      <div className={cn('max-w-[80%] rounded-xl px-3 py-2',
                        msg.direction === 'outbound'
                          ? 'bg-green-600 text-white rounded-br-sm'
                          : 'bg-surface-100 text-surface-800 rounded-bl-sm')}>
                        <p className="text-xs whitespace-pre-wrap">{msg.body}</p>
                        <p className={cn('text-[9px] mt-1', msg.direction === 'outbound' ? 'text-green-200' : 'text-surface-400')}>
                          {msg.direction === 'inbound' ? 'IN' : 'OUT'} · {new Date(msg.received_at).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick-reply input */}
              <div className="flex gap-2 pt-2 border-t border-surface-100 mt-auto">
                <input
                  className="input flex-1 text-xs"
                  placeholder="Type a message..."
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                />
                <button onClick={sendMessage} disabled={sending || !newMsg.trim()}
                  className="btn-primary btn-sm flex items-center gap-1">
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {showHoldModal && (
        <OnHoldModal
          dealTitle={deal.title}
          onConfirm={handlePause}
          onCancel={() => setShowHoldModal(false)}
        />
      )}
    </div>
  )
}

// --- LOSS REASON MODAL ---
interface LossReasonOption { id: string; label: string; color: string }
function LossReasonModal({ dealTitle, onConfirm, onCancel }: {
  dealTitle: string
  onConfirm: (payload: { reasonId: string | null; reasonLabel: string; notes: string }) => void
  onCancel: () => void
}) {
  const [reasons, setReasons] = useState<LossReasonOption[]>([])
  const [loadingReasons, setLoadingReasons] = useState(true)
  const [selectedId, setSelectedId] = useState<string>('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/loss-reasons')
      .then(r => r.json())
      .then(j => {
        if (cancelled) return
        setReasons(j.reasons || [])
        setLoadingReasons(false)
      })
      .catch(() => { if (!cancelled) setLoadingReasons(false) })
    return () => { cancelled = true }
  }, [])

  const selected = reasons.find(r => r.id === selectedId) || null
  const canSubmit = !!selected

  const submit = () => {
    if (!selected) return
    onConfirm({ reasonId: selected.id, reasonLabel: selected.label, notes: notes.trim() })
  }

  return (
    <div className="modal-overlay">
      <div className="modal-panel max-w-sm">
        <div className="modal-header">
          <h2 className="text-sm font-bold">Why was this deal lost?</h2>
          <button onClick={onCancel} className="modal-close"><X className="w-4 h-4" /></button>
        </div>
        <div className="modal-body space-y-3">
          <p className="text-xs text-surface-500">Select a reason for losing &ldquo;{dealTitle}&rdquo;.</p>

          {loadingReasons ? (
            <div className="py-6 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
            </div>
          ) : reasons.length === 0 ? (
            <div className="rounded-lg border border-dashed border-surface-200 p-3 text-xs text-surface-500">
              No loss reasons configured. <a href="/settings/loss-reasons" className="text-brand-600 underline">Configure now</a>.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {reasons.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm transition-colors',
                    selectedId === r.id
                      ? 'border-brand-500 bg-brand-50 text-brand-800'
                      : 'border-surface-200 hover:border-surface-300 hover:bg-surface-50'
                  )}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.color || '#94a3b8' }} />
                  <span className="flex-1">{r.label}</span>
                  {selectedId === r.id && <Check className="w-4 h-4 text-brand-600" />}
                </button>
              ))}
            </div>
          )}

          <div>
            <label className="text-[10px] font-semibold uppercase text-surface-400">Additional notes (optional)</label>
            <textarea
              className="input min-h-[60px] text-sm mt-1"
              placeholder="More context..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
            <button type="button" disabled={!canSubmit} onClick={submit}
              className="btn-primary flex-1 disabled:opacity-50">Mark as Lost</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- ON-HOLD MODAL ---
function OnHoldModal({ dealTitle, onConfirm, onCancel }: {
  dealTitle: string
  onConfirm: (payload: { reason: string; until: string }) => void
  onCancel: () => void
}) {
  const [reason, setReason] = useState('')
  const [until, setUntil] = useState('')
  return (
    <div className="modal-overlay">
      <div className="modal-panel max-w-sm">
        <div className="modal-header">
          <h2 className="text-sm font-bold flex items-center gap-1.5"><Pause className="w-4 h-4" /> Pause Deal</h2>
          <button onClick={onCancel} className="modal-close"><X className="w-4 h-4" /></button>
        </div>
        <div className="modal-body space-y-3">
          <p className="text-xs text-surface-500">Pause &ldquo;{dealTitle}&rdquo; — it will move to On Hold.</p>
          <div>
            <label className="text-[10px] font-semibold uppercase text-surface-400">Why are you pausing this deal?</label>
            <textarea
              className="input min-h-[70px] text-sm mt-1"
              placeholder="e.g. Waiting on client decision..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase text-surface-400">Resume on (optional)</label>
            <input type="date" className="input text-sm mt-1" value={until} onChange={e => setUntil(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
            <button type="button" disabled={!reason.trim()} onClick={() => onConfirm({ reason: reason.trim(), until })}
              className="btn-primary flex-1 disabled:opacity-50">Pause deal</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- CELEBRATION OVERLAY ---
function CelebrationOverlay({ title, value, onDone }: { title: string; value: number; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 animate-fade-in">
      <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-8 text-center text-white shadow-2xl max-w-sm mx-4 animate-scale-in">
        <p className="text-5xl mb-3">&#127881;</p>
        <p className="text-2xl font-extrabold mb-1">Deal Won!</p>
        <p className="text-lg font-semibold opacity-90 mb-2">{title}</p>
        {value > 0 && <p className="text-3xl font-black">{formatCurrency(value)}</p>}
        <p className="text-sm opacity-75 mt-3">Congratulations!</p>
      </div>
    </div>
  )
}

// --- TABLE VIEW ---
function DealsTable({ deals, columns, teamMembers, onSelectDeal }: {
  deals: DealWithContact[]; columns: Column[]; teamMembers: Pick<Profile, 'id' | 'full_name'>[];
  onSelectDeal: (d: DealWithContact) => void;
}) {
  const [sortField, setSortField] = useState<string>('title')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const stageMap = Object.fromEntries(columns.map(c => [c.id, c.name]))
  const memberMap = Object.fromEntries(teamMembers.map(m => [m.id, m.full_name]))

  const sorted = [...deals].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    switch (sortField) {
      case 'title': return dir * a.title.localeCompare(b.title)
      case 'contact': return dir * ((a.contacts?.name || '').localeCompare(b.contacts?.name || ''))
      case 'stage': return dir * ((stageMap[a.stage_id] || '').localeCompare(stageMap[b.stage_id] || ''))
      case 'value': return dir * ((a.value || 0) - (b.value || 0))
      case 'probability': return dir * ((a.probability ?? 0) - (b.probability ?? 0))
      case 'age': return dir * (getDealAgeDays(a) - getDealAgeDays(b))
      case 'close_date': return dir * ((a.expected_close_date || '').localeCompare(b.expected_close_date || ''))
      case 'assigned': return dir * ((memberMap[a.owner_id || ''] || '').localeCompare(memberMap[b.owner_id || ''] || ''))
      default: return 0
    }
  })

  const SortHeader = ({ field, label }: { field: string; label: string }) => (
    <th className="text-left text-[10px] font-semibold text-surface-400 uppercase px-3 py-2 cursor-pointer hover:text-surface-600 select-none"
      onClick={() => toggleSort(field)}>
      <span className="flex items-center gap-1">{label}
        {sortField === field && <ArrowUpDown className="w-3 h-3" />}
      </span>
    </th>
  )

  return (
    <div className="card overflow-hidden flex-1 overflow-y-auto">
      <table className="w-full">
        <thead className="border-b border-surface-100 bg-surface-50/50 dark:bg-surface-800/50 sticky top-0">
          <tr>
            <SortHeader field="title" label="Title" />
            <SortHeader field="contact" label="Contact" />
            <SortHeader field="stage" label="Stage" />
            <SortHeader field="value" label="Value" />
            <SortHeader field="probability" label="Prob." />
            <SortHeader field="age" label="Age" />
            <SortHeader field="close_date" label="Close Date" />
            <SortHeader field="assigned" label="Assigned To" />
          </tr>
        </thead>
        <tbody>
          {sorted.map(deal => (
            <tr key={deal.id} onClick={() => onSelectDeal(deal)}
              className="border-b border-surface-100 hover:bg-surface-50 dark:hover:bg-surface-800 cursor-pointer transition-colors">
              <td className="px-3 py-2 text-xs font-semibold text-surface-800">{deal.title}</td>
              <td className="px-3 py-2 text-xs text-surface-500">{deal.contacts?.name || '—'}</td>
              <td className="px-3 py-2 text-xs text-surface-500">{stageMap[deal.stage_id] || '—'}</td>
              <td className="px-3 py-2 text-xs font-bold text-surface-800">{deal.value ? formatCurrency(deal.value) : '—'}</td>
              <td className="px-3 py-2 text-xs text-surface-500">{deal.probability != null ? `${deal.probability}%` : '—'}</td>
              <td className="px-3 py-2"><DealAgeBadge days={getDealAgeDays(deal)} /></td>
              <td className="px-3 py-2 text-xs text-surface-500">{deal.expected_close_date ? new Date(deal.expected_close_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</td>
              <td className="px-3 py-2 text-xs text-surface-500">{memberMap[deal.owner_id || ''] || '—'}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr><td colSpan={8} className="px-3 py-8 text-center text-xs text-surface-400">No deals match your filters</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// --- MAIN PAGE ---
interface PipelineInfo {
  id: string
  name: string
  color: string
  contact_id?: string | null
  contacts?: { name: string } | null
}

export default function PipelinePage() {
  const supabase = createClient()
  const { template, customFields } = useWorkspace()
  const { t } = useI18n()
  const [pipelines, setPipelines] = useState<PipelineInfo[]>([])
  const [activePipelineId, setActivePipelineId] = useState<string>('')
  const [columns, setColumns] = useState<Column[]>([])
  const [contacts, setContacts] = useState<Pick<Contact, 'id' | 'name' | 'email'>[]>([])
  const [teamMembers, setTeamMembers] = useState<Pick<Profile, 'id' | 'full_name'>[]>([])
  const [workspaceId, setWorkspaceId] = useState<string>('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserName, setCurrentUserName] = useState<string>('Alguien')
  const [showNewDeal, setShowNewDeal] = useState(false)
  const [selectedDeal, setSelectedDeal] = useState<DealWithContact | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [lossReasonPrompt, setLossReasonPrompt] = useState<{ dealId: string; dealTitle: string; stageId: string } | null>(null)
  const [wonThisMonthValue, setWonThisMonthValue] = useState(0)
  const [mobileStage, setMobileStage] = useState<string | null>(null)

  // New states for features 6, 7, 8
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<FilterState>({ minValue: '', maxValue: '', assignedTo: '', age: 'all' })
  const [celebration, setCelebration] = useState<{ title: string; value: number } | null>(null)
  const [statusView, setStatusView] = useState<'active' | 'on_hold' | 'won' | 'lost'>('active')
  const [altDeals, setAltDeals] = useState<DealWithContact[]>([])
  const [altLossLabels, setAltLossLabels] = useState<Record<string, { label: string; color: string }>>({})
  const [altLoading, setAltLoading] = useState(false)

  const activeFilterCount = [
    filters.minValue, filters.maxValue, filters.assignedTo, filters.age !== 'all' ? 'yes' : '',
  ].filter(Boolean).length

  const loadData = useCallback(async (pipelineId?: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUserId(user.id)

    const ws = await getActiveWorkspace(supabase, user.id, 'id')
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)

    // Load all pipelines
    const { data: pipelinesData, error: pipelinesErr } = await supabase.from('pipelines').select('id, name, color, contact_id, contacts(name)').eq('workspace_id', ws.id).order('order_index')
    if (pipelinesErr) {
      console.error('[pipeline] pipelines load failed:', pipelinesErr)
      toast.error(`Pipelines: ${pipelinesErr.message}`)
    }
    const allPipelines = pipelinesData || []
    console.log('[pipeline] loaded', { workspaceId: ws.id, pipelinesCount: allPipelines.length })
    setPipelines(allPipelines as unknown as PipelineInfo[])

    // Pick active pipeline
    const activeId = pipelineId || allPipelines[0]?.id || ''
    setActivePipelineId(activeId)

    if (!activeId) {
      console.warn('[pipeline] no active pipeline id')
      setLoading(false)
      return
    }

    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

    const [stagesRes, dealsRes, contactsRes, wonThisMonthRes, profilesRes] = await Promise.all([
      supabase.from('pipeline_stages').select('*').eq('pipeline_id', activeId).order('order_index'),
      supabase.from('deals').select('*, contacts!deals_contact_id_fkey(name, email)').eq('workspace_id', ws.id).eq('pipeline_id', activeId).eq('status', 'open').order('order_index'),
      supabase.from('contacts').select('id, name, email').eq('workspace_id', ws.id).order('name'),
      supabase.from('deals').select('id, value').eq('workspace_id', ws.id).eq('pipeline_id', activeId).eq('status', 'won').gte('updated_at', firstOfMonth),
      supabase.from('profiles').select('id, full_name').eq('workspace_id', ws.id),
    ])

    if (stagesRes.error) console.error('[pipeline] stages load failed:', stagesRes.error)
    if (dealsRes.error) console.error('[pipeline] deals load failed:', dealsRes.error)
    const stages: PipelineStage[] = stagesRes.data || []
    const deals: DealWithContact[] = dealsRes.data || []
    console.log('[pipeline] loaded', { activeId, stages: stages.length, deals: deals.length })
    setContacts(contactsRes.data || [])
    const tm = (profilesRes.data || []) as Pick<Profile, 'id' | 'full_name'>[]
    setTeamMembers(tm)
    const me = tm.find(t => t.id === user.id)
    if (me?.full_name) setCurrentUserName(me.full_name)
    const wonDeals: { id: string; value: number }[] = wonThisMonthRes.data || []
    setWonThisMonthValue(wonDeals.reduce((s, d) => s + (d.value || 0), 0))

    // Load next tasks for deals
    const dealIds = deals.map(d => d.id)
    let nextTaskMap: Record<string, { title: string; due_date: string }> = {}
    if (dealIds.length > 0) {
      const { data: tasks } = await supabase
        .from('activities')
        .select('deal_id, title, due_date')
        .in('deal_id', dealIds)
        .eq('done', false)
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true })

      if (tasks) {
        for (const task of tasks) {
          if (task.deal_id && !nextTaskMap[task.deal_id]) {
            nextTaskMap[task.deal_id] = { title: task.title, due_date: task.due_date! }
          }
        }
      }
    }

    setColumns(stages.map(stage => ({
      ...stage,
      deals: deals.filter(d => d.stage_id === stage.id).map(d => ({
        ...d,
        next_task: nextTaskMap[d.id] || null,
      })),
    })))
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Load alternate status views
  const loadAltDeals = useCallback(async (status: 'on_hold' | 'won' | 'lost') => {
    if (!workspaceId || !activePipelineId) return
    setAltLoading(true)
    const { data } = await supabase
      .from('deals')
      .select('*, contacts!deals_contact_id_fkey(name, email)')
      .eq('workspace_id', workspaceId)
      .eq('pipeline_id', activePipelineId)
      .eq('status', status)
      .order('updated_at', { ascending: false })
    setAltDeals((data || []) as DealWithContact[])

    if (status === 'lost') {
      const ids = Array.from(new Set((data || []).map((d: DbRow) => d.lost_reason_id).filter(Boolean))) as string[]
      if (ids.length > 0) {
        const { data: reasons } = await supabase
          .from('loss_reasons')
          .select('id, label, color')
          .in('id', ids)
        const map: Record<string, { label: string; color: string }> = {}
        for (const r of (reasons || []) as { id: string; label: string; color: string }[]) {
          map[r.id] = { label: r.label, color: r.color }
        }
        setAltLossLabels(map)
      } else {
        setAltLossLabels({})
      }
    }
    setAltLoading(false)
  }, [supabase, workspaceId, activePipelineId])

  useEffect(() => {
    if (statusView === 'active') return
    loadAltDeals(statusView)
  }, [statusView, loadAltDeals])

  const handleResumeFromList = async (dealId: string) => {
    try {
      const res = await fetch(`/api/deals/${dealId}/hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ on_hold: false }),
      })
      if (res.ok) {
        setAltDeals(prev => prev.filter(d => d.id !== dealId))
        toast.success('Deal resumed')
        loadData(activePipelineId)
      }
    } catch {
      toast.error('Failed to resume')
    }
  }


  const switchPipeline = (pipelineId: string) => {
    setLoading(true)
    loadData(pipelineId)
  }

  const handleCreateDeal = async (dealData: Partial<Deal>): Promise<boolean> => {
    if (!activePipelineId) {
      toast.error('No active pipeline — reload the page')
      return false
    }
    const dataWithPipeline = { ...dealData, pipeline_id: activePipelineId, owner_id: currentUserId || undefined }
    console.log('[pipeline] handleCreateDeal', dataWithPipeline)
    const { data, error } = await supabase.from('deals').insert([dataWithPipeline]).select('*, contacts!deals_contact_id_fkey(name, email)').single()
    if (error || !data) {
      console.error('[pipeline] create failed:', error)
      toast.error(`Could not create: ${error?.message || 'unknown error'}`)
      return false
    }
    setColumns(prev => prev.map(col =>
      col.id === dealData.stage_id ? { ...col, deals: [...col.deals, data] } : col
    ))
    toast.success('Created')
    return true
  }

  const handleUpdateDeal = (dealId: string, updates: Partial<Deal>) => {
    setColumns(prev => prev.map(col => ({
      ...col,
      deals: col.deals.map(d => d.id === dealId ? { ...d, ...updates } : d),
    })))
    // Also update selectedDeal if it matches
    setSelectedDeal(prev => prev && prev.id === dealId ? { ...prev, ...updates } : prev)
  }

  const handleMoveDeal = async (dealId: string, newStageId: string) => {
    const targetStage = columns.find(c => c.id === newStageId)
    const deal = columns.flatMap(c => c.deals).find(d => d.id === dealId)
    if (!deal || !targetStage) return
    const fromStage = columns.find(c => c.deals.some(d => d.id === dealId))

    // Legacy per-stage required_fields check
    const requiredFields = (targetStage.required_fields as string[]) || []
    if (requiredFields.length > 0) {
      const missing: string[] = []
      if (requiredFields.includes('value') && !deal.value) missing.push('Value')
      if (requiredFields.includes('contact') && !deal.contact_id) missing.push('Contact')
      if (requiredFields.includes('close_date') && !deal.expected_close_date) missing.push('Close date')
      if (requiredFields.includes('probability') && !deal.probability) missing.push('Probability')
      if (missing.length > 0) {
        toast.error(`Cannot move to "${targetStage.name}": missing ${missing.join(', ')}`)
        return
      }
    }

    // Configurable stage transition conditions (workspace rules)
    const transition = validateTransition(
      deal as unknown as Record<string, unknown>,
      fromStage?.name || '',
      targetStage.name || '',
    )
    if (!transition.allowed) {
      const msg = `Cannot move to "${targetStage.name}": ${transition.reason || 'missing ' + transition.missingFields.join(', ')}`
      toast.error(msg)
      if (typeof window !== 'undefined') window.alert(msg)
      return
    }
    if (transition.requireApproval && typeof window !== 'undefined') {
      const ok = window.confirm(`Move "${deal.title}" to "${targetStage.name}"? This stage requires approval.`)
      if (!ok) return
    }

    // Intercept lost stage: require a reason
    if (targetStage.is_lost) {
      setLossReasonPrompt({ dealId, dealTitle: deal.title, stageId: newStageId })
      return
    }

    await supabase.from('deals').update({
      stage_id: newStageId,
      ...(targetStage.is_won ? { status: 'won' } : {}),
    }).eq('id', dealId)

    if (deal.owner_id && deal.owner_id !== currentUserId) {
      notifyRecordChange({
        entity: 'deal',
        entityId: dealId,
        entityTitle: deal.title,
        ownerId: deal.owner_id,
        editorId: currentUserId,
        editorName: currentUserName,
        actionUrl: `/pipeline?deal=${dealId}`,
        workspaceId,
      })
    }

    setColumns(prev => {
      return prev.map(col => ({
        ...col,
        deals: col.id === newStageId
          ? [...col.deals.filter(d => d.id !== dealId), { ...deal, stage_id: newStageId }]
          : col.deals.filter(d => d.id !== dealId),
      }))
    })

    if (targetStage.is_won) {
      setCelebration({ title: deal.title, value: deal.value || 0 })
      toast.success(`Deal won!`)
    }
  }

  const handleLossConfirm = async (payload: { reasonId: string | null; reasonLabel: string; notes: string }) => {
    if (!lossReasonPrompt) return
    const { dealId, stageId } = lossReasonPrompt
    const deal = columns.flatMap(c => c.deals).find(d => d.id === dealId)
    if (!deal) return

    const combinedText = payload.notes ? `${payload.reasonLabel} — ${payload.notes}` : payload.reasonLabel

    await supabase.from('deals').update({
      stage_id: stageId,
      status: 'lost',
      lost_reason: combinedText,
      lost_reason_id: payload.reasonId,
    }).eq('id', dealId)

    setColumns(prev => prev.map(col => ({
      ...col,
      deals: col.id === stageId
        ? [...col.deals.filter(d => d.id !== dealId), { ...deal, stage_id: stageId, status: 'lost', lost_reason: combinedText }]
        : col.deals.filter(d => d.id !== dealId),
    })))

    toast.error('Deal marked as lost')
    setLossReasonPrompt(null)
    // Close detail panel if this deal was open there
    setSelectedDeal(prev => (prev && prev.id === dealId ? null : prev))
  }

  const handleMarkWonFromPanel = async (dealId: string) => {
    const deal = columns.flatMap(c => c.deals).find(d => d.id === dealId)
    if (!deal) return
    const wonStage = columns.find(c => c.is_won)
    const targetStageId = wonStage?.id || deal.stage_id
    await supabase.from('deals').update({
      status: 'won',
      stage_id: targetStageId,
    }).eq('id', dealId)

    setColumns(prev => prev.map(col => ({
      ...col,
      deals: col.id === targetStageId
        ? [...col.deals.filter(d => d.id !== dealId), { ...deal, stage_id: targetStageId, status: 'won' as const }]
        : col.deals.filter(d => d.id !== dealId),
    })))

    setCelebration({ title: deal.title, value: deal.value || 0 })
    toast.success('Deal won!')
    setSelectedDeal(null)
  }

  const filteredColumns = columns.map(col => ({
    ...col,
    deals: col.deals.filter(d => {
      // Text search
      if (search && !d.title.toLowerCase().includes(search.toLowerCase()) &&
        !d.contacts?.name?.toLowerCase().includes(search.toLowerCase())) return false
      // Min value
      if (filters.minValue && (d.value || 0) < parseFloat(filters.minValue)) return false
      // Max value
      if (filters.maxValue && (d.value || 0) > parseFloat(filters.maxValue)) return false
      // Assigned to
      if (filters.assignedTo && d.owner_id !== filters.assignedTo) return false
      // Age filter
      if (filters.age !== 'all') {
        const days = getDealAgeDays(d)
        if (filters.age === 'fresh' && days >= 7) return false
        if (filters.age === 'aging' && (days < 7 || days > 14)) return false
        if (filters.age === 'stale' && days <= 14) return false
      }
      return true
    }),
  }))

  const allOpenDeals = columns.flatMap(c => c.deals)
  const totalValue = allOpenDeals.reduce((s, d) => s + (d.value || 0), 0)
  const totalDeals = allOpenDeals.length
  const weightedForecast = allOpenDeals.reduce((s, d) => s + ((d.value || 0) * ((d.probability ?? 50) / 100)), 0)
  const activePipeline = pipelines.find(p => p.id === activePipelineId)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="animate-fade-in flex flex-col h-full">
      {/* Header */}
      <div className="page-header flex-shrink-0">
        <div>
          <h1 className="page-title">{template.dealLabel.plural}</h1>
          <p className="page-subtitle">
            {totalDeals} {template.dealLabel.plural.toLowerCase()} · {formatCurrency(totalValue)} total
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex items-center bg-surface-100 dark:bg-surface-800 rounded-lg p-0.5">
            <button onClick={() => setViewMode('kanban')}
              className={cn('px-2 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1',
                viewMode === 'kanban' ? 'bg-white dark:bg-surface-700 text-surface-900 shadow-sm' : 'text-surface-400 hover:text-surface-600')}>
              <LayoutGrid className="w-3.5 h-3.5" /> Kanban
            </button>
            <button onClick={() => setViewMode('table')}
              className={cn('px-2 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1',
                viewMode === 'table' ? 'bg-white dark:bg-surface-700 text-surface-900 shadow-sm' : 'text-surface-400 hover:text-surface-600')}>
              <Table2 className="w-3.5 h-3.5" /> Table
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input className="input pl-9 w-full sm:w-56 text-xs"
              placeholder={`Search ${template.dealLabel.plural.toLowerCase()}...`}
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {/* Filters button */}
          <div className="relative">
            <button onClick={() => setShowFilters(!showFilters)}
              className={cn('btn-secondary btn-sm flex items-center gap-1', showFilters && 'ring-2 ring-brand-300')}>
              <Filter className="w-3.5 h-3.5" /> Filters
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-brand-600 text-white text-[9px] flex items-center justify-center font-bold">{activeFilterCount}</span>
              )}
            </button>
            {showFilters && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-xl shadow-xl p-3 w-64 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-surface-400 font-semibold uppercase">Min Value</label>
                    <input type="number" className="input text-xs" placeholder="0" value={filters.minValue}
                      onChange={e => setFilters(f => ({ ...f, minValue: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-[10px] text-surface-400 font-semibold uppercase">Max Value</label>
                    <input type="number" className="input text-xs" placeholder="Any" value={filters.maxValue}
                      onChange={e => setFilters(f => ({ ...f, maxValue: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-surface-400 font-semibold uppercase">Assigned To</label>
                  <select className="input text-xs" value={filters.assignedTo}
                    onChange={e => setFilters(f => ({ ...f, assignedTo: e.target.value }))}>
                    <option value="">All</option>
                    {teamMembers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-surface-400 font-semibold uppercase">Age</label>
                  <select className="input text-xs" value={filters.age}
                    onChange={e => setFilters(f => ({ ...f, age: e.target.value as FilterState['age'] }))}>
                    <option value="all">All</option>
                    <option value="fresh">Fresh (&lt;7d)</option>
                    <option value="aging">Aging (7-14d)</option>
                    <option value="stale">Stale (&gt;14d)</option>
                  </select>
                </div>
                <button onClick={() => { setFilters({ minValue: '', maxValue: '', assignedTo: '', age: 'all' }); setShowFilters(false) }}
                  className="btn-secondary btn-sm w-full text-xs">Clear Filters</button>
              </div>
            )}
          </div>
          <button onClick={() => setShowNewDeal(true)} className="btn-primary btn-sm">
            <Plus className="w-3.5 h-3.5" /> New {template.dealLabel.singular}
          </button>
        </div>
      </div>

      {/* Pipeline selector - only show if multiple pipelines */}
      {pipelines.length > 1 && (
        <div className="segmented-control mb-4 flex-shrink-0 overflow-x-auto no-scrollbar">
          {pipelines.map(p => (
            <button key={p.id} onClick={() => switchPipeline(p.id)}
              data-active={activePipelineId === p.id}
              className={cn(activePipelineId === p.id && 'active')}>
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
              <span>{p.name}</span>
              {p.contacts?.name && (
                <span className="text-[10px] px-1.5 py-0.5 bg-surface-200/50 rounded-full text-surface-400 font-medium">
                  {p.contacts.name}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* No pipeline */}
      {columns.length === 0 && pipelines.length === 0 && (
        <div className="empty-state flex-1">
          <div className="empty-state-icon">
            <Filter className="w-7 h-7 text-surface-300" />
          </div>
          <p className="empty-state-title">No pipeline yet</p>
          <p className="empty-state-desc">Go to Settings to create your pipeline and start tracking deals.</p>
          <a href="/settings" className="btn-primary">Set up pipeline</a>
        </div>
      )}

      {/* Revenue Forecast */}
      {columns.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 flex-shrink-0">
          <div className="card p-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-50 dark:bg-blue-950 rounded-lg flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-surface-500 font-medium">Pipeline Value</p>
              <p className="text-sm font-bold text-surface-900">{formatCurrency(totalValue)}</p>
            </div>
          </div>
          <div className="card p-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-violet-50 dark:bg-violet-950 rounded-lg flex items-center justify-center">
              <Filter className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <p className="text-xs text-surface-500 font-medium">Weighted Forecast</p>
              <p className="text-sm font-bold text-violet-700">{formatCurrency(weightedForecast)}</p>
            </div>
          </div>
          <div className="card p-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-950 rounded-lg flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-surface-500 font-medium">Won This Month</p>
              <p className="text-sm font-bold text-emerald-700">{formatCurrency(wonThisMonthValue)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Status view segmented control */}
      <div className="mb-3 flex items-center gap-0.5 bg-surface-100 dark:bg-surface-800 rounded-lg p-0.5 w-fit">
        {([
          { id: 'active', label: 'Active' },
          { id: 'on_hold', label: 'On Hold' },
          { id: 'won', label: 'Won' },
          { id: 'lost', label: 'Lost' },
        ] as const).map(opt => (
          <button
            key={opt.id}
            onClick={() => setStatusView(opt.id)}
            className={cn('px-3 py-1 rounded-md text-xs font-semibold transition-colors',
              statusView === opt.id ? 'bg-white dark:bg-surface-700 text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700')}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* ALT STATUS TABLES */}
      {statusView !== 'active' && (
        <div className="card p-0 overflow-hidden flex-1 flex flex-col">
          {altLoading ? (
            <div className="p-8 text-center text-sm text-surface-400">Loading...</div>
          ) : altDeals.length === 0 ? (
            <div className="p-8 text-center text-sm text-surface-400">No {statusView === 'on_hold' ? 'on-hold' : statusView} deals.</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-50 dark:bg-surface-800 text-[11px] font-semibold text-surface-500 uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Title</th>
                    <th className="px-3 py-2 text-right">Value</th>
                    <th className="px-3 py-2 text-left">Contact</th>
                    {statusView === 'on_hold' && <th className="px-3 py-2 text-left">Hold reason</th>}
                    {statusView === 'on_hold' && <th className="px-3 py-2 text-left">Resume on</th>}
                    {statusView === 'lost' && <th className="px-3 py-2 text-left">Reason</th>}
                    {statusView === 'lost' && <th className="px-3 py-2 text-left">Date</th>}
                    {statusView === 'won' && <th className="px-3 py-2 text-left">Closed</th>}
                    <th className="px-3 py-2 text-left">Owner</th>
                    {statusView === 'on_hold' && <th className="px-3 py-2"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {altDeals.map(d => {
                    const dRaw = d as DealWithContact & { hold_reason?: string; hold_until?: string; lost_reason_id?: string; lost_reason?: string; updated_at?: string }
                    const owner = teamMembers.find(t => t.id === d.owner_id)?.full_name || '—'
                    const lostReasonInfo = dRaw.lost_reason_id ? altLossLabels[dRaw.lost_reason_id] : null
                    return (
                      <tr key={d.id} className="hover:bg-surface-50 dark:hover:bg-surface-800 cursor-pointer" onClick={() => setSelectedDeal(d)}>
                        <td className="px-3 py-2 font-medium text-surface-800">{d.title}</td>
                        <td className="px-3 py-2 text-right text-surface-700">{formatCurrency(d.value || 0)}</td>
                        <td className="px-3 py-2 text-surface-600">{d.contacts?.name || '—'}</td>
                        {statusView === 'on_hold' && <td className="px-3 py-2 text-surface-600 max-w-[220px] truncate">{dRaw.hold_reason || '—'}</td>}
                        {statusView === 'on_hold' && <td className="px-3 py-2 text-surface-600">{dRaw.hold_until ? new Date(dRaw.hold_until).toLocaleDateString() : '—'}</td>}
                        {statusView === 'lost' && (
                          <td className="px-3 py-2">
                            {lostReasonInfo ? (
                              <span className="inline-flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: lostReasonInfo.color }} />
                                <span className="text-surface-700">{lostReasonInfo.label}</span>
                              </span>
                            ) : (
                              <span className="text-surface-500">{dRaw.lost_reason || '—'}</span>
                            )}
                          </td>
                        )}
                        {statusView === 'lost' && <td className="px-3 py-2 text-surface-500">{dRaw.updated_at ? new Date(dRaw.updated_at).toLocaleDateString() : '—'}</td>}
                        {statusView === 'won' && <td className="px-3 py-2 text-surface-500">{dRaw.updated_at ? new Date(dRaw.updated_at).toLocaleDateString() : '—'}</td>}
                        <td className="px-3 py-2 text-surface-600">{owner}</td>
                        {statusView === 'on_hold' && (
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleResumeFromList(d.id) }}
                              className="btn-primary btn-sm inline-flex items-center gap-1"
                            >
                              <Play className="w-3 h-3" /> Resume
                            </button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TABLE VIEW */}
      {statusView === 'active' && columns.length > 0 && viewMode === 'table' && (
        <DealsTable
          deals={filteredColumns.flatMap(c => c.deals)}
          columns={filteredColumns}
          teamMembers={teamMembers}
          onSelectDeal={setSelectedDeal}
        />
      )}

      {/* Mobile Accordion View */}
      {statusView === 'active' && columns.length > 0 && viewMode === 'kanban' && (
        <div className="md:hidden space-y-2 pb-4 flex-1 overflow-y-auto">
          {filteredColumns.map(col => {
            const colValue = col.deals.reduce((s, d) => s + (d.value || 0), 0)
            const isOpen = mobileStage === col.id
            return (
              <div key={col.id} className="card overflow-hidden">
                <button
                  onClick={() => setMobileStage(isOpen ? null : col.id)}
                  className="w-full flex items-center justify-between p-3 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color || '#0891B2' }} />
                    <span className="text-xs font-bold text-surface-700 dark:text-surface-300 uppercase tracking-wide">{col.name}</span>
                    <span className="text-[10px] text-surface-400 font-semibold bg-surface-100 dark:bg-surface-800 px-1.5 py-0.5 rounded-full">{col.deals.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {colValue > 0 && <span className="text-xs font-semibold text-surface-500">{formatCurrency(colValue)}</span>}
                    {isOpen ? <ChevronUp className="w-4 h-4 text-surface-400" /> : <ChevronDown className="w-4 h-4 text-surface-400" />}
                  </div>
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 space-y-2">
                    {col.deals.length === 0 ? (
                      <div className="h-12 flex items-center justify-center text-xs text-surface-400 border-2 border-dashed border-surface-200 dark:border-surface-700 rounded-xl">
                        No {template.dealLabel.plural.toLowerCase()} in this stage
                      </div>
                    ) : (
                      col.deals.map(deal => (
                        <DealCard key={deal.id} deal={deal} teamMembers={teamMembers} onClick={() => setSelectedDeal(deal)} />
                      ))
                    )}
                    <button onClick={() => setShowNewDeal(true)}
                      className="w-full flex items-center gap-1.5 p-2 rounded-xl text-xs text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors">
                      <Plus className="w-3.5 h-3.5" /> Add {template.dealLabel.singular.toLowerCase()}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Desktop Kanban with drag-drop */}
      {statusView === 'active' && columns.length > 0 && viewMode === 'kanban' && (
        <DragDropContext onDragEnd={(result: DropResult) => {
          if (!result.destination) return
          const dealId = result.draggableId
          const newStageId = result.destination.droppableId
          if (result.source.droppableId !== newStageId) {
            handleMoveDeal(dealId, newStageId)
          }
        }}>
          <div className="hidden md:flex gap-4 overflow-x-auto pb-4 flex-1 no-scrollbar">
            {filteredColumns.map(col => {
              const colValue = col.deals.reduce((s, d) => s + (d.value || 0), 0)
              return (
                <div key={col.id} className="flex-shrink-0 w-72 flex flex-col">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color || '#0891B2' }} />
                      <span className="text-xs font-bold text-surface-700 dark:text-surface-300 uppercase tracking-wide">{col.name}</span>
                      <span className="text-[10px] text-surface-400 font-semibold bg-surface-100 dark:bg-surface-800 px-1.5 py-0.5 rounded-full">{col.deals.length}</span>
                    </div>
                    {colValue > 0 && <span className="text-xs font-semibold text-surface-500">{formatCurrency(colValue)}</span>}
                  </div>

                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div ref={provided.innerRef} {...provided.droppableProps}
                        className={cn('flex-1 space-y-2 min-h-20 p-2 rounded-xl transition-colors',
                          snapshot.isDraggingOver ? 'bg-brand-50 dark:bg-brand-950 border-2 border-brand-200' : 'bg-surface-100/50 dark:bg-surface-800/50')}>
                        {col.deals.map((deal, index) => (
                          <Draggable key={deal.id} draggableId={deal.id} index={index}>
                            {(provided, snapshot) => (
                              <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                                className={cn(snapshot.isDragging && 'opacity-80 rotate-1 scale-105')}>
                                <DealCard deal={deal} teamMembers={teamMembers} onClick={() => setSelectedDeal(deal)} />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {col.deals.length === 0 && !snapshot.isDraggingOver && (
                          <div className="h-16 flex items-center justify-center text-xs text-surface-400 border-2 border-dashed border-surface-200 dark:border-surface-700 rounded-xl">
                            Drop here
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>

                  <button onClick={() => setShowNewDeal(true)}
                    className="mt-2 w-full flex items-center gap-1.5 p-2 rounded-xl text-xs text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Add {template.dealLabel.singular.toLowerCase()}
                  </button>
                </div>
              )
            })}
          </div>
        </DragDropContext>
      )}

      {showNewDeal && (
        <NewDealModal
          stages={columns}
          contacts={contacts}
          workspaceId={workspaceId}
          customFields={customFields}
          template={template}
          onClose={() => setShowNewDeal(false)}
          onSave={handleCreateDeal}
        />
      )}

      {selectedDeal && (
        <DealWhatsApp
          deal={selectedDeal}
          onClose={() => setSelectedDeal(null)}
          onUpdateDeal={handleUpdateDeal}
          onDealHoldChange={(dealId, onHold) => {
            // Remove from active kanban when paused
            if (onHold) {
              setColumns(prev => prev.map(col => ({ ...col, deals: col.deals.filter(d => d.id !== dealId) })))
            }
          }}
          onMarkLost={(dealId, dealTitle, stageId) => setLossReasonPrompt({ dealId, dealTitle, stageId })}
          onMarkWon={handleMarkWonFromPanel}
          teamMembers={teamMembers}
          workspaceId={workspaceId}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
        />
      )}

      {lossReasonPrompt && (
        <LossReasonModal
          dealTitle={lossReasonPrompt.dealTitle}
          onConfirm={handleLossConfirm}
          onCancel={() => setLossReasonPrompt(null)}
        />
      )}

      {celebration && (
        <CelebrationOverlay
          title={celebration.title}
          value={celebration.value}
          onDone={() => setCelebration(null)}
        />
      )}
    </div>
  )
}
