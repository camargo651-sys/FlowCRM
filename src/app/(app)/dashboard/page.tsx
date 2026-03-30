import { createClient } from '@/lib/supabase/server'
import { TrendingUp, Users, CheckSquare, DollarSign, ArrowUpRight, AlertCircle, Plus, FileText } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import DashboardClient from '@/components/dashboard/DashboardClient'
import AICommandCenter from '@/components/dashboard/AICommandCenter'

import { getIndustryKPIs } from '@/lib/ai/industry-kpis'

async function getData(userId: string, supabase: any) {
  const { data: ws } = await supabase.from('workspaces').select('id, terminology, industry').eq('owner_id', userId).single()
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

  // Get industry-specific KPIs
  let industryKPIs: any[] = []
  try {
    industryKPIs = await getIndustryKPIs(supabase, ws.id, ws.industry || 'generic')
  } catch {}

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
    industryKPIs,
    industry: ws.industry,
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

  const industryKPIs = result?.industryKPIs || []

  // Use industry KPIs if available, otherwise fall back to defaults
  const statCards = industryKPIs.length > 0
    ? industryKPIs.slice(0, 6)
    : [
        { label: `Open ${dealLabel}`, value: stats.open_deals, icon: '📊' },
        { label: 'Won This Month', value: stats.won_this_month, icon: '💰' },
        { label: contactLabel, value: stats.contacts, icon: '👥' },
        { label: 'Overdue', value: stats.overdue, icon: stats.overdue > 0 ? '⚠️' : '✅' },
        { label: 'Pending Quotes', value: stats.quotes_pending, icon: '📄' },
      ]

  return (
    <div className="animate-fade-in">
      <DashboardClient />

      {/* Industry KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {statCards.map((kpi: any) => (
          <div key={kpi.key || kpi.label} className="card p-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-surface-50 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">
                {kpi.icon || '📊'}
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-surface-900 leading-tight">{kpi.value}</p>
                <p className="text-[10px] text-surface-500 font-semibold uppercase truncate">{kpi.label}</p>
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
