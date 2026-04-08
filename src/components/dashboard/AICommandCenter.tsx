'use client'
import { useEffect, useState } from 'react'
import {
  Sparkles, Phone, Mail, AlertTriangle, Clock, DollarSign, TrendingUp,
  CheckCircle2, Star, ArrowRight, RefreshCw, Zap, MessageCircle, Copy, Check
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Action {
  id: string
  priority: 'high' | 'medium' | 'low'
  icon: string
  title: string
  description: string
  entity_type: string
  entity_name: string
  suggested_message?: string
}

interface Insight {
  id: string
  type: 'risk' | 'opportunity' | 'info' | 'win'
  title: string
  description: string
}

interface AIInsights {
  greeting: string
  urgent_actions: Action[]
  insights: Insight[]
  daily_summary: string
}

const ICON_MAP: Record<string, typeof Phone> = {
  phone: Phone, mail: Mail, alert: AlertTriangle, clock: Clock,
  dollar: DollarSign, trending: TrendingUp, check: CheckCircle2,
  star: Star, message: MessageCircle,
}

const PRIORITY_STYLES = {
  high: 'border-l-red-500 bg-red-50/30',
  medium: 'border-l-amber-500 bg-amber-50/30',
  low: 'border-l-brand-500 bg-brand-50/30',
}

const PRIORITY_BADGE = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-brand-100 text-brand-700',
}

const INSIGHT_STYLES = {
  risk: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50' },
  opportunity: { icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  info: { icon: Zap, color: 'text-blue-500', bg: 'bg-blue-50' },
  win: { icon: Star, color: 'text-amber-500', bg: 'bg-amber-50' },
}

export default function AICommandCenter() {
  const [data, setData] = useState<AIInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedAction, setExpandedAction] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchInsights = async () => {
    try {
      const res = await fetch('/api/ai/insights', { method: 'POST' })
      if (!res.ok) {
        // AI not available — try local insights
        const localRes = await fetch('/api/ai/local-insights', { method: 'POST' })
        if (localRes.ok) {
          const localData = await localRes.json()
          setData(localData)
          setError('')
        } else {
          setError('Unable to load insights')
        }
        setLoading(false)
        setRefreshing(false)
        return
      }
      const insights = await res.json()
      setData(insights)
      setError('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    }
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { fetchInsights() }, [])

  const refresh = () => {
    setRefreshing(true)
    fetchInsights()
  }

  const copyMessage = (id: string, message: string) => {
    navigator.clipboard.writeText(message)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (loading) {
    return (
      <div className="mb-8">
        <div className="card p-8 bg-gradient-to-br from-brand-50 via-white to-violet-50 border-brand-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-brand-600 animate-pulse" />
            </div>
            <div>
              <p className="font-bold text-surface-900">Analyzing your business data...</p>
              <p className="text-xs text-surface-400">Reviewing deals, contacts, and tasks to find what needs attention</p>
            </div>
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-surface-100/50 rounded-xl animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mb-8">
        <div className="card p-6 border-amber-200 bg-amber-50/50">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-surface-800">AI Sales Assistant</p>
              <p className="text-xs text-surface-500">{error || 'Add your Anthropic API key in .env.local to unlock AI-powered insights'}</p>
            </div>
            <button onClick={refresh} className="btn-secondary btn-sm"><RefreshCw className="w-3.5 h-3.5" /> Retry</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-8 space-y-4">
      {/* AI Greeting + Summary */}
      <div className="card p-6 bg-gradient-to-br from-brand-50 via-white to-violet-50 border-brand-100">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-violet-500 rounded-xl flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-surface-900">{data.greeting}</p>
              <p className="text-xs text-surface-400 mt-0.5">AI Sales Assistant</p>
            </div>
          </div>
          <button onClick={refresh} disabled={refreshing}
            className="btn-ghost btn-sm text-surface-400">
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        <div className="p-4 bg-white/70 rounded-xl border border-surface-100">
          <p className="text-sm text-surface-700 leading-relaxed">{data.daily_summary}</p>
        </div>
      </div>

      {/* Next Best Actions */}
      {data.urgent_actions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-brand-600" />
            <h2 className="font-semibold text-surface-900 text-sm">Next Best Actions</h2>
            <span className="text-[10px] px-2 py-0.5 bg-brand-100 text-brand-700 rounded-full font-semibold">{data.urgent_actions.length}</span>
          </div>

          <div className="space-y-2">
            {data.urgent_actions.map((action, idx) => {
              const Icon = ICON_MAP[action.icon] || Zap
              const isExpanded = expandedAction === action.id

              return (
                <div key={`action-${action.id}-${idx}`}
                  className={cn('card border-l-4 overflow-hidden transition-all cursor-pointer',
                    PRIORITY_STYLES[action.priority])}
                  onClick={() => setExpandedAction(isExpanded ? null : action.id)}>
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white border border-surface-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <Icon className="w-4 h-4 text-surface-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold text-surface-900">{action.title}</p>
                          <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase', PRIORITY_BADGE[action.priority])}>
                            {action.priority}
                          </span>
                        </div>
                        <p className="text-xs text-surface-500">{action.description}</p>
                        {action.entity_name && (
                          <p className="text-[10px] text-surface-400 mt-1 font-medium">
                            {action.entity_type}: {action.entity_name}
                          </p>
                        )}
                      </div>
                      <ArrowRight className={cn('w-4 h-4 text-surface-300 transition-transform flex-shrink-0', isExpanded && 'rotate-90')} />
                    </div>
                  </div>

                  {/* Expanded: Suggested message */}
                  {isExpanded && action.suggested_message && (
                    <div className="px-4 pb-4 animate-fade-in" onClick={e => e.stopPropagation()}>
                      <div className="p-3 bg-white rounded-xl border border-surface-100">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] font-semibold text-surface-400 uppercase">Suggested Message</p>
                          <button onClick={() => copyMessage(action.id, action.suggested_message!)}
                            className="flex items-center gap-1 text-[10px] text-brand-600 hover:text-brand-700 font-semibold">
                            {copiedId === action.id ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                          </button>
                        </div>
                        <p className="text-sm text-surface-700 leading-relaxed italic">"{action.suggested_message}"</p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Insights */}
      {data.insights.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-surface-500" />
            <h2 className="font-semibold text-surface-900 text-sm">Insights</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.insights.map((insight, idx) => {
              const style = INSIGHT_STYLES[insight.type] || INSIGHT_STYLES.info
              const InsightIcon = style.icon

              return (
                <div key={`insight-${insight.id}-${idx}`} className="card p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', style.bg)}>
                      <InsightIcon className={cn('w-4 h-4', style.color)} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-surface-800">{insight.title}</p>
                      <p className="text-xs text-surface-500 mt-0.5">{insight.description}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
