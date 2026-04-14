'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculateHealthScore, type HealthResult } from '@/lib/health/score'
import { getActiveWorkspace } from '@/lib/get-active-workspace'

interface Props {
  contactId: string
  size?: 'sm' | 'md'
  className?: string
}

const STATUS_STYLES: Record<HealthResult['status'], { dot: string; bg: string; text: string; label: string }> = {
  green: { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Healthy' },
  yellow: { dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', label: 'At risk' },
  red: { dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700', label: 'Critical' },
}

export default function HealthScoreBadge({ contactId, size = 'md', className = '' }: Props) {
  const [result, setResult] = useState<HealthResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!contactId) return
    let cancelled = false
    const supabase = createClient()
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }
        const ws = await getActiveWorkspace(supabase, user.id, 'id') as { id: string } | null
        if (!ws) { setLoading(false); return }
        const r = await calculateHealthScore(contactId, ws.id, supabase)
        if (!cancelled) { setResult(r); setLoading(false) }
      } catch {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [contactId])

  if (loading || !result) return null

  const style = STATUS_STYLES[result.status]
  const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${style.bg} ${style.text} ${sizeClasses} ${className}`}
      title={`${style.label} (${result.score}/100)\n${result.signals.join('\n')}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {result.score}
    </span>
  )
}
