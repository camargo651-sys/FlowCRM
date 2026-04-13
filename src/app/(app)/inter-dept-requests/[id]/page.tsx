'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Send, User, Calendar, ArrowRightLeft, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import {
  type InterDeptRequest, type IDRStatus, loadRequests, saveRequests, updateRequest,
} from '@/lib/inter-dept-requests/store'

const STATUS_META: Record<IDRStatus, { label: string; className: string }> = {
  draft:     { label: 'Borrador',    className: 'bg-surface-100 text-surface-700' },
  submitted: { label: 'Enviada',     className: 'bg-blue-50 text-blue-700' },
  in_review: { label: 'En revisión', className: 'bg-amber-50 text-amber-700' },
  approved:  { label: 'Aprobada',    className: 'bg-emerald-50 text-emerald-700' },
  rejected:  { label: 'Rechazada',   className: 'bg-rose-50 text-rose-700' },
  completed: { label: 'Completada',  className: 'bg-violet-50 text-violet-700' },
}

const PRIORITY_META: Record<string, { label: string; className: string }> = {
  low:    { label: 'Baja',    className: 'bg-surface-100 text-surface-600' },
  normal: { label: 'Normal',  className: 'bg-blue-50 text-blue-700' },
  high:   { label: 'Alta',    className: 'bg-amber-50 text-amber-700' },
  urgent: { label: 'Urgente', className: 'bg-rose-50 text-rose-700' },
}

export default function InterDeptRequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [req, setReq] = useState<InterDeptRequest | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [comment, setComment] = useState('')

  useEffect(() => {
    const all = loadRequests()
    setReq(all.find(r => r.id === id) ?? null)
    setLoaded(true)
  }, [id])

  function refresh() {
    const all = loadRequests()
    setReq(all.find(r => r.id === id) ?? null)
  }

  function changeStatus(status: IDRStatus) {
    if (!req) return
    updateRequest(req.id, { status })
    refresh()
  }

  function postComment() {
    if (!req || !comment.trim()) return
    const all = loadRequests()
    const idx = all.findIndex(r => r.id === req.id)
    if (idx === -1) return
    const newNote = {
      id: 'c_' + Math.random().toString(36).slice(2, 10),
      author: 'Yo',
      text: comment.trim(),
      created_at: new Date().toISOString(),
    }
    all[idx] = {
      ...all[idx],
      comments: [...(all[idx].comments ?? []), newNote],
      updated_at: new Date().toISOString(),
    }
    saveRequests(all)
    setComment('')
    refresh()
  }

  if (loaded && !req) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Link href="/inter-dept-requests" className="inline-flex items-center gap-1 text-sm text-surface-500 hover:text-brand-600 mb-4">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>
        <div className="card p-10 text-center">
          <p className="text-surface-600">Solicitud no encontrada.</p>
        </div>
      </div>
    )
  }

  if (!req) return <div className="p-6 text-sm text-surface-500">Cargando...</div>

  const statusMeta = STATUS_META[req.status]
  const prioMeta = PRIORITY_META[req.priority]

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <Link href="/inter-dept-requests" className="inline-flex items-center gap-1 text-sm text-surface-500 hover:text-brand-600 mb-4">
        <ArrowLeft className="w-4 h-4" /> Volver a solicitudes
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <div className="text-xs text-surface-400 font-mono mb-1">#{req.number}</div>
          <h1 className="text-2xl font-bold text-surface-900 break-words">{req.title}</h1>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-semibold', statusMeta.className)}>{statusMeta.label}</span>
            <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-semibold', prioMeta.className)}>{prioMeta.label}</span>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {(req.status === 'submitted' || req.status === 'draft') && (
            <button onClick={() => changeStatus('in_review')} className="btn-primary inline-flex items-center gap-1 text-sm">
              <Clock className="w-3.5 h-3.5" /> Revisar
            </button>
          )}
          {req.status === 'in_review' && (
            <>
              <button onClick={() => changeStatus('approved')} className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Aprobar
              </button>
              <button onClick={() => changeStatus('rejected')} className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 font-semibold">
                <XCircle className="w-3.5 h-3.5" /> Rechazar
              </button>
            </>
          )}
          {req.status === 'approved' && (
            <button onClick={() => changeStatus('completed')} className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Completar
            </button>
          )}
        </div>
      </div>

      {/* Details card */}
      <div className="card p-4 mb-5">
        <h2 className="text-sm font-bold text-surface-900 mb-3">Detalles</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <DetailRow icon={<ArrowRightLeft className="w-4 h-4 text-surface-400" />} label="Ruta" value={`${req.from_dept} → ${req.to_dept}`} />
          <DetailRow icon={<User className="w-4 h-4 text-surface-400" />} label="Solicitante" value={req.requested_by} />
          <DetailRow icon={<Calendar className="w-4 h-4 text-surface-400" />} label="Creada" value={formatDate(req.created_at)} />
          <DetailRow icon={<Calendar className="w-4 h-4 text-surface-400" />} label="Actualizada" value={formatDate(req.updated_at)} />
        </div>
        {req.description && (
          <div className="mt-4 pt-4 border-t border-surface-100">
            <div className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-1">Descripción</div>
            <p className="text-sm text-surface-700 whitespace-pre-wrap">{req.description}</p>
          </div>
        )}
      </div>

      {/* Comments hub */}
      <div className="card p-4">
        <h2 className="text-sm font-bold text-surface-900 mb-3">Actividad</h2>
        <div className="space-y-3 mb-4">
          {(req.comments ?? []).length === 0 && (
            <p className="text-xs text-surface-400 italic">Todavía no hay comentarios.</p>
          )}
          {(req.comments ?? []).map(c => (
            <div key={c.id} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-500 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                {c.author.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-surface-800">{c.author}</span>
                  <span className="text-[10px] text-surface-400">{formatDate(c.created_at)}</span>
                </div>
                <div className="bg-surface-50 rounded-xl px-3 py-2 text-sm text-surface-700 whitespace-pre-wrap">{c.text}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Composer */}
        <div className="flex gap-2 border-t border-surface-100 pt-3">
          <input
            value={comment}
            onChange={e => setComment(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') postComment() }}
            placeholder="Escribe un comentario..."
            className="input flex-1"
          />
          <button onClick={postComment} disabled={!comment.trim()} className="btn-primary inline-flex items-center gap-1">
            <Send className="w-3.5 h-3.5" /> Enviar
          </button>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5">{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-surface-400 font-semibold">{label}</div>
        <div className="text-sm text-surface-800 truncate">{value}</div>
      </div>
    </div>
  )
}
