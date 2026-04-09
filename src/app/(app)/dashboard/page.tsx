import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import DashboardClient from '@/components/dashboard/DashboardClient'
import AICommandCenter from '@/components/dashboard/AICommandCenter'
import GettingStarted from '@/components/dashboard/GettingStarted'
import DashboardWidgets from '@/components/dashboard/DashboardWidgets'
import { getIndustryKPIs } from '@/lib/ai/industry-kpis'
import { SupabaseClient } from '@supabase/supabase-js'
import type { DbRow } from '@/types'

type DashboardRecord = DbRow

async function getData(userId: string, supabase: SupabaseClient) {
  const { data: ws } = await supabase.from('workspaces').select('id, terminology, industry, name').eq('owner_id', userId).single()
  if (!ws) return null

  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // Parallel fetch all ERP data
  // Safe query helper — returns empty array if table doesn't exist
  const safeQuery = async (query: PromiseLike<{ data: DashboardRecord[] | null }>) => {
    const res = await query
    return res?.data || []
  }

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [deals, wonDeals, overdueTasks, contacts, quotes, invoices, products, employees, socialLeads, firstActivities] = await Promise.all([
    safeQuery(supabase.from('deals').select('id, value, status, probability, updated_at, created_at').eq('workspace_id', ws.id)),
    safeQuery(supabase.from('deals').select('id, value').eq('workspace_id', ws.id).eq('status', 'won').gte('updated_at', firstOfMonth)),
    safeQuery(supabase.from('activities').select('id').eq('workspace_id', ws.id).eq('done', false).lte('due_date', now.toISOString())),
    safeQuery(supabase.from('contacts').select('id, score_label').eq('workspace_id', ws.id)),
    safeQuery(supabase.from('quotes').select('id, total, status').eq('workspace_id', ws.id)),
    safeQuery(supabase.from('invoices').select('id, total, balance_due, status').eq('workspace_id', ws.id)),
    safeQuery(supabase.from('products').select('id, stock_quantity, min_stock, unit_price, cost_price, status').eq('workspace_id', ws.id).eq('status', 'active')),
    safeQuery(supabase.from('employees').select('id, salary, salary_period, status').eq('workspace_id', ws.id).eq('status', 'active')),
    safeQuery(supabase.from('social_leads').select('id, platform, status, contact_id, created_at').eq('workspace_id', ws.id)),
    safeQuery(supabase.from('activities').select('contact_id, created_at').eq('workspace_id', ws.id).order('created_at', { ascending: true })),
  ])

  const openDeals = deals.filter((d) => d.status === 'open')
  const term = (ws.terminology as Record<string, { singular?: string; plural?: string }>) || {}

  // CRM metrics
  const hotContacts = contacts.filter((c) => c.score_label === 'hot').length
  const atRiskDeals = deals.filter((d) => d.status === 'open' && d.updated_at && new Date(d.updated_at as string) < new Date(sevenDaysAgo)).length

  // Conversion metrics
  const totalSocialLeads = socialLeads.length
  const convertedLeads = socialLeads.filter((l) => l.status === 'converted').length
  const leadConversionRate = totalSocialLeads > 0 ? Math.round((convertedLeads / totalSocialLeads) * 100) : 0
  const closedDeals = deals.filter((d) => d.status === 'won' || d.status === 'lost')
  const wonDealsAll = deals.filter((d) => d.status === 'won')
  const dealWinRate = closedDeals.length > 0 ? Math.round((wonDealsAll.length / closedDeals.length) * 100) : 0
  const avgWonDealValue = wonDealsAll.length > 0 ? wonDealsAll.reduce((s: number, d) => s + ((d.value as number) || 0), 0) / wonDealsAll.length : 0

  // Response time metric: avg time from social_lead.created_at to first activity on linked contact
  const convertedLeadsWithContact = socialLeads.filter((l) => l.contact_id)
  const firstActivityByContact = new Map<string, string>()
  for (const a of firstActivities) {
    if (a.contact_id && !firstActivityByContact.has(a.contact_id as string)) {
      firstActivityByContact.set(a.contact_id as string, a.created_at as string)
    }
  }
  let avgResponseTimeHours = 0
  const responseTimes: number[] = []
  for (const lead of convertedLeadsWithContact) {
    const firstActivity = firstActivityByContact.get(lead.contact_id as string)
    if (firstActivity && lead.created_at) {
      const diff = new Date(firstActivity).getTime() - new Date(lead.created_at as string).getTime()
      if (diff > 0) responseTimes.push(diff)
    }
  }
  if (responseTimes.length > 0) {
    avgResponseTimeHours = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length / (1000 * 60 * 60) * 10) / 10
  }

  // Leads by source
  const leadsByPlatform: Record<string, number> = {}
  for (const lead of socialLeads) {
    const platform = (lead.platform as string) || 'other'
    leadsByPlatform[platform] = (leadsByPlatform[platform] || 0) + 1
  }

  // Finance metrics
  const outstandingInvoices = invoices.filter((i) => ['sent', 'partial', 'overdue'].includes(i.status as string))
  const totalOutstanding = outstandingInvoices.reduce((s: number, i) => s + ((i.balance_due as number) || 0), 0)
  const collectedThisMonth = invoices.filter((i) => i.status === 'paid').reduce((s: number, i) => s + ((i.total as number) || 0), 0)

  // Inventory metrics
  const lowStockCount = products.filter((p) => (p.stock_quantity as number) <= (p.min_stock as number)).length
  const inventoryValue = products.reduce((s: number, p) => s + ((p.stock_quantity as number) * (p.cost_price as number)), 0)

  // HR metrics
  const monthlyPayroll = employees.reduce((s: number, e) => {
    let monthly = (e.salary as number) || 0
    if (e.salary_period === 'annual') monthly /= 12
    if (e.salary_period === 'weekly') monthly *= 4.33
    return s + monthly
  }, 0)

  // Industry KPIs
  let industryKPIs: { key: string; label: string; value: string | number; icon?: string; trend?: string }[] = []
  try { industryKPIs = await getIndustryKPIs(supabase, ws.id, ws.industry || 'generic') } catch {}

  return {
    workspaceName: ws.name,
    industry: ws.industry,
    dealLabel: term.deal?.plural || 'Deals',
    contactLabel: term.contact?.plural || 'Contacts',
    industryKPIs,
    crm: {
      pipelineValue: openDeals.reduce((s: number, d) => s + ((d.value as number) || 0), 0),
      openDeals: openDeals.length,
      wonThisMonth: wonDeals.length,
      wonValue: wonDeals.reduce((s: number, d) => s + ((d.value as number) || 0), 0),
      contacts: contacts.length,
      hotContacts,
      atRiskDeals,
      overdueTasks: overdueTasks.length,
      pendingQuotes: quotes.filter((q) => q.status === 'sent').length,
      leadConversionRate,
      dealWinRate,
      avgWonDealValue,
      avgResponseTimeHours,
      leadsByPlatform,
    },
    finance: {
      totalOutstanding,
      outstandingCount: outstandingInvoices.length,
      collected: collectedThisMonth,
      overdueInvoices: invoices.filter((i) => i.status === 'overdue').length,
    },
    inventory: {
      totalProducts: products.length,
      lowStock: lowStockCount,
      inventoryValue,
    },
    hr: {
      employees: employees.length,
      monthlyPayroll,
    },
  }
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const data = await getData(user.id, supabase)
  if (!data) return null

  const firstName = user.user_metadata?.full_name?.split(' ')[0] || ''

  // Quick action links
  const quickActions = [
    { label: `New ${data.dealLabel.replace(/s$/, '')}`, href: '/pipeline', icon: '🔀' },
    { label: 'New Contact', href: '/contacts', icon: '👤' },
    { label: 'New Invoice', href: '/invoices', icon: '🧾' },
    { label: 'New Quote', href: '/quotes', icon: '📄' },
  ]

  return (
    <div className="animate-fade-in">
      <DashboardClient />
      <GettingStarted />

      <DashboardWidgets
        kpis={<>
          {data.industryKPIs.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {data.industryKPIs.slice(0, 6).map((kpi) => (
              <div key={kpi.key || kpi.label} className="card p-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-surface-50 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">{kpi.icon || '📊'}</div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-surface-900 leading-tight">{kpi.value}</p>
                    <p className="text-[10px] text-surface-500 font-semibold uppercase truncate">{kpi.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}

          {/* Conversion & Performance KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="card p-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">🎯</div>
                <div className="min-w-0">
                  <p className="text-lg font-bold text-surface-900 leading-tight">{data.crm.leadConversionRate}%</p>
                  <p className="text-[10px] text-surface-500 font-semibold uppercase truncate">Lead Conversion</p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">🏆</div>
                <div className="min-w-0">
                  <p className="text-lg font-bold text-surface-900 leading-tight">{data.crm.dealWinRate}%</p>
                  <p className="text-[10px] text-surface-500 font-semibold uppercase truncate">Win Rate</p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">💎</div>
                <div className="min-w-0">
                  <p className="text-lg font-bold text-surface-900 leading-tight">{formatCurrency(data.crm.avgWonDealValue)}</p>
                  <p className="text-[10px] text-surface-500 font-semibold uppercase truncate">Avg Deal Value</p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">⏱️</div>
                <div className="min-w-0">
                  <p className="text-lg font-bold text-surface-900 leading-tight">{data.crm.avgResponseTimeHours > 0 ? `${data.crm.avgResponseTimeHours}h` : '--'}</p>
                  <p className="text-[10px] text-surface-500 font-semibold uppercase truncate">Avg Response Time</p>
                </div>
              </div>
            </div>
          </div>

          {/* Leads by Source */}
          {Object.keys(data.crm.leadsByPlatform).length > 0 && (
            <div className="card p-4 mb-6">
              <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-3">Leads by Source</p>
              <div className="flex items-end gap-3">
                {Object.entries(data.crm.leadsByPlatform).sort(([,a], [,b]) => b - a).map(([platform, count]) => {
                  const maxCount = Math.max(...Object.values(data.crm.leadsByPlatform))
                  const height = Math.max(16, Math.round((count / maxCount) * 64))
                  const icons: Record<string, string> = { instagram: '📸', facebook: '📘', tiktok: '🎵', linkedin: '💼', twitter: '🐦', youtube: '📺' }
                  return (
                    <div key={platform} className="flex flex-col items-center gap-1 flex-1">
                      <span className="text-xs font-bold text-surface-700">{count}</span>
                      <div className="w-full bg-brand-500 rounded-t-md" style={{ height: `${height}px` }} />
                      <span className="text-sm" title={platform}>{icons[platform] || '🌐'}</span>
                      <span className="text-[9px] text-surface-400 font-medium capitalize">{platform}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>}
        ai={<AICommandCenter />}
        modules={
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-8">

        {/* CRM Module */}
        <Link href="/pipeline" className="card-interactive p-5 group">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-surface-900">Sales / CRM</h3>
            <span className="text-lg">🔀</span>
          </div>
          <div className="space-y-2.5">
            <div className="flex justify-between">
              <span className="text-xs text-surface-500">Pipeline</span>
              <span className="text-xs font-bold text-surface-900">{formatCurrency(data.crm.pipelineValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-surface-500">Won this month</span>
              <span className="text-xs font-bold text-emerald-600">{formatCurrency(data.crm.wonValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-surface-500">Open {data.dealLabel.toLowerCase()}</span>
              <span className="text-xs font-bold">{data.crm.openDeals}</span>
            </div>
            {data.crm.hotContacts > 0 && (
              <div className="flex justify-between">
                <span className="text-xs text-surface-500">Hot contacts</span>
                <span className="text-xs font-bold text-red-600">🔥 {data.crm.hotContacts}</span>
              </div>
            )}
            {data.crm.atRiskDeals > 0 && (
              <div className="flex justify-between">
                <span className="text-xs text-surface-500">At risk</span>
                <span className="text-xs font-bold text-amber-600">⚠️ {data.crm.atRiskDeals}</span>
              </div>
            )}
          </div>
        </Link>

        {/* Finance Module */}
        <Link href="/invoices" className="card-interactive p-5 group">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-surface-900">Finance</h3>
            <span className="text-lg">💰</span>
          </div>
          <div className="space-y-2.5">
            <div className="flex justify-between">
              <span className="text-xs text-surface-500">Outstanding</span>
              <span className="text-xs font-bold text-amber-600">{formatCurrency(data.finance.totalOutstanding)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-surface-500">Collected</span>
              <span className="text-xs font-bold text-emerald-600">{formatCurrency(data.finance.collected)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-surface-500">Open invoices</span>
              <span className="text-xs font-bold">{data.finance.outstandingCount}</span>
            </div>
            {data.finance.overdueInvoices > 0 && (
              <div className="flex justify-between">
                <span className="text-xs text-surface-500">Overdue</span>
                <span className="text-xs font-bold text-red-600">🔴 {data.finance.overdueInvoices}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-xs text-surface-500">Pending quotes</span>
              <span className="text-xs font-bold">{data.crm.pendingQuotes}</span>
            </div>
          </div>
        </Link>

        {/* Inventory Module */}
        <Link href="/inventory" className="card-interactive p-5 group">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-surface-900">Inventory</h3>
            <span className="text-lg">📦</span>
          </div>
          <div className="space-y-2.5">
            <div className="flex justify-between">
              <span className="text-xs text-surface-500">Stock value</span>
              <span className="text-xs font-bold text-surface-900">{formatCurrency(data.inventory.inventoryValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-surface-500">Products</span>
              <span className="text-xs font-bold">{data.inventory.totalProducts}</span>
            </div>
            {data.inventory.lowStock > 0 ? (
              <div className="flex justify-between">
                <span className="text-xs text-surface-500">Low stock</span>
                <span className="text-xs font-bold text-red-600">⚠️ {data.inventory.lowStock}</span>
              </div>
            ) : (
              <div className="flex justify-between">
                <span className="text-xs text-surface-500">Stock health</span>
                <span className="text-xs font-bold text-emerald-600">✅ All good</span>
              </div>
            )}
          </div>
        </Link>

        {/* HR Module */}
        <Link href="/hr" className="card-interactive p-5 group">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-surface-900">Human Resources</h3>
            <span className="text-lg">👥</span>
          </div>
          <div className="space-y-2.5">
            <div className="flex justify-between">
              <span className="text-xs text-surface-500">Employees</span>
              <span className="text-xs font-bold">{data.hr.employees}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-surface-500">Monthly payroll</span>
              <span className="text-xs font-bold text-surface-900">{formatCurrency(data.hr.monthlyPayroll)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-surface-500">Overdue tasks</span>
              <span className="text-xs font-bold">{data.crm.overdueTasks}</span>
            </div>
          </div>
        </Link>
      </div>

        }
        actions={
          <div className="flex gap-3 mt-8 flex-wrap">
            {quickActions.map(a => (
              <Link key={a.label} href={a.href}
                className="flex items-center gap-2.5 px-4 py-2.5 card-interactive text-sm font-medium text-surface-700">
                <span>{a.icon}</span> {a.label}
              </Link>
            ))}
          </div>
        }
      />
    </div>
  )
}
