'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import {
  MessageCircle, Send, Search, Phone, User, Check, CheckCircle2,
  Zap, ArrowLeft, UserCircle, ChevronDown,
} from 'lucide-react'
import Link from 'next/link'

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
  wa_contact_id: string | null
  resolved: boolean
  assigned_to: string | null
}

interface TeamMember {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
}

interface QuickReply {
  label: string
  text: string
}

const DEFAULT_QUICK_REPLIES: QuickReply[] = [
  { label: 'Greeting', text: 'Hi! Thanks for reaching out. How can I help you today?' },
  { label: 'Follow-up', text: 'Just following up on our last conversation. Do you have any updates?' },
  { label: 'Appointment Confirm', text: 'Your appointment is confirmed. Please let us know if you need to reschedule.' },
  { label: 'Thanks', text: 'Thank you! We appreciate your time. Let us know if there\'s anything else we can help with.' },
  { label: 'Busy', text: 'Thanks for your message. We\'re currently handling a high volume of inquiries and will get back to you shortly.' },
]

type StatusFilter = 'open' | 'resolved' | 'all'
type AssignFilter = 'all' | 'mine' | 'unassigned'

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

function InitialsAvatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'xs' }) {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  return (
    <div className={cn(
      'rounded-full bg-brand-100 text-brand-700 font-semibold flex items-center justify-center flex-shrink-0',
      size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-5 h-5 text-[9px]'
    )}>
      {initials || '?'}
    </div>
  )
}

export default function WhatsAppInboxPage() {
  const supabase = createClient()
  const { t } = useI18n()

  const [loading, setLoading] = useState(true)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // New state for features
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open')
  const [assignFilter, setAssignFilter] = useState<AssignFilter>('all')
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>(DEFAULT_QUICK_REPLIES)
  const [showQuickReplies, setShowQuickReplies] = useState(false)
  const [showAssignDropdown, setShowAssignDropdown] = useState(false)
  const [mobileShowChat, setMobileShowChat] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const quickRepliesRef = useRef<HTMLDivElement>(null)
  const assignDropdownRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (quickRepliesRef.current && !quickRepliesRef.current.contains(e.target as Node)) {
        setShowQuickReplies(false)
      }
      if (assignDropdownRef.current && !assignDropdownRef.current.contains(e.target as Node)) {
        setShowAssignDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Load workspace + user
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)
      const { data: ws } = await supabase.from('workspaces').select('id, whatsapp_bot_config').eq('owner_id', user.id).single()
      if (ws) {
        setWorkspaceId(ws.id)
        // Load quick replies from workspace config
        const config = ws.whatsapp_bot_config as Record<string, unknown> | null
        if (config?.quick_replies && Array.isArray(config.quick_replies) && config.quick_replies.length > 0) {
          setQuickReplies(config.quick_replies as QuickReply[])
        }
      }
    }
    load()
  }, [])

  // Load team members
  useEffect(() => {
    if (!workspaceId) return
    const loadTeam = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .eq('workspace_id', workspaceId)
      if (data) setTeamMembers(data)
    }
    loadTeam()
  }, [workspaceId])

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

        // Load whatsapp_contacts for status + assignment
        const { data: waContacts } = await supabase
          .from('whatsapp_contacts')
          .select('id, contact_id, status, assigned_to')
          .eq('workspace_id', workspaceId)
          .in('contact_id', contactIds)

        const contactLookup = new Map((contacts || []).map(c => [c.id, c]))
        const waContactLookup = new Map((waContacts || []).map(wc => [wc.contact_id, wc]))

        const convos: Conversation[] = contactIds
          .map(cid => {
            const entry = contactMap.get(cid)!
            const contact = contactLookup.get(cid)
            const waContact = waContactLookup.get(cid)
            return {
              contact_id: cid,
              contact_name: contact?.name || 'Unknown',
              contact_phone: contact?.phone || '',
              last_message: entry.last.body || '',
              last_message_at: entry.last.received_at,
              direction: entry.last.direction as 'inbound' | 'outbound',
              unread_count: entry.unread,
              wa_contact_id: waContact?.id || null,
              resolved: waContact?.status === 'resolved',
              assigned_to: waContact?.assigned_to || null,
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
                    // Auto-reopen if inbound message on resolved conversation
                    resolved: newMsg.direction === 'inbound' ? false : c.resolved,
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
            wa_contact_id: null,
            resolved: false,
            assigned_to: null,
          }, ...prev]
        })

        // Auto-reopen resolved contact in DB on inbound
        if (newMsg.direction === 'inbound') {
          supabase
            .from('whatsapp_contacts')
            .update({ status: 'open' })
            .eq('workspace_id', workspaceId)
            .eq('contact_id', newMsg.contact_id)
            .then(() => {})
        }

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

  // Resolve / reopen a conversation
  const handleToggleResolve = async (convo: Conversation, e: React.MouseEvent) => {
    e.stopPropagation()
    const newResolved = !convo.resolved
    const newStatus = newResolved ? 'resolved' : 'open'

    // Optimistic update
    setConversations(prev =>
      prev.map(c => c.contact_id === convo.contact_id ? { ...c, resolved: newResolved } : c)
    )

    if (convo.wa_contact_id) {
      const { error } = await supabase
        .from('whatsapp_contacts')
        .update({ status: newStatus })
        .eq('id', convo.wa_contact_id)
      if (error) {
        toast.error('Failed to update status')
        setConversations(prev =>
          prev.map(c => c.contact_id === convo.contact_id ? { ...c, resolved: !newResolved } : c)
        )
      }
    } else {
      // No whatsapp_contact row yet — update by workspace + contact_id
      const { error } = await supabase
        .from('whatsapp_contacts')
        .update({ status: newStatus })
        .eq('workspace_id', workspaceId!)
        .eq('contact_id', convo.contact_id)
      if (error) {
        toast.error('Failed to update status')
        setConversations(prev =>
          prev.map(c => c.contact_id === convo.contact_id ? { ...c, resolved: !newResolved } : c)
        )
      }
    }
  }

  // Assign conversation
  const handleAssign = async (userId: string | null) => {
    if (!selectedContactId) return
    const convo = conversations.find(c => c.contact_id === selectedContactId)
    if (!convo) return

    setConversations(prev =>
      prev.map(c => c.contact_id === selectedContactId ? { ...c, assigned_to: userId } : c)
    )
    setShowAssignDropdown(false)

    const updatePayload = { assigned_to: userId }
    if (convo.wa_contact_id) {
      await supabase.from('whatsapp_contacts').update(updatePayload).eq('id', convo.wa_contact_id)
    } else {
      await supabase.from('whatsapp_contacts').update(updatePayload).eq('workspace_id', workspaceId!).eq('contact_id', selectedContactId)
    }
  }

  // Filter conversations
  const filteredConversations = conversations.filter(c => {
    // Search filter
    if (searchQuery && !c.contact_name.toLowerCase().includes(searchQuery.toLowerCase()) && !c.contact_phone.includes(searchQuery)) {
      return false
    }
    // Status filter
    if (statusFilter === 'open' && c.resolved) return false
    if (statusFilter === 'resolved' && !c.resolved) return false
    // Assignment filter
    if (assignFilter === 'mine' && c.assigned_to !== currentUserId) return false
    if (assignFilter === 'unassigned' && c.assigned_to !== null) return false
    return true
  })

  const selectedConvo = conversations.find(c => c.contact_id === selectedContactId)
  const assignedMember = selectedConvo?.assigned_to ? teamMembers.find(m => m.id === selectedConvo.assigned_to) : null

  const getTeamMemberName = (userId: string | null) => {
    if (!userId) return null
    return teamMembers.find(m => m.id === userId)
  }

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
      <div className={cn(
        'w-full md:w-[360px] border-r border-surface-200 bg-white flex flex-col flex-shrink-0',
        mobileShowChat && 'hidden md:flex'
      )}>
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

          {/* Filter row: Status + Assignment */}
          <div className="mt-2 flex items-center gap-2">
            {/* Status filter */}
            <div className="flex rounded-lg border border-surface-200 overflow-hidden text-xs flex-1">
              {(['open', 'resolved', 'all'] as StatusFilter[]).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    'flex-1 px-2 py-1.5 capitalize transition-colors',
                    statusFilter === s ? 'bg-brand-600 text-white' : 'bg-white text-surface-600 hover:bg-surface-50'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            {/* Assignment filter */}
            <select
              value={assignFilter}
              onChange={e => setAssignFilter(e.target.value as AssignFilter)}
              className="input text-xs py-1.5 px-2 w-auto min-w-0"
            >
              <option value="all">All</option>
              <option value="mine">Mine</option>
              <option value="unassigned">Unassigned</option>
            </select>
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
            filteredConversations.map(convo => {
              const member = getTeamMemberName(convo.assigned_to)
              return (
                <button
                  key={convo.contact_id}
                  onClick={() => {
                    setSelectedContactId(convo.contact_id)
                    setMobileShowChat(true)
                    // Clear unread
                    setConversations(prev =>
                      prev.map(c => c.contact_id === convo.contact_id ? { ...c, unread_count: 0 } : c)
                    )
                  }}
                  className={cn(
                    'w-full text-left px-4 py-3 border-b border-surface-50 hover:bg-surface-50 transition-colors flex gap-3 group',
                    selectedContactId === convo.contact_id && 'bg-brand-50 hover:bg-brand-50'
                  )}
                >
                  {/* Avatar */}
                  <div className="relative w-10 h-10 rounded-full bg-surface-100 flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-surface-400" />
                    {/* Assigned badge */}
                    {member && (
                      <div className="absolute -bottom-0.5 -right-0.5" title={member.full_name}>
                        <InitialsAvatar name={member.full_name} size="xs" />
                      </div>
                    )}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('text-sm truncate', convo.unread_count > 0 ? 'font-bold text-surface-900' : 'font-medium text-surface-800')}>
                        {convo.contact_name}
                      </span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-[11px] text-surface-400">{relativeTime(convo.last_message_at)}</span>
                        {/* Resolve button */}
                        <button
                          onClick={(e) => handleToggleResolve(convo, e)}
                          title={convo.resolved ? 'Reopen conversation' : 'Mark as resolved'}
                          className={cn(
                            'p-0.5 rounded transition-colors',
                            convo.resolved
                              ? 'text-green-500 hover:text-green-700'
                              : 'text-surface-300 opacity-0 group-hover:opacity-100 hover:text-green-500'
                          )}
                        >
                          {convo.resolved ? <CheckCircle2 className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                        </button>
                      </div>
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
              )
            })
          )}
        </div>
      </div>

      {/* RIGHT PANEL — Chat Thread */}
      <div className={cn(
        'flex-1 flex flex-col bg-white',
        !mobileShowChat && 'hidden md:flex'
      )}>
        {!selectedContactId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-surface-400">
            <MessageCircle className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">Select a conversation</p>
            <p className="text-sm mt-1">Choose a contact from the left to view messages</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-4 md:px-5 py-3 border-b border-surface-100 flex items-center gap-3 flex-shrink-0">
              {/* Mobile back button */}
              <button
                onClick={() => {
                  setMobileShowChat(false)
                  setSelectedContactId(null)
                }}
                className="md:hidden p-1 -ml-1 text-surface-500 hover:text-surface-700"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

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

              {/* Resolve button in header */}
              {selectedConvo && (
                <button
                  onClick={(e) => handleToggleResolve(selectedConvo, e)}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5',
                    selectedConvo.resolved
                      ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                      : 'border-surface-200 text-surface-500 hover:bg-surface-50 hover:text-green-600'
                  )}
                >
                  {selectedConvo.resolved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                  {selectedConvo.resolved ? 'Resolved' : 'Resolve'}
                </button>
              )}

              {/* Assignment dropdown */}
              <div className="relative" ref={assignDropdownRef}>
                <button
                  onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-surface-200 text-surface-600 hover:bg-surface-50 transition-colors flex items-center gap-1.5"
                >
                  {assignedMember ? (
                    <>
                      <InitialsAvatar name={assignedMember.full_name} size="xs" />
                      <span className="hidden sm:inline max-w-[80px] truncate">{assignedMember.full_name}</span>
                    </>
                  ) : (
                    <>
                      <UserCircle className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Assign</span>
                    </>
                  )}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showAssignDropdown && (
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-lg border border-surface-200 z-50 py-1 max-h-64 overflow-y-auto">
                    <button
                      onClick={() => handleAssign(null)}
                      className="w-full text-left px-3 py-2 text-sm text-surface-500 hover:bg-surface-50 flex items-center gap-2"
                    >
                      <UserCircle className="w-4 h-4 text-surface-300" />
                      Unassigned
                    </button>
                    {teamMembers.map(m => (
                      <button
                        key={m.id}
                        onClick={() => handleAssign(m.id)}
                        className={cn(
                          'w-full text-left px-3 py-2 text-sm hover:bg-surface-50 flex items-center gap-2',
                          selectedConvo?.assigned_to === m.id && 'bg-brand-50 text-brand-700'
                        )}
                      >
                        <InitialsAvatar name={m.full_name} size="xs" />
                        <span className="truncate">{m.full_name}</span>
                        {m.id === currentUserId && <span className="text-[10px] text-surface-400 ml-auto">(you)</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Messages area */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 md:px-5 py-4 space-y-2 bg-surface-50">
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
                {/* Quick replies button */}
                <div className="relative" ref={quickRepliesRef}>
                  <button
                    onClick={() => setShowQuickReplies(!showQuickReplies)}
                    title="Quick replies"
                    className={cn(
                      'p-2.5 rounded-xl border border-surface-200 text-surface-500 hover:text-brand-600 hover:border-brand-200 transition-colors',
                      showQuickReplies && 'bg-brand-50 border-brand-200 text-brand-600'
                    )}
                  >
                    <Zap className="w-4 h-4" />
                  </button>
                  {showQuickReplies && (
                    <div className="absolute bottom-full left-0 mb-2 w-72 bg-white rounded-xl shadow-lg border border-surface-200 z-50 py-1">
                      <div className="px-3 py-2 border-b border-surface-100">
                        <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide">Quick Replies</p>
                      </div>
                      {quickReplies.map((qr, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setReply(qr.text)
                            setShowQuickReplies(false)
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-surface-50 transition-colors"
                        >
                          <p className="text-xs font-medium text-surface-700">{qr.label}</p>
                          <p className="text-[11px] text-surface-400 truncate mt-0.5">{qr.text}</p>
                        </button>
                      ))}
                      <div className="px-3 py-2 border-t border-surface-100">
                        <Link href="/settings" className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                          Manage quick replies
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

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
