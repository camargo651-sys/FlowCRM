'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowUp, Plus, Loader2, Zap, Lightbulb, CheckCircle2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RoadmapItem {
  id: string
  title: string
  description: string | null
  category: string
  status: 'idea' | 'planned' | 'in_progress' | 'shipped' | 'declined'
  vote_count: number
  created_at: string
}

type TabKey = 'in_progress' | 'planned' | 'shipped' | 'idea'

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'in_progress', label: 'In Progress', icon: Zap },
  { key: 'planned', label: 'Planned', icon: Clock },
  { key: 'shipped', label: 'Shipped', icon: CheckCircle2 },
  { key: 'idea', label: 'Ideas', icon: Lightbulb },
]

const CATEGORY_STYLES: Record<string, string> = {
  feature: 'bg-brand-50 text-brand-700',
  improvement: 'bg-violet-50 text-violet-700',
  bugfix: 'bg-rose-50 text-rose-700',
  integration: 'bg-emerald-50 text-emerald-700',
}

export default function RoadmapPage() {
  const [items, setItems] = useState<RoadmapItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('in_progress')
  const [voted, setVoted] = useState<Set<string>>(new Set())
  const [votingId, setVotingId] = useState<string | null>(null)
  const [showSubmit, setShowSubmit] = useState(false)
  const [submitForm, setSubmitForm] = useState({ title: '', description: '', category: 'feature' })
  const [submitting, setSubmitting] = useState(false)
  const [guestEmail, setGuestEmail] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/roadmap')
    const json = await res.json()
    setItems(json.items || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    try {
      const stored = localStorage.getItem('tracktio_roadmap_voted')
      if (stored) setVoted(new Set(JSON.parse(stored)))
      const email = localStorage.getItem('tracktio_roadmap_email')
      if (email) setGuestEmail(email)
    } catch {}
  }, [])

  const persistVoted = (next: Set<string>) => {
    setVoted(next)
    try { localStorage.setItem('tracktio_roadmap_voted', JSON.stringify(Array.from(next))) } catch {}
  }

  const handleVote = async (item: RoadmapItem) => {
    if (votingId) return
    const already = voted.has(item.id)

    let email = guestEmail
    if (!email) {
      email = window.prompt('Enter your email to vote (or log in):') || ''
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        toast.error('Valid email required')
        return
      }
      setGuestEmail(email)
      try { localStorage.setItem('tracktio_roadmap_email', email) } catch {}
    }

    setVotingId(item.id)
    try {
      const res = already
        ? await fetch(`/api/roadmap/${item.id}/vote?email=${encodeURIComponent(email)}`, { method: 'DELETE' })
        : await fetch(`/api/roadmap/${item.id}/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Vote failed')

      if (json.item) {
        setItems(prev => prev.map(it => it.id === item.id ? json.item : it))
      }
      const next = new Set(voted)
      if (already) next.delete(item.id); else next.add(item.id)
      persistVoted(next)
      toast.success(already ? 'Vote removed' : 'Voted!')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setVotingId(null)
    }
  }

  const handleSubmitIdea = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!submitForm.title.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitForm),
      })
      const json = await res.json()
      if (!res.ok) {
        if (res.status === 401) {
          toast.error('Please log in to submit ideas')
        } else {
          toast.error(json.error || 'Submit failed')
        }
        return
      }
      toast.success('Idea submitted!')
      setSubmitForm({ title: '', description: '', category: 'feature' })
      setShowSubmit(false)
      setTab('idea')
      load()
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = items.filter(i => i.status === tab)

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      {/* Top nav */}
      <nav className="border-b border-surface-100 dark:border-surface-800 bg-white dark:bg-surface-900">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <span className="font-bold text-lg text-surface-900 dark:text-surface-50">Tracktio</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-xs font-medium text-surface-600 dark:text-surface-300 hover:text-surface-900">Log in</Link>
            <Link href="/auth/signup" className="btn-primary btn-sm text-xs">Sign up free</Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <header className="max-w-5xl mx-auto px-6 pt-12 pb-8 text-center">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-surface-900 dark:text-surface-50 mb-3">
          Tracktio Public Roadmap
        </h1>
        <p className="text-base text-surface-500 dark:text-surface-400 max-w-xl mx-auto">
          Vote for what matters to you. We build what the community wants.
        </p>
      </header>

      <main className="max-w-5xl mx-auto px-6 pb-16">
        {/* Tabs */}
        <div className="segmented-control mb-6 overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon }) => {
            const count = items.filter(i => i.status === key).length
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                data-active={tab === key}
                className={cn(tab === key && 'active')}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                <span className="ml-1 text-[10px] opacity-60">{count}</span>
              </button>
            )
          })}
        </div>

        {/* Items */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-sm text-surface-500">Nothing here yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(item => {
              const hasVoted = voted.has(item.id)
              return (
                <div key={item.id} className="card p-5 flex items-start gap-4 hover:border-brand-200 transition-colors">
                  {/* Vote button */}
                  <button
                    onClick={() => handleVote(item)}
                    disabled={votingId === item.id || item.status === 'shipped'}
                    className={cn(
                      'flex flex-col items-center justify-center min-w-[56px] px-2 py-2 rounded-xl border-2 transition-all',
                      hasVoted
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-surface-200 hover:border-brand-300 text-surface-600',
                      item.status === 'shipped' && 'opacity-60 cursor-not-allowed'
                    )}
                  >
                    <ArrowUp className={cn('w-4 h-4', hasVoted && 'fill-current')} />
                    <span className="text-sm font-bold">{item.vote_count}</span>
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <h3 className="text-sm font-bold text-surface-900 dark:text-surface-50">{item.title}</h3>
                      <span className={cn('text-[9px] font-bold uppercase px-1.5 py-0.5 rounded', CATEGORY_STYLES[item.category] || 'bg-surface-100 text-surface-600')}>
                        {item.category}
                      </span>
                    </div>
                    {item.description && (
                      <p className="text-xs text-surface-500 dark:text-surface-400 leading-relaxed">{item.description}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Submit idea section */}
        <div className="mt-10 card p-5">
          {!showSubmit ? (
            <button
              onClick={() => setShowSubmit(true)}
              className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700 py-2"
            >
              <Plus className="w-4 h-4" />
              Submit an idea
            </button>
          ) : (
            <form onSubmit={handleSubmitIdea} className="space-y-3">
              <h3 className="text-sm font-bold text-surface-900 dark:text-surface-50">Submit an idea</h3>
              <div>
                <label className="label">Title *</label>
                <input
                  className="input"
                  required
                  maxLength={200}
                  value={submitForm.title}
                  onChange={e => setSubmitForm({ ...submitForm, title: e.target.value })}
                  placeholder="What would you like to see?"
                />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  className="input"
                  rows={3}
                  value={submitForm.description}
                  onChange={e => setSubmitForm({ ...submitForm, description: e.target.value })}
                  placeholder="Tell us more..."
                />
              </div>
              <div>
                <label className="label">Category</label>
                <select
                  className="input"
                  value={submitForm.category}
                  onChange={e => setSubmitForm({ ...submitForm, category: e.target.value })}
                >
                  <option value="feature">Feature</option>
                  <option value="improvement">Improvement</option>
                  <option value="integration">Integration</option>
                  <option value="bugfix">Bug fix</option>
                </select>
              </div>
              <p className="text-[11px] text-surface-500">You must be logged in to submit ideas.</p>
              <div className="flex items-center gap-2">
                <button type="submit" disabled={submitting} className="btn-primary btn-sm text-xs">
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
                <button type="button" onClick={() => setShowSubmit(false)} className="btn-ghost btn-sm text-xs">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
