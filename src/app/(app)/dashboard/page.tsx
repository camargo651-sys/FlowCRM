import { createClient } from '@/lib/supabase/server'
import { TrendingUp, Users, CheckSquare, DollarSign, ArrowUpRight, ArrowDownRight, AlertCircle, Plus } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'

async function getStats(workspaceId: string, supabase: any) {
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [dealsRes, wonRes, tasksRes, contactsRes] = await Promise.all([
    supabase.from('deals').select('id, value, status, stage_id').eq('workspace_id', workspaceId).eq('status', 'open'),
    supabase.from('deals').select('id, value').eq('workspace_id', workspaceId).eq('status', 'won').gte('updated_at', firstOfMonth),
    supabase.from('activities').select('id').eq('workspace_id', workspaceId).eq('done', false).lte('due_date', now.toISOString()),
    supabase.from('contacts').select('id').eq('workspace_id', workspaceId),
  ])

  const openDeals = dealsRes.data || []
  const wonDeals = wonRes.data || []

  return {
    open_deals: openDeals.length,
    total_value: openDeals.reduce((s: number, d: any) => s + (d.value || 0), 0),
    won_this_month: wonDeals.length,
    won_value_this_month: wonDeals.reduce((s: number, d: any) => s + (d.value || 0), 0),
    overdue_tasks: tasksRes.data?.length || 0,
    total_contacts: contactsRes.data?.length || 0,
  }
}

async function getRecentDeals(workspaceId: string, supabase: any) {
  const { data } = await supabase
    .from('deals')
    .select('id, title, value, status, updated_at, contacts(name)')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })
    .limit(5)
  return data || []
}

async function getWorkspaceId(userId: string, supabase: any) {
  const { data } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', userId)
    .single()
  return data?.id
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const workspaceId = await getWorkspaceId(user.id, supabase)

  const [stats, recentDeals] = workspaceId
    ? await Promise.all([getStats(workspaceId, supabase), getRecentDeals(workspaceId, supabase)])
    : [{ open_deals: 0, total_value: 0, won_this_month: 0, won_value_this_month: 0, overdue_tasks: 0, total_contacts: 0 }, []]

  const firstName = user.user_metadata?.full_name?.split(' ')[0] || 'there'

  const statCards = [
    {
      label: 'Open Deals',
      value: stats.open_deals,
      sub: formatCurrency(stats.total_value) + ' total value',
      icon: TrendingUp,
      color: 'text-brand-600',
      bg: 'bg-brand-50',
      trend: null,
    },
    {
      label: 'Won This Month',
      value: stats.won_this_month,
      sub: formatCurrency(stats.won_value_this_month) + ' closed',
      icon: DollarSign,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      trend: 'up',
    },
    {
      label: 'Total Contacts',
      value: stats.total_contacts,
      sub: 'People & companies',
      icon: Users,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
      trend: null,
    },
    {
      label: 'Overdue Tasks',
      value: stats.overdue_tasks,
      sub: stats.overdue_tasks > 0 ? 'Needs attention' : 'All caught up!',
      icon: CheckSquare,
      color: stats.overdue_tasks > 0 ? 'text-amber-600' : 'text-emerald-600',
      bg: stats.overdue_tasks > 0 ? 'bg-amber-50' : 'bg-emerald-50',
      trend: stats.overdue_tasks > 0 ? 'down' : null,
    },
  ]

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Good morning, {firstName} 👋</h1>
          <p className="text-surface-500 text-sm mt-0.5">Here's what's happening with your sales today.</p>
        </div>
        <Link href="/pipeline" className="btn-primary">
          <Plus className="w-4 h-4" /> New Deal
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(({ label, value, sub, icon: Icon, color, bg, trend }) => (
          <div key={label} className="stat-card animate-slide-up">
            <div className="flex items-start justify-between">
              <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              {trend === 'up' && <div className="flex items-center gap-0.5 text-emerald-600 text-xs font-semibold"><ArrowUpRight className="w-3.5 h-3.5" /></div>}
              {trend === 'down' && <div className="flex items-center gap-0.5 text-amber-600 text-xs font-semibold"><AlertCircle className="w-3.5 h-3.5" /></div>}
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold text-surface-900">{typeof value === 'number' && label !== 'Open Deals' && label !== 'Total Contacts' ? value : value}</p>
              <p className="text-xs font-semibold text-surface-500 mt-0.5">{label}</p>
            </div>
            <p className="text-xs text-surface-400">{sub}</p>
          </div>
        ))}
      </div>

      {/* Recent deals + quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent deals */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-surface-900">Recent Deals</h2>
            <Link href="/pipeline" className="text-xs text-brand-600 font-semibold hover:text-brand-700 transition-colors">View all →</Link>
          </div>

          {recentDeals.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-12 h-12 bg-surface-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <TrendingUp className="w-6 h-6 text-surface-400" />
              </div>
              <p className="text-surface-500 text-sm font-medium">No deals yet</p>
              <p className="text-surface-400 text-xs mt-1">Create your first deal to get started</p>
              <Link href="/pipeline" className="btn-primary btn-sm mt-4 inline-flex">
                <Plus className="w-3.5 h-3.5" /> Add Deal
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentDeals.map((deal: any) => (
                <Link key={deal.id} href={`/pipeline?deal=${deal.id}`}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-50 transition-colors group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      deal.status === 'won' ? 'bg-emerald-400' :
                      deal.status === 'lost' ? 'bg-red-400' : 'bg-brand-400'
                    }`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-surface-800 truncate group-hover:text-brand-600 transition-colors">{deal.title}</p>
                      {deal.contacts?.name && <p className="text-xs text-surface-400 truncate">{deal.contacts.name}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    {deal.value && <span className="text-sm font-semibold text-surface-700">{formatCurrency(deal.value)}</span>}
                    <span className={`badge text-[10px] ${
                      deal.status === 'won' ? 'badge-green' :
                      deal.status === 'lost' ? 'badge-red' : 'badge-blue'
                    }`}>{deal.status}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="font-semibold text-surface-900 mb-3">Quick Actions</h2>
            <div className="space-y-2">
              {[
                { label: 'Add new deal', href: '/pipeline', icon: TrendingUp, color: 'bg-brand-50 text-brand-600' },
                { label: 'Add contact', href: '/contacts', icon: Users, color: 'bg-violet-50 text-violet-600' },
                { label: 'Schedule task', href: '/tasks', icon: CheckSquare, color: 'bg-amber-50 text-amber-600' },
              ].map(({ label, href, icon: Icon, color }) => (
                <Link key={label} href={href}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-50 transition-colors group">
                  <div className={`w-8 h-8 ${color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-surface-700 group-hover:text-surface-900 transition-colors">{label}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-surface-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>
          </div>

          {/* Setup checklist */}
          <div className="card p-5 border-brand-100 bg-gradient-to-br from-brand-50 to-white">
            <h2 className="font-semibold text-surface-900 mb-1">🚀 Get started</h2>
            <p className="text-xs text-surface-500 mb-3">Complete your setup to unlock FlowCRM's power</p>
            <div className="space-y-2">
              {[
                { label: 'Create your first pipeline', done: false, href: '/settings' },
                { label: 'Add team members', done: false, href: '/settings' },
                { label: 'Import contacts', done: false, href: '/contacts' },
              ].map(({ label, done, href }) => (
                <Link key={label} href={href} className="flex items-center gap-2.5 group">
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${done ? 'bg-emerald-500 border-emerald-500' : 'border-surface-300 group-hover:border-brand-400'}`}>
                    {done && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </div>
                  <span className={`text-xs transition-colors ${done ? 'line-through text-surface-400' : 'text-surface-600 group-hover:text-brand-600'}`}>{label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
