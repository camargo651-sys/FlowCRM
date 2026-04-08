'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { Search, User, TrendingUp, FileText, CheckSquare, Mail, MessageCircle, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface SearchResult {
  id: string
  type: 'contact' | 'deal' | 'quote' | 'task' | 'email' | 'whatsapp'
  title: string
  subtitle: string
  url: string
  score?: number
}

const TYPE_ICONS: Record<string, typeof User> = {
  contact: User,
  deal: TrendingUp,
  quote: FileText,
  task: CheckSquare,
  email: Mail,
  whatsapp: MessageCircle,
}

const TYPE_COLORS: Record<string, string> = {
  contact: 'bg-brand-50 text-brand-600',
  deal: 'bg-emerald-50 text-emerald-600',
  quote: 'bg-violet-50 text-violet-600',
  task: 'bg-amber-50 text-amber-600',
  email: 'bg-blue-50 text-blue-600',
  whatsapp: 'bg-green-50 text-green-600',
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selected, setSelected] = useState(0)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  // Cmd+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setResults([])
      setSelected(0)
    }
  }, [open])

  const search = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) { setResults([]); return }
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
    if (!ws) { setLoading(false); return }

    const searchTerm = `%${q}%`
    const all: SearchResult[] = []

    // Search contacts
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name, email, phone, company_name, engagement_score')
      .eq('workspace_id', ws.id)
      .or(`name.ilike.${searchTerm},email.ilike.${searchTerm},phone.ilike.${searchTerm},company_name.ilike.${searchTerm}`)
      .limit(5)

    for (const c of contacts || []) {
      all.push({
        id: c.id, type: 'contact', title: c.name,
        subtitle: [c.email, c.company_name, c.phone].filter(Boolean).join(' · '),
        url: `/contacts/${c.id}`, score: c.engagement_score || 0,
      })
    }

    // Search deals
    const { data: deals } = await supabase
      .from('deals')
      .select('id, title, value, status')
      .eq('workspace_id', ws.id)
      .ilike('title', searchTerm)
      .limit(5)

    for (const d of deals || []) {
      all.push({
        id: d.id, type: 'deal', title: d.title,
        subtitle: `${d.status} ${d.value ? `· $${d.value.toLocaleString()}` : ''}`,
        url: '/pipeline',
      })
    }

    // Search quotes
    const { data: quotes } = await supabase
      .from('quotes')
      .select('id, title, quote_number, total, status')
      .eq('workspace_id', ws.id)
      .or(`title.ilike.${searchTerm},quote_number.ilike.${searchTerm}`)
      .limit(3)

    for (const q of quotes || []) {
      all.push({
        id: q.id, type: 'quote', title: q.title,
        subtitle: `${q.quote_number} · $${q.total?.toLocaleString()} · ${q.status}`,
        url: '/quotes',
      })
    }

    // Search activities/tasks
    const { data: tasks } = await supabase
      .from('activities')
      .select('id, title, type, done')
      .eq('workspace_id', ws.id)
      .ilike('title', searchTerm)
      .limit(3)

    for (const t of tasks || []) {
      all.push({
        id: t.id, type: 'task', title: t.title,
        subtitle: `${t.type} · ${t.done ? 'Done' : 'Pending'}`,
        url: '/tasks',
      })
    }

    // Search emails
    try {
      const { data: emails } = await supabase
        .from('email_messages')
        .select('id, subject, from_name, from_address, contact_id')
        .eq('workspace_id', ws.id)
        .or(`subject.ilike.${searchTerm},from_name.ilike.${searchTerm},from_address.ilike.${searchTerm}`)
        .limit(3)

      for (const e of emails || []) {
        all.push({
          id: e.id, type: 'email', title: e.subject || '(No subject)',
          subtitle: e.from_name || e.from_address,
          url: e.contact_id ? `/contacts/${e.contact_id}` : '/contacts',
        })
      }
    } catch {}

    // Search WhatsApp
    try {
      const { data: wa } = await supabase
        .from('whatsapp_messages')
        .select('id, body, from_number, contact_id')
        .eq('workspace_id', ws.id)
        .ilike('body', searchTerm)
        .limit(3)

      for (const m of wa || []) {
        all.push({
          id: m.id, type: 'whatsapp', title: (m.body || '').slice(0, 60),
          subtitle: m.from_number,
          url: m.contact_id ? `/contacts/${m.contact_id}` : '/contacts',
        })
      }
    } catch {}

    setResults(all)
    setSelected(0)
    setLoading(false)
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => search(query), 200)
    return () => clearTimeout(timeout)
  }, [query, search])

  const handleSelect = (result: SearchResult) => {
    router.push(result.url)
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && results[selected]) { handleSelect(results[selected]) }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] p-4 animate-fade-in" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-surface-900/40 backdrop-blur-[2px]" />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-modal overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-100">
          <Search className="w-5 h-5 text-surface-400 flex-shrink-0" />
          <input ref={inputRef} type="text" className="flex-1 text-sm outline-none placeholder:text-surface-400"
            placeholder="Search contacts, deals, emails, messages..."
            value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKeyDown} />
          <kbd className="kbd hidden sm:flex">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
            </div>
          )}

          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-surface-400">No results for "{query}"</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="py-2">
              {results.map((result, i) => {
                const Icon = TYPE_ICONS[result.type] || Search
                return (
                  <div key={`${result.type}-${result.id}`}
                    onClick={() => handleSelect(result)}
                    className={cn('flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors',
                      i === selected ? 'bg-brand-50' : 'hover:bg-surface-50')}>
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', TYPE_COLORS[result.type])}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-900 truncate">{result.title}</p>
                      <p className="text-[11px] text-surface-400 truncate">{result.subtitle}</p>
                    </div>
                    <span className="text-[9px] uppercase font-bold text-surface-300 flex-shrink-0">{result.type}</span>
                  </div>
                )
              })}
            </div>
          )}

          {!loading && query.length < 2 && (
            <div className="py-6 px-4 text-center">
              <p className="text-xs text-surface-400">Type at least 2 characters to search across everything</p>
              <div className="flex items-center justify-center gap-4 mt-3">
                {['Contacts', 'Deals', 'Emails', 'WhatsApp', 'Tasks', 'Quotes'].map(t => (
                  <span key={t} className="text-[10px] text-surface-300 font-medium">{t}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="px-4 py-2.5 border-t border-surface-100 flex items-center gap-4 text-[10px] text-surface-400">
            <span><kbd className="kbd">↑↓</kbd> navigate</span>
            <span><kbd className="kbd">↵</kbd> open</span>
            <span><kbd className="kbd">esc</kbd> close</span>
          </div>
        )}
      </div>
    </div>
  )
}
