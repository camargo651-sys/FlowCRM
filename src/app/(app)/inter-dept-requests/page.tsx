'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Filter, ArrowRightLeft, CheckCircle2, XCircle, Clock, FileText, X } from 'lucide-react'
import { MobileList, MobileListCard, DesktopOnly } from '@/components/shared/MobileListCard'
import { cn, formatDate } from '@/lib/utils'
import {
  type IDRStatus,
  type IDRPriority,
  type InterDeptRequest,
  DEPARTMENTS,
  STATUS_META,
  PRIORITY_META,
  loadRequests,
  createRequest,
  updateRequest,
} from '@/lib/inter-dept-requests/store'

// ─── Badge helpers ─────────────────────────────────────────
function StatusBadge({ status }: { status: IDRStatus }) {
  const m = STATUS_META[status]
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold', m.className)}>{m.label}</span>
}
function PriorityBadge({ p }: { p: IDRPriority }) {
  const m = PRIORITY_META[p]
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold', m.className)}>{m.label}</span>
}

// ─── Page ──────────────────────────────────────────────────
export default function InterDeptRequestsPage() {
  const [items, setItems] = useState<InterDeptRequest[]>([])
  const [loaded, setLoaded] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [fStatus, setFStatus] = useState<string>('')
  const [fFrom, setFFrom] = useState<string>('')
  const [fTo, setFTo] = useState<string>('')
  const [fPrio, setFPrio] = useState<string>('')

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '',
    from_dept: DEPARTMENTS[0], to_dept: DEPARTMENTS[1],
    priority: 'normal' as IDRPriority,
    requested_by: '',
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const list = await loadRequests()
      if (!cancelled) {
        setItems(list)
        setLoaded(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const stats = useMemo(() => {
    const open = items.filter(i => ['draft', 'submitted'].includes(i.status)).length
    const pending = items.filter(i => i.status === 'in_review').length
    const approved = items.filter(i => i.status === 'approved').length
    const rejected = items.filter(i => i.status === 'rejected').length
    return { open, pending, approved, rejected }
  }, [items])

  const filtered = useMemo(() => {
    return items.filter(i => {
      if (fStatus && i.status !== fStatus) return false
      if (fFrom && i.from_dept !== fFrom) return false
      if (fTo && i.to_dept !== fTo) return false
      if (fPrio && i.priority !== fPrio) return false
      if (search) {
        const q = search.toLowerCase()
        if (!i.title.toLowerCase().includes(q) && !i.requested_by.toLowerCase().includes(q)) return false
      }
      return true
    }).sort((a, b) => b.number - a.number)
  }, [items, fStatus, fFrom, fTo, fPrio, search])

  async function handleCreate() {
    if (!form.title.trim()) return
    const created = await createRequest({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      from_dept: form.from_dept,
      to_dept: form.to_dept,
      priority: form.priority,
      requested_by: form.requested_by.trim() || 'Yo',
      status: 'submitted',
    })
    if (created) setItems(prev => [created, ...prev])
    setShowModal(false)
    setForm({
      title: '', description: '',
      from_dept: DEPARTMENTS[0], to_dept: DEPARTMENTS[1],
      priority: 'normal', requested_by: '',
    })
  }

  async function changeStatus(id: string, status: IDRStatus) {
    const updated = await updateRequest(id, { status })
    if (updated) {
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...updated } : i))
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Solicitudes Inter-Departamentales</h1>
          <p className="text-sm text-surface-500 mt-0.5">Coordina peticiones entre departamentos.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary inline-flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Nueva solicitud
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard icon={<FileText className="w-4 h-4" />} label="Abiertas" value={stats.open} tone="bg-blue-50 text-blue-600" />
        <StatCard icon={<Clock className="w-4 h-4" />} label="En revisión" value={stats.pending} tone="bg-amber-50 text-amber-600" />
        <StatCard icon={<CheckCircle2 className="w-4 h-4" />} label="Aprobadas" value={stats.approved} tone="bg-emerald-50 text-emerald-600" />
        <StatCard icon={<XCircle className="w-4 h-4" />} label="Rechazadas" value={stats.rejected} tone="bg-rose-50 text-rose-600" />
      </div>

      {/* Filters */}
      <div className="card p-3 mb-4 flex flex-col lg:flex-row gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por título o solicitante..."
            className="input pl-9 w-full"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="input" value={fStatus} onChange={e => setFStatus(e.target.value)}>
            <option value="">Estado (todos)</option>
            {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className="input" value={fFrom} onChange={e => setFFrom(e.target.value)}>
            <option value="">Desde (todos)</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="input" value={fTo} onChange={e => setFTo(e.target.value)}>
            <option value="">Hacia (todos)</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="input" value={fPrio} onChange={e => setFPrio(e.target.value)}>
            <option value="">Prioridad (todas)</option>
            {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {(fStatus || fFrom || fTo || fPrio || search) && (
            <button
              onClick={() => { setFStatus(''); setFFrom(''); setFTo(''); setFPrio(''); setSearch('') }}
              className="btn-ghost inline-flex items-center gap-1 text-xs"
            >
              <Filter className="w-3.5 h-3.5" /> Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {loaded && filtered.length === 0 && (
        <div className="card p-10 text-center">
          <ArrowRightLeft className="w-10 h-10 mx-auto text-surface-300 mb-2" />
          <p className="text-surface-600 font-medium">No hay solicitudes</p>
          <p className="text-xs text-surface-400 mt-1">Crea la primera solicitud inter-departamental.</p>
        </div>
      )}

      {/* Desktop table */}
      {filtered.length > 0 && (
        <DesktopOnly>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-50 text-left">
                  <tr className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
                    <th className="px-3 py-2.5">#</th>
                    <th className="px-3 py-2.5">Título</th>
                    <th className="px-3 py-2.5">Desde</th>
                    <th className="px-3 py-2.5">Hacia</th>
                    <th className="px-3 py-2.5">Prioridad</th>
                    <th className="px-3 py-2.5">Estado</th>
                    <th className="px-3 py-2.5">Solicitante</th>
                    <th className="px-3 py-2.5">Creada</th>
                    <th className="px-3 py-2.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {filtered.map(r => (
                    <tr key={r.id} className="hover:bg-surface-50/60 transition-colors">
                      <td className="px-3 py-2.5 text-surface-500 font-mono text-xs">#{r.number}</td>
                      <td className="px-3 py-2.5">
                        <Link href={`/inter-dept-requests/${r.id}`} className="font-semibold text-surface-900 hover:text-brand-600">
                          {r.title}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-surface-700">{r.from_dept}</td>
                      <td className="px-3 py-2.5 text-surface-700">{r.to_dept}</td>
                      <td className="px-3 py-2.5"><PriorityBadge p={r.priority} /></td>
                      <td className="px-3 py-2.5"><StatusBadge status={r.status} /></td>
                      <td className="px-3 py-2.5 text-surface-700">{r.requested_by}</td>
                      <td className="px-3 py-2.5 text-xs text-surface-500">{formatDate(r.created_at)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <RowActions r={r} onChange={changeStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </DesktopOnly>
      )}

      {/* Mobile list */}
      {filtered.length > 0 && (
        <MobileList>
          {filtered.map(r => (
            <Link key={r.id} href={`/inter-dept-requests/${r.id}`}>
              <MobileListCard
                title={<>#{r.number} · {r.title}</>}
                subtitle={`${r.from_dept} → ${r.to_dept}`}
                badge={<StatusBadge status={r.status} />}
                meta={<>
                  <PriorityBadge p={r.priority} />
                  <span>{r.requested_by}</span>
                  <span>{formatDate(r.created_at)}</span>
                </>}
              />
            </Link>
          ))}
        </MobileList>
      )}

      {/* Create modal */}
      {showModal && (
        <div className="fixed inset-0 bg-surface-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-float max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-surface-100">
              <h2 className="text-lg font-bold text-surface-900">Nueva solicitud</h2>
              <button onClick={() => setShowModal(false)} className="text-surface-400 hover:text-surface-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-surface-600 mb-1 block">Título *</label>
                <input className="input w-full" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ej: Solicitar acceso a CRM" />
              </div>
              <div>
                <label className="text-xs font-semibold text-surface-600 mb-1 block">Descripción</label>
                <textarea className="input w-full min-h-[80px]" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-surface-600 mb-1 block">Desde (departamento)</label>
                  <select className="input w-full" value={form.from_dept} onChange={e => setForm({ ...form, from_dept: e.target.value })}>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-surface-600 mb-1 block">Hacia (departamento)</label>
                  <select className="input w-full" value={form.to_dept} onChange={e => setForm({ ...form, to_dept: e.target.value })}>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-surface-600 mb-1 block">Prioridad</label>
                  <select className="input w-full" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as IDRPriority })}>
                    {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-surface-600 mb-1 block">Solicitante</label>
                  <input className="input w-full" value={form.requested_by} onChange={e => setForm({ ...form, requested_by: e.target.value })} placeholder="Tu nombre" />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-surface-100 flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="btn-ghost">Cancelar</button>
              <button onClick={handleCreate} disabled={!form.title.trim()} className="btn-primary">Crear solicitud</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return (
    <div className="card p-3 flex items-center gap-3">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', tone)}>{icon}</div>
      <div>
        <div className="text-xs text-surface-500">{label}</div>
        <div className="text-xl font-bold text-surface-900">{value}</div>
      </div>
    </div>
  )
}

function RowActions({ r, onChange }: { r: InterDeptRequest; onChange: (id: string, s: IDRStatus) => void }) {
  return (
    <div className="inline-flex gap-1 justify-end">
      {(r.status === 'submitted' || r.status === 'draft') && (
        <button onClick={() => onChange(r.id, 'in_review')} className="btn-ghost text-xs">Revisar</button>
      )}
      {r.status === 'in_review' && (
        <>
          <button onClick={() => onChange(r.id, 'approved')} className="text-xs px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold">Aprobar</button>
          <button onClick={() => onChange(r.id, 'rejected')} className="text-xs px-2 py-1 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 font-semibold">Rechazar</button>
        </>
      )}
      {r.status === 'approved' && (
        <button onClick={() => onChange(r.id, 'completed')} className="text-xs px-2 py-1 rounded-md bg-violet-50 text-violet-700 hover:bg-violet-100 font-semibold">Completar</button>
      )}
    </div>
  )
}
