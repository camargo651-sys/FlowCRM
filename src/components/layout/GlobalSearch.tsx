'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Search, User, TrendingUp, FileText, CheckSquare, Mail, MessageCircle, X,
  LayoutDashboard, Kanban, Receipt, Package, BookOpen, Settings, Briefcase,
  Plus, ArrowRight, Zap, Clock, ShoppingCart, Factory, CreditCard, Plug,
  BarChart2, Shield, UserPlus, Ticket
} from 'lucide-react'
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

interface CommandItem {
  id: string
  icon: typeof User
  label: string
  hint?: string
  action: () => void
  section: 'create' | 'navigate' | 'result'
  color?: string
}

const TYPE_ICONS: Record<string, typeof User> = {
  contact: User, deal: TrendingUp, quote: FileText,
  task: CheckSquare, email: Mail, whatsapp: MessageCircle,
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

  // All command items
  const createActions: CommandItem[] = [
    { id: 'new-deal', icon: TrendingUp, label: 'New Deal', hint: '', action: () => navigate('/pipeline?new=1'), section: 'create', color: 'bg-emerald-50 text-emerald-600' },
    { id: 'new-contact', icon: User, label: 'New Contact', hint: '', action: () => navigate('/contacts?new=1'), section: 'create', color: 'bg-brand-50 text-brand-600' },
    { id: 'new-invoice', icon: Receipt, label: 'New Invoice', hint: '', action: () => navigate('/invoices?new=1'), section: 'create', color: 'bg-violet-50 text-violet-600' },
    { id: 'new-quote', icon: FileText, label: 'New Quote', hint: '', action: () => navigate('/quotes?new=1'), section: 'create', color: 'bg-amber-50 text-amber-600' },
    { id: 'new-task', icon: CheckSquare, label: 'New Task', hint: '', action: () => navigate('/tasks?new=1'), section: 'create', color: 'bg-blue-50 text-blue-600' },
  ]

  const navActions: CommandItem[] = [
    { id: 'nav-dashboard', icon: LayoutDashboard, label: 'Dashboard', hint: 'G then D', action: () => navigate('/dashboard'), section: 'navigate' },
    { id: 'nav-pipeline', icon: Kanban, label: 'Pipeline', hint: 'G then P', action: () => navigate('/pipeline'), section: 'navigate' },
    { id: 'nav-contacts', icon: User, label: 'Contacts', hint: 'G then C', action: () => navigate('/contacts'), section: 'navigate' },
    { id: 'nav-invoices', icon: Receipt, label: 'Invoices', hint: 'G then I', action: () => navigate('/invoices'), section: 'navigate' },
    { id: 'nav-quotes', icon: FileText, label: 'Quotes', hint: '', action: () => navigate('/quotes'), section: 'navigate' },
    { id: 'nav-inventory', icon: Package, label: 'Inventory', hint: 'G then N', action: () => navigate('/inventory'), section: 'navigate' },
    { id: 'nav-accounting', icon: BookOpen, label: 'Accounting', hint: '', action: () => navigate('/accounting'), section: 'navigate' },
    { id: 'nav-hr', icon: Briefcase, label: 'HR & Payroll', hint: 'G then H', action: () => navigate('/hr'), section: 'navigate' },
    { id: 'nav-pos', icon: ShoppingCart, label: 'POS', hint: '', action: () => navigate('/pos'), section: 'navigate' },
    { id: 'nav-manufacturing', icon: Factory, label: 'Manufacturing', hint: '', action: () => navigate('/manufacturing'), section: 'navigate' },
    { id: 'nav-expenses', icon: CreditCard, label: 'Expenses', hint: '', action: () => navigate('/expenses'), section: 'navigate' },
    { id: 'nav-analytics', icon: BarChart2, label: 'Analytics', hint: '', action: () => navigate('/analytics'), section: 'navigate' },
    { id: 'nav-automations', icon: Zap, label: 'Automations', hint: '', action: () => navigate('/automations'), section: 'navigate' },
    { id: 'nav-tickets', icon: Ticket, label: 'Tickets', hint: '', action: () => navigate('/tickets'), section: 'navigate' },
    { id: 'nav-team', icon: UserPlus, label: 'Team', hint: '', action: () => navigate('/team'), section: 'navigate' },
    { id: 'nav-integrations', icon: Plug, label: 'Integrations', hint: '', action: () => navigate('/integrations'), section: 'navigate' },
    { id: 'nav-settings', icon: Settings, label: 'Settings', hint: 'G then S', action: () => navigate('/settings'), section: 'navigate' },
    { id: 'nav-roles', icon: Shield, label: 'Roles & Permissions', hint: '', action: () => navigate('/roles'), section: 'navigate' },
  ]

  const navigate = (url: string) => {
    router.push(url)
    setOpen(false)
  }

  // Filter commands by query
  const filteredCommands = query.trim()
    ? [...createActions, ...navActions].filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase())
      )
    : []

  const allItems = query.length >= 2
    ? [
        ...filteredCommands,
        ...results.map(r => ({
          id: `result-${r.type}-${r.id}`,
          icon: TYPE_ICONS[r.type] || Search,
          label: r.title,
          hint: r.subtitle,
          action: () => navigate(r.url),
          section: 'result' as const,
          color: TYPE_COLORS[r.type],
        })),
      ]
    : filteredCommands

  // Cmd+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
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
    const { data: wsRows } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).limit(1)
    const ws = wsRows?.[0] || null
    if (!ws) { setLoading(false); return }

    // Escape LIKE wildcards to prevent pattern injection
    const escaped = q.replace(/[%_\\]/g, '\\$&')
    const searchTerm = `%${escaped}%`
    const all: SearchResult[] = []

    const { data: contacts } = await supabase
      .from('contacts').select('id, name, email, phone, company_name, engagement_score')
      .eq('workspace_id', ws.id)
      .or(`name.ilike.${searchTerm},email.ilike.${searchTerm},phone.ilike.${searchTerm},company_name.ilike.${searchTerm}`)
      .limit(5)

    for (const c of contacts || []) {
      all.push({ id: c.id, type: 'contact', title: c.name,
        subtitle: [c.email, c.company_name, c.phone].filter(Boolean).join(' · '),
        url: `/contacts/${c.id}`, score: c.engagement_score || 0 })
    }

    const { data: deals } = await supabase
      .from('deals').select('id, title, value, status')
      .eq('workspace_id', ws.id).ilike('title', searchTerm).limit(5)

    for (const d of deals || []) {
      all.push({ id: d.id, type: 'deal', title: d.title,
        subtitle: `${d.status} ${d.value ? `· $${d.value.toLocaleString()}` : ''}`,
        url: '/pipeline' })
    }

    const { data: quotes } = await supabase
      .from('quotes').select('id, title, quote_number, total, status')
      .eq('workspace_id', ws.id)
      .or(`title.ilike.${searchTerm},quote_number.ilike.${searchTerm}`)
      .limit(3)

    for (const q of quotes || []) {
      all.push({ id: q.id, type: 'quote', title: q.title,
        subtitle: `${q.quote_number} · $${q.total?.toLocaleString()} · ${q.status}`,
        url: '/quotes' })
    }

    const { data: tasks } = await supabase
      .from('activities').select('id, title, type, done')
      .eq('workspace_id', ws.id).ilike('title', searchTerm).limit(3)

    for (const t of tasks || []) {
      all.push({ id: t.id, type: 'task', title: t.title,
        subtitle: `${t.type} · ${t.done ? 'Done' : 'Pending'}`, url: '/tasks' })
    }

    try {
      const { data: emails } = await supabase
        .from('email_messages').select('id, subject, from_name, from_address, contact_id')
        .eq('workspace_id', ws.id)
        .or(`subject.ilike.${searchTerm},from_name.ilike.${searchTerm},from_address.ilike.${searchTerm}`)
        .limit(3)
      for (const e of emails || []) {
        all.push({ id: e.id, type: 'email', title: e.subject || '(No subject)',
          subtitle: e.from_name || e.from_address,
          url: e.contact_id ? `/contacts/${e.contact_id}` : '/contacts' })
      }
    } catch {}

    try {
      const { data: wa } = await supabase
        .from('whatsapp_messages').select('id, body, from_number, contact_id')
        .eq('workspace_id', ws.id).ilike('body', searchTerm).limit(3)
      for (const m of wa || []) {
        all.push({ id: m.id, type: 'whatsapp', title: (m.body || '').slice(0, 60),
          subtitle: m.from_number,
          url: m.contact_id ? `/contacts/${m.contact_id}` : '/contacts' })
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const total = query.trim() ? allItems.length : createActions.length + navActions.length
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, total - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (query.trim()) {
        allItems[selected]?.action()
      } else {
        const combined = [...createActions, ...navActions]
        combined[selected]?.action()
      }
    }
  }

  if (!open) return null

  const renderItem = (item: CommandItem, idx: number) => (
    <div key={item.id}
      onClick={item.action}
      className={cn('flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors',
        idx === selected ? 'bg-brand-50' : 'hover:bg-surface-50')}>
      <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
        item.color || 'bg-surface-100 text-surface-500')}>
        <item.icon className="w-3.5 h-3.5" />
      </div>
      <span className="text-sm text-surface-800 flex-1 truncate">{item.label}</span>
      {item.hint && <span className="text-[10px] text-surface-300 flex-shrink-0">{item.hint}</span>}
    </div>
  )

  let globalIdx = 0

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] p-4 animate-fade-in" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-surface-900/40 backdrop-blur-[2px]" />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-modal overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-surface-100">
          <Search className="w-5 h-5 text-surface-400 flex-shrink-0" />
          <input ref={inputRef} type="text" className="flex-1 text-sm outline-none placeholder:text-surface-400 bg-transparent"
            placeholder="Search or type a command..."
            value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKeyDown} />
          <kbd className="kbd hidden sm:flex">ESC</kbd>
        </div>

        {/* Content */}
        <div className="max-h-[50vh] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-6">
              <div className="w-5 h-5 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
            </div>
          )}

          {/* Filtered results when typing */}
          {query.trim() && !loading && (
            <>
              {allItems.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-surface-400">No results for "{query}"</p>
                </div>
              ) : (
                <div className="py-1.5">
                  {/* Commands */}
                  {filteredCommands.length > 0 && (
                    <>
                      <p className="px-4 py-1.5 text-[10px] font-bold text-surface-400 uppercase tracking-widest">Commands</p>
                      {filteredCommands.map(item => renderItem(item, globalIdx++))}
                    </>
                  )}
                  {/* Data results */}
                  {results.length > 0 && (
                    <>
                      <p className="px-4 py-1.5 text-[10px] font-bold text-surface-400 uppercase tracking-widest mt-1">Results</p>
                      {results.map(r => {
                        const item: CommandItem = {
                          id: `result-${r.type}-${r.id}`, icon: TYPE_ICONS[r.type] || Search,
                          label: r.title, hint: r.subtitle,
                          action: () => navigate(r.url), section: 'result', color: TYPE_COLORS[r.type],
                        }
                        return renderItem(item, globalIdx++)
                      })}
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* Default state - show quick actions and pages */}
          {!query.trim() && !loading && (
            <div className="py-1.5">
              <p className="px-4 py-1.5 text-[10px] font-bold text-surface-400 uppercase tracking-widest">Quick actions</p>
              {createActions.map(item => renderItem(item, globalIdx++))}
              <p className="px-4 py-1.5 text-[10px] font-bold text-surface-400 uppercase tracking-widest mt-1">Go to</p>
              {navActions.map(item => renderItem(item, globalIdx++))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-surface-100 flex items-center gap-4 text-[10px] text-surface-400">
          <span><kbd className="kbd">↑↓</kbd> navigate</span>
          <span><kbd className="kbd">↵</kbd> select</span>
          <span><kbd className="kbd">esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
