'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, Circle, ArrowRight, X, Rocket } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface CheckItem {
  key: string
  label: string
  description: string
  href: string
  check: (data: any) => boolean
}

const CHECKLIST: CheckItem[] = [
  { key: 'contact', label: 'Add your first contact', description: 'Import or create a contact', href: '/contacts', check: d => d.contacts > 0 },
  { key: 'deal', label: 'Create a deal', description: 'Start tracking an opportunity', href: '/pipeline', check: d => d.deals > 0 },
  { key: 'product', label: 'Add a product', description: 'Set up your catalog', href: '/inventory', check: d => d.products > 0 },
  { key: 'invoice', label: 'Create an invoice', description: 'Send your first invoice', href: '/invoices', check: d => d.invoices > 0 },
  { key: 'integration', label: 'Connect an integration', description: 'Gmail, WhatsApp, or Outlook', href: '/integrations', check: d => d.integrations > 0 },
  { key: 'team', label: 'Invite a team member', description: 'Collaborate with your team', href: '/team', check: d => d.members > 1 },
]

export default function GettingStarted() {
  const supabase = createClient()
  const [data, setData] = useState<any>(null)
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
        if (!ws) return

        // Check if dismissed
        const stored = localStorage.getItem('tracktio_getting_started_dismissed')
        if (stored === 'true') { setDismissed(true); setLoading(false); return }

        const [contacts, deals, products, invoices, integrations, members] = await Promise.all([
          supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('workspace_id', ws.id),
          supabase.from('deals').select('id', { count: 'exact', head: true }).eq('workspace_id', ws.id),
          supabase.from('products').select('id', { count: 'exact', head: true }).eq('workspace_id', ws.id),
          supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('workspace_id', ws.id),
          supabase.from('integrations').select('id', { count: 'exact', head: true }).eq('workspace_id', ws.id).eq('enabled', true),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('workspace_id', ws.id),
        ])

        setData({
          contacts: contacts.count || 0,
          deals: deals.count || 0,
          products: products.count || 0,
          invoices: invoices.count || 0,
          integrations: integrations.count || 0,
          members: members.count || 0,
        })
      } catch {}
      setLoading(false)
    }
    load()
  }, [])

  if (loading || dismissed || !data) return null

  const completed = CHECKLIST.filter(item => item.check(data))
  const remaining = CHECKLIST.filter(item => !item.check(data))
  const progress = Math.round((completed.length / CHECKLIST.length) * 100)

  // All done — don't show
  if (remaining.length === 0) return null

  return (
    <div className="card p-5 mb-6 border-brand-100 bg-gradient-to-r from-brand-50/50 to-white">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-brand-100 rounded-xl flex items-center justify-center">
            <Rocket className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-surface-900">Getting Started</h3>
            <p className="text-[10px] text-surface-500">{completed.length} of {CHECKLIST.length} completed</p>
          </div>
        </div>
        <button onClick={() => { setDismissed(true); localStorage.setItem('tracktio_getting_started_dismissed', 'true') }}
          className="text-surface-300 hover:text-surface-500"><X className="w-4 h-4" /></button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-surface-100 rounded-full mb-4 overflow-hidden">
        <div className="h-full bg-brand-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="space-y-1.5">
        {CHECKLIST.map(item => {
          const done = item.check(data)
          return (
            <Link key={item.key} href={item.href}
              className={cn('flex items-center gap-3 px-3 py-2 rounded-lg transition-all',
                done ? 'opacity-50' : 'hover:bg-white')}>
              {done ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-surface-300 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className={cn('text-xs font-medium', done ? 'text-surface-400 line-through' : 'text-surface-800')}>{item.label}</p>
                {!done && <p className="text-[10px] text-surface-400">{item.description}</p>}
              </div>
              {!done && <ArrowRight className="w-3 h-3 text-surface-300 flex-shrink-0" />}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
