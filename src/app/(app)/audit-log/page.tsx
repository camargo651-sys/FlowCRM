'use client'
import { DbRow } from '@/types'
import { useI18n } from '@/lib/i18n/context'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Shield, Search, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getActiveWorkspace } from '@/lib/get-active-workspace'

const ACTION_COLORS: Record<string, string> = {
  'contact.created': 'text-blue-600 bg-blue-50',
  'deal.created': 'text-emerald-600 bg-emerald-50',
  'deal.won': 'text-emerald-600 bg-emerald-50',
  'deal.lost': 'text-red-600 bg-red-50',
  'deal.stage_changed': 'text-amber-600 bg-amber-50',
  'invoice.created': 'text-violet-600 bg-violet-50',
  'payment.received': 'text-emerald-600 bg-emerald-50',
}

export default function AuditLogPage() {
  const supabase = createClient()
  const { t } = useI18n()
  const [logs, setLogs] = useState<DbRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const ws = await getActiveWorkspace(supabase, user.id, 'id')
    if (!ws) { setLoading(false); return }

    const { data } = await supabase.from('audit_log')
      .select('*')
      .eq('workspace_id', ws.id)
      .order('created_at', { ascending: false })
      .limit(100)
    setLogs(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const entityTypes = Array.from(new Set(logs.map(l => l.entity_type).filter(Boolean)))
  const filtered = logs.filter(l => {
    if (filterType !== 'all' && l.entity_type !== filterType) return false
    if (search && !l.action?.toLowerCase().includes(search.toLowerCase()) && !l.entity_name?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">{t('nav.audit_log')}</h1><p className="text-sm text-surface-500 mt-0.5">{logs.length} events tracked</p></div>
      </div>

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input className="input pl-9 text-xs" placeholder="Search actions or entities..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto text-xs" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="all">All Types</option>
          {entityTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-16">
          <Shield className="w-10 h-10 text-surface-300 mx-auto mb-3" />
          <p className="text-surface-500 font-medium">No audit events yet</p>
          <p className="text-xs text-surface-400 mt-1">Events are logged automatically when actions occur via the API</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map(log => (
            <div key={log.id} className="card p-3 flex items-center gap-3">
              <div className={cn('text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap', ACTION_COLORS[log.action] || 'text-surface-600 bg-surface-100')}>
                {log.action}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-surface-800 font-medium">{log.entity_name || log.entity_type || '—'}</span>
                {log.entity_id && <span className="text-[10px] text-surface-300 font-mono ml-2">{log.entity_id.slice(0, 8)}</span>}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-surface-400 flex-shrink-0">
                <Clock className="w-3 h-3" />
                {new Date(log.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
