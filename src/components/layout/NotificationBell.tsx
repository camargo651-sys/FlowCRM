'use client'
import { useEffect, useState, useRef } from 'react'
import { Bell, X, Check, ExternalLink, AlertTriangle, Eye, MessageCircle, Phone, Star, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  priority: string
  read: boolean
  action_url: string | null
  created_at: string
}

const TYPE_ICONS: Record<string, any> = {
  quote_viewed: Eye,
  hot_contact: Star,
  deal_at_risk: AlertTriangle,
  whatsapp_received: MessageCircle,
  email_replied: ExternalLink,
  call_positive: Phone,
  task_overdue: AlertTriangle,
  deal_won: Star,
  automation_fired: Zap,
  system: Bell,
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'border-l-red-500 bg-red-50/50',
  high: 'border-l-amber-500 bg-amber-50/30',
  medium: 'border-l-blue-500',
  low: '',
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/ai/notifications')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
        setUnread(data.unread_count || 0)
      }
    } catch {}
  }

  useEffect(() => {
    fetchNotifications()
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)

    // Realtime subscription for instant notifications
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        const newNotif = payload.new as Notification
        setNotifications(prev => [newNotif, ...prev].slice(0, 20))
        setUnread(prev => prev + 1)
      })
      .subscribe()

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [])

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const markAllRead = async () => {
    await fetch('/api/ai/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: 'all' }),
    })
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnread(0)
  }

  const handleClick = (notif: Notification) => {
    // Mark as read
    fetch('/api/ai/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [notif.id] }),
    })
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n))
    setUnread(prev => Math.max(0, prev - (notif.read ? 0 : 1)))

    if (notif.action_url) {
      router.push(notif.action_url)
      setOpen(false)
    }
  }

  const timeAgo = (date: string) => {
    const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-2 rounded-lg hover:bg-surface-100 transition-colors">
        <Bell className="w-5 h-5 text-surface-500" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-lg border border-surface-100 z-50 overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100">
            <h3 className="font-semibold text-surface-900 text-sm">Notifications</h3>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-[10px] text-brand-600 font-semibold hover:underline flex items-center gap-1">
                <Check className="w-3 h-3" /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="w-8 h-8 text-surface-300 mx-auto mb-2" />
                <p className="text-xs text-surface-400">No notifications yet</p>
              </div>
            ) : (
              notifications.map(notif => {
                const Icon = TYPE_ICONS[notif.type] || Bell
                return (
                  <div key={notif.id}
                    onClick={() => handleClick(notif)}
                    className={cn(
                      'px-4 py-3 border-b border-surface-50 cursor-pointer hover:bg-surface-50 transition-colors border-l-4',
                      notif.read ? 'border-l-transparent' : PRIORITY_COLORS[notif.priority] || 'border-l-brand-500',
                      !notif.read && 'bg-brand-50/20'
                    )}>
                    <div className="flex items-start gap-2.5">
                      <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                        notif.priority === 'urgent' ? 'bg-red-100' :
                        notif.priority === 'high' ? 'bg-amber-100' : 'bg-surface-100')}>
                        <Icon className={cn('w-3.5 h-3.5',
                          notif.priority === 'urgent' ? 'text-red-600' :
                          notif.priority === 'high' ? 'text-amber-600' : 'text-surface-500')} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-xs leading-tight', notif.read ? 'text-surface-600' : 'text-surface-900 font-semibold')}>
                          {notif.title}
                        </p>
                        {notif.body && (
                          <p className="text-[11px] text-surface-400 mt-0.5 line-clamp-2">{notif.body}</p>
                        )}
                        <p className="text-[10px] text-surface-300 mt-1">{timeAgo(notif.created_at)}</p>
                      </div>
                      {!notif.read && <div className="w-2 h-2 bg-brand-500 rounded-full flex-shrink-0 mt-1.5" />}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
