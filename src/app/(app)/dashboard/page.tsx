import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import DashboardClient from '@/components/dashboard/DashboardClient'
import AICommandCenter from '@/components/dashboard/AICommandCenter'
import GettingStarted from '@/components/dashboard/GettingStarted'
import DashboardWidgets from '@/components/dashboard/DashboardWidgets'
import CallMetricsWidget from '@/components/shared/CallMetricsWidget'
import DashboardCharts from '@/components/dashboard/DashboardCharts'
import { getIndustryKPIs } from '@/lib/ai/industry-kpis'
import { SupabaseClient } from '@supabase/supabase-js'
import type { DbRow } from '@/types'

type DashboardRecord = DbRow

async function getData(userId: string, supabase: SupabaseClient) {
  // Read active workspace from cookie (server-side) or fallback to first
  const cookieStore = cookies()
  const activeWsId = cookieStore.get('tracktio_ws')?.value

  let ws: DashboardRecord | null = null
  if (activeWsId) {
    const { data } = await supabase.from('workspaces').select('id, terminology, industry, name, enabled_modules').eq('id', activeWsId).eq('owner_id', userId).single()
    ws = data
  }
  if (!ws) {
    const { data } = await supabase.from('workspaces').select('id, terminology, industry, name, enabled_modules').eq('owner_id', userId).order('created_at').limit(1).single()
    ws = data
  }
  if (!ws) return null

  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const safeQuery = async (query: PromiseLike<{ data: DashboardRecord[] | null }>) => {
    const res = await query
    return res?.data || []
  }

  const [deals, wonDeals, wonDealsLastMonth, overdueTasks, contacts, quotes, invoices, products, employees, socialLeads, firstActivities, recentDeals] = await Promise.all([
    safeQuery(supabase.from('deals').select('id, value, status, probability, updated_at, created_at').eq('workspace_id', ws.id)),
    safeQuery(supabase.from('deals').select('id, value').eq('workspace_id', ws.id).eq('status', 'won').gte('updated_at', firstOfMonth)),
    safeQuery(supabase.from('deals').select('id, value').eq('workspace_id', ws.id).eq('status', 'won').gte('updated_at', firstOfLastMonth).lte('updated_at', endOfLastMonth)),
    safeQuery(supabase.from('activities').select('id').eq('workspace_id', ws.id).eq('done', false).lte('due_date', now.toISOString())),
    safeQuery(supabase.from('contacts').select('id, score_label').eq('workspace_id', ws.id)),
    safeQuery(supabase.from('quotes').select('id, total, status').eq('workspace_id', ws.id)),
    safeQuery(supabase.from('invoices').select('id, total, balance_due, status').eq('workspace_id', ws.id)),
    safeQuery(supabase.from('products').select('id, stock_quantity, min_stock, unit_price, cost_price, status').eq('workspace_id', ws.id).eq('status', 'active')),
    safeQuery(supabase.from('employees').select('id, salary, salary_period, status').eq('workspace_id', ws.id).eq('status', 'active')),
    safeQuery(supabase.from('social_leads').select('id, platform, status, contact_id, created_at').eq('workspace_id', ws.id)),
    safeQuery(supabase.from('activities').select('contact_id, created_at').eq('workspace_id', ws.id).order('created_at', { ascending: true })),
    // Last 7 days of won deals for trend chart
    safeQuery(supabase.from('deals').select('value, updated_at').eq('workspace_id', ws.id).eq('status', 'won').gte('updated_at', sevenDaysAgo)),
  ])

  const openDeals = deals.filter((d) => d.status === 'open')
  const term = (ws.terminology as Record<string, { singular?: string; plural?: string }>) || {}

  // Enabled modules
  const enabledMods = ws.enabled_modules as Record<string, boolean> | null

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

  // MoM comparison
  const wonThisMonthValue = wonDeals.reduce((s: number, d) => s + ((d.value as number) || 0), 0)
  const wonLastMonthValue = wonDealsLastMonth.reduce((s: number, d) => s + ((d.value as number) || 0), 0)
  const momChange = wonLastMonthValue > 0 ? Math.round(((wonThisMonthValue - wonLastMonthValue) / wonLastMonthValue) * 100) : 0

  // Response time
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

  // Trend data: daily won deal values for last 7 days
  const trendData: { day: string; value: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    const dayStr = d.toLocaleDateString('en', { weekday: 'short' })
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    const dayEnd = dayStart + 24 * 60 * 60 * 1000
    const dayValue = recentDeals
      .filter(deal => {
        const t = new Date(deal.updated_at as string).getTime()
        return t >= dayStart && t < dayEnd
      })
      .reduce((s: number, deal) => s + ((deal.value as number) || 0), 0)
    trendData.push({ day: dayStr, value: dayValue })
  }

  // Contextual alerts
  const alerts: { text: string; href: string; type: 'warning' | 'info' | 'success' }[] = []
  const unrepliedLeads = socialLeads.filter(l => l.status === 'new').length
  if (unrepliedLeads > 0) alerts.push({ text: `${unrepliedLeads} leads sin responder`, href: '/leads', type: 'warning' })
  if (atRiskDeals > 0) alerts.push({ text: `${atRiskDeals} deals at risk (>7d sin actividad)`, href: '/pipeline', type: 'warning' })
  if (overdueTasks.length > 0) alerts.push({ text: `${overdueTasks.length} tareas vencidas`, href: '/tasks', type: 'warning' })
  const lowStockCount = products.filter((p) => (p.stock_quantity as number) <= (p.min_stock as number)).length
  if (lowStockCount > 0) alerts.push({ text: `${lowStockCount} productos con stock bajo`, href: '/inventory', type: 'warning' })

  // Finance metrics
  const outstandingInvoices = invoices.filter((i) => ['sent', 'partial', 'overdue'].includes(i.status as string))
  const totalOutstanding = outstandingInvoices.reduce((s: number, i) => s + ((i.balance_due as number) || 0), 0)
  const collectedThisMonth = invoices.filter((i) => i.status === 'paid').reduce((s: number, i) => s + ((i.total as number) || 0), 0)

  // Inventory metrics
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
  try { industryKPIs = await getIndustryKPIs(supabase, ws.id as string, (ws.industry as string) || 'generic') } catch {}

  return {
    workspaceId: ws.id as string,
    workspaceName: ws.name as string,
    industry: ws.industry as string,
    enabledModules: enabledMods,
    dealLabel: term.deal?.plural || 'Deals',
    contactLabel: term.contact?.plural || 'Contacts',
    industryKPIs,
    trendData,
    alerts,
    momChange,
    crm: {
      pipelineValue: openDeals.reduce((s: number, d) => s + ((d.value as number) || 0), 0),
      openDeals: openDeals.length,
      wonThisMonth: wonDeals.length,
      wonValue: wonThisMonthValue,
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

function getGreeting(name: string): string {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'
  return name ? `${greeting}, ${name}` : greeting
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const data = await getData(user.id, supabase)
  if (!data) return null

  const firstName = user.user_metadata?.full_name?.split(' ')[0] || ''
  const isModuleEnabled = (mod: string) => !data.enabledModules || (data.enabledModules as Record<string, boolean>)[mod] !== false

  return (
    <div className="animate-fade-in">
      <DashboardClient />
      <GettingStarted />

      {/* Personalized greeting */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-surface-900 dark:text-surface-50">{getGreeting(firstName)}</h1>
        {data.alerts.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {data.alerts.map((alert, i) => (
              <Link key={i} href={alert.href}
                className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                  alert.type === 'warning' ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20' :
                  alert.type === 'success' ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20' :
                  'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20'
                }`}>
                {alert.type === 'warning' ? '⚠️' : alert.type === 'success' ? '✅' : 'ℹ️'} {alert.text}
              </Link>
            ))}
          </div>
        )}
      </div>

      <DashboardWidgets
        kpis={<>
          {data.industryKPIs.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {data.industryKPIs.slice(0, 6).map((kpi) => (
              <div key={kpi.key || kpi.label} className="card p-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-surface-50 dark:bg-surface-800 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">{kpi.icon || '📊'}</div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-surface-900 dark:text-surface-50 leading-tight">{kpi.value}</p>
                    <p className="text-[10px] text-surface-500 font-semibold uppercase truncate">{kpi.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}

          {/* Conversion & Performance KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="card p-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-blue-50 dark:bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">🎯</div>
                <div className="min-w-0">
                  <p className="text-lg font-bold text-surface-900 dark:text-surface-50 leading-tight">{data.crm.leadConversionRate}%</p>
                  <p className="text-[10px] text-surface-500 font-semibold uppercase truncate">Lead Conversion</p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">🏆</div>
                <div className="min-w-0">
                  <p className="text-lg font-bold text-surface-900 dark:text-surface-50 leading-tight">{data.crm.dealWinRate}%</p>
                  <p className="text-[10px] text-surface-500 font-semibold uppercase truncate">Win Rate</p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-violet-50 dark:bg-violet-500/10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">💎</div>
                <div className="min-w-0">
                  <p className="text-lg font-bold text-surface-900 dark:text-surface-50 leading-tight">{formatCurrency(data.crm.avgWonDealValue)}</p>
                  <p className="text-[10px] text-surface-500 font-semibold uppercase truncate">Avg Deal Value</p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-amber-50 dark:bg-amber-500/10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">⏱️</div>
                <div className="min-w-0">
                  <p className="text-lg font-bold text-surface-900 dark:text-surface-50 leading-tight">{data.crm.avgResponseTimeHours > 0 ? `${data.crm.avgResponseTimeHours}h` : '--'}</p>
                  <p className="text-[10px] text-surface-500 font-semibold uppercase truncate">Avg Response Time</p>
                </div>
              </div>
            </div>
          </div>

          {/* Call metrics widget */}
          {data.workspaceId && <CallMetricsWidget workspaceId={data.workspaceId} />}

          {/* Trend chart + Leads by source side by side */}
          <DashboardCharts
            trendData={data.trendData}
            leadsByPlatform={data.crm.leadsByPlatform}
          />
        </>}
        ai={<AICommandCenter />}
        modules={
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-8">

        {/* CRM Module — always visible */}
        <Link href="/pipeline" className="card-interactive p-5 group">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-50">Sales / CRM</h3>
            <span className="text-lg">🔀</span>
          </div>
          <div className="space-y-2.5">
            <div className="flex justify-between">
              <span className="text-xs text-surface-500">Pipeline</span>
              <span className="text-xs font-bold text-surface-900 dark:text-surface-50">{formatCurrency(data.crm.pipelineValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-surface-500">Won this month</span>
              <span className="text-xs font-bold text-emerald-600">
                {formatCurrency(data.crm.wonValue)}
                {data.momChange !== 0 && (
                  <span className={`ml-1 text-[10px] ${data.momChange > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {data.momChange > 0 ? '↑' : '↓'}{Math.abs(data.momChange)}%
                  </span>
                )}
              </span>
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
        {isModuleEnabled('invoicing') && (
        <Link href="/invoices" className="card-interactive p-5 group">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-50">Finance</h3>
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
        )}

        {/* Inventory Module */}
        {isModuleEnabled('inventory') && (
        <Link href="/inventory" className="card-interactive p-5 group">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-50">Inventory</h3>
            <span className="text-lg">📦</span>
          </div>
          <div className="space-y-2.5">
            <div className="flex justify-between">
              <span className="text-xs text-surface-500">Stock value</span>
              <span className="text-xs font-bold text-surface-900 dark:text-surface-50">{formatCurrency(data.inventory.inventoryValue)}</span>
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
        )}

        {/* HR Module */}
        {isModuleEnabled('hr') && (
        <Link href="/hr" className="card-interactive p-5 group">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-50">Human Resources</h3>
            <span className="text-lg">👥</span>
          </div>
          <div className="space-y-2.5">
            <div className="flex justify-between">
              <span className="text-xs text-surface-500">Employees</span>
              <span className="text-xs font-bold">{data.hr.employees}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-surface-500">Monthly payroll</span>
              <span className="text-xs font-bold text-surface-900 dark:text-surface-50">{formatCurrency(data.hr.monthlyPayroll)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-surface-500">Overdue tasks</span>
              <span className="text-xs font-bold">{data.crm.overdueTasks}</span>
            </div>
          </div>
        </Link>
        )}
      </div>

        }
        actions={
          <div className="flex gap-3 mt-8 flex-wrap">
            <Link href="/pipeline" className="flex items-center gap-2.5 px-4 py-2.5 card-interactive text-sm font-medium text-surface-700">
              <span>🔀</span> Nuevo {(data.dealLabel || 'Deal').replace(/s$/i, '')}
            </Link>
            <Link href="/contacts" className="flex items-center gap-2.5 px-4 py-2.5 card-interactive text-sm font-medium text-surface-700">
              <span>👤</span> Nuevo Contacto
            </Link>
            {isModuleEnabled('invoicing') && (
              <Link href="/invoices" className="flex items-center gap-2.5 px-4 py-2.5 card-interactive text-sm font-medium text-surface-700">
                <span>🧾</span> Nueva Factura
              </Link>
            )}
            <Link href="/quotes" className="flex items-center gap-2.5 px-4 py-2.5 card-interactive text-sm font-medium text-surface-700">
              <span>📄</span> Nueva Cotización
            </Link>
            <Link href="/leads" className="flex items-center gap-2.5 px-4 py-2.5 card-interactive text-sm font-medium text-surface-700">
              <span>📸</span> Ver Leads
            </Link>
          </div>
        }
      />
    </div>
  )
}
