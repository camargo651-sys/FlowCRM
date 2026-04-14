'use client'
import { useEffect, useState } from 'react'
import { Check, X, Inbox } from 'lucide-react'
import { toast } from 'sonner'

interface Request {
  id: string
  entity: string
  entity_id: string
  status: string
  reason: string | null
  requested_by: string | null
  approver_id: string | null
  created_at: string
  decided_at: string | null
}

type Tab = 'pending' | 'approved' | 'rejected'

export default function ApprovalsInboxPage() {
  const [tab, setTab] = useState<Tab>('pending')
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/approval-requests?status=${tab}&mine=true`)
      const j = await res.json()
      setRequests(j.requests || [])
    } catch {
      toast.error('Failed to load')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [tab])

  const decide = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const res = await fetch('/api/approval-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      const j = await res.json()
      if (j.request) {
        setRequests(prev => prev.filter(r => r.id !== id))
        toast.success(status === 'approved' ? 'Approved' : 'Rejected')
      } else {
        toast.error(j.error || 'Failed')
      }
    } catch {
      toast.error('Failed')
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
          <Inbox className="w-6 h-6 text-brand-600" /> Approvals
        </h1>
        <p className="text-sm text-surface-500 mt-1">Review requests waiting for your decision.</p>
      </div>

      <div className="flex items-center gap-1 mb-4 border-b border-surface-100">
        {(['pending', 'approved', 'rejected'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition border-b-2 ${
              tab === t ? 'text-brand-700 border-brand-600' : 'text-surface-500 border-transparent hover:text-surface-800'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-surface-400">Loading...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-surface-200 rounded-2xl">
          <Inbox className="w-10 h-10 text-surface-300 mx-auto mb-3" />
          <p className="text-sm text-surface-500">No {tab} approvals</p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map(req => (
            <div key={req.id} className="bg-white border border-surface-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-brand-700 bg-brand-50 px-2 py-0.5 rounded">{req.entity}</span>
                    <span className="text-xs text-surface-400">{new Date(req.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-surface-800 font-medium truncate">
                    {req.entity} · {req.entity_id.slice(0, 8)}
                  </p>
                  {req.reason && <p className="text-xs text-surface-500 mt-1">{req.reason}</p>}
                </div>
                {tab === 'pending' && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => decide(req.id, 'rejected')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100"
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                    <button
                      onClick={() => decide(req.id, 'approved')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
