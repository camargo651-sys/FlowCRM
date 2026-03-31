import { createCrudHandlers } from '@/lib/api/crud'
import { authenticateRequest, apiSuccess, apiError } from '@/lib/api/auth'
import { NextRequest } from 'next/server'

const crud = createCrudHandlers({
  table: 'payroll_runs',
  searchFields: [],
  selectFields: '*, payslips(*, employees(first_name, last_name))',
  allowedFilters: ['status'],
  defaultSort: 'period_start',
})

export const { GET, DELETE } = crud

// POST: Create payroll run and auto-generate payslips
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth instanceof Response) return auth

  const body = await request.json()
  body.workspace_id = auth.workspaceId

  // Create payroll run
  const { data: run, error } = await auth.supabase.from('payroll_runs').insert(body).select().single()
  if (error) return apiError(error.message, 400)

  // Get active employees
  const { data: employees } = await auth.supabase
    .from('employees')
    .select('id, salary, salary_period')
    .eq('workspace_id', auth.workspaceId)
    .eq('status', 'active')

  if (employees?.length) {
    const payslips = employees.map((emp: any) => {
      // Normalize salary to period
      let grossSalary = emp.salary || 0
      if (emp.salary_period === 'annual') grossSalary = grossSalary / 12
      if (emp.salary_period === 'biweekly') grossSalary = grossSalary * 2
      if (emp.salary_period === 'weekly') grossSalary = grossSalary * 4.33

      // Simple deductions (customizable per workspace later)
      const deductions = [
        { name: 'Income Tax', amount: grossSalary * 0.15, type: 'tax' },
        { name: 'Social Security', amount: grossSalary * 0.0625, type: 'social' },
        { name: 'Health Insurance', amount: grossSalary * 0.03, type: 'health' },
      ]
      const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0)

      return {
        payroll_run_id: run.id,
        employee_id: emp.id,
        gross_salary: Math.round(grossSalary * 100) / 100,
        deductions,
        total_deductions: Math.round(totalDeductions * 100) / 100,
        net_salary: Math.round((grossSalary - totalDeductions) * 100) / 100,
      }
    })

    await auth.supabase.from('payslips').insert(payslips)

    // Update run totals
    const totalGross = payslips.reduce((s: number, p: any) => s + p.gross_salary, 0)
    const totalDed = payslips.reduce((s: number, p: any) => s + p.total_deductions, 0)
    await auth.supabase.from('payroll_runs').update({
      total_gross: totalGross,
      total_deductions: totalDed,
      total_net: totalGross - totalDed,
      employee_count: payslips.length,
    }).eq('id', run.id)
  }

  // Fetch complete run
  const { data: complete } = await auth.supabase
    .from('payroll_runs')
    .select('*, payslips(*, employees(first_name, last_name))')
    .eq('id', run.id)
    .single()

  return apiSuccess(complete)
}

export const PUT = crud.PUT
