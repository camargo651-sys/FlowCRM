'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { MessageCircle, Users, Filter } from 'lucide-react'
import { getActiveWorkspace } from '@/lib/get-active-workspace'
import { useI18n } from '@/lib/i18n/context'
import VisualMessageEditor, { WhatsAppPreview } from '@/components/shared/VisualMessageEditor'
import { type Block, blocksToWhatsAppText, WHATSAPP_TEMPLATES, newId } from '@/lib/campaigns/blocks-to-html'

export default function WhatsAppCampaignsPage() {
  const { t } = useI18n()
  const supabase = createClient()
  const [contacts, setContacts] = useState<{ id: string; name: string; phone: string; score_label: string; tags: string[] }[]>([])
  const [blocks, setBlocks] = useState<Block[]>([
    { id: newId(), type: 'text', content: 'Hi {{first_name}}, ...' },
  ])
  const [filterScore, setFilterScore] = useState('all')
  const [filterTags, setFilterTags] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<{ sent: number; failed: number } | null>(null)
  const [workspaceId, setWorkspaceId] = useState('')

  const messageText = useMemo(() => blocksToWhatsAppText(blocks), [blocks])
  const previewText = useMemo(() => messageText
    .replace(/\{\{name\}\}/g, 'María García')
    .replace(/\{\{first_name\}\}/g, 'María'),
  [messageText])

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const ws = await getActiveWorkspace(supabase, user.id, 'id')
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

  const applyTemplate = (tpl: typeof WHATSAPP_TEMPLATES[0]) => {
    setBlocks(tpl.blocks.map(b => ({ ...b, id: newId() })))
  }

  const sendCampaign = async () => {
    if (!messageText.trim()) { toast.error('Message is required'); return }
    if (filteredContacts.length === 0) { toast.error('No contacts match filters'); return }
    setSending(true)

    let sentCount = 0, failedCount = 0

    for (const contact of filteredContacts.slice(0, 200)) {
      const personalizedMsg = messageText
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

      if (filteredContacts.length > 5) await new Promise(r => setTimeout(r, 200))
    }

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
          <h1 className="page-title">{t('pages.wa_campaigns')}</h1>
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
          <button onClick={() => { setSent(null); setBlocks([]) }} className="btn-primary btn-sm mt-4">New campaign</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="card p-4">
              <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Quick templates</p>
              <div className="flex gap-2 flex-wrap">
                {WHATSAPP_TEMPLATES.map(tpl => (
                  <button key={tpl.name} onClick={() => applyTemplate(tpl)} className="btn-secondary btn-sm text-xs">{tpl.name}</button>
                ))}
              </div>
            </div>

            <div className="card p-4">
              <label className="label">Message</label>
              <VisualMessageEditor type="whatsapp" value={blocks} onChange={setBlocks} />
              <div className="flex items-center justify-between mt-2">
                <p className="text-[10px] text-surface-400">Variables: {'{{name}}, {{first_name}}'} · Max 200 recipients</p>
                <p className="text-[10px] font-semibold text-surface-400">{messageText.length} chars</p>
              </div>
            </div>

            <div className="card p-4">
              <p className="label">Preview</p>
              <WhatsAppPreview text={previewText} />
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

            <button onClick={sendCampaign} disabled={sending || !messageText.trim() || filteredContacts.length === 0}
              className="btn-primary w-full py-3">
              {sending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><MessageCircle className="w-4 h-4" /> {t('action.send')} WhatsApp</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
