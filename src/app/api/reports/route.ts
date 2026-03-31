import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

function getSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )
}

export async function GET(request: NextRequest) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: ws } = await supabase.from('workspaces').select('id, name').eq('owner_id', user.id).single()
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const url = new URL(request.url)
  const reportType = url.searchParams.get('type')
  const startDate = url.searchParams.get('start') || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
  const endDate = url.searchParams.get('end') || new Date().toISOString().split('T')[0]

  // Get all accounts
  const { data: accounts } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('workspace_id', ws.id)
    .eq('active', true)
    .order('code')

  const accs = accounts || []

  if (reportType === 'pnl' || reportType === 'profit_loss') {
    // Revenue accounts
    const revenue = accs.filter(a => a.type === 'revenue').map(a => ({
      code: a.code, name: a.name, balance: Math.abs(a.balance || 0),
    }))
    const totalRevenue = revenue.reduce((s, a) => s + a.balance, 0)

    // Expense accounts
    const expenses = accs.filter(a => a.type === 'expense').map(a => ({
      code: a.code, name: a.name, balance: Math.abs(a.balance || 0),
    }))
    const totalExpenses = expenses.reduce((s, a) => s + a.balance, 0)

    // Also include invoice/payment data for period
    const { data: invoices } = await supabase.from('invoices')
      .select('total, amount_paid, status')
      .eq('workspace_id', ws.id)
      .gte('issue_date', startDate)
      .lte('issue_date', endDate)

    const { data: payments } = await supabase.from('payments')
      .select('amount, status')
      .eq('workspace_id', ws.id)
      .eq('status', 'completed')
      .gte('payment_date', startDate)
      .lte('payment_date', endDate)

    const invoiceRevenue = (invoices || []).reduce((s, i) => s + (i.total || 0), 0)
    const collectedPayments = (payments || []).reduce((s, p) => s + (p.amount || 0), 0)

    return NextResponse.json({
      report: 'Profit & Loss',
      period: { start: startDate, end: endDate },
      revenue: { accounts: revenue, total: totalRevenue },
      expenses: { accounts: expenses, total: totalExpenses },
      net_income: totalRevenue - totalExpenses,
      invoiced: invoiceRevenue,
      collected: collectedPayments,
      gross_margin: totalRevenue > 0 ? Math.round((totalRevenue - totalExpenses) / totalRevenue * 100) : 0,
    })
  }

  if (reportType === 'balance_sheet') {
    const assets = accs.filter(a => a.type === 'asset').map(a => ({ code: a.code, name: a.name, balance: a.balance || 0 }))
    const liabilities = accs.filter(a => a.type === 'liability').map(a => ({ code: a.code, name: a.name, balance: Math.abs(a.balance || 0) }))
    const equity = accs.filter(a => a.type === 'equity').map(a => ({ code: a.code, name: a.name, balance: Math.abs(a.balance || 0) }))

    const totalAssets = assets.reduce((s, a) => s + a.balance, 0)
    const totalLiabilities = liabilities.reduce((s, a) => s + a.balance, 0)
    const totalEquity = equity.reduce((s, a) => s + a.balance, 0)

    // Add retained earnings (revenue - expenses)
    const retainedEarnings = accs.filter(a => a.type === 'revenue').reduce((s, a) => s + Math.abs(a.balance || 0), 0)
      - accs.filter(a => a.type === 'expense').reduce((s, a) => s + Math.abs(a.balance || 0), 0)

    return NextResponse.json({
      report: 'Balance Sheet',
      as_of: endDate,
      assets: { accounts: assets, total: totalAssets },
      liabilities: { accounts: liabilities, total: totalLiabilities },
      equity: {
        accounts: [...equity, { code: 'RE', name: 'Retained Earnings', balance: retainedEarnings }],
        total: totalEquity + retainedEarnings,
      },
      total_liabilities_equity: totalLiabilities + totalEquity + retainedEarnings,
      balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity + retainedEarnings)) < 0.01,
    })
  }

  if (reportType === 'cashflow') {
    const { data: payments } = await supabase.from('payments')
      .select('amount, method, payment_date, status')
      .eq('workspace_id', ws.id)
      .eq('status', 'completed')
      .gte('payment_date', startDate)
      .lte('payment_date', endDate)
      .order('payment_date')

    // Group by month
    const monthly: Record<string, { inflow: number; outflow: number }> = {}
    for (const p of payments || []) {
      const month = p.payment_date.slice(0, 7)
      if (!monthly[month]) monthly[month] = { inflow: 0, outflow: 0 }
      monthly[month].inflow += p.amount || 0
    }

    // Add purchase orders as outflows
    const { data: pos } = await supabase.from('purchase_orders')
      .select('total, received_at')
      .eq('workspace_id', ws.id)
      .eq('status', 'received')
      .gte('received_at', startDate)
      .lte('received_at', endDate)

    for (const po of pos || []) {
      const month = (po.received_at || '').slice(0, 7)
      if (month && !monthly[month]) monthly[month] = { inflow: 0, outflow: 0 }
      if (month) monthly[month].outflow += po.total || 0
    }

    // Payroll as outflows
    const { data: payrolls } = await supabase.from('payroll_runs')
      .select('total_net, period_end')
      .eq('workspace_id', ws.id)
      .eq('status', 'completed')

    for (const pr of payrolls || []) {
      const month = (pr.period_end || '').slice(0, 7)
      if (month && !monthly[month]) monthly[month] = { inflow: 0, outflow: 0 }
      if (month) monthly[month].outflow += pr.total_net || 0
    }

    const cashflow = Object.entries(monthly).sort().map(([month, data]) => ({
      month, inflow: data.inflow, outflow: data.outflow, net: data.inflow - data.outflow,
    }))

    const totalInflow = cashflow.reduce((s, c) => s + c.inflow, 0)
    const totalOutflow = cashflow.reduce((s, c) => s + c.outflow, 0)

    return NextResponse.json({
      report: 'Cash Flow',
      period: { start: startDate, end: endDate },
      monthly: cashflow,
      total_inflow: totalInflow,
      total_outflow: totalOutflow,
      net_cashflow: totalInflow - totalOutflow,
    })
  }

  return NextResponse.json({ error: 'Invalid report type. Use: pnl, balance_sheet, cashflow' }, { status: 400 })
}
