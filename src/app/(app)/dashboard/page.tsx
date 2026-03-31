import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import DashboardClient from '@/components/dashboard/DashboardClient'
import AICommandCenter from '@/components/dashboard/AICommandCenter'
import { getIndustryKPIs } from '@/lib/ai/industry-kpis'

async function getData(userId: string, supabase: any) {
  const { data: ws } = await supabase.from('workspaces').select('id, terminology, industry, name').eq('owner_id', userId).single()
  if (!ws) return null

  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // Parallel fetch all ERP data
  const [
    dealsRes, wonRes, tasksRes, contactsRes, quotesRes,
    invoicesRes, productsRes, employeesRes,
  ] = await Promise.all([
    supabase.from('deals').select('id, value, status, ai_risk').eq('workspace_id', ws.id),
    supabase.from('deals').select('id, value').eq('workspace_id', ws.id).eq('status', 'won').gte('updated_at', firstOfMonth),
    supabase.from('activities').select('id').eq('workspace_id', ws.id).eq('done', false).lte('due_date', now.toISOString()),
    supabase.from('contacts').select('id, score_label').eq('workspace_id', ws.id),
    supabase.from('quotes').select('id, total, status').eq('workspace_id', ws.id),
    supabase.from('invoices').select('id, total, balance_due, status').eq('workspace_id', ws.id).catch(() => ({ data: [] })),
    supabase.from('products').select('id, stock_quantity, min_stock, unit_price, cost_price, status').eq('workspace_id', ws.id).eq('status', 'active').catch(() => ({ data: [] })),
    supabase.from('employees').select('id, salary, salary_period, status').eq('workspace_id', ws.id).eq('status', 'active').catch(() => ({ data: [] })),
  ])

  const deals = dealsRes.data || []
  const openDeals = deals.filter((d: any) => d.status === 'open')
  const wonDeals = wonRes.data || []
  const contacts = contactsRes.data || []
  const quotes = quotesRes.data || []
  const invoices = (invoicesRes as any).data || []
  const products = (productsRes as any).data || []
  const employees = (employeesRes as any).data || []
  const term = (ws.terminology as any) || {}

  // CRM metrics
  const hotContacts = contacts.filter((c: any) => c.score_label === 'hot').length
  const atRiskDeals = deals.filter((d: any) => d.ai_risk === 'critical' || d.ai_risk === 'at_risk').length

  // Finance metrics
  const outstandingInvoices = invoices.filter((i: any) => ['sent', 'partial', 'overdue'].includes(i.status))
  const totalOutstanding = outstandingInvoices.reduce((s: number, i: any) => s + (i.balance_due || 0), 0)
  const collectedThisMonth = invoices.filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + (i.total || 0), 0)

  // Inventory metrics
  const lowStockCount = products.filter((p: any) => p.stock_quantity <= p.min_stock).length
  const inventoryValue = products.reduce((s: number, p: any) => s + (p.stock_quantity * p.cost_price), 0)

  // HR metrics
  const monthlyPayroll = employees.reduce((s: number, e: any) => {
    let monthly = e.salary || 0
    if (e.salary_period === 'annual') monthly /= 12
    if (e.salary_period === 'weekly') monthly *= 4.33
    return s + monthly
  }, 0)

  // Industry KPIs
  let industryKPIs: any[] = []
  try { industryKPIs = await getIndustryKPIs(supabase, ws.id, ws.industry || 'generic') } catch {}

  return {
    workspaceName: ws.name,
    industry: ws.industry,
    dealLabel: term.deal?.plural || 'Deals',
    contactLabel: term.contact?.plural || 'Contacts',
    industryKPIs,
    crm: {
      pipelineValue: openDeals.reduce((s: number, d: any) => s + (d.value || 0), 0),
      openDeals: openDeals.length,
      wonThisMonth: wonDeals.length,
      wonValue: wonDeals.reduce((s: number, d: any) => s + (d.value || 0), 0),
      contacts: contacts.length,
      hotContacts,
      atRiskDeals,
      overdueTasks: tasksRes.data?.length || 0,
      pendingQuotes: quotes.filter((q: any) => q.status === 'sent').length,
    },
    finance: {
      totalOutstanding,
      outstandingCount: outstandingInvoices.length,
      collected: collectedThisMonth,
      overdueInvoices: invoices.filter((i: any) => i.status === 'overdue').length,
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

      {/* Industry KPIs */}
      {data.industryKPIs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {data.industryKPIs.slice(0, 6).map((kpi: any) => (
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

      {/* AI Command Center */}
      <AICommandCenter />

      {/* ERP Module Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-6">

        {/* CRM Module */}
        <Link href="/pipeline" className="card p-5 hover:shadow-card-hover transition-all group">
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
        <Link href="/invoices" className="card p-5 hover:shadow-card-hover transition-all group">
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
        <Link href="/inventory" className="card p-5 hover:shadow-card-hover transition-all group">
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
        <Link href="/hr" className="card p-5 hover:shadow-card-hover transition-all group">
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

      {/* Quick Actions */}
      <div className="flex gap-2 mt-6">
        {quickActions.map(a => (
          <Link key={a.label} href={a.href}
            className="flex items-center gap-2 px-4 py-2.5 card hover:shadow-card-hover transition-all text-sm font-medium text-surface-700">
            <span>{a.icon}</span> {a.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
