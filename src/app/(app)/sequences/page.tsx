'use client'
import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Zap, Plus, Trash2, ChevronDown, ChevronRight, MessageCircle, Mail, Phone,
  Play, Pause, Users, Search, X, GripVertical, ArrowDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/context'
import { getActiveWorkspace } from '@/lib/get-active-workspace'

type Channel = 'whatsapp' | 'sms' | 'email'

interface SequenceStep {
  order: number
  channel: Channel
  message: string
  delay_hours: number
  condition: 'no_reply' | null
}

interface Sequence {
  id: string
  name: string
  description: string | null
  enabled: boolean
  steps: SequenceStep[]
  enrolled_count: number
  completed_count: number
  created_at: string
}

interface Contact {
  id: string
  name: string
  phone: string | null
  email: string | null
}

const CHANNEL_ICONS: Record<Channel, typeof MessageCircle> = {
  whatsapp: MessageCircle,
  sms: Phone,
  email: Mail,
}

const CHANNEL_COLORS: Record<Channel, string> = {
  whatsapp: 'bg-green-50 text-green-700 border-green-200',
  sms: 'bg-blue-50 text-blue-700 border-blue-200',
  email: 'bg-purple-50 text-purple-700 border-purple-200',
}

function emptyStep(order: number): SequenceStep {
  return { order, channel: 'whatsapp', message: '', delay_hours: 24, condition: null }
}

export default function SequencesPage() {
  const supabase = createClient()
  const { t } = useI18n()
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [loading, setLoading] = useState(true)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)

  // Create/Edit modal
  const [showEditor, setShowEditor] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState<SequenceStep[]>([emptyStep(0)])
  const [saving, setSaving] = useState(false)

  // Enroll modal
  const [showEnroll, setShowEnroll] = useState(false)
  const [enrollSequenceId, setEnrollSequenceId] = useState<string | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [contactSearch, setContactSearch] = useState('')
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())
  const [enrolling, setEnrolling] = useState(false)

  // Expanded sequence (preview)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const loadSequences = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const ws = await getActiveWorkspace(supabase, user.id, 'id')
    if (!ws) return
    setWorkspaceId(ws.id)

    const { data } = await supabase
      .from('sequences')
      .select('*')
      .eq('workspace_id', ws.id)
      .order('created_at', { ascending: false })

    setSequences((data || []) as Sequence[])
    setLoading(false)
  }, [])

  useEffect(() => { loadSequences() }, [loadSequences])

  const openCreate = () => {
    setEditingId(null)
    setName('')
    setDescription('')
    setSteps([emptyStep(0)])
    setShowEditor(true)
  }

  const openEdit = (seq: Sequence) => {
    setEditingId(seq.id)
    setName(seq.name)
    setDescription(seq.description || '')
    setSteps(seq.steps.length > 0 ? seq.steps : [emptyStep(0)])
    setShowEditor(true)
  }

  const saveSequence = async () => {
    if (!name.trim()) { toast.error('Name is required'); return }
    if (steps.some(s => !s.message.trim())) { toast.error('All steps need a message'); return }
    if (!workspaceId) return

    setSaving(true)
    try {
      const payload = {
        workspace_id: workspaceId,
        name: name.trim(),
        description: description.trim() || null,
        steps: steps.map((s, i) => ({ ...s, order: i })),
      }

      if (editingId) {
        await supabase.from('sequences').update(payload).eq('id', editingId)
        toast.success('Sequence updated')
      } else {
        await supabase.from('sequences').insert(payload)
        toast.success('Sequence created')
      }

      setShowEditor(false)
      loadSequences()
    } catch {
      toast.error('Error saving sequence')
    } finally {
      setSaving(false)
    }
  }

  const toggleEnabled = async (seq: Sequence) => {
    await supabase.from('sequences').update({ enabled: !seq.enabled }).eq('id', seq.id)
    setSequences(prev => prev.map(s => s.id === seq.id ? { ...s, enabled: !s.enabled } : s))
  }

  const deleteSequence = async (id: string) => {
    if (!confirm('Delete this sequence? Enrolled contacts will be removed.')) return
    await supabase.from('sequences').delete().eq('id', id)
    setSequences(prev => prev.filter(s => s.id !== id))
    toast.success('Sequence deleted')
  }

  // Steps editor helpers
  const updateStep = (index: number, patch: Partial<SequenceStep>) => {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, ...patch } : s))
  }

  const addStep = () => {
    setSteps(prev => [...prev, emptyStep(prev.length)])
  }

  const removeStep = (index: number) => {
    if (steps.length <= 1) return
    setSteps(prev => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i })))
  }

  // Enrollment
  const openEnroll = async (sequenceId: string) => {
    if (!workspaceId) return
    setEnrollSequenceId(sequenceId)
    setSelectedContacts(new Set())
    setContactSearch('')
    setShowEnroll(true)

    const { data } = await supabase
      .from('contacts')
      .select('id, name, phone, email')
      .eq('workspace_id', workspaceId)
      .order('name')
      .limit(500)

    setContacts((data || []) as Contact[])
  }

  const toggleContact = (id: string) => {
    setSelectedContacts(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const enrollSelected = async () => {
    if (!enrollSequenceId || !workspaceId || selectedContacts.size === 0) return
    setEnrolling(true)

    let enrolled = 0
    let errors = 0

    for (const contactId of Array.from(selectedContacts)) {
      const res = await fetch('/api/sequences/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequenceId: enrollSequenceId, contactId, workspaceId }),
      }).catch(() => null)

      if (res?.ok) enrolled++
      else errors++
    }

    toast.success(`Enrolled ${enrolled} contacts${errors > 0 ? `, ${errors} errors` : ''}`)
    setShowEnroll(false)
    setEnrolling(false)
    loadSequences()
  }

  const filteredContacts = contacts.filter(c =>
    !contactSearch || c.name?.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.phone?.includes(contactSearch) || c.email?.toLowerCase().includes(contactSearch.toLowerCase()),
  )

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{t('nav.sequences')}</h1>
          <p className="text-sm text-surface-500 mt-1">
            Multi-step drip campaigns via WhatsApp, SMS, or email
          </p>
        </div>
        <button onClick={openCreate}
          className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Create Sequence
        </button>
      </div>

      {/* Sequence List */}
      {sequences.length === 0 ? (
        <div className="bg-white rounded-2xl border border-surface-100 p-12 text-center">
          <Zap className="w-12 h-12 text-surface-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-surface-800 mb-2">No sequences yet</h3>
          <p className="text-sm text-surface-500 mb-6">
            Create your first drip campaign to automate follow-ups via WhatsApp, SMS, or email.
          </p>
          <button onClick={openCreate} className="btn-primary">Create Sequence</button>
        </div>
      ) : (
        <div className="space-y-3">
          {sequences.map(seq => {
            const isExpanded = expandedId === seq.id
            return (
              <div key={seq.id} className="bg-white rounded-2xl border border-surface-100 overflow-hidden">
                <div className="p-4 flex items-center gap-4">
                  {/* Expand toggle */}
                  <button onClick={() => setExpandedId(isExpanded ? null : seq.id)}
                    className="text-surface-400 hover:text-surface-600">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-surface-900 truncate">{seq.name}</h3>
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-[11px] font-medium',
                        seq.enabled ? 'bg-green-50 text-green-700' : 'bg-surface-100 text-surface-500',
                      )}>
                        {seq.enabled ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    {seq.description && (
                      <p className="text-xs text-surface-500 mt-0.5 truncate">{seq.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-surface-400">
                      <span>{seq.steps.length} step{seq.steps.length !== 1 ? 's' : ''}</span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" /> {seq.enrolled_count} enrolled
                      </span>
                      <span>{seq.completed_count} completed</span>
                      <div className="flex items-center gap-1">
                        {(seq.steps || []).map((s, i) => {
                          const Icon = CHANNEL_ICONS[s.channel]
                          return <Icon key={i} className="w-3 h-3" />
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEnroll(seq.id)}
                      className="btn-outline text-xs px-3 py-1.5 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> Enroll
                    </button>
                    <button onClick={() => toggleEnabled(seq)}
                      className="p-2 rounded-lg hover:bg-surface-50 text-surface-400 hover:text-surface-600"
                      title={seq.enabled ? 'Pause' : 'Activate'}>
                      {seq.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button onClick={() => openEdit(seq)}
                      className="p-2 rounded-lg hover:bg-surface-50 text-surface-400 hover:text-surface-600">
                      <Zap className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteSequence(seq.id)}
                      className="p-2 rounded-lg hover:bg-red-50 text-surface-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded: step preview */}
                {isExpanded && (
                  <div className="border-t border-surface-100 px-6 py-4 bg-surface-50/50">
                    <div className="space-y-3">
                      {(seq.steps || []).map((step, i) => {
                        const Icon = CHANNEL_ICONS[step.channel]
                        return (
                          <div key={i} className="flex items-start gap-3">
                            <div className="flex flex-col items-center">
                              <div className={cn('w-8 h-8 rounded-lg border flex items-center justify-center', CHANNEL_COLORS[step.channel])}>
                                <Icon className="w-4 h-4" />
                              </div>
                              {i < seq.steps.length - 1 && (
                                <div className="w-px h-6 bg-surface-200 mt-1" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 text-xs text-surface-500">
                                <span className="font-medium capitalize">{step.channel}</span>
                                <span>after {step.delay_hours}h</span>
                                {step.condition === 'no_reply' && (
                                  <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px]">
                                    Only if no reply
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-surface-700 mt-0.5 line-clamp-2">{step.message}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Create/Edit Modal ── */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setShowEditor(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl"
            onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-surface-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-surface-900">
                {editingId ? 'Edit Sequence' : 'Create Sequence'}
              </h2>
              <button onClick={() => setShowEditor(false)}
                className="p-2 rounded-lg hover:bg-surface-50 text-surface-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Name & Description */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-sm font-medium text-surface-700 block mb-1.5">Name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="e.g. New Lead Follow-up"
                    className="input w-full" />
                </div>
                <div>
                  <label className="text-sm font-medium text-surface-700 block mb-1.5">Description</label>
                  <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                    placeholder="Optional description"
                    className="input w-full" />
                </div>
              </div>

              {/* Steps builder */}
              <div>
                <label className="text-sm font-medium text-surface-700 block mb-3">Steps</label>
                <div className="space-y-4">
                  {steps.map((step, i) => {
                    const Icon = CHANNEL_ICONS[step.channel]
                    return (
                      <div key={i} className="relative">
                        {/* Connector line */}
                        {i > 0 && (
                          <div className="flex items-center justify-center mb-2 text-surface-300">
                            <ArrowDown className="w-4 h-4" />
                            <span className="text-xs text-surface-400 ml-1">
                              Wait {step.delay_hours >= 24 ? `${Math.round(step.delay_hours / 24)}d` : `${step.delay_hours}h`}
                            </span>
                          </div>
                        )}
                        <div className="border border-surface-200 rounded-xl p-4 bg-surface-50/50">
                          <div className="flex items-center gap-3 mb-3">
                            <GripVertical className="w-4 h-4 text-surface-300" />
                            <span className="text-xs font-bold text-surface-400 w-6">#{i + 1}</span>

                            {/* Channel selector */}
                            <div className="flex gap-1">
                              {(['whatsapp', 'sms', 'email'] as Channel[]).map(ch => {
                                const ChIcon = CHANNEL_ICONS[ch]
                                return (
                                  <button key={ch}
                                    onClick={() => updateStep(i, { channel: ch })}
                                    className={cn(
                                      'px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all',
                                      step.channel === ch
                                        ? CHANNEL_COLORS[ch]
                                        : 'border-surface-200 text-surface-400 hover:bg-surface-50',
                                    )}>
                                    <ChIcon className="w-3.5 h-3.5" />
                                    <span className="capitalize">{ch}</span>
                                  </button>
                                )
                              })}
                            </div>

                            <div className="flex-1" />

                            {steps.length > 1 && (
                              <button onClick={() => removeStep(i)}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-surface-400 hover:text-red-500">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Message */}
                          <textarea
                            value={step.message}
                            onChange={e => updateStep(i, { message: e.target.value })}
                            placeholder={`Message for step ${i + 1}... Use {{name}} or {{first_name}}`}
                            rows={3}
                            className="input w-full text-sm resize-none mb-3"
                          />

                          {/* Delay & Condition */}
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-surface-500">Delay:</label>
                              <input type="number" min={0} value={step.delay_hours}
                                onChange={e => updateStep(i, { delay_hours: parseInt(e.target.value) || 0 })}
                                className="input w-16 text-xs text-center" />
                              <span className="text-xs text-surface-400">hours</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-surface-500">Condition:</label>
                              <select
                                value={step.condition || ''}
                                onChange={e => updateStep(i, { condition: e.target.value === 'no_reply' ? 'no_reply' : null })}
                                className="input text-xs py-1.5">
                                <option value="">None</option>
                                <option value="no_reply">Only if no reply</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <button onClick={addStep}
                  className="mt-3 w-full py-2.5 border-2 border-dashed border-surface-200 rounded-xl text-sm text-surface-400 hover:border-brand-300 hover:text-brand-600 transition-colors flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" /> Add Step
                </button>
              </div>

              {/* Visual flow preview */}
              <div>
                <label className="text-sm font-medium text-surface-700 block mb-2">Preview</label>
                <div className="border border-surface-200 rounded-xl p-4 bg-white">
                  <div className="flex items-center gap-2 flex-wrap">
                    {steps.map((step, i) => {
                      const Icon = CHANNEL_ICONS[step.channel]
                      return (
                        <div key={i} className="flex items-center gap-2">
                          {i > 0 && (
                            <span className="text-[10px] text-surface-400 bg-surface-100 px-1.5 py-0.5 rounded">
                              {step.delay_hours}h
                            </span>
                          )}
                          <div className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium',
                            CHANNEL_COLORS[step.channel],
                          )}>
                            <Icon className="w-3.5 h-3.5" />
                            <span className="capitalize">{step.channel}</span>
                            {step.condition === 'no_reply' && <span className="text-amber-600">*</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {steps.some(s => s.condition === 'no_reply') && (
                    <p className="text-[10px] text-amber-600 mt-2">* Only sends if contact has not replied</p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-surface-100 flex justify-end gap-3">
              <button onClick={() => setShowEditor(false)} className="btn-outline">Cancel</button>
              <button onClick={saveSequence} disabled={saving} className="btn-primary">
                {saving ? 'Saving...' : editingId ? 'Update Sequence' : 'Create Sequence'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Enroll Contacts Modal ── */}
      {showEnroll && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setShowEnroll(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-xl"
            onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-surface-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-surface-900">Enroll Contacts</h2>
              <button onClick={() => setShowEnroll(false)}
                className="p-2 rounded-lg hover:bg-surface-50 text-surface-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-surface-100">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                <input type="text" value={contactSearch}
                  onChange={e => setContactSearch(e.target.value)}
                  placeholder="Search contacts..."
                  className="input w-full pl-9" />
              </div>
              {selectedContacts.size > 0 && (
                <p className="text-xs text-brand-600 mt-2 font-medium">
                  {selectedContacts.size} contact{selectedContacts.size !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            {/* Contact list */}
            <div className="flex-1 overflow-y-auto p-2">
              {filteredContacts.length === 0 ? (
                <p className="text-center text-sm text-surface-400 py-8">No contacts found</p>
              ) : (
                filteredContacts.map(c => (
                  <label key={c.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-50 cursor-pointer">
                    <input type="checkbox"
                      checked={selectedContacts.has(c.id)}
                      onChange={() => toggleContact(c.id)}
                      className="rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-800 truncate">{c.name}</p>
                      <p className="text-xs text-surface-400 truncate">
                        {c.phone || c.email || 'No contact info'}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {c.phone && <MessageCircle className="w-3 h-3 text-green-500" />}
                      {c.email && <Mail className="w-3 h-3 text-purple-500" />}
                    </div>
                  </label>
                ))
              )}
            </div>

            <div className="p-4 border-t border-surface-100 flex justify-end gap-3">
              <button onClick={() => setShowEnroll(false)} className="btn-outline">Cancel</button>
              <button onClick={enrollSelected}
                disabled={enrolling || selectedContacts.size === 0}
                className="btn-primary flex items-center gap-2">
                {enrolling ? 'Enrolling...' : `Enroll ${selectedContacts.size} Contact${selectedContacts.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
