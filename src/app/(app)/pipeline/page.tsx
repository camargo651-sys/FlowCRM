'use client'
import { toast } from 'sonner'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Filter, X, DollarSign, Calendar, User, MessageCircle, Send, ArrowLeft, Share2, ChevronDown, ChevronUp } from 'lucide-react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { formatCurrency, getInitials, cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace-context'
import { useI18n } from '@/lib/i18n/context'
import type { Deal, PipelineStage, Contact, DbRow } from '@/types'

interface DealWithContact extends Deal {
  contacts?: { name: string; email?: string } | null
}

interface Column extends PipelineStage {
  deals: DealWithContact[]
}

// --- NEW DEAL MODAL ---
function NewDealModal({ stages, contacts, onClose, onSave, workspaceId, customFields, template }: {
  stages: PipelineStage[], contacts: Pick<Contact, 'id' | 'name' | 'email'>[], onClose: () => void,
  onSave: (deal: Partial<Deal>) => void, workspaceId: string,
  customFields: { entity: string; label: string; key: string; type: string; options?: string[] }[],
  template: { key?: string; name?: string; dealLabel: { singular: string; plural: string }; contactLabel: { singular: string; plural: string } },
}) {
  const [title, setTitle] = useState('')
  const [value, setValue] = useState('')
  const [stageId, setStageId] = useState(stages[0]?.id || '')
  const [contactId, setContactId] = useState('')
  const [closeDate, setCloseDate] = useState('')
  const [customValues, setCustomValues] = useState<DbRow>({})

  const dealFields = customFields.filter(f => f.entity === 'deal')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      title, value: value ? parseFloat(value) : undefined,
      stage_id: stageId, contact_id: contactId || undefined,
      expected_close_date: closeDate || undefined,
      workspace_id: workspaceId, status: 'open', currency: 'USD', order_index: 0,
      custom_fields: Object.keys(customValues).length > 0 ? customValues : undefined,
    })
    onClose()
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

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1">Create {template.dealLabel.singular}</button>
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

// --- DEAL CARD ---
function DealCard({ deal, onClick }: { deal: DealWithContact; onClick: () => void }) {
  const ageDays = getDealAgeDays(deal)

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
      {deal.contacts?.name && (
        <p className="text-xs text-surface-400 mb-2.5 flex items-center gap-1">
          <span className="w-4 h-4 bg-violet-100 text-violet-600 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0">
            {getInitials(deal.contacts.name)}
          </span>
          {deal.contacts.name}
        </p>
      )}
      {/* Show some custom fields on card */}
      {deal.custom_fields && typeof deal.custom_fields === 'object' && Object.keys(deal.custom_fields as object).length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {Object.entries(deal.custom_fields as DbRow).slice(0, 2).map(([key, val]) => (
            val && <span key={key} className="badge-gray text-[9px]">{String(val)}</span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between mt-2">
        {deal.value ? (
          <span className="text-sm font-bold text-surface-900">{formatCurrency(deal.value)}</span>
        ) : (
          <span className="text-xs text-surface-300">No value set</span>
        )}
        {deal.expected_close_date && (
          <span className="text-[10px] text-surface-400 font-medium">
            {new Date(deal.expected_close_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
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

function DealWhatsApp({ deal, onClose }: { deal: DealWithContact; onClose: () => void }) {
  const supabase = createClient()
  const [messages, setMessages] = useState<WaMessage[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingMsgs, setLoadingMsgs] = useState(true)
  const [activeTab, setActiveTab] = useState<'details' | 'whatsapp'>('details')
  const [portalCopied, setPortalCopied] = useState(false)

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
        const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
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
          <button onClick={onClose} className="modal-close"><X className="w-4 h-4" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-surface-100">
          <button onClick={() => setActiveTab('details')}
            className={cn('px-4 py-2 text-xs font-semibold border-b-2 transition-colors',
              activeTab === 'details' ? 'border-brand-600 text-brand-600' : 'border-transparent text-surface-400 hover:text-surface-600')}>
            Details
          </button>
          {deal.contact_id && (
            <button onClick={() => setActiveTab('whatsapp')}
              className={cn('px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1',
                activeTab === 'whatsapp' ? 'border-green-600 text-green-600' : 'border-transparent text-surface-400 hover:text-surface-600')}>
              <MessageCircle className="w-3 h-3" /> WhatsApp
              {messages.length > 0 && <span className="text-[9px] bg-green-100 text-green-700 px-1 rounded-full">{messages.length}</span>}
            </button>
          )}
        </div>

        <div className="modal-body">
          {activeTab === 'details' && (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-[10px] text-surface-400 font-semibold uppercase">Value</p><p className="text-sm font-bold">{deal.value ? formatCurrency(deal.value) : '—'}</p></div>
                <div><p className="text-[10px] text-surface-400 font-semibold uppercase">Status</p><p className="text-sm font-semibold capitalize">{deal.status}</p></div>
                <div><p className="text-[10px] text-surface-400 font-semibold uppercase">Close Date</p><p className="text-sm">{deal.expected_close_date ? new Date(deal.expected_close_date).toLocaleDateString() : '—'}</p></div>
                <div><p className="text-[10px] text-surface-400 font-semibold uppercase">Contact</p><p className="text-sm">{deal.contacts?.name || '—'}</p></div>
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

          {activeTab === 'whatsapp' && (
            <div className="flex flex-col" style={{ height: 380 }}>
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
    </div>
  )
}

// --- LOSS REASON MODAL ---
function LossReasonModal({ dealTitle, onConfirm, onCancel }: {
  dealTitle: string
  onConfirm: (reason: string) => void
  onCancel: () => void
}) {
  const [reason, setReason] = useState('')
  return (
    <div className="modal-overlay">
      <div className="modal-panel max-w-sm">
        <div className="modal-header">
          <h2 className="text-sm font-bold">Why was this deal lost?</h2>
          <button onClick={onCancel} className="modal-close"><X className="w-4 h-4" /></button>
        </div>
        <div className="modal-body space-y-3">
          <p className="text-xs text-surface-500">Provide a reason for losing &ldquo;{dealTitle}&rdquo;.</p>
          <textarea
            className="input min-h-[80px] text-sm"
            placeholder="e.g. Budget constraints, went with competitor..."
            value={reason}
            onChange={e => setReason(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
            <button type="button" disabled={!reason.trim()} onClick={() => onConfirm(reason.trim())}
              className="btn-primary flex-1 disabled:opacity-50">Mark as Lost</button>
          </div>
        </div>
      </div>
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
  const [workspaceId, setWorkspaceId] = useState<string>('')
  const [showNewDeal, setShowNewDeal] = useState(false)
  const [selectedDeal, setSelectedDeal] = useState<DealWithContact | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [lossReasonPrompt, setLossReasonPrompt] = useState<{ dealId: string; dealTitle: string; stageId: string } | null>(null)
  const [wonThisMonthValue, setWonThisMonthValue] = useState(0)
  const [mobileStage, setMobileStage] = useState<string | null>(null)

  const loadData = useCallback(async (pipelineId?: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)

    // Load all pipelines
    const { data: pipelinesData } = await supabase.from('pipelines').select('id, name, color, contact_id, contacts(name)').eq('workspace_id', ws.id).order('order_index')
    const allPipelines = pipelinesData || []
    setPipelines(allPipelines as unknown as PipelineInfo[])

    // Pick active pipeline
    const activeId = pipelineId || allPipelines[0]?.id || ''
    setActivePipelineId(activeId)

    if (!activeId) { setLoading(false); return }

    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

    const [stagesRes, dealsRes, contactsRes, wonThisMonthRes] = await Promise.all([
      supabase.from('pipeline_stages').select('*').eq('pipeline_id', activeId).order('order_index'),
      supabase.from('deals').select('*, contacts(name, email)').eq('workspace_id', ws.id).eq('pipeline_id', activeId).eq('status', 'open').order('order_index'),
      supabase.from('contacts').select('id, name, email').eq('workspace_id', ws.id).order('name'),
      supabase.from('deals').select('id, value').eq('workspace_id', ws.id).eq('pipeline_id', activeId).eq('status', 'won').gte('updated_at', firstOfMonth),
    ])

    const stages: PipelineStage[] = stagesRes.data || []
    const deals: DealWithContact[] = dealsRes.data || []
    setContacts(contactsRes.data || [])
    const wonDeals: { id: string; value: number }[] = wonThisMonthRes.data || []
    setWonThisMonthValue(wonDeals.reduce((s, d) => s + (d.value || 0), 0))

    setColumns(stages.map(stage => ({
      ...stage,
      deals: deals.filter(d => d.stage_id === stage.id),
    })))
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const switchPipeline = (pipelineId: string) => {
    setLoading(true)
    loadData(pipelineId)
  }

  const handleCreateDeal = async (dealData: Partial<Deal>) => {
    const dataWithPipeline = { ...dealData, pipeline_id: activePipelineId }
    const { data } = await supabase.from('deals').insert([dataWithPipeline]).select('*, contacts(name, email)').single()
    if (data) {
      setColumns(prev => prev.map(col =>
        col.id === dealData.stage_id ? { ...col, deals: [...col.deals, data] } : col
      ))
    }
  }

  const handleMoveDeal = async (dealId: string, newStageId: string) => {
    // Check stage transition conditions
    const targetStage = columns.find(c => c.id === newStageId)
    const deal = columns.flatMap(c => c.deals).find(d => d.id === dealId)
    if (!deal || !targetStage) return

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

    // Intercept lost stage: require a reason
    if (targetStage.is_lost) {
      setLossReasonPrompt({ dealId, dealTitle: deal.title, stageId: newStageId })
      return
    }

    await supabase.from('deals').update({
      stage_id: newStageId,
      ...(targetStage.is_won ? { status: 'won' } : {}),
    }).eq('id', dealId)

    setColumns(prev => {
      return prev.map(col => ({
        ...col,
        deals: col.id === newStageId
          ? [...col.deals.filter(d => d.id !== dealId), { ...deal, stage_id: newStageId }]
          : col.deals.filter(d => d.id !== dealId),
      }))
    })

    if (targetStage.is_won) toast.success(`Deal won! 🎉`)
  }

  const handleLossConfirm = async (reason: string) => {
    if (!lossReasonPrompt) return
    const { dealId, stageId } = lossReasonPrompt
    const deal = columns.flatMap(c => c.deals).find(d => d.id === dealId)
    if (!deal) return

    await supabase.from('deals').update({
      stage_id: stageId,
      status: 'lost',
      lost_reason: reason,
    }).eq('id', dealId)

    setColumns(prev => prev.map(col => ({
      ...col,
      deals: col.id === stageId
        ? [...col.deals.filter(d => d.id !== dealId), { ...deal, stage_id: stageId, status: 'lost', lost_reason: reason }]
        : col.deals.filter(d => d.id !== dealId),
    })))

    toast.error('Deal marked as lost')
    setLossReasonPrompt(null)
  }

  const filteredColumns = columns.map(col => ({
    ...col,
    deals: col.deals.filter(d =>
      !search || d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.contacts?.name?.toLowerCase().includes(search.toLowerCase())
    ),
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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input className="input pl-9 w-full sm:w-56 text-xs"
              placeholder={`Search ${template.dealLabel.plural.toLowerCase()}...`}
              value={search} onChange={e => setSearch(e.target.value)} />
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

      {/* Mobile Accordion View */}
      {columns.length > 0 && (
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
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color || '#6172f3' }} />
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
                        <DealCard key={deal.id} deal={deal} onClick={() => setSelectedDeal(deal)} />
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
      {columns.length > 0 && (
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
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color || '#6172f3' }} />
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
                                <DealCard deal={deal} onClick={() => setSelectedDeal(deal)} />
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
        <DealWhatsApp deal={selectedDeal} onClose={() => setSelectedDeal(null)} />
      )}

      {lossReasonPrompt && (
        <LossReasonModal
          dealTitle={lossReasonPrompt.dealTitle}
          onConfirm={handleLossConfirm}
          onCancel={() => setLossReasonPrompt(null)}
        />
      )}
    </div>
  )
}
