'use client'
import { DbRow } from '@/types'
import { useI18n } from '@/lib/i18n/context'
import { toast } from 'sonner'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Users, Building2, Calendar, DollarSign, X, Search, Clock, CheckCircle2, Download, LayoutGrid, List, Gift, UserCheck, UserX, Palmtree } from 'lucide-react'
import { formatCurrency, cn, getInitials } from '@/lib/utils'
import { getActiveWorkspace } from '@/lib/get-active-workspace'
import { MobileList, MobileListCard, DesktopOnly } from '@/components/shared/MobileListCard'

export default function HRPage() {
  const supabase = createClient()
  const { t } = useI18n()
  interface EmpForm { first_name: string; last_name: string; email: string; phone: string; department_id: string; position: string; employment_type: string; start_date: string; salary: number | string; salary_period: string }
  const [employees, setEmployees] = useState<DbRow[]>([])
  const [departments, setDepartments] = useState<DbRow[]>([])
  const [leaveRequests, setLeaveRequests] = useState<DbRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'employees'|'departments'|'leave'|'payroll'>('employees')
  const [showNewEmployee, setShowNewEmployee] = useState(false)
  const [showNewDept, setShowNewDept] = useState(false)
  const [workspaceId, setWorkspaceId] = useState('')

  // Employee view mode and filters
  const [viewMode, setViewMode] = useState<'table'|'grid'>('table')
  const [deptFilter, setDeptFilter] = useState<string>('all')

  const [empForm, setEmpForm] = useState<EmpForm>({ first_name: '', last_name: '', email: '', phone: '', department_id: '', position: '', employment_type: 'full_time', start_date: '', salary: 0, salary_period: 'monthly' })
  const [deptForm, setDeptForm] = useState({ name: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const ws = await getActiveWorkspace(supabase, user.id, 'id')
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)

    const [empRes, deptRes, leaveRes] = await Promise.all([
      supabase.from('employees').select('*, departments(name)').eq('workspace_id', ws.id).order('last_name'),
      supabase.from('departments').select('*').eq('workspace_id', ws.id).order('name'),
      supabase.from('leave_requests').select('*, employees(first_name, last_name)').eq('workspace_id', ws.id).order('created_at', { ascending: false }).limit(20),
    ])
    setEmployees(empRes.data || [])
    setDepartments(deptRes.data || [])
    setLeaveRequests(leaveRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const createEmployee = async () => {
    if (!empForm.first_name || !empForm.last_name) return
    setSaving(true)
    const num = employees.length + 1
    await supabase.from('employees').insert({
      workspace_id: workspaceId, employee_number: `EMP-${String(num).padStart(4, '0')}`,
      ...empForm, department_id: empForm.department_id || null, salary: parseFloat(String(empForm.salary)) || 0,
    })
    setEmpForm({ first_name: '', last_name: '', email: '', phone: '', department_id: '', position: '', employment_type: 'full_time', start_date: '', salary: 0, salary_period: 'monthly' })
    setShowNewEmployee(false); setSaving(false); toast.success("Saved"); load()
  }

  const createDepartment = async () => {
    if (!deptForm.name) return
    setSaving(true)
    await supabase.from('departments').insert({ workspace_id: workspaceId, name: deptForm.name })
    setDeptForm({ name: '' }); setShowNewDept(false); setSaving(false); toast.success("Saved"); load()
  }

  const updateLeaveStatus = async (id: string, status: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('leave_requests').update({ status, approved_by: user?.id }).eq('id', id)
    load()
  }

  // Export payroll as CSV
  const exportPayrollCSV = () => {
    const rows = [['Employee Number', 'First Name', 'Last Name', 'Department', 'Position', 'Employment Type', 'Salary', 'Period', 'Monthly Equivalent']]
    for (const emp of activeEmployees) {
      let monthly = emp.salary || 0
      if (emp.salary_period === 'annual') monthly /= 12
      if (emp.salary_period === 'weekly') monthly *= 4.33
      if (emp.salary_period === 'hourly') monthly *= 173.33
      rows.push([
        emp.employee_number || '',
        emp.first_name || '',
        emp.last_name || '',
        emp.departments?.name || '',
        emp.position || '',
        emp.employment_type || '',
        String(emp.salary || 0),
        emp.salary_period || '',
        monthly.toFixed(2),
      ])
    }
    const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `payroll_${new Date().toISOString().split('T')[0]}.csv`
    a.click(); URL.revokeObjectURL(url)
    toast.success('Payroll exported')
  }

  const activeEmployees = employees.filter(e => e.status === 'active')
  const totalPayroll = activeEmployees.reduce((s, e) => {
    let monthly = e.salary || 0
    if (e.salary_period === 'annual') monthly /= 12
    if (e.salary_period === 'weekly') monthly *= 4.33
    return s + monthly
  }, 0)

  // Filter employees by department
  const filteredEmployees = deptFilter === 'all' ? employees : employees.filter(e => e.department_id === deptFilter)

  // Birthday alerts - employees with birthdays this month
  const currentMonth = new Date().getMonth() + 1
  const birthdayEmployees = activeEmployees.filter(e => {
    if (!e.date_of_birth) return false
    const birthMonth = new Date(e.date_of_birth).getMonth() + 1
    return birthMonth === currentMonth
  })

  // Attendance / leave summary for today
  const today = new Date().toISOString().split('T')[0]
  const onLeaveToday = leaveRequests.filter(lr => {
    if (lr.status !== 'approved') return false
    return lr.start_date <= today && lr.end_date >= today
  })
  const presentCount = activeEmployees.length - onLeaveToday.length
  const onLeaveCount = onLeaveToday.length

  // Leave balance: 20 days default minus used approved leave days per employee
  const getLeaveBalance = (empId: string) => {
    const DEFAULT_LEAVE_DAYS = 20
    const usedDays = leaveRequests
      .filter(lr => lr.employee_id === empId && lr.status === 'approved')
      .reduce((s, lr) => s + (lr.days || 0), 0)
    return DEFAULT_LEAVE_DAYS - usedDays
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">{t('hr.title')}</h1><p className="text-sm text-surface-500 mt-0.5">{activeEmployees.length} active employees</p></div>
        <div className="flex gap-2">
          <button onClick={() => setShowNewDept(true)} className="btn-secondary btn-sm"><Plus className="w-3.5 h-3.5" /> Department</button>
          <button onClick={() => setShowNewEmployee(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> Employee</button>
        </div>
      </div>

      {/* Stat cards with attendance summary */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        <div className="card p-4 flex items-center gap-3"><div className="w-9 h-9 bg-brand-50 rounded-xl flex items-center justify-center"><Users className="w-4 h-4 text-brand-600" /></div><div><p className="text-lg font-bold">{activeEmployees.length}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Active</p></div></div>
        <div className="card p-4 flex items-center gap-3"><div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center"><Building2 className="w-4 h-4 text-violet-600" /></div><div><p className="text-lg font-bold">{departments.length}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Departments</p></div></div>
        <div className="card p-4 flex items-center gap-3"><div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center"><DollarSign className="w-4 h-4 text-emerald-600" /></div><div><p className="text-lg font-bold">{formatCurrency(totalPayroll)}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Monthly Payroll</p></div></div>
        <div className="card p-4 flex items-center gap-3"><div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center"><UserCheck className="w-4 h-4 text-emerald-600" /></div><div><p className="text-lg font-bold">{presentCount}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Present Today</p></div></div>
        <div className="card p-4 flex items-center gap-3"><div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center"><Palmtree className="w-4 h-4 text-amber-600" /></div><div><p className="text-lg font-bold">{onLeaveCount}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">On Leave</p></div></div>
        <div className="card p-4 flex items-center gap-3"><div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center"><Calendar className="w-4 h-4 text-amber-600" /></div><div><p className="text-lg font-bold">{leaveRequests.filter(l => l.status === 'pending').length}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Pending Leave</p></div></div>
      </div>

      {/* Birthday alerts */}
      {birthdayEmployees.length > 0 && (
        <div className="card p-4 mb-6 border-amber-200 bg-amber-50/30">
          <div className="flex items-center gap-2 mb-2">
            <Gift className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-800">Birthdays This Month</h3>
          </div>
          <div className="flex flex-wrap gap-3">
            {birthdayEmployees.map(emp => (
              <div key={emp.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 shadow-sm">
                <div className="avatar-xs bg-amber-500 text-[10px]">{getInitials(`${emp.first_name} ${emp.last_name}`)}</div>
                <span className="text-sm text-surface-700">{emp.first_name} {emp.last_name}</span>
                <span className="text-[10px] text-surface-400">{new Date(emp.date_of_birth).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="segmented-control mb-8">
        {[{ id: 'employees', label: 'Employees' }, { id: 'departments', label: 'Departments' }, { id: 'leave', label: 'Leave Requests' }, { id: 'payroll', label: 'Payroll' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all', tab === t.id ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500')}>{t.label}</button>
        ))}
      </div>

      {tab === 'employees' && (
        <>
          {/* Filters and view toggle */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <select className="input w-48 text-sm" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
                <option value="all">All Departments</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1 bg-surface-100 rounded-lg p-0.5">
              <button onClick={() => setViewMode('table')} className={cn('p-1.5 rounded-md', viewMode === 'table' ? 'bg-white shadow-sm' : '')}><List className="w-4 h-4 text-surface-600" /></button>
              <button onClick={() => setViewMode('grid')} className={cn('p-1.5 rounded-md', viewMode === 'grid' ? 'bg-white shadow-sm' : '')}><LayoutGrid className="w-4 h-4 text-surface-600" /></button>
            </div>
          </div>

          {filteredEmployees.length === 0 ? (
            <div className="card text-center py-16"><Users className="w-10 h-10 text-surface-300 mx-auto mb-3" /><p className="text-surface-500">No employees found</p></div>
          ) : viewMode === 'grid' ? (
            /* Grid / Card view */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredEmployees.map(emp => (
                <div key={emp.id} className="card p-5 hover:shadow-md transition-shadow">
                  <div className="flex flex-col items-center text-center">
                    <div className="avatar-lg bg-brand-500 mb-3 text-lg">{getInitials(`${emp.first_name} ${emp.last_name}`)}</div>
                    <p className="font-semibold text-surface-900">{emp.first_name} {emp.last_name}</p>
                    <p className="text-xs text-surface-500 mt-0.5">{emp.position || 'No position'}</p>
                    <p className="text-[10px] text-surface-400 mt-0.5">{emp.departments?.name || 'No department'}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <span className={cn('badge text-[10px]', emp.status === 'active' ? 'badge-green' : 'badge-gray')}>{emp.status}</span>
                      <span className="badge badge-gray text-[10px] capitalize">{emp.employment_type?.replace('_', ' ')}</span>
                    </div>
                    <div className="mt-2 text-xs text-surface-400">
                      Leave balance: <span className="font-semibold text-surface-700">{getLeaveBalance(emp.id)} days</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Table view */
            <>
            <MobileList>
              {filteredEmployees.map(emp => (
                <MobileListCard
                  key={emp.id}
                  title={`${emp.first_name} ${emp.last_name}`}
                  subtitle={`${emp.employee_number || ''}${emp.position ? ' · ' + emp.position : ''}`}
                  badge={<span className={cn('badge text-[10px]', emp.status === 'active' ? 'badge-green' : 'badge-gray')}>{emp.status}</span>}
                  meta={<>
                    <span>{emp.departments?.name || '—'}</span>
                    <span>· {formatCurrency(emp.salary)}/{emp.salary_period}</span>
                    <span>· {getLeaveBalance(emp.id)}d leave</span>
                  </>}
                />
              ))}
            </MobileList>
            <DesktopOnly>
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead><tr className="border-b border-surface-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Employee</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden md:table-cell">Position</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden lg:table-cell">Department</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden lg:table-cell">Type</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Salary</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden md:table-cell">Leave Bal.</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Status</th>
                </tr></thead>
                <tbody>
                  {filteredEmployees.map(emp => (
                    <tr key={emp.id} className="border-b border-surface-50 hover:bg-surface-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="avatar-sm bg-brand-500 flex-shrink-0">{getInitials(`${emp.first_name} ${emp.last_name}`)}</div>
                          <div><p className="text-sm font-semibold text-surface-800">{emp.first_name} {emp.last_name}</p><p className="text-[10px] text-surface-400">{emp.employee_number} · {emp.email}</p></div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-surface-600 hidden md:table-cell">{emp.position || '—'}</td>
                      <td className="px-4 py-3 text-xs text-surface-500 hidden lg:table-cell">{emp.departments?.name || '—'}</td>
                      <td className="px-4 py-3 hidden lg:table-cell"><span className="badge badge-gray text-[10px] capitalize">{emp.employment_type?.replace('_', ' ')}</span></td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-surface-900">{formatCurrency(emp.salary)}<span className="text-[10px] text-surface-400">/{emp.salary_period}</span></td>
                      <td className="px-4 py-3 text-center text-sm text-surface-600 hidden md:table-cell">{getLeaveBalance(emp.id)}d</td>
                      <td className="px-4 py-3"><span className={cn('badge text-[10px]', emp.status === 'active' ? 'badge-green' : 'badge-gray')}>{emp.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </DesktopOnly>
            </>
          )}
        </>
      )}

      {tab === 'departments' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {departments.map(dept => {
            const count = employees.filter(e => e.department_id === dept.id && e.status === 'active').length
            return (
              <div key={dept.id} className="card p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center"><Building2 className="w-5 h-5 text-violet-600" /></div>
                  <div><p className="font-semibold text-surface-900">{dept.name}</p><p className="text-xs text-surface-400">{count} employee{count !== 1 ? 's' : ''}</p></div>
                </div>
              </div>
            )
          })}
          {departments.length === 0 && <div className="col-span-full card text-center py-16"><Building2 className="w-10 h-10 text-surface-300 mx-auto mb-3" /><p className="text-surface-500">No departments yet</p></div>}
        </div>
      )}

      {tab === 'leave' && (
        <div className="space-y-2">
          {leaveRequests.length === 0 ? (
            <div className="card text-center py-16"><Calendar className="w-10 h-10 text-surface-300 mx-auto mb-3" /><p className="text-surface-500">No leave requests</p></div>
          ) : leaveRequests.map(lr => (
            <div key={lr.id} className="card p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-surface-800">{lr.employees?.first_name} {lr.employees?.last_name}</p>
                <p className="text-xs text-surface-500">{lr.type} · {lr.start_date} to {lr.end_date} ({lr.days} days)</p>
                {lr.notes && <p className="text-xs text-surface-400 mt-0.5">{lr.notes}</p>}
              </div>
              <div className="flex items-center gap-2">
                {lr.status === 'pending' ? (
                  <>
                    <button onClick={() => updateLeaveStatus(lr.id, 'approved')} className="btn-sm bg-emerald-600 text-white text-[10px] rounded-lg px-2 py-1"><CheckCircle2 className="w-3 h-3" /></button>
                    <button onClick={() => updateLeaveStatus(lr.id, 'rejected')} className="btn-sm bg-red-600 text-white text-[10px] rounded-lg px-2 py-1"><X className="w-3 h-3" /></button>
                  </>
                ) : (
                  <span className={cn('badge text-[10px]', lr.status === 'approved' ? 'badge-green' : 'badge-red')}>{lr.status}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'payroll' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-surface-900">Payroll Summary</h3>
            <button onClick={exportPayrollCSV} className="btn-secondary btn-sm"><Download className="w-3.5 h-3.5" /> Export CSV</button>
          </div>
          {activeEmployees.length > 0 && (
            <MobileList>
              {activeEmployees.map(emp => {
                let monthly = emp.salary || 0
                if (emp.salary_period === 'annual') monthly /= 12
                if (emp.salary_period === 'weekly') monthly *= 4.33
                if (emp.salary_period === 'hourly') monthly *= 173.33
                return (
                  <MobileListCard
                    key={emp.id}
                    title={`${emp.first_name} ${emp.last_name}`}
                    subtitle={emp.departments?.name || '—'}
                    meta={<>
                      <span>{formatCurrency(emp.salary)}/{emp.salary_period}</span>
                      <span>· Monthly: <strong>{formatCurrency(monthly)}</strong></span>
                    </>}
                  />
                )
              })}
            </MobileList>
          )}
          <DesktopOnly>
          <div className="card overflow-hidden">
            {activeEmployees.length === 0 ? (
              <div className="text-center py-16"><DollarSign className="w-10 h-10 text-surface-300 mx-auto mb-3" /><p className="text-surface-500">No active employees</p></div>
            ) : (
              <table className="w-full">
                <thead><tr className="border-b border-surface-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Employee</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden md:table-cell">Department</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden md:table-cell">Type</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Salary</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Monthly Equiv.</th>
                </tr></thead>
                <tbody>
                  {activeEmployees.map(emp => {
                    let monthly = emp.salary || 0
                    if (emp.salary_period === 'annual') monthly /= 12
                    if (emp.salary_period === 'weekly') monthly *= 4.33
                    if (emp.salary_period === 'hourly') monthly *= 173.33
                    return (
                      <tr key={emp.id} className="border-b border-surface-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="avatar-sm bg-brand-500 flex-shrink-0">{getInitials(`${emp.first_name} ${emp.last_name}`)}</div>
                            <div><p className="text-sm font-semibold text-surface-800">{emp.first_name} {emp.last_name}</p><p className="text-[10px] text-surface-400">{emp.employee_number}</p></div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-surface-600 hidden md:table-cell">{emp.departments?.name || '—'}</td>
                        <td className="px-4 py-3 hidden md:table-cell"><span className="badge badge-gray text-[10px] capitalize">{emp.employment_type?.replace('_', ' ')}</span></td>
                        <td className="px-4 py-3 text-right text-sm font-semibold">{formatCurrency(emp.salary)}<span className="text-[10px] text-surface-400">/{emp.salary_period}</span></td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-surface-900">{formatCurrency(monthly)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-surface-200 font-bold">
                    <td colSpan={4} className="px-4 py-3 text-sm">Total Monthly Payroll</td>
                    <td className="px-4 py-3 text-right text-sm text-brand-600">{formatCurrency(totalPayroll)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
          </DesktopOnly>
        </div>
      )}

      {/* New Employee Modal */}
      {showNewEmployee && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-lg max-h-[85vh] flex flex-col animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100 flex-shrink-0">
              <h2 className="font-semibold text-surface-900">New Employee</h2>
              <button onClick={() => setShowNewEmployee(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">First Name *</label><input className="input" value={empForm.first_name} onChange={e => setEmpForm((f) => ({ ...f, first_name: e.target.value }))} /></div>
                <div><label className="label">Last Name *</label><input className="input" value={empForm.last_name} onChange={e => setEmpForm((f) => ({ ...f, last_name: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Email</label><input className="input" type="email" value={empForm.email} onChange={e => setEmpForm((f) => ({ ...f, email: e.target.value }))} /></div>
                <div><label className="label">Phone</label><input className="input" value={empForm.phone} onChange={e => setEmpForm((f) => ({ ...f, phone: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Department</label>
                  <select className="input" value={empForm.department_id} onChange={e => setEmpForm((f) => ({ ...f, department_id: e.target.value }))}>
                    <option value="">None</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div><label className="label">Position</label><input className="input" value={empForm.position} onChange={e => setEmpForm((f) => ({ ...f, position: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="label">Type</label>
                  <select className="input" value={empForm.employment_type} onChange={e => setEmpForm((f) => ({ ...f, employment_type: e.target.value }))}>
                    <option value="full_time">Full Time</option><option value="part_time">Part Time</option><option value="contractor">Contractor</option><option value="intern">Intern</option>
                  </select>
                </div>
                <div><label className="label">Salary</label><input className="input" type="number" value={empForm.salary} onChange={e => setEmpForm((f) => ({ ...f, salary: e.target.value }))} /></div>
                <div><label className="label">Period</label>
                  <select className="input" value={empForm.salary_period} onChange={e => setEmpForm((f) => ({ ...f, salary_period: e.target.value }))}>
                    <option value="hourly">Hourly</option><option value="monthly">Monthly</option><option value="annual">Annual</option>
                  </select>
                </div>
              </div>
              <div><label className="label">Start Date</label><input type="date" className="input" value={empForm.start_date} onChange={e => setEmpForm((f) => ({ ...f, start_date: e.target.value }))} /></div>
            </div>
            <div className="flex gap-2 p-5 border-t border-surface-100 flex-shrink-0">
              <button onClick={() => setShowNewEmployee(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={createEmployee} disabled={!empForm.first_name || !empForm.last_name || saving} className="btn-primary flex-1">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* New Department Modal */}
      {showNewDept && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-sm animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100">
              <h2 className="font-semibold text-surface-900">New Department</h2>
              <button onClick={() => setShowNewDept(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="label">Name *</label><input className="input" value={deptForm.name} onChange={e => setDeptForm({ name: e.target.value })} /></div>
              <div className="flex gap-2">
                <button onClick={() => setShowNewDept(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={createDepartment} disabled={!deptForm.name || saving} className="btn-primary flex-1">Create</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
