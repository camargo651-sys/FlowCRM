'use client'
import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Send, Users, Mail, Filter, Eye, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const TEMPLATES = [
  { name: 'Blank', subject: '', body: '' },
  { name: 'Newsletter', subject: 'News from {{company}}', body: `<div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px;">
<h1 style="font-size:24px;color:#151b3a;">Hi {{first_name}},</h1>
<p style="color:#6b75a0;font-size:15px;line-height:1.7;">Here's what's new this month:</p>
<ul style="color:#374068;font-size:14px;line-height:2;">
<li>New feature announcement</li>
<li>Tips to get more from Tracktio</li>
<li>Customer spotlight</li>
</ul>
<p style="color:#6b75a0;font-size:14px;margin-top:24px;">Best,<br/>The {{company}} Team</p>
</div>` },
  { name: 'Promotion', subject: 'Special offer for {{first_name}}', body: `<div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px;text-align:center;">
<h1 style="font-size:28px;color:#151b3a;">Special Offer!</h1>
<p style="color:#6b75a0;font-size:16px;">Hi {{first_name}}, we have something special for you.</p>
<div style="margin:32px 0;padding:24px;background:#f0f4ff;border-radius:16px;">
<p style="font-size:36px;font-weight:800;color:#6172f3;margin:0;">20% OFF</p>
<p style="color:#6b75a0;font-size:14px;margin:4px 0 0;">Use code: SPECIAL20</p>
</div>
<a href="#" style="display:inline-block;padding:14px 32px;background:#6172f3;color:white;text-decoration:none;border-radius:12px;font-weight:600;">Claim Offer</a>
</div>` },
  { name: 'Follow-up', subject: 'Quick follow-up, {{first_name}}', body: `<div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px;">
<p style="color:#374068;font-size:15px;line-height:1.7;">Hi {{first_name}},</p>
<p style="color:#374068;font-size:15px;line-height:1.7;">I wanted to follow up on our last conversation. Do you have any questions I can help with?</p>
<p style="color:#374068;font-size:15px;line-height:1.7;">I'd love to schedule a quick call this week if you're available.</p>
<p style="color:#6b75a0;font-size:14px;margin-top:24px;">Best regards,<br/>{{company}}</p>
</div>` },
]

export default function CampaignsPage() {
  const supabase = createClient()
  const [contactCount, setContactCount] = useState(0)
  const [subject, setSubject] = useState('')
  const [htmlBody, setHtmlBody] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterScore, setFilterScore] = useState('all')
  const [filterTags, setFilterTags] = useState('')
  const [sending, setSending] = useState(false)
  const [preview, setPreview] = useState(false)
  const [sent, setSent] = useState<{ sent: number; failed: number } | null>(null)

  const loadCount = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
    if (!ws) return
    const { count } = await supabase.from('contacts').select('id', { count: 'exact', head: true })
      .eq('workspace_id', ws.id).not('email', 'is', null)
    setContactCount(count || 0)
  }, [])

  useEffect(() => { loadCount() }, [loadCount])

  const applyTemplate = (t: typeof TEMPLATES[0]) => {
    setSubject(t.subject)
    setHtmlBody(t.body)
  }

  const sendCampaign = async () => {
    if (!subject || !htmlBody) { toast.error('Subject and body are required'); return }
    setSending(true)
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject, html_body: htmlBody,
          filter_type: filterType, filter_score: filterScore,
          filter_tags: filterTags ? filterTags.split(',').map(t => t.trim()) : [],
        }),
      })
      const result = await res.json()
      if (result.success) {
        setSent(result)
        toast.success(`Campaign sent to ${result.sent} contacts!`)
      } else {
        toast.error(result.error || 'Failed to send')
      }
    } catch { toast.error('Failed to send campaign') }
    setSending(false)
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Email Campaigns</h1>
          <p className="text-sm text-surface-500 mt-0.5">{contactCount} contacts with email</p>
        </div>
      </div>

      {sent ? (
        <div className="card text-center py-16">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Send className="w-7 h-7 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-surface-900 mb-2">Campaign sent!</h2>
          <p className="text-sm text-surface-500 mb-1">{sent.sent} emails delivered, {sent.failed} failed</p>
          <button onClick={() => { setSent(null); setSubject(''); setHtmlBody('') }} className="btn-primary btn-sm mt-4">
            Create another campaign
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Compose */}
          <div className="lg:col-span-2 space-y-4">
            {/* Templates */}
            <div className="card p-4">
              <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Start from a template</p>
              <div className="flex gap-2 flex-wrap">
                {TEMPLATES.map(t => (
                  <button key={t.name} onClick={() => applyTemplate(t)}
                    className="btn-secondary btn-sm text-xs">{t.name}</button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div className="card p-4">
              <label className="label">Subject line</label>
              <input className="input" value={subject} onChange={e => setSubject(e.target.value)}
                placeholder="e.g. News from {{company}}" />
              <p className="text-[10px] text-surface-400 mt-1">Variables: {'{{name}}, {{first_name}}, {{email}}, {{company}}'}</p>
            </div>

            {/* Body */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Email body (HTML)</label>
                <button onClick={() => setPreview(!preview)} className={cn('btn-ghost btn-sm text-xs', preview && 'bg-brand-50 text-brand-600')}>
                  <Eye className="w-3 h-3" /> {preview ? 'Edit' : 'Preview'}
                </button>
              </div>
              {preview ? (
                <div className="border border-surface-100 rounded-xl p-4 min-h-[300px] bg-white" dangerouslySetInnerHTML={{ __html: htmlBody
                  .replace(/\{\{name\}\}/g, 'John Doe')
                  .replace(/\{\{first_name\}\}/g, 'John')
                  .replace(/\{\{email\}\}/g, 'john@example.com')
                  .replace(/\{\{company\}\}/g, 'Your Company')
                }} />
              ) : (
                <textarea className="input font-mono text-xs resize-none" rows={14}
                  value={htmlBody} onChange={e => setHtmlBody(e.target.value)}
                  placeholder="<div>Your email content here...</div>" />
              )}
            </div>
          </div>

          {/* Right: Filters & Send */}
          <div className="space-y-4">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Filter className="w-4 h-4 text-surface-400" />
                <p className="text-sm font-semibold text-surface-900">Audience</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="label">Contact type</label>
                  <select className="input" value={filterType} onChange={e => setFilterType(e.target.value)}>
                    <option value="all">All contacts</option>
                    <option value="person">People only</option>
                    <option value="company">Companies only</option>
                  </select>
                </div>
                <div>
                  <label className="label">Engagement</label>
                  <select className="input" value={filterScore} onChange={e => setFilterScore(e.target.value)}>
                    <option value="all">Any engagement</option>
                    <option value="hot">Hot only</option>
                    <option value="warm">Warm only</option>
                    <option value="cold">Cold only</option>
                  </select>
                </div>
                <div>
                  <label className="label">Tags (comma separated)</label>
                  <input className="input" value={filterTags} onChange={e => setFilterTags(e.target.value)}
                    placeholder="e.g. newsletter, vip" />
                </div>
              </div>
            </div>

            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-surface-400" />
                <p className="text-sm font-semibold text-surface-900">Estimated reach</p>
              </div>
              <p className="text-3xl font-extrabold text-surface-900">{contactCount}</p>
              <p className="text-xs text-surface-400">contacts with email address</p>
            </div>

            <button onClick={sendCampaign} disabled={sending || !subject || !htmlBody}
              className="btn-primary w-full py-3">
              {sending ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><Mail className="w-4 h-4" /> Send Campaign</>
              )}
            </button>

            <p className="text-[10px] text-surface-400 text-center">
              Requires RESEND_API_KEY configured in environment.
              Max 500 recipients per campaign.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
