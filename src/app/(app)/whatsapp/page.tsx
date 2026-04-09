'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import { MessageCircle, Send, Search, Phone, User } from 'lucide-react'

interface Message {
  id: string
  wamid: string
  from_number: string
  to_number: string
  direction: 'inbound' | 'outbound'
  message_type: string
  body: string
  status: string
  received_at: string
  contact_id: string
}

interface Conversation {
  contact_id: string
  contact_name: string
  contact_phone: string
  last_message: string
  last_message_at: string
  direction: 'inbound' | 'outbound'
  unread_count: number
}

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const diff = now - new Date(dateStr).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function StatusCheck({ status }: { status: string }) {
  if (status === 'read') return <span className="text-brand-500 text-xs ml-1">✓✓</span>
  if (status === 'delivered') return <span className="text-surface-400 text-xs ml-1">✓✓</span>
  if (status === 'sent') return <span className="text-surface-400 text-xs ml-1">✓</span>
  return null
}

export default function WhatsAppInboxPage() {
  const supabase = createClient()
  const { t } = useI18n()

  const [loading, setLoading] = useState(true)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Load workspace
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
      if (ws) setWorkspaceId(ws.id)
    }
    load()
  }, [])

  // Load conversations
  useEffect(() => {
    if (!workspaceId) return
    const loadConversations = async () => {
      setLoading(true)
      try {
        // Get all messages grouped by contact
        const { data: msgs, error } = await supabase
          .from('whatsapp_messages')
          .select('id, contact_id, body, direction, received_at, status')
          .eq('workspace_id', workspaceId)
          .order('received_at', { ascending: false })

        if (error) throw error
        if (!msgs || msgs.length === 0) {
          setConversations([])
          setLoading(false)
          return
        }

        // Group by contact_id to get latest message per contact
        const contactMap = new Map<string, { last: typeof msgs[0]; unread: number }>()
        for (const msg of msgs) {
          if (!msg.contact_id) continue
          if (!contactMap.has(msg.contact_id)) {
            contactMap.set(msg.contact_id, { last: msg, unread: 0 })
          }
          if (msg.direction === 'inbound' && msg.status !== 'read') {
            const entry = contactMap.get(msg.contact_id)!
            entry.unread++
          }
        }

        // Load contact names
        const contactIds = Array.from(contactMap.keys())
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id, name, phone')
          .in('id', contactIds)

        const contactLookup = new Map((contacts || []).map(c => [c.id, c]))

        const convos: Conversation[] = contactIds
          .map(cid => {
            const entry = contactMap.get(cid)!
            const contact = contactLookup.get(cid)
            return {
              contact_id: cid,
              contact_name: contact?.name || 'Unknown',
              contact_phone: contact?.phone || '',
              last_message: entry.last.body || '',
              last_message_at: entry.last.received_at,
              direction: entry.last.direction as 'inbound' | 'outbound',
              unread_count: entry.unread,
            }
          })
          .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())

        setConversations(convos)
      } catch (err) {
        toast.error('Failed to load conversations')
      } finally {
        setLoading(false)
      }
    }
    loadConversations()
  }, [workspaceId])

  // Load messages for selected contact
  useEffect(() => {
    if (!selectedContactId || !workspaceId) {
      setMessages([])
      return
    }
    const loadMessages = async () => {
      setLoadingMessages(true)
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('id, wamid, from_number, to_number, direction, message_type, body, status, received_at, contact_id')
        .eq('workspace_id', workspaceId)
        .eq('contact_id', selectedContactId)
        .order('received_at', { ascending: true })

      if (error) {
        toast.error('Failed to load messages')
      } else {
        setMessages(data || [])
      }
      setLoadingMessages(false)
    }
    loadMessages()
  }, [selectedContactId, workspaceId])

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Realtime subscription
  useEffect(() => {
    if (!workspaceId) return
    const channel = supabase
      .channel('wa-inbox')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'whatsapp_messages',
        filter: `workspace_id=eq.${workspaceId}`,
      }, (payload) => {
        const newMsg = payload.new as Message

        // Update conversation list
        setConversations(prev => {
          const existing = prev.find(c => c.contact_id === newMsg.contact_id)
          if (existing) {
            const updated = prev.map(c =>
              c.contact_id === newMsg.contact_id
                ? {
                    ...c,
                    last_message: newMsg.body,
                    last_message_at: newMsg.received_at,
                    direction: newMsg.direction,
                    unread_count: newMsg.direction === 'inbound' && newMsg.contact_id !== selectedContactId
                      ? c.unread_count + 1
                      : c.unread_count,
                  }
                : c
            )
            return updated.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
          }
          // New conversation — add it
          return [{
            contact_id: newMsg.contact_id,
            contact_name: newMsg.from_number || 'Unknown',
            contact_phone: newMsg.from_number || '',
            last_message: newMsg.body,
            last_message_at: newMsg.received_at,
            direction: newMsg.direction,
            unread_count: newMsg.direction === 'inbound' ? 1 : 0,
          }, ...prev]
        })

        // Add to current chat if viewing this contact
        if (newMsg.contact_id === selectedContactId) {
          setMessages(prev => [...prev, newMsg])
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [workspaceId, selectedContactId])

  const handleSend = async () => {
    if (!reply.trim() || !selectedContactId || sending) return
    const msg = reply.trim()
    setReply('')
    setSending(true)
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: selectedContactId, message: msg }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Send failed')
      // Message will arrive via realtime, but add optimistically
      if (data.message) {
        setMessages(prev => [...prev, data.message])
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send'
      toast.error(message)
      setReply(msg) // Restore on failure
    } finally {
      setSending(false)
    }
  }

  const filteredConversations = conversations.filter(c =>
    !searchQuery || c.contact_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.contact_phone.includes(searchQuery)
  )

  const selectedConvo = conversations.find(c => c.contact_id === selectedContactId)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-64px)] bg-surface-50">
      {/* LEFT PANEL — Conversation List */}
      <div className="w-[360px] border-r border-surface-200 bg-white flex flex-col flex-shrink-0">
        {/* Header */}
        <div className="px-4 py-3 border-b border-surface-100">
          <h1 className="text-lg font-bold text-surface-900 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-600" />
            {t('nav.wa_inbox')}
          </h1>
          <div className="mt-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              type="text"
              placeholder={t('contacts.search') || 'Search...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input pl-9 w-full text-sm"
            />
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-surface-400 px-6 text-center">
              <MessageCircle className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">No conversations yet</p>
              <p className="text-xs mt-1">WhatsApp messages will appear here</p>
            </div>
          ) : (
            filteredConversations.map(convo => (
              <button
                key={convo.contact_id}
                onClick={() => {
                  setSelectedContactId(convo.contact_id)
                  // Clear unread
                  setConversations(prev =>
                    prev.map(c => c.contact_id === convo.contact_id ? { ...c, unread_count: 0 } : c)
                  )
                }}
                className={cn(
                  'w-full text-left px-4 py-3 border-b border-surface-50 hover:bg-surface-50 transition-colors flex gap-3',
                  selectedContactId === convo.contact_id && 'bg-brand-50 hover:bg-brand-50'
                )}
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-surface-100 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-surface-400" />
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('text-sm truncate', convo.unread_count > 0 ? 'font-bold text-surface-900' : 'font-medium text-surface-800')}>
                      {convo.contact_name}
                    </span>
                    <span className="text-[11px] text-surface-400 flex-shrink-0">{relativeTime(convo.last_message_at)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className={cn('text-xs truncate', convo.unread_count > 0 ? 'text-surface-700 font-medium' : 'text-surface-400')}>
                      {convo.direction === 'outbound' && <span className="text-surface-300">You: </span>}
                      {convo.last_message}
                    </p>
                    {convo.unread_count > 0 && (
                      <span className="bg-green-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                        {convo.unread_count > 99 ? '99+' : convo.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* RIGHT PANEL — Chat Thread */}
      <div className="flex-1 flex flex-col bg-white">
        {!selectedContactId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-surface-400">
            <MessageCircle className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">Select a conversation</p>
            <p className="text-sm mt-1">Choose a contact from the left to view messages</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-5 py-3 border-b border-surface-100 flex items-center gap-3 flex-shrink-0">
              <div className="w-9 h-9 rounded-full bg-surface-100 flex items-center justify-center">
                <User className="w-4.5 h-4.5 text-surface-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-surface-900 truncate">{selectedConvo?.contact_name}</p>
                {selectedConvo?.contact_phone && (
                  <p className="text-xs text-surface-400 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {selectedConvo.contact_phone}
                  </p>
                )}
              </div>
            </div>

            {/* Messages area */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-2 bg-surface-50">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-surface-400 text-sm">
                  No messages yet
                </div>
              ) : (
                messages.map(msg => (
                  <div
                    key={msg.id}
                    className={cn('flex', msg.direction === 'outbound' ? 'justify-end' : 'justify-start')}
                  >
                    <div
                      className={cn(
                        'max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-sm',
                        msg.direction === 'outbound'
                          ? 'bg-brand-600 text-white rounded-br-md'
                          : 'bg-white text-surface-800 border border-surface-100 rounded-bl-md'
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                      <div className={cn(
                        'flex items-center justify-end gap-1 mt-1',
                        msg.direction === 'outbound' ? 'text-white/60' : 'text-surface-300'
                      )}>
                        <span className="text-[10px]">{relativeTime(msg.received_at)}</span>
                        {msg.direction === 'outbound' && <StatusCheck status={msg.status} />}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="px-4 py-3 border-t border-surface-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                  placeholder="Type a message..."
                  className="input flex-1 text-sm"
                  disabled={sending}
                />
                <button
                  onClick={handleSend}
                  disabled={!reply.trim() || sending}
                  className={cn(
                    'btn-primary p-2.5 rounded-xl',
                    (!reply.trim() || sending) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
