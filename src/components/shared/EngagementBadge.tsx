'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff } from 'lucide-react'

interface Props {
  entity: string
  entityId: string
  className?: string
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return `${Math.floor(d / 30)}mo ago`
}

export default function EngagementBadge({ entity, entityId, className = '' }: Props) {
  const [lastEvent, setLastEvent] = useState<string | null>(null)
  const [eventType, setEventType] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!entityId) return
    const supabase = createClient()
    let cancelled = false
    supabase
      .from('engagement_events')
      .select('occurred_at, event_type')
      .eq('entity', entity)
      .eq('entity_id', entityId)
      .order('occurred_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        if (data) {
          setLastEvent(data.occurred_at)
          setEventType(data.event_type)
        }
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [entity, entityId])

  if (loading) return null

  if (!lastEvent) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface-100 text-surface-500 ${className}`} title="No engagement yet">
        <EyeOff className="w-3 h-3" /> Not viewed
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 ${className}`} title={`Last ${eventType?.replace('_', ' ')} at ${new Date(lastEvent).toLocaleString()}`}>
      <Eye className="w-3 h-3" /> Viewed {timeAgo(lastEvent)}
    </span>
  )
}
