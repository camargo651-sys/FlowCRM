'use client'
import { useState, useCallback, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Send, Users, Mail, Filter, Eye, Edit3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getActiveWorkspace } from '@/lib/get-active-workspace'
import { useI18n } from '@/lib/i18n/context'
import VisualMessageEditor, { EmailPreview } from '@/components/shared/VisualMessageEditor'
import { type Block, blocksToHTML, EMAIL_TEMPLATES, newId } from '@/lib/campaigns/blocks-to-html'

export default function CampaignsPage() {
  const { t } = useI18n()
  const supabase = createClient()
  const [contactCount, setContactCount] = useState(0)
  const [subject, setSubject] = useState('')
  const [blocks, setBlocks] = useState<Block[]>([
    { id: newId(), type: 'text', content: 'Hi {{first_name}},\n\nWrite your message here. Click "Add block" to insert images, buttons or headings.' },
  ])
  const [filterType, setFilterType] = useState('all')
  const [filterScore, setFilterScore] = useState('all')
  const [filterTags, setFilterTags] = useState('')
  const [sending, setSending] = useState(false)
  const [preview, setPreview] = useState(true)
  const [sent, setSent] = useState<{ sent: number; failed: number } | null>(null)

  const htmlBody = useMemo(() => blocksToHTML(blocks, 'email'), [blocks])
  const previewHtml = useMemo(() => htmlBody
    .replace(/\{\{name\}\}/g, 'John Doe')
    .replace(/\{\{first_name\}\}/g, 'John')
    .replace(/\{\{email\}\}/g, 'john@example.com')
    .replace(/\{\{company\}\}/g, 'Your Company'),
  [htmlBody])

  const loadCount = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const ws = await getActiveWorkspace(supabase, user.id, 'id')
    if (!ws) return
    const { count } = await supabase.from('contacts').select('id', { count: 'exact', head: true })
      .eq('workspace_id', ws.id).not('email', 'is', null)
    setContactCount(count || 0)
  }, [])

  useEffect(() => { loadCount() }, [loadCount])

  const applyTemplate = (tpl: typeof EMAIL_TEMPLATES[0]) => {
    setSubject(tpl.subject)
    setBlocks(tpl.blocks.map(b => ({ ...b, id: newId() })))
  }

  const sendCampaign = async () => {
    if (!subject || blocks.length === 0 || !htmlBody) { toast.error(t('campaigns.subject_required')); return }
    setSending(true)
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject, html_body: htmlBody, body_blocks: blocks,
          filter_type: filterType, filter_score: filterScore,
          filter_tags: filterTags ? filterTags.split(',').map(t => t.trim()) : [],
        }),
      })
      const result = await res.json()
      if (result.success) {
        setSent(result)
        toast.success(`${t('campaigns.sent_to_n')} ${result.sent} ${t('campaigns.contacts_suffix')}!`)
      } else {
        toast.error(result.error || t('campaigns.send_failed'))
      }
    } catch { toast.error(t('campaigns.failed_to_send')) }
    setSending(false)
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('pages.campaigns')}</h1>
          <p className="text-sm text-surface-500 mt-0.5">{contactCount} {t('campaigns.contacts_with_email')}</p>
        </div>
      </div>

      {sent ? (
        <div className="card text-center py-16">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Send className="w-7 h-7 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-surface-900 mb-2">{t('campaigns.campaign_sent')}</h2>
          <p className="text-sm text-surface-500 mb-1">{sent.sent} {t('campaigns.emails_delivered')} {sent.failed} {t('campaigns.failed')}</p>
          <button onClick={() => { setSent(null); setSubject(''); setBlocks([]) }} className="btn-primary btn-sm mt-4">
            {t('campaigns.create_another')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Compose */}
          <div className="lg:col-span-2 space-y-4">
            {/* Templates */}
            <div className="card p-4">
              <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">{t('campaigns.start_from_template')}</p>
              <div className="flex gap-2 flex-wrap">
                {EMAIL_TEMPLATES.map(tpl => (
                  <button key={tpl.name} onClick={() => applyTemplate(tpl)}
                    className="btn-secondary btn-sm text-xs">{tpl.name}</button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div className="card p-4">
              <label className="label">{t('campaigns.subject_line')}</label>
              <input className="input" value={subject} onChange={e => setSubject(e.target.value)}
                placeholder={t('campaigns.subject_placeholder')} />
              <p className="text-[10px] text-surface-400 mt-1">{t('campaigns.variables_label')} {'{{name}}, {{first_name}}, {{email}}, {{company}}'}</p>
            </div>

            {/* Visual body editor */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <label className="label mb-0">{t('campaigns.email_body')}</label>
                <button onClick={() => setPreview(!preview)} className={cn('btn-ghost btn-sm text-xs', preview && 'bg-brand-50 text-brand-600')}>
                  {preview ? <><Edit3 className="w-3 h-3" /> {t('campaigns.edit')}</> : <><Eye className="w-3 h-3" /> {t('campaigns.preview')}</>}
                </button>
              </div>
              {preview ? (
                <EmailPreview html={previewHtml} />
              ) : (
                <VisualMessageEditor type="email" value={blocks} onChange={setBlocks} />
              )}
            </div>
          </div>

          {/* Right: Filters & Send */}
          <div className="space-y-4">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Filter className="w-4 h-4 text-surface-400" />
                <p className="text-sm font-semibold text-surface-900">{t('campaigns.audience')}</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="label">{t('campaigns.contact_type')}</label>
                  <select className="input" value={filterType} onChange={e => setFilterType(e.target.value)}>
                    <option value="all">{t('campaigns.all_contacts')}</option>
                    <option value="person">{t('campaigns.people_only')}</option>
                    <option value="company">{t('campaigns.companies_only')}</option>
                  </select>
                </div>
                <div>
                  <label className="label">{t('campaigns.engagement')}</label>
                  <select className="input" value={filterScore} onChange={e => setFilterScore(e.target.value)}>
                    <option value="all">{t('campaigns.any_engagement')}</option>
                    <option value="hot">{t('campaigns.hot_only')}</option>
                    <option value="warm">{t('campaigns.warm_only')}</option>
                    <option value="cold">{t('campaigns.cold_only')}</option>
                  </select>
                </div>
                <div>
                  <label className="label">{t('campaigns.tags_comma')}</label>
                  <input className="input" value={filterTags} onChange={e => setFilterTags(e.target.value)}
                    placeholder={t('campaigns.tags_placeholder')} />
                </div>
              </div>
            </div>

            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-surface-400" />
                <p className="text-sm font-semibold text-surface-900">{t('campaigns.estimated_reach')}</p>
              </div>
              <p className="text-3xl font-extrabold text-surface-900">{contactCount}</p>
              <p className="text-xs text-surface-400">{t('campaigns.contacts_email_addr')}</p>
            </div>

            <button onClick={sendCampaign} disabled={sending || !subject || blocks.length === 0}
              className="btn-primary w-full py-3">
              {sending ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><Mail className="w-4 h-4" /> {t('campaigns.send_campaign')}</>
              )}
            </button>

            <p className="text-[10px] text-surface-400 text-center">
              {t('campaigns.resend_notice')}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
