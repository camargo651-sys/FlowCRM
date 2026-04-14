'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { Mail, Search, Inbox, Send as SendIcon, Star, Archive, RefreshCw, Paperclip, ArrowLeft, Reply, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import AISummaryButton from '@/components/shared/AISummaryButton'

type Folder = 'inbox' | 'sent' | 'starred' | 'archived'

interface EmailMessage {
  id: string
  workspace_id: string
  contact_id: string | null
  thread_id: string | null
  direction: 'inbound' | 'outbound' | null
  from_address: string | null
  from_name: string | null
  to_addresses: string[] | null
  cc_addresses: string[] | null
  subject: string | null
  snippet: string | null
  body_html: string | null
  body_text: string | null
  has_attachments: boolean | null
  is_read: boolean | null
  starred: boolean | null
  archived: boolean | null
  received_at: string
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const dd = Math.floor(h / 24)
  if (dd < 7) return `${dd}d`
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function InboxEmailPage() {
  const [messages, setMessages] = useState<EmailMessage[]>([])
  const [folder, setFolder] = useState<Folder>('inbox')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [thread, setThread] = useState<EmailMessage[]>([])
  const [showReply, setShowReply] = useState(false)
  const [replySubject, setReplySubject] = useState('')
  const [replyBody, setReplyBody] = useState('')
  const [sending, setSending] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [mobileView, setMobileView] = useState<'list' | 'reading'>('list')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ folder })
      if (search.trim()) params.set('search', search.trim())
      const res = await fetch(`/api/email/messages?${params.toString()}`)
      const data = await res.json()
      setMessages(data.messages || [])
    } catch {
      setMessages([])
    } finally {
      setLoading(false)
    }
  }, [folder, search])

  useEffect(() => { load() }, [load])

  // Group into threads (by thread_id, fall back to id)
  const threads = useMemo(() => {
    const map = new Map<string, EmailMessage[]>()
    for (const m of messages) {
      const key = m.thread_id || m.id
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(m)
    }
    return Array.from(map.entries()).map(([key, msgs]) => {
      const sorted = [...msgs].sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime())
      return { key, latest: sorted[0], count: msgs.length, anyUnread: msgs.some(m => !m.is_read), anyStarred: msgs.some(m => m.starred), anyAttach: msgs.some(m => m.has_attachments) }
    }).sort((a, b) => new Date(b.latest.received_at).getTime() - new Date(a.latest.received_at).getTime())
  }, [messages])

  const openThread = async (key: string, latest: EmailMessage) => {
    setSelectedThreadId(key)
    setSelectedMessageId(latest.id)
    setShowReply(false)
    setMobileView('reading')
    try {
      const res = await fetch(`/api/email/messages/${latest.id}`)
      const data = await res.json()
      const t: EmailMessage[] = (data.thread && data.thread.length > 0) ? data.thread : [data.message]
      setThread(t)
      // Mark read
      if (!latest.is_read) {
        await fetch(`/api/email/messages/${latest.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_read: true }),
        })
        setMessages(prev => prev.map(m => m.id === latest.id ? { ...m, is_read: true } : m))
      }
    } catch {
      setThread([])
    }
  }

  const toggleStar = async (msg: EmailMessage) => {
    const next = !msg.starred
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, starred: next } : m))
    setThread(prev => prev.map(m => m.id === msg.id ? { ...m, starred: next } : m))
    await fetch(`/api/email/messages/${msg.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ starred: next }),
    })
  }

  const archiveMsg = async (msg: EmailMessage) => {
    await fetch(`/api/email/messages/${msg.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: true }),
    })
    toast.success('Archived')
    setMessages(prev => prev.filter(m => m.id !== msg.id))
    setSelectedThreadId(null)
    setMobileView('list')
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/email/sync', { method: 'POST' })
      const data = await res.json()
      if (res.ok && (data.synced || 0) > 0) {
        toast.success(`Synced ${data.synced} account(s)`)
        load()
      } else {
        toast.message('Sync placeholder — wire OAuth in integrations', { description: data.message || data.todo || 'No active accounts' })
      }
    } catch {
      toast.error('Sync failed')
    }
    setSyncing(false)
  }

  const openReply = () => {
    const latest = thread[thread.length - 1] || thread[0]
    if (!latest) return
    setReplySubject(latest.subject?.startsWith('Re: ') ? latest.subject : `Re: ${latest.subject || ''}`)
    setReplyBody('')
    setShowReply(true)
  }

  const sendReply = async () => {
    const latest = thread[thread.length - 1] || thread[0]
    if (!latest) return
    if (!replyBody.trim()) { toast.error('Write a message'); return }
    setSending(true)
    try {
      const to = latest.direction === 'inbound' ? [latest.from_address!] : (latest.to_addresses || [])
      const res = await fetch('/api/email/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject: replySubject,
          body_text: replyBody,
          contact_id: latest.contact_id,
          thread_id: latest.thread_id,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Reply saved', { description: data.todo })
        setShowReply(false)
        setReplyBody('')
        load()
      } else {
        toast.error(data.error || 'Failed')
      }
    } catch {
      toast.error('Failed to send')
    }
    setSending(false)
  }

  const folders: { key: Folder; label: string; icon: typeof Inbox }[] = [
    { key: 'inbox', label: 'Inbox', icon: Inbox },
    { key: 'sent', label: 'Sent', icon: SendIcon },
    { key: 'starred', label: 'Starred', icon: Star },
    { key: 'archived', label: 'Archived', icon: Archive },
  ]

  const selected = selectedMessageId ? (messages.find(m => m.id === selectedMessageId) || thread[0]) : null

  return (
    <div className="animate-fade-in flex flex-col h-[calc(100vh-7rem)]">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><Mail className="w-5 h-5" /> Email Inbox</h1>
          <p className="text-sm text-surface-500 mt-0.5">{messages.length} message{messages.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSync} disabled={syncing} className="btn-secondary btn-sm">
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Sync now
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[200px_360px_1fr] gap-4 min-h-0">
        {/* Sidebar */}
        <aside className={cn('space-y-1', mobileView === 'reading' && 'hidden lg:block')}>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400" />
            <input className="input pl-9 text-xs" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {folders.map(f => {
            const Icon = f.icon
            return (
              <button key={f.key}
                onClick={() => { setFolder(f.key); setSelectedThreadId(null); setMobileView('list') }}
                className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors text-left',
                  folder === f.key ? 'bg-brand-50 text-brand-700' : 'text-surface-600 hover:bg-surface-100')}>
                <Icon className="w-3.5 h-3.5" />
                {f.label}
              </button>
            )
          })}
        </aside>

        {/* Thread list */}
        <div className={cn('card overflow-y-auto min-h-0', mobileView === 'reading' && 'hidden lg:block', selectedThreadId && 'lg:block')}>
          {loading ? (
            <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>
          ) : threads.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Mail className="w-10 h-10 text-surface-300 mx-auto mb-2" />
              <p className="text-surface-500 text-sm">No messages</p>
              <p className="text-surface-400 text-xs mt-1">Click Sync now to pull from your connected accounts</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-100">
              {threads.map(t => (
                <button key={t.key}
                  onClick={() => openThread(t.key, t.latest)}
                  className={cn('w-full text-left px-4 py-3 hover:bg-surface-50 transition-colors block',
                    selectedThreadId === t.key && 'bg-brand-50',
                    t.anyUnread && 'font-semibold')}>
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className={cn('text-xs truncate', t.anyUnread ? 'text-surface-900 font-bold' : 'text-surface-700')}>
                      {t.latest.from_name || t.latest.from_address || 'Unknown'}
                    </span>
                    <span className="text-[10px] text-surface-400 flex-shrink-0">{timeAgo(t.latest.received_at)}</span>
                  </div>
                  <p className={cn('text-xs truncate mb-0.5', t.anyUnread ? 'text-surface-900' : 'text-surface-600')}>
                    {t.latest.subject || '(no subject)'}
                    {t.count > 1 && <span className="ml-1 text-[10px] text-surface-400">({t.count})</span>}
                  </p>
                  <p className="text-[11px] text-surface-400 truncate">{t.latest.snippet}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    {t.anyUnread && <span className="badge badge-blue text-[9px]">unread</span>}
                    {t.anyStarred && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                    {t.anyAttach && <Paperclip className="w-3 h-3 text-surface-400" />}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reading panel */}
        <div className={cn('card overflow-y-auto min-h-0 p-5', mobileView === 'list' && 'hidden lg:block')}>
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Mail className="w-12 h-12 text-surface-200 mb-3" />
              <p className="text-surface-500 text-sm">Select a message to read</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-surface-100">
                <div className="flex items-center gap-2">
                  <button onClick={() => { setSelectedThreadId(null); setMobileView('list') }} className="lg:hidden btn-ghost btn-sm"><ArrowLeft className="w-4 h-4" /></button>
                  <h2 className="text-base font-semibold text-surface-900">{selected.subject || '(no subject)'}</h2>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => toggleStar(selected)} className="btn-ghost btn-sm" title="Star">
                    <Star className={cn('w-4 h-4', selected.starred ? 'text-amber-500 fill-amber-500' : 'text-surface-400')} />
                  </button>
                  <button onClick={() => archiveMsg(selected)} className="btn-ghost btn-sm" title="Archive">
                    <Archive className="w-4 h-4 text-surface-400" />
                  </button>
                  <AISummaryButton
                    type="email"
                    label="Summarize thread"
                    getText={() => thread.map(m => `${m.from_name || m.from_address}: ${m.body_text || m.snippet || ''}`).join('\n\n')}
                  />
                  <button onClick={openReply} className="btn-primary btn-sm"><Reply className="w-3.5 h-3.5" /> Reply</button>
                </div>
              </div>

              <div className="space-y-4">
                {thread.map(m => (
                  <div key={m.id} className="border border-surface-100 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold text-surface-900">{m.from_name || m.from_address}</p>
                        <p className="text-[11px] text-surface-400">to {(m.to_addresses || []).join(', ')}</p>
                      </div>
                      <span className="text-[11px] text-surface-400">{new Date(m.received_at).toLocaleString()}</span>
                    </div>
                    {m.body_html ? (
                      <div className="prose prose-sm max-w-none text-sm text-surface-700" dangerouslySetInnerHTML={{ __html: m.body_html }} />
                    ) : (
                      <p className="text-sm text-surface-700 whitespace-pre-wrap">{m.body_text || m.snippet}</p>
                    )}
                  </div>
                ))}
              </div>

              {showReply && (
                <div className="card p-4 border border-brand-200 bg-brand-50/30">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">Reply</h3>
                    <button onClick={() => setShowReply(false)} className="btn-ghost btn-sm"><X className="w-4 h-4" /></button>
                  </div>
                  <input className="input mb-2" value={replySubject} onChange={e => setReplySubject(e.target.value)} placeholder="Subject" />
                  <textarea className="input min-h-[140px] text-sm" value={replyBody} onChange={e => setReplyBody(e.target.value)} placeholder="Write your reply..." />
                  <div className="flex justify-end gap-2 mt-3">
                    <button onClick={() => setShowReply(false)} className="btn-secondary btn-sm">Cancel</button>
                    <button onClick={sendReply} disabled={sending} className="btn-primary btn-sm">
                      {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SendIcon className="w-3.5 h-3.5" />}
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
