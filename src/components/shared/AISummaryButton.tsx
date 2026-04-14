'use client'
import { useState, useEffect } from 'react'
import { Sparkles, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  /** Text to summarize. Can be a function for lazy loading. */
  getText: () => string | Promise<string>
  type: 'call' | 'email' | 'deal' | 'ticket'
  label?: string
  className?: string
}

interface SummaryData {
  summary: string
  bullets: string[]
  sentiment?: string
  provider: string
  configured: boolean
}

export default function AISummaryButton({ getText, type, label, className }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<SummaryData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [configured, setConfigured] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/ai/summarize')
      .then(r => r.json())
      .then(j => setConfigured(!!j.configured))
      .catch(() => setConfigured(false))
  }, [])

  const handleClick = async () => {
    setOpen(true)
    if (data || loading) return
    setLoading(true)
    setError(null)
    try {
      const text = await getText()
      if (!text || !text.trim()) {
        setError('No content to summarize')
        setLoading(false)
        return
      }
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, type }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setData(json)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  const tooltip = configured === false ? 'Configure OpenAI in Settings → Integrations' : undefined

  return (
    <>
      <button
        onClick={handleClick}
        title={tooltip}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-surface-200 bg-white hover:bg-brand-50 hover:border-brand-200 text-surface-700 hover:text-brand-700 transition-colors',
          className,
        )}
      >
        <Sparkles className="w-3.5 h-3.5" />
        {label || 'AI Summary'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-[2px]" onClick={() => setOpen(false)}>
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-modal p-5" onClick={e => e.stopPropagation()}>
            <button onClick={() => setOpen(false)} className="absolute top-3 right-3 p-1 text-surface-400 hover:text-surface-700">
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-brand-600" />
              <h3 className="text-sm font-semibold text-surface-900">AI Summary</h3>
              {data?.provider === 'fallback' && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">Basic</span>
              )}
              {data?.provider === 'openai' && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">GPT</span>
              )}
            </div>

            {loading && (
              <div className="flex items-center gap-2 py-8 justify-center text-surface-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Generating summary...
              </div>
            )}

            {error && !loading && (
              <p className="text-sm text-red-600 py-4">{error}</p>
            )}

            {data && !loading && (
              <div className="space-y-3">
                <p className="text-sm text-surface-800 leading-relaxed">{data.summary}</p>
                {data.bullets?.length > 0 && (
                  <ul className="space-y-1.5">
                    {data.bullets.map((b, i) => (
                      <li key={i} className="text-xs text-surface-600 flex gap-2">
                        <span className="text-brand-500 mt-0.5">•</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {data.sentiment && (
                  <div className="pt-2 border-t border-surface-100">
                    <span className="text-[10px] uppercase tracking-wider text-surface-400">Sentiment: </span>
                    <span className={cn(
                      'text-xs font-medium',
                      data.sentiment === 'positive' && 'text-emerald-600',
                      data.sentiment === 'negative' && 'text-red-600',
                      data.sentiment === 'neutral' && 'text-surface-600',
                    )}>{data.sentiment}</span>
                  </div>
                )}
                {!data.configured && (
                  <p className="text-[10px] text-surface-400 pt-1">
                    Using basic extractive summary. Configure OpenAI in Settings → Integrations for AI-powered summaries.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
