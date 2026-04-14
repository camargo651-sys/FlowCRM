'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getActiveWorkspace } from '@/lib/get-active-workspace'
import Link from 'next/link'
import { CheckCircle2, Circle, Upload, Mail, Zap, Target, Users, X, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

const DISMISS_KEY = 'tracktio_quickwins_dismissed'
const NEW_WORKSPACE_THRESHOLD = 20

interface Win {
  key: string
  icon: React.ReactNode
  title: string
  desc: string
  cta: string
  href: string
  done: boolean
}

export default function QuickWinsCard() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)
  const [hide, setHide] = useState(false)
  const [wins, setWins] = useState<Win[]>([])

  const check = useCallback(async () => {
    if (typeof window !== 'undefined' && window.localStorage.getItem(DISMISS_KEY) === '1') {
      setDismissed(true)
      setLoading(false)
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const ws = await getActiveWorkspace(supabase, user.id, 'id')
    if (!ws) { setLoading(false); return }

    const safeCount = async (q: PromiseLike<{ count: number | null }>): Promise<number> => {
      try { const r = await q; return r.count || 0 } catch { return 0 }
    }

    const [contactCount, dealCount, emailAccountCount, quotaCount, teamCount] = await Promise.all([
      safeCount(supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('workspace_id', ws.id)),
      safeCount(supabase.from('deals').select('id', { count: 'exact', head: true }).eq('workspace_id', ws.id)),
      safeCount(supabase.from('email_accounts').select('id', { count: 'exact', head: true }).eq('workspace_id', ws.id)),
      safeCount(supabase.from('quotas').select('id', { count: 'exact', head: true }).eq('workspace_id', ws.id)),
      safeCount(supabase.from('workspace_members').select('id', { count: 'exact', head: true }).eq('workspace_id', ws.id)),
    ])

    // Only show for new workspaces
    if (contactCount >= NEW_WORKSPACE_THRESHOLD) {
      setHide(true)
      setLoading(false)
      return
    }

    const list: Win[] = [
      {
        key: 'import',
        icon: <Upload className="w-4 h-4" />,
        title: 'Import your contacts from CSV',
        desc: 'Bring your existing customers in one click.',
        cta: 'Import',
        href: '/settings/data-quality?tab=import',
        done: contactCount > 0,
      },
      {
        key: 'email',
        icon: <Mail className="w-4 h-4" />,
        title: 'Connect Gmail or Outlook',
        desc: 'Auto-log every email and see it in your inbox.',
        cta: 'Connect',
        href: '/integrations',
        done: emailAccountCount > 0,
      },
      {
        key: 'deal',
        icon: <Zap className="w-4 h-4" />,
        title: 'Create your first deal',
        desc: 'Track opportunities in your visual pipeline.',
        cta: 'Create deal',
        href: '/pipeline',
        done: dealCount > 0,
      },
      {
        key: 'quota',
        icon: <Target className="w-4 h-4" />,
        title: 'Set your sales quota',
        desc: 'Track team performance against goals.',
        cta: 'Set quota',
        href: '/settings/quotas',
        done: quotaCount > 0,
      },
      {
        key: 'team',
        icon: <Users className="w-4 h-4" />,
        title: 'Invite your team',
        desc: 'Collaborate with teammates on deals.',
        cta: 'Invite',
        href: '/team',
        done: teamCount > 1,
      },
    ]
    setWins(list)
    setLoading(false)
  }, [supabase])

  useEffect(() => { check() }, [check])

  const dismiss = () => {
    if (typeof window !== 'undefined') window.localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  if (loading || dismissed || hide) return null

  const completed = wins.filter((w) => w.done).length
  const total = wins.length
  const allDone = completed === total

  if (allDone) {
    return (
      <div className="card p-5 mb-6 border-emerald-200 bg-gradient-to-br from-emerald-50 to-brand-50 dark:from-emerald-500/5 dark:to-brand-500/5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <Sparkles className="w-6 h-6 text-emerald-600" />
            <div>
              <h3 className="font-semibold text-surface-900 dark:text-surface-50">You&apos;re all set!</h3>
              <p className="text-xs text-surface-600 dark:text-surface-400 mt-0.5">All quick wins completed. Time to close some deals.</p>
            </div>
          </div>
          <button onClick={dismiss} className="text-surface-400 hover:text-surface-600" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-5 mb-6 border-brand-200 bg-gradient-to-br from-brand-50/50 to-transparent dark:from-brand-500/5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-brand-600" />
          <div>
            <h3 className="font-semibold text-surface-900 dark:text-surface-50">Quick wins to get started</h3>
            <p className="text-xs text-surface-500">
              {completed} of {total} completed · Get the most out of Tracktio in minutes
            </p>
          </div>
        </div>
        <button onClick={dismiss} className="text-surface-400 hover:text-surface-600" aria-label="Dismiss">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="w-full h-1.5 bg-surface-100 dark:bg-surface-800 rounded-full mb-4 overflow-hidden">
        <div className="h-full bg-brand-500 transition-all" style={{ width: `${(completed / total) * 100}%` }} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {wins.map((w) => (
          <Link
            key={w.key}
            href={w.href}
            className={cn(
              'p-4 rounded-xl border transition-all group',
              w.done
                ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-500/5 dark:border-emerald-500/20'
                : 'bg-white border-surface-200 hover:border-brand-300 hover:shadow-sm dark:bg-surface-900 dark:border-surface-700',
            )}
          >
            <div className="flex items-start gap-3">
              {w.done
                ? <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                : <Circle className="w-5 h-5 text-surface-300 flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-brand-600 mb-0.5">
                  {w.icon}
                  <p className={cn('text-sm font-semibold text-surface-900 dark:text-surface-50', w.done && 'line-through text-surface-500')}>
                    {w.title}
                  </p>
                </div>
                <p className="text-[11px] text-surface-500 mb-2">{w.desc}</p>
                {!w.done && (
                  <span className="text-[11px] font-semibold text-brand-600 group-hover:text-brand-700">
                    {w.cta} →
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
