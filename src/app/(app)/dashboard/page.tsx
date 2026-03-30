import { createClient } from '@/lib/supabase/server'
import { TrendingUp, Users, CheckSquare, DollarSign, ArrowUpRight, AlertCircle, Plus, FileText } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import DashboardClient from '@/components/dashboard/DashboardClient'
import AICommandCenter from '@/components/dashboard/AICommandCenter'

async function getData(userId: string, supabase: any) {
  const { data: ws } = await supabase.from('workspaces').select('id, terminology').eq('owner_id', userId).single()
  if (!ws) return null

  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [dealsRes, wonRes, tasksRes, contactsRes, quotesRes] = await Promise.all([
    supabase.from('deals').select('id, value, status').eq('workspace_id', ws.id).eq('status', 'open'),
    supabase.from('deals').select('id, value').eq('workspace_id', ws.id).eq('status', 'won').gte('updated_at', firstOfMonth),
    supabase.from('activities').select('id').eq('workspace_id', ws.id).eq('done', false).lte('due_date', now.toISOString()),
    supabase.from('contacts').select('id').eq('workspace_id', ws.id),
    supabase.from('quotes').select('id, total, status').eq('workspace_id', ws.id),
  ])

  const openDeals = dealsRes.data || []
  const wonDeals = wonRes.data || []
  const quotes = quotesRes.data || []
  const term = (ws.terminology as any) || {}

  return {
    stats: {
      open_deals: openDeals.length,
      total_value: openDeals.reduce((s: number, d: any) => s + (d.value || 0), 0),
      won_this_month: wonDeals.length,
      won_value: wonDeals.reduce((s: number, d: any) => s + (d.value || 0), 0),
      overdue: tasksRes.data?.length || 0,
      contacts: contactsRes.data?.length || 0,
      quotes_pending: quotes.filter((q: any) => q.status === 'sent').length,
      quotes_value: quotes.filter((q: any) => q.status === 'accepted').reduce((s: number, q: any) => s + (q.total || 0), 0),
    },
    dealLabel: term.deal?.plural || 'Deals',
    contactLabel: term.contact?.plural || 'Contacts',
  }
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const result = await getData(user.id, supabase)
  const stats = result?.stats || { open_deals: 0, total_value: 0, won_this_month: 0, won_value: 0, overdue: 0, contacts: 0, quotes_pending: 0, quotes_value: 0 }
  const dealLabel = result?.dealLabel || 'Deals'
  const contactLabel = result?.contactLabel || 'Contacts'
  const firstName = user.user_metadata?.full_name?.split(' ')[0] || ''

  const statCards = [
    { label: `Open ${dealLabel}`, value: stats.open_deals, sub: formatCurrency(stats.total_value), icon: TrendingUp, color: 'text-brand-600', bg: 'bg-brand-50' },
    { label: 'Won This Month', value: stats.won_this_month, sub: formatCurrency(stats.won_value), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: contactLabel, value: stats.contacts, sub: 'Total', icon: Users, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Overdue', value: stats.overdue, sub: stats.overdue > 0 ? 'Needs attention' : 'All caught up', icon: stats.overdue > 0 ? AlertCircle : CheckSquare, color: stats.overdue > 0 ? 'text-red-600' : 'text-emerald-600', bg: stats.overdue > 0 ? 'bg-red-50' : 'bg-emerald-50' },
    { label: 'Pending Quotes', value: stats.quotes_pending, sub: formatCurrency(stats.quotes_value) + ' accepted', icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50' },
  ]

  return (
    <div className="animate-fade-in">
      <DashboardClient />

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {statCards.map(({ label, value, sub, icon: Icon, color, bg }) => (
          <div key={label} className="card p-4">
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-surface-900 leading-tight">{value}</p>
                <p className="text-[10px] text-surface-500 font-semibold uppercase truncate">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* AI Command Center */}
      <AICommandCenter />
    </div>
  )
}
