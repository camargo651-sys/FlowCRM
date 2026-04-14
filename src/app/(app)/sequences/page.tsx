'use client'
import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Zap, Plus, Trash2, ChevronDown, ChevronRight, MessageCircle, Mail, Phone,
  Play, Pause, Users, Search, X, GripVertical, ArrowDown, Copy, Clock,
  UserMinus, BarChart3, ChevronUp,
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
  send_window_start?: number
  send_window_end?: number
}

interface Contact {
  id: string
  name: string
  phone: string | null
  email: string | null
}

interface Enrollment {
  id: string
  sequence_id: string
  contact_id: string
  current_step: number
  status: string
  next_run_at: string | null
  started_at: string
  completed_at: string | null
  log: Array<{ step: number; channel: string; sent_at: string; status?: string }>
  contacts: { name: string } | null
}

interface StepAnalytics {
  step: number
  sent: number
  replied: number
  waiting: number
  total: number
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

// ── Sequence Templates ──
const SEQUENCE_TEMPLATES = [
  {
    label: 'Lead Follow-up',
    description: '3 WhatsApp steps over 3 days',
    name: 'Lead Follow-up',
    templateDesc: 'Automated follow-up for new leads via WhatsApp',
    steps: [
      { order: 0, channel: 'whatsapp' as Channel, message: 'Hi {{name}}, thanks for your interest! How can we help you today?', delay_hours: 0, condition: null },
      { order: 1, channel: 'whatsapp' as Channel, message: 'Hi {{first_name}}, just checking in — did you have any questions about our services?', delay_hours: 24, condition: 'no_reply' as const },
      { order: 2, channel: 'whatsapp' as Channel, message: 'Hey {{first_name}}, last follow-up! Let us know if you\'d like to chat — we\'re happy to help.', delay_hours: 72, condition: 'no_reply' as const },
    ],
  },
  {
    label: 'Onboarding Welcome',
    description: '3 email steps over 1 week',
    name: 'Onboarding Welcome',
    templateDesc: 'Welcome sequence for new customers via email',
    steps: [
      { order: 0, channel: 'email' as Channel, message: 'Welcome {{name}}! We\'re excited to have you on board. Here\'s how to get started...', delay_hours: 0, condition: null },
      { order: 1, channel: 'email' as Channel, message: 'Hi {{first_name}}, here are some tips to get the most out of our platform.', delay_hours: 24, condition: null },
      { order: 2, channel: 'email' as Channel, message: 'Hi {{first_name}}, how\'s everything going? Reply if you need any help!', delay_hours: 168, condition: null },
    ],
  },
  {
    label: 'Re-engagement',
    description: '2 WhatsApp steps over 2 days',
    name: 'Re-engagement',
    templateDesc: 'Re-engage inactive contacts via WhatsApp',
    steps: [
      { order: 0, channel: 'whatsapp' as Channel, message: 'Hi {{name}}, it\'s been a while! We have some exciting updates to share with you.', delay_hours: 0, condition: null },
      { order: 1, channel: 'whatsapp' as Channel, message: 'Hey {{first_name}}, we miss you! Check out what\'s new — reply YES to learn more.', delay_hours: 48, condition: 'no_reply' as const },
    ],
  },
]

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
  const [sendWindowStart, setSendWindowStart] = useState(9)
  const [sendWindowEnd, setSendWindowEnd] = useState(18)

  // Enroll modal
  const [showEnroll, setShowEnroll] = useState(false)
  const [enrollSequenceId, setEnrollSequenceId] = useState<string | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [contactSearch, setContactSearch] = useState('')
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())
  const [enrolling, setEnrolling] = useState(false)

  // Expanded sequence (preview)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedTab, setExpandedTab] = useState<'steps' | 'enrollments' | 'analytics'>('steps')

  // Enrollments view
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false)
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

  // Step analytics
  const [stepAnalytics, setStepAnalytics] = useState<StepAnalytics[]>([])
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

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

  // ── Load enrollments for a sequence ──
  const loadEnrollments = useCallback(async (sequenceId: string) => {
    setEnrollmentsLoading(true)
    const { data } = await supabase
      .from('sequence_enrollments')
      .select('*, contacts(name)')
      .eq('sequence_id', sequenceId)
      .order('started_at', { ascending: false })

    setEnrollments((data || []) as Enrollment[])
    setEnrollmentsLoading(false)
  }, [])

  // ── Load step analytics for a sequence ──
  const loadStepAnalytics = useCallback(async (sequenceId: string) => {
    setAnalyticsLoading(true)
    const { data } = await supabase
      .from('sequence_enrollments')
      .select('current_step, status')
      .eq('sequence_id', sequenceId)

    if (data) {
      const seq = sequences.find(s => s.id === sequenceId)
      const totalSteps = seq?.steps.length || 1
      const analytics: StepAnalytics[] = []

      for (let step = 0; step < totalSteps; step++) {
        const atOrPast = data.filter(d => d.current_step >= step)
        const sent = atOrPast.length
        const replied = data.filter(d => d.current_step === step && d.status === 'replied').length
        const waiting = data.filter(d => d.current_step === step && d.status === 'active').length
        analytics.push({ step, sent, replied, waiting, total: data.length })
      }
      setStepAnalytics(analytics)
    }
    setAnalyticsLoading(false)
  }, [sequences])

  // ── Handle expand with tab loading ──
  const handleExpand = (seqId: string) => {
    if (expandedId === seqId) {
      setExpandedId(null)
      return
    }
    setExpandedId(seqId)
    setExpandedTab('steps')
    setEnrollments([])
    setStepAnalytics([])
  }

  const switchTab = (tab: 'steps' | 'enrollments' | 'analytics', seqId: string) => {
    setExpandedTab(tab)
    if (tab === 'enrollments') loadEnrollments(seqId)
    if (tab === 'analytics') loadStepAnalytics(seqId)
  }

  const openCreate = () => {
    setEditingId(null)
    setName('')
    setDescription('')
    setSteps([emptyStep(0)])
    setSendWindowStart(9)
    setSendWindowEnd(18)
    setShowEditor(true)
  }

  const openEdit = (seq: Sequence) => {
    setEditingId(seq.id)
    setName(seq.name)
    setDescription(seq.description || '')
    setSteps(seq.steps.length > 0 ? seq.steps : [emptyStep(0)])
    setSendWindowStart(seq.send_window_start ?? 9)
    setSendWindowEnd(seq.send_window_end ?? 18)
    setShowEditor(true)
  }

  const applyTemplate = (tpl: typeof SEQUENCE_TEMPLATES[number]) => {
    setName(tpl.name)
    setDescription(tpl.templateDesc)
    setSteps(tpl.steps.map(s => ({ ...s })))
  }

  const saveSequence = async () => {
    if (!name.trim()) { toast.error(t('sequences.name_required')); return }
    if (steps.some(s => !s.message.trim())) { toast.error(t('sequences.all_steps_need_message')); return }
    if (!workspaceId) return

    setSaving(true)
    try {
      const payload = {
        workspace_id: workspaceId,
        name: name.trim(),
        description: description.trim() || null,
        steps: steps.map((s, i) => ({ ...s, order: i })),
        send_window_start: sendWindowStart,
        send_window_end: sendWindowEnd,
      }

      if (editingId) {
        await supabase.from('sequences').update(payload).eq('id', editingId)
        toast.success(t('sequences.updated_toast'))
      } else {
        await supabase.from('sequences').insert(payload)
        toast.success(t('sequences.created_toast'))
      }

      setShowEditor(false)
      loadSequences()
    } catch {
      toast.error(t('sequences.error_saving'))
    } finally {
      setSaving(false)
    }
  }

  const toggleEnabled = async (seq: Sequence) => {
    await supabase.from('sequences').update({ enabled: !seq.enabled }).eq('id', seq.id)
    setSequences(prev => prev.map(s => s.id === seq.id ? { ...s, enabled: !s.enabled } : s))
  }

  const deleteSequence = async (id: string) => {
    if (!confirm(t('sequences.confirm_delete'))) return
    await supabase.from('sequences').delete().eq('id', id)
    setSequences(prev => prev.filter(s => s.id !== id))
    toast.success(t('sequences.deleted_toast'))
  }

  // ── Duplicate Sequence ──
  const duplicateSequence = async (seq: Sequence) => {
    if (!workspaceId) return
    const payload = {
      workspace_id: workspaceId,
      name: seq.name + ' (copy)',
      description: seq.description,
      steps: seq.steps,
      enrolled_count: 0,
      completed_count: 0,
      send_window_start: seq.send_window_start ?? 9,
      send_window_end: seq.send_window_end ?? 18,
    }
    await supabase.from('sequences').insert(payload)
    toast.success(t('sequences.duplicated_toast'))
    loadSequences()
  }

  // ── Pause/Resume enrollment ──
  const pauseEnrollment = async (enrollmentId: string, seqId: string) => {
    await supabase.from('sequence_enrollments').update({ status: 'paused' }).eq('id', enrollmentId)
    toast.success(t('sequences.enrollment_paused_toast'))
    loadEnrollments(seqId)
  }

  const resumeEnrollment = async (enrollment: Enrollment, seqId: string) => {
    const seq = sequences.find(s => s.id === seqId)
    if (!seq) return
    const currentStep = seq.steps[enrollment.current_step]
    const delayHours = currentStep?.delay_hours ?? 1
    const nextRun = new Date(Date.now() + delayHours * 3600 * 1000).toISOString()
    await supabase.from('sequence_enrollments')
      .update({ status: 'active', next_run_at: nextRun })
      .eq('id', enrollment.id)
    toast.success(t('sequences.enrollment_resumed_toast'))
    loadEnrollments(seqId)
  }

  // ── Remove from sequence (unenroll) ──
  const removeEnrollment = async (enrollmentId: string, seqId: string) => {
    await supabase.from('sequence_enrollments').delete().eq('id', enrollmentId)
    // Decrement enrolled_count
    const seq = sequences.find(s => s.id === seqId)
    if (seq) {
      const newCount = Math.max(0, seq.enrolled_count - 1)
      await supabase.from('sequences').update({ enrolled_count: newCount }).eq('id', seqId)
      setSequences(prev => prev.map(s => s.id === seqId ? { ...s, enrolled_count: newCount } : s))
    }
    toast.success(t('sequences.contact_removed_toast'))
    loadEnrollments(seqId)
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

    toast.success(`${t('sequences.enrolled_prefix')} ${enrolled} ${t('sequences.contacts_suffix') || 'contacts'}${errors > 0 ? `, ${errors} ${t('sequences.errors_suffix')}` : ''}`)
    setShowEnroll(false)
    setEnrolling(false)
    loadSequences()
  }

  const filteredContacts = contacts.filter(c =>
    !contactSearch || c.name?.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.phone?.includes(contactSearch) || c.email?.toLowerCase().includes(contactSearch.toLowerCase()),
  )

  // ── Message preview helper ──
  const previewMessage = (msg: string) =>
    msg.replace(/\{\{name\}\}/g, 'Maria Garcia').replace(/\{\{first_name\}\}/g, 'Maria')

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
            {t('sequences.subtitle')}
          </p>
        </div>
        <button onClick={openCreate}
          className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> {t('sequences.create_sequence')}
        </button>
      </div>

      {/* Sequence List */}
      {sequences.length === 0 ? (
        <div className="bg-white rounded-2xl border border-surface-100 p-12 text-center">
          <Zap className="w-12 h-12 text-surface-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-surface-800 mb-2">{t('sequences.no_sequences')}</h3>
          <p className="text-sm text-surface-500 mb-6">
            {t('sequences.no_sequences_desc')}
          </p>
          <button onClick={openCreate} className="btn-primary">{t('sequences.create_sequence')}</button>
        </div>
      ) : (
        <div className="space-y-3">
          {sequences.map(seq => {
            const isExpanded = expandedId === seq.id
            return (
              <div key={seq.id} className="bg-white rounded-2xl border border-surface-100 overflow-hidden">
                <div className="p-4 flex items-center gap-4">
                  {/* Expand toggle */}
                  <button onClick={() => handleExpand(seq.id)}
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
                        {seq.enabled ? t('sequences.active') : t('sequences.paused')}
                      </span>
                    </div>
                    {seq.description && (
                      <p className="text-xs text-surface-500 mt-0.5 truncate">{seq.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-surface-400">
                      <span>{seq.steps.length} {seq.steps.length !== 1 ? t('sequences.step_plural') : t('sequences.step_singular')}</span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" /> {seq.enrolled_count} {t('sequences.enrolled')}
                      </span>
                      <span>{seq.completed_count} {t('sequences.completed')}</span>
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
                      <Users className="w-3.5 h-3.5" /> {t('sequences.enroll')}
                    </button>
                    <button onClick={() => duplicateSequence(seq)}
                      className="p-2 rounded-lg hover:bg-surface-50 text-surface-400 hover:text-surface-600"
                      title={t('sequences.duplicate')}>
                      <Copy className="w-4 h-4" />
                    </button>
                    <button onClick={() => toggleEnabled(seq)}
                      className="p-2 rounded-lg hover:bg-surface-50 text-surface-400 hover:text-surface-600"
                      title={seq.enabled ? t('sequences.pause') : t('sequences.activate')}>
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

                {/* Expanded section with tabs */}
                {isExpanded && (
                  <div className="border-t border-surface-100">
                    {/* Tab bar */}
                    <div className="flex gap-0 px-6 bg-surface-50/50 border-b border-surface-100">
                      {(['steps', 'analytics', 'enrollments'] as const).map(tab => (
                        <button key={tab}
                          onClick={() => switchTab(tab, seq.id)}
                          className={cn(
                            'px-4 py-2.5 text-xs font-medium border-b-2 transition-colors capitalize',
                            expandedTab === tab
                              ? 'border-brand-600 text-brand-700'
                              : 'border-transparent text-surface-400 hover:text-surface-600',
                          )}>
                          {tab === 'analytics' && <BarChart3 className="w-3 h-3 inline mr-1.5" />}
                          {tab === 'enrollments' && <Users className="w-3 h-3 inline mr-1.5" />}
                          {tab === 'steps' ? t('sequences.tab_steps') : tab === 'analytics' ? t('sequences.tab_analytics') : t('sequences.tab_enrollments')}
                        </button>
                      ))}
                    </div>

                    {/* ── Tab: Steps ── */}
                    {expandedTab === 'steps' && (
                      <div className="px-6 py-4 bg-surface-50/50">
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
                                    <span>{t('sequences.after_hours')} {step.delay_hours}{t('sequences.hours_short')}</span>
                                    {step.condition === 'no_reply' && (
                                      <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px]">
                                        {t('sequences.only_if_no_reply')}
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

                    {/* ── Tab: Analytics ── */}
                    {expandedTab === 'analytics' && (
                      <div className="px-6 py-4 bg-surface-50/50">
                        {analyticsLoading ? (
                          <div className="flex items-center justify-center py-6">
                            <div className="w-5 h-5 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
                          </div>
                        ) : stepAnalytics.length === 0 ? (
                          <p className="text-sm text-surface-400 text-center py-6">{t('sequences.no_enrollment_data')}</p>
                        ) : (
                          <div className="space-y-3">
                            {stepAnalytics.map((sa, i) => {
                              const maxVal = sa.total || 1
                              const sentPct = Math.round((sa.sent / maxVal) * 100)
                              const repliedPct = Math.round((sa.replied / maxVal) * 100)
                              const dropOff = i > 0 && stepAnalytics[i - 1].sent > 0
                                ? Math.round(((stepAnalytics[i - 1].sent - sa.sent) / stepAnalytics[i - 1].sent) * 100)
                                : 0
                              return (
                                <div key={i} className="space-y-1.5">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-medium text-surface-700">
                                      {t('sequences.step_label')} {i + 1}: {sa.sent} {t('sequences.sent')} {sa.replied} {t('sequences.replied')} {sa.waiting} {t('sequences.waiting')}
                                    </span>
                                    {dropOff > 0 && (
                                      <span className="text-red-500 text-[10px] font-medium">
                                        -{dropOff}% {t('sequences.drop_off')}
                                      </span>
                                    )}
                                  </div>
                                  <div className="h-2 bg-surface-100 rounded-full overflow-hidden flex">
                                    <div className="bg-brand-500 h-full transition-all" style={{ width: `${sentPct}%` }} />
                                    <div className="bg-green-500 h-full transition-all" style={{ width: `${repliedPct}%` }} />
                                  </div>
                                  <div className="flex gap-4 text-[10px] text-surface-400">
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-brand-500 inline-block" /> {t('sequences.legend_sent')}</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> {t('sequences.legend_replied')}</span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Tab: Enrollments ── */}
                    {expandedTab === 'enrollments' && (
                      <div className="px-6 py-4 bg-surface-50/50">
                        {enrollmentsLoading ? (
                          <div className="flex items-center justify-center py-6">
                            <div className="w-5 h-5 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
                          </div>
                        ) : enrollments.length === 0 ? (
                          <p className="text-sm text-surface-400 text-center py-6">{t('sequences.no_enrollments')}</p>
                        ) : (
                          <div className="space-y-1 overflow-x-auto">
                            <div className="min-w-[560px]">
                            {/* Table header */}
                            <div className="grid grid-cols-[1fr_80px_80px_120px_100px] gap-2 px-3 py-1.5 text-[10px] font-semibold text-surface-400 uppercase tracking-wider">
                              <span>{t('sequences.col_contact')}</span>
                              <span>{t('sequences.col_step')}</span>
                              <span>{t('sequences.col_status')}</span>
                              <span>{t('sequences.col_started')}</span>
                              <span className="text-right">{t('sequences.col_actions')}</span>
                            </div>
                            {enrollments.map(enr => {
                              const isLogOpen = expandedLogId === enr.id
                              const statusColors: Record<string, string> = {
                                active: 'bg-green-50 text-green-700',
                                completed: 'bg-blue-50 text-blue-700',
                                replied: 'bg-purple-50 text-purple-700',
                                paused: 'bg-amber-50 text-amber-700',
                                unsubscribed: 'bg-red-50 text-red-700',
                              }
                              return (
                                <div key={enr.id}>
                                  <div className="grid grid-cols-[1fr_80px_80px_120px_100px] gap-2 px-3 py-2 text-xs text-surface-700 items-center rounded-lg hover:bg-white/60">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <button onClick={() => setExpandedLogId(isLogOpen ? null : enr.id)}
                                        className="text-surface-300 hover:text-surface-500 shrink-0">
                                        {isLogOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                      </button>
                                      <span className="truncate font-medium">{enr.contacts?.name || t('sequences.unknown')}</span>
                                    </div>
                                    <span>{enr.current_step + 1}/{seq.steps.length}</span>
                                    <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium text-center', statusColors[enr.status] || 'bg-surface-100 text-surface-500')}>
                                      {enr.status}
                                    </span>
                                    <span className="text-surface-400">{new Date(enr.started_at).toLocaleDateString()}</span>
                                    <div className="flex items-center justify-end gap-1">
                                      {enr.status === 'active' && (
                                        <button onClick={() => pauseEnrollment(enr.id, seq.id)}
                                          className="p-1 rounded hover:bg-amber-50 text-surface-400 hover:text-amber-600"
                                          title={t('sequences.pause')}>
                                          <Pause className="w-3 h-3" />
                                        </button>
                                      )}
                                      {enr.status === 'paused' && (
                                        <button onClick={() => resumeEnrollment(enr, seq.id)}
                                          className="p-1 rounded hover:bg-green-50 text-surface-400 hover:text-green-600"
                                          title={t('sequences.resume')}>
                                          <Play className="w-3 h-3" />
                                        </button>
                                      )}
                                      <button onClick={() => removeEnrollment(enr.id, seq.id)}
                                        className="p-1 rounded hover:bg-red-50 text-surface-400 hover:text-red-500"
                                        title={t('sequences.remove_from_sequence')}>
                                        <UserMinus className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                  {/* Enrollment log */}
                                  {isLogOpen && (
                                    <div className="ml-8 mb-2 px-3 py-2 bg-white rounded-lg border border-surface-100 text-[11px]">
                                      {Array.isArray(enr.log) && enr.log.length > 0 ? (
                                        <div className="space-y-1">
                                          {enr.log.map((entry, li) => (
                                            <div key={li} className="flex items-center gap-2 text-surface-500">
                                              <span className="font-mono text-surface-400">{new Date(entry.sent_at).toLocaleString()}</span>
                                              <span className="capitalize font-medium">{entry.channel}</span>
                                              <span>{t('sequences.step_label')} {entry.step + 1}</span>
                                              {entry.status && <span className="text-surface-400">({entry.status})</span>}
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-surface-400">{t('sequences.no_log')}</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
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
                {editingId ? t('sequences.edit_sequence') : t('sequences.create_sequence')}
              </h2>
              <button onClick={() => setShowEditor(false)}
                className="p-2 rounded-lg hover:bg-surface-50 text-surface-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* ── Sequence Templates (only when creating) ── */}
              {!editingId && (
                <div>
                  <label className="text-sm font-medium text-surface-700 block mb-2">{t('sequences.start_from_template')}</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {SEQUENCE_TEMPLATES.map(tpl => (
                      <button key={tpl.label}
                        onClick={() => applyTemplate(tpl)}
                        className="border border-surface-200 rounded-xl p-3 text-left hover:border-brand-300 hover:bg-brand-50/30 transition-colors group">
                        <p className="text-sm font-semibold text-surface-800 group-hover:text-brand-700">{tpl.label}</p>
                        <p className="text-[11px] text-surface-400 mt-0.5">{tpl.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Name & Description */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-sm font-medium text-surface-700 block mb-1.5">{t('sequences.name')}</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder={t('sequences.name_placeholder')}
                    className="input w-full" />
                </div>
                <div>
                  <label className="text-sm font-medium text-surface-700 block mb-1.5">{t('sequences.description')}</label>
                  <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                    placeholder={t('sequences.description_placeholder')}
                    className="input w-full" />
                </div>
              </div>

              {/* ── Time-of-Day Restriction ── */}
              <div className="border border-surface-200 rounded-xl p-4 bg-surface-50/50">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-surface-500" />
                  <label className="text-sm font-medium text-surface-700">{t('sequences.send_window')}</label>
                  <span className="text-[10px] text-surface-400">{t('sequences.send_window_hint')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs text-surface-500">{t('sequences.from')}</label>
                  <input type="number" min={0} max={23} value={sendWindowStart}
                    onChange={e => setSendWindowStart(Math.min(23, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="input w-16 text-xs text-center" />
                  <span className="text-xs text-surface-400">:00</span>
                  <label className="text-xs text-surface-500 ml-2">{t('sequences.to')}</label>
                  <input type="number" min={0} max={23} value={sendWindowEnd}
                    onChange={e => setSendWindowEnd(Math.min(23, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="input w-16 text-xs text-center" />
                  <span className="text-xs text-surface-400">:00</span>
                </div>
              </div>

              {/* Steps builder */}
              <div>
                <label className="text-sm font-medium text-surface-700 block mb-3">{t('sequences.steps_label')}</label>
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
                              {t('sequences.wait')} {step.delay_hours >= 24 ? `${Math.round(step.delay_hours / 24)}d` : `${step.delay_hours}h`}
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
                            placeholder={`${t('sequences.message_placeholder')} ${i + 1}... ${t('sequences.use_variables')}`}
                            rows={3}
                            className="input w-full text-sm resize-none mb-3"
                          />

                          {/* ── Message Preview (WA-style bubble) ── */}
                          {step.message.trim() && (
                            <div className="mb-3 rounded-lg p-3" style={{ backgroundColor: '#e5ddd5' }}>
                              <div className="max-w-[80%] ml-auto">
                                <div className="rounded-lg px-3 py-2 text-sm shadow-sm" style={{ backgroundColor: '#dcf8c6' }}>
                                  <p className="text-surface-800 whitespace-pre-wrap text-[13px]">{previewMessage(step.message)}</p>
                                  <p className="text-[10px] text-surface-400 text-right mt-1">12:00</p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Delay & Condition */}
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-surface-500">{t('sequences.delay')}</label>
                              <input type="number" min={0} value={step.delay_hours}
                                onChange={e => updateStep(i, { delay_hours: parseInt(e.target.value) || 0 })}
                                className="input w-16 text-xs text-center" />
                              <span className="text-xs text-surface-400">{t('sequences.hours')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-surface-500">{t('sequences.condition')}</label>
                              <select
                                value={step.condition || ''}
                                onChange={e => updateStep(i, { condition: e.target.value === 'no_reply' ? 'no_reply' : null })}
                                className="input text-xs py-1.5">
                                <option value="">{t('sequences.none')}</option>
                                <option value="no_reply">{t('sequences.only_if_no_reply')}</option>
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
                  <Plus className="w-4 h-4" /> {t('sequences.add_step')}
                </button>
              </div>

              {/* Visual flow preview */}
              <div>
                <label className="text-sm font-medium text-surface-700 block mb-2">{t('sequences.preview')}</label>
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
                    <p className="text-[10px] text-amber-600 mt-2">{t('sequences.only_sends_note')}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-surface-100 flex justify-end gap-3">
              <button onClick={() => setShowEditor(false)} className="btn-outline">{t('sequences.cancel')}</button>
              <button onClick={saveSequence} disabled={saving} className="btn-primary">
                {saving ? t('sequences.saving') : editingId ? t('sequences.update_sequence') : t('sequences.create_sequence')}
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
              <h2 className="text-lg font-bold text-surface-900">{t('sequences.enroll_contacts')}</h2>
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
                  placeholder={t('sequences.search_contacts')}
                  className="input w-full pl-9" />
              </div>
              {selectedContacts.size > 0 && (
                <p className="text-xs text-brand-600 mt-2 font-medium">
                  {selectedContacts.size} {selectedContacts.size !== 1 ? t('sequences.contact_plural') : t('sequences.contact_singular')}
                </p>
              )}
            </div>

            {/* Contact list */}
            <div className="flex-1 overflow-y-auto p-2">
              {filteredContacts.length === 0 ? (
                <p className="text-center text-sm text-surface-400 py-8">{t('sequences.no_contacts_found')}</p>
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
                        {c.phone || c.email || t('sequences.no_contact_info')}
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
              <button onClick={() => setShowEnroll(false)} className="btn-outline">{t('sequences.cancel')}</button>
              <button onClick={enrollSelected}
                disabled={enrolling || selectedContacts.size === 0}
                className="btn-primary flex items-center gap-2">
                {enrolling ? t('sequences.enrolling') : `${t('sequences.enroll_action')} ${selectedContacts.size}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
