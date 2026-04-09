'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Send, MessageCircle, Users, Filter, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

const TEMPLATES = [
  { name: 'Custom', message: '' },
  { name: 'Follow-up', message: 'Hi {{name}}, just following up on our conversation. Do you have any questions? Happy to help!' },
  { name: 'Promotion', message: '🎉 Hi {{name}}! We have a special offer for you. Reply YES to learn more.' },
  { name: 'Appointment', message: 'Hi {{name}}, this is a reminder about your appointment. Please confirm by replying OK.' },
  { name: 'Thank you', message: 'Hi {{name}}, thank you for your recent purchase! We appreciate your business. 🙏' },
]

export default function WhatsAppCampaignsPage() {
  const supabase = createClient()
  const [contacts, setContacts] = useState<{ id: string; name: string; phone: string; score_label: string; tags: string[] }[]>([])
  const [message, setMessage] = useState('')
  const [filterScore, setFilterScore] = useState('all')
  const [filterTags, setFilterTags] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<{ sent: number; failed: number } | null>(null)
  const [workspaceId, setWorkspaceId] = useState('')

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
    if (!ws) return
    setWorkspaceId(ws.id)
    const { data } = await supabase.from('contacts').select('id, name, phone, score_label, tags')
      .eq('workspace_id', ws.id).not('phone', 'is', null).order('name')
    setContacts((data || []).filter(c => c.phone))
  }, [])

  useEffect(() => { load() }, [load])

  const filteredContacts = contacts.filter(c => {
    if (filterScore !== 'all' && c.score_label !== filterScore) return false
    if (filterTags) {
      const tags = filterTags.split(',').map(t => t.trim().toLowerCase())
      if (!tags.some(t => c.tags?.map(ct => ct.toLowerCase()).includes(t))) return false
    }
    return true
  })

  const sendCampaign = async () => {
    if (!message.trim()) { toast.error('Message is required'); return }
    if (filteredContacts.length === 0) { toast.error('No contacts match filters'); return }
    setSending(true)

    let sentCount = 0, failedCount = 0

    for (const contact of filteredContacts.slice(0, 200)) {
      const personalizedMsg = message
        .replace(/\{\{name\}\}/g, contact.name || '')
        .replace(/\{\{first_name\}\}/g, (contact.name || '').split(' ')[0])

      try {
        const res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: contact.phone, message: personalizedMsg, contact_id: contact.id }),
        })
        if (res.ok) sentCount++
        else failedCount++
      } catch { failedCount++ }

      // Rate limit
      if (filteredContacts.length > 5) await new Promise(r => setTimeout(r, 200))
    }

    // Log activity
    await supabase.from('activities').insert({
      workspace_id: workspaceId,
      title: `WhatsApp campaign sent to ${sentCount} contacts`,
      type: 'note', done: true,
    })

    setSent({ sent: sentCount, failed: failedCount })
    toast.success(`Sent to ${sentCount} contacts!`)
    setSending(false)
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">WhatsApp Campaigns</h1>
          <p className="text-sm text-surface-500 mt-0.5">{contacts.length} contacts with phone number</p>
        </div>
      </div>

      {sent ? (
        <div className="card text-center py-16">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-7 h-7 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-surface-900 mb-2">Campaign sent!</h2>
          <p className="text-sm text-surface-500">{sent.sent} messages delivered, {sent.failed} failed</p>
          <button onClick={() => { setSent(null); setMessage('') }} className="btn-primary btn-sm mt-4">New campaign</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="card p-4">
              <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Quick templates</p>
              <div className="flex gap-2 flex-wrap">
                {TEMPLATES.map(t => (
                  <button key={t.name} onClick={() => setMessage(t.message)} className="btn-secondary btn-sm text-xs">{t.name}</button>
                ))}
              </div>
            </div>

            <div className="card p-4">
              <label className="label">Message</label>
              <textarea className="input resize-none" rows={6} value={message} onChange={e => setMessage(e.target.value)}
                placeholder="Hi {{name}}, ..." />
              <div className="flex items-center justify-between mt-2">
                <p className="text-[10px] text-surface-400">Variables: {'{{name}}, {{first_name}}'} · Max 200 recipients</p>
                <p className={cn('text-[10px] font-semibold', message.length > 1000 ? 'text-red-500' : 'text-surface-400')}>{message.length}/1000</p>
              </div>
            </div>

            <div className="card p-4">
              <p className="label">Preview</p>
              <div className="bg-[#e5ddd5] rounded-xl p-4 max-w-xs">
                <div className="bg-white rounded-xl rounded-tl-sm p-3 shadow-sm">
                  <p className="text-sm text-surface-800 whitespace-pre-wrap">
                    {(message || 'Your message will appear here...').replace(/\{\{name\}\}/g, 'María García').replace(/\{\{first_name\}\}/g, 'María')}
                  </p>
                  <p className="text-[10px] text-surface-400 text-right mt-1">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Filter className="w-4 h-4 text-surface-400" />
                <p className="text-sm font-semibold text-surface-900">Audience</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="label">Engagement</label>
                  <select className="input" value={filterScore} onChange={e => setFilterScore(e.target.value)}>
                    <option value="all">All</option>
                    <option value="hot">Hot only</option>
                    <option value="warm">Warm only</option>
                    <option value="cold">Cold only</option>
                  </select>
                </div>
                <div>
                  <label className="label">Tags</label>
                  <input className="input" value={filterTags} onChange={e => setFilterTags(e.target.value)} placeholder="e.g. vip, newsletter" />
                </div>
              </div>
            </div>

            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-surface-400" />
                <p className="text-sm font-semibold text-surface-900">Recipients</p>
              </div>
              <p className="text-3xl font-extrabold text-surface-900">{Math.min(filteredContacts.length, 200)}</p>
              <p className="text-xs text-surface-400">contacts with phone number</p>
            </div>

            <button onClick={sendCampaign} disabled={sending || !message.trim() || filteredContacts.length === 0}
              className="btn-primary w-full py-3">
              {sending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><MessageCircle className="w-4 h-4" /> Send WhatsApp Campaign</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
