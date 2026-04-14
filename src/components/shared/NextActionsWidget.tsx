'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Sparkles, Clock, Calendar, FileText, Users, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { getNextActionsForUser, type NextAction, type DealLike } from '@/lib/ai/next-action'

interface Props {
  workspaceId: string
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  clock: Clock,
  calendar: Calendar,
  file: FileText,
  users: Users,
}

export default function NextActionsWidget({ workspaceId }: Props) {
  const supabase = createClient()
  const [actions, setActions] = useState<NextAction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!workspaceId) return
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: deals } = await supabase
        .from('deals')
        .select('id, title, value, status, stage_id, updated_at, expected_close_date, contact_id')
        .eq('workspace_id', workspaceId)
        .eq('owner_id', user.id)
        .eq('status', 'open')

      const dealsList = (deals || []) as Array<{
        id: string; title: string | null; value: number | null; status: string | null
        stage_id: string | null; updated_at: string | null; expected_close_date: string | null; contact_id: string | null
      }>
      if (dealsList.length === 0) { if (!cancelled) { setActions([]); setLoading(false) }; return }

      // Stage names
      const stageIds = Array.from(new Set(dealsList.map(d => d.stage_id).filter(Boolean))) as string[]
      const stageMap = new Map<string, string>()
      if (stageIds.length > 0) {
        const { data: stages } = await supabase.from('pipeline_stages').select('id, name').in('id', stageIds)
        for (const s of (stages || []) as { id: string; name: string }[]) stageMap.set(s.id, s.name)
      }

      // Contact names
      const contactIds = Array.from(new Set(dealsList.map(d => d.contact_id).filter(Boolean))) as string[]
      const contactMap = new Map<string, string>()
      if (contactIds.length > 0) {
        const { data: contacts } = await supabase.from('contacts').select('id, name').in('id', contactIds)
        for (const c of (contacts || []) as { id: string; name: string }[]) contactMap.set(c.id, c.name)
      }

      // Pending tasks per deal
      const dealIds = dealsList.map(d => d.id)
      const pendingByDeal = new Set<string>()
      if (dealIds.length > 0) {
        const { data: tasks } = await supabase
          .from('activities')
          .select('deal_id')
          .in('deal_id', dealIds)
          .eq('done', false)
          .eq('type', 'task')
        for (const t of (tasks || []) as { deal_id: string | null }[]) {
          if (t.deal_id) pendingByDeal.add(t.deal_id)
        }
      }

      // Quotes per deal (sent + viewed)
      const quoteSent = new Set<string>()
      const quoteViewed = new Set<string>()
      if (dealIds.length > 0) {
        const { data: quotes } = await supabase
          .from('quotes')
          .select('deal_id, status, last_viewed_at')
          .in('deal_id', dealIds)
        for (const q of (quotes || []) as { deal_id: string | null; status: string | null; last_viewed_at: string | null }[]) {
          if (!q.deal_id) continue
          if (q.status === 'sent' || q.status === 'viewed' || q.status === 'accepted') quoteSent.add(q.deal_id)
          if (q.last_viewed_at) quoteViewed.add(q.deal_id)
        }
      }

      const avgDealValue = dealsList.length > 0
        ? dealsList.reduce((s, d) => s + (Number(d.value) || 0), 0) / dealsList.length
        : 0

      const dealLikes: DealLike[] = dealsList.map(d => ({
        id: d.id,
        title: d.title,
        value: d.value,
        status: d.status,
        stage_name: d.stage_id ? stageMap.get(d.stage_id) : null,
        last_activity_at: d.updated_at,
        expected_close_date: d.expected_close_date,
        contact_name: d.contact_id ? contactMap.get(d.contact_id) : null,
        has_pending_task: pendingByDeal.has(d.id),
        has_quote_sent: quoteSent.has(d.id),
        quote_viewed: quoteViewed.has(d.id),
      }))

      const all = getNextActionsForUser(dealLikes, { avgDealValue })
      if (!cancelled) {
        setActions(all.slice(0, 5))
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [workspaceId, supabase])

  if (loading) {
    return (
      <div className="card p-4 mb-6">
        <div className="h-4 w-32 bg-surface-100 rounded animate-pulse mb-3" />
        <div className="space-y-2">
          {[0, 1, 2].map(i => <div key={i} className="h-10 bg-surface-100 rounded animate-pulse" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="card p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wide flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Next Best Actions
        </h3>
      </div>
      {actions.length === 0 ? (
        <p className="text-xs text-surface-400">All caught up. No suggested actions right now.</p>
      ) : (
        <div className="space-y-2">
          {actions.map(a => {
            const Icon = ICONS[a.icon] || Sparkles
            const badgeColor =
              a.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300' :
              a.priority === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' :
              'bg-surface-100 text-surface-600'
            return (
              <Link
                key={a.id}
                href={a.action_url || '#'}
                className="flex items-center gap-3 p-2.5 rounded-lg border border-surface-100 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors group"
              >
                <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-surface-700 dark:text-surface-200 truncate">{a.message}</p>
                </div>
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${badgeColor}`}>{a.priority}</span>
                <ArrowRight className="w-3 h-3 text-surface-400 group-hover:text-surface-700" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
