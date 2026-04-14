'use client'
import { DbRow } from '@/types'
import { useI18n } from '@/lib/i18n/context'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Shield, Search, Clock, ChevronLeft, ChevronRight, User as UserIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getActiveWorkspace } from '@/lib/get-active-workspace'
import { MobileList, MobileListCard, DesktopOnly } from '@/components/shared/MobileListCard'
import EmptyState from '@/components/shared/EmptyState'

const ACTION_COLORS: Record<string, string> = {
  'contact.created': 'text-blue-600 bg-blue-50',
  'contact.updated': 'text-blue-600 bg-blue-50',
  'deal.created': 'text-emerald-600 bg-emerald-50',
  'deal.won': 'text-emerald-600 bg-emerald-50',
  'deal.lost': 'text-red-600 bg-red-50',
  'deal.stage_changed': 'text-amber-600 bg-amber-50',
  'invoice.created': 'text-violet-600 bg-violet-50',
  'invoice.sent': 'text-violet-600 bg-violet-50',
  'payment.received': 'text-emerald-600 bg-emerald-50',
  'ticket.created': 'text-cyan-600 bg-cyan-50',
}

const PAGE_SIZE = 50

interface Member { id: string; full_name?: string; email?: string }
interface AuditRow extends DbRow {
  id: string
  action: string
  entity_type?: string
  entity_id?: string
  entity_name?: string
  user_id?: string
  changes?: DbRow
  created_at: string
}

function summarizeChanges(changes: unknown): string {
  if (!changes || typeof changes !== 'object') return ''
  const obj = changes as DbRow
  const keys = Object.keys(obj)
  if (keys.length === 0) return ''
  return keys.slice(0, 3).map(k => k).join(', ') + (keys.length > 3 ? ` +${keys.length - 3}` : '')
}

export default function AuditLogPage() {
  const supabase = createClient()
  const { t } = useI18n()
  const [logs, setLogs] = useState<AuditRow[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterUser, setFilterUser] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(0)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const ws = await getActiveWorkspace(supabase, user.id, 'id')
    if (!ws) { setLoading(false); return }

    const { data } = await supabase.from('audit_log')
      .select('*')
      .eq('workspace_id', ws.id)
      .order('created_at', { ascending: false })
      .limit(500)
    setLogs((data as AuditRow[]) || [])

    // Load workspace members
    const { data: memberData } = await supabase
      .from('workspace_members')
      .select('user_id, profiles:user_id(id, full_name, email)')
      .eq('workspace_id', ws.id)
    if (memberData) {
      const ms: Member[] = []
      for (const row of memberData as DbRow[]) {
        const p = row.profiles as DbRow | null
        if (p && typeof p === 'object') {
          ms.push({ id: p.id as string, full_name: p.full_name as string, email: p.email as string })
        }
      }
      setMembers(ms)
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const memberName = (uid?: string) => {
    if (!uid) return 'System'
    const m = members.find(x => x.id === uid)
    return m?.full_name || m?.email || uid.slice(0, 8)
  }

  const entityTypes = useMemo(
    () => Array.from(new Set(logs.map(l => l.entity_type).filter(Boolean) as string[])),
    [logs]
  )

  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (filterType !== 'all' && l.entity_type !== filterType) return false
      if (filterUser !== 'all' && l.user_id !== filterUser) return false
      if (dateFrom && new Date(l.created_at) < new Date(dateFrom)) return false
      if (dateTo) {
        const end = new Date(dateTo)
        end.setHours(23, 59, 59, 999)
        if (new Date(l.created_at) > end) return false
      }
      if (search) {
        const q = search.toLowerCase()
        const hay = `${l.action} ${l.entity_name || ''} ${l.entity_id || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [logs, filterType, filterUser, dateFrom, dateTo, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  useEffect(() => { setPage(0) }, [filterType, filterUser, dateFrom, dateTo, search])

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav.audit_log')}</h1>
          <p className="text-sm text-surface-500 mt-0.5">{filtered.length} of {logs.length} events</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            className="input pl-9 text-xs"
            placeholder="Search action, entity or ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="input w-auto text-xs" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="all">All Types</option>
          {entityTypes.map(et => <option key={et} value={et}>{et}</option>)}
        </select>
        <select className="input w-auto text-xs" value={filterUser} onChange={e => setFilterUser(e.target.value)}>
          <option value="all">All Users</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
        </select>
        <input
          type="date"
          className="input w-auto text-xs"
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
        />
        <input
          type="date"
          className="input w-auto text-xs"
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Shield className="w-7 h-7" />}
          title="No audit events"
          description="Events are logged automatically when actions occur in your workspace."
        />
      ) : (
        <>
          {/* Desktop table */}
          <DesktopOnly>
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-100 bg-surface-50/50">
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-surface-500 uppercase tracking-wider">When</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-surface-500 uppercase tracking-wider">User</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-surface-500 uppercase tracking-wider">Action</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-surface-500 uppercase tracking-wider">Entity</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-surface-500 uppercase tracking-wider hidden xl:table-cell">ID</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-surface-500 uppercase tracking-wider hidden xl:table-cell">Changes</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(log => (
                    <tr key={log.id} className="border-b border-surface-50 hover:bg-surface-50/50 transition-colors">
                      <td className="px-4 py-2.5 text-[11px] text-surface-500 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-surface-300" />
                          {new Date(log.created_at).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-surface-700">
                        <div className="flex items-center gap-1.5">
                          <UserIcon className="w-3 h-3 text-surface-300" />
                          {memberName(log.user_id)}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn('text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap', ACTION_COLORS[log.action] || 'text-surface-600 bg-surface-100')}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-surface-800 font-medium max-w-[200px] truncate">
                        {log.entity_name || log.entity_type || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-[10px] text-surface-300 font-mono hidden xl:table-cell">
                        {log.entity_id ? log.entity_id.slice(0, 8) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-[10px] text-surface-400 hidden xl:table-cell">
                        {summarizeChanges(log.changes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DesktopOnly>

          {/* Mobile list */}
          <MobileList>
            {pageRows.map(log => (
              <MobileListCard
                key={log.id}
                title={log.entity_name || log.entity_type || log.action}
                subtitle={`${memberName(log.user_id)} • ${new Date(log.created_at).toLocaleString()}`}
                badge={
                  <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded', ACTION_COLORS[log.action] || 'text-surface-600 bg-surface-100')}>
                    {log.action}
                  </span>
                }
              />
            ))}
          </MobileList>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-surface-400">
                Page {page + 1} of {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="btn-sm border border-surface-200 rounded-lg px-2 py-1 disabled:opacity-40"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="btn-sm border border-surface-200 rounded-lg px-2 py-1 disabled:opacity-40"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
