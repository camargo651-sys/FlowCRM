'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Sparkles, Clock, Calendar, FileText, Users } from 'lucide-react'
import { getNextActionsForDeal, type NextAction, type DealLike } from '@/lib/ai/next-action'

interface Props {
  dealId: string
  workspaceId: string
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  clock: Clock,
  calendar: Calendar,
  file: FileText,
  users: Users,
}

export default function DealNextActions({ dealId, workspaceId }: Props) {
  const supabase = createClient()
  const [actions, setActions] = useState<NextAction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!dealId || !workspaceId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data: deal } = await supabase
        .from('deals')
        .select('id, title, value, status, stage_id, updated_at, expected_close_date, contact_id')
        .eq('id', dealId)
        .single()
      if (!deal) { if (!cancelled) { setActions([]); setLoading(false) }; return }

      let stageName: string | null = null
      if (deal.stage_id) {
        const { data: s } = await supabase.from('pipeline_stages').select('name').eq('id', deal.stage_id).single()
        stageName = s?.name || null
      }
      let contactName: string | null = null
      if (deal.contact_id) {
        const { data: c } = await supabase.from('contacts').select('name').eq('id', deal.contact_id).single()
        contactName = c?.name || null
      }

      const { data: tasks } = await supabase
        .from('activities')
        .select('id')
        .eq('deal_id', dealId)
        .eq('done', false)
        .eq('type', 'task')
      const hasPendingTask = (tasks || []).length > 0

      const { data: quotes } = await supabase
        .from('quotes')
        .select('status, viewed_at')
        .eq('deal_id', dealId)
      const qList = (quotes || []) as { status: string | null; viewed_at: string | null }[]
      const hasQuoteSent = qList.some(q => q.status === 'sent' || q.status === 'viewed' || q.status === 'accepted')
      const quoteViewed = qList.some(q => !!q.viewed_at)

      // Workspace avg deal value for "big deal" rule
      const { data: allDeals } = await supabase
        .from('deals')
        .select('value')
        .eq('workspace_id', workspaceId)
        .eq('status', 'open')
      const values = (allDeals || []).map(d => Number(d.value) || 0)
      const avgDealValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0

      const dealLike: DealLike = {
        id: deal.id,
        title: deal.title,
        value: deal.value,
        status: deal.status,
        stage_name: stageName,
        last_activity_at: deal.updated_at,
        expected_close_date: deal.expected_close_date,
        contact_name: contactName,
        has_pending_task: hasPendingTask,
        has_quote_sent: hasQuoteSent,
        quote_viewed: quoteViewed,
      }

      if (!cancelled) {
        setActions(getNextActionsForDeal(dealLike, { avgDealValue }))
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [dealId, workspaceId, supabase])

  if (loading) {
    return (
      <div className="border-t border-surface-100 pt-3">
        <p className="text-[10px] text-surface-400 font-semibold uppercase mb-2 flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> AI Suggestions
        </p>
        <div className="h-8 bg-surface-100 rounded animate-pulse" />
      </div>
    )
  }

  if (actions.length === 0) return null

  return (
    <div className="border-t border-surface-100 pt-3">
      <p className="text-[10px] text-surface-400 font-semibold uppercase mb-2 flex items-center gap-1">
        <Sparkles className="w-3 h-3 text-amber-500" /> AI Suggestions
      </p>
      <div className="space-y-1.5">
        {actions.map(a => {
          const Icon = ICONS[a.icon] || Sparkles
          const badgeColor =
            a.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300' :
            a.priority === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' :
            'bg-surface-100 text-surface-600'
          return (
            <div key={a.id} className="flex items-start gap-2 p-2 rounded-lg bg-surface-50 dark:bg-surface-800/40">
              <Icon className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-surface-700 dark:text-surface-200 flex-1">{a.message}</p>
              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${badgeColor}`}>{a.priority}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
