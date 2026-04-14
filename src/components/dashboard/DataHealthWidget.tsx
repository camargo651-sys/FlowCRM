'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getActiveWorkspace } from '@/lib/get-active-workspace'
import { analyzeWorkspace } from '@/lib/data-quality/analyzer'
import { cn } from '@/lib/utils'

export default function DataHealthWidget() {
  const [score, setScore] = useState<number | null>(null)
  const [issueCount, setIssueCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const ws = await getActiveWorkspace(supabase, user.id, 'id')
      if (!ws) return
      const report = await analyzeWorkspace(ws.id, supabase)
      if (cancelled) return
      setScore(report.healthScore)
      setIssueCount(report.issues.reduce((sum, i) => sum + i.count, 0))
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (score === null) return null

  const color =
    score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-rose-600'

  return (
    <Link
      href="/settings/data-quality"
      className="card p-3 flex items-center gap-3 hover:shadow-md transition-shadow"
    >
      <div className="w-9 h-9 bg-brand-50 dark:bg-brand-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-4 h-4 text-brand-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold text-surface-500 uppercase">Data Health</p>
        <p className={cn('text-lg font-bold leading-tight', color)}>
          {score}
          <span className="text-xs text-surface-500 font-normal"> / 100</span>
        </p>
      </div>
      <p className="text-[10px] text-surface-500 whitespace-nowrap">{issueCount} issues</p>
    </Link>
  )
}
