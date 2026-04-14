'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Tag } from 'lucide-react'
import Link from 'next/link'

interface LossReason {
  id: string
  label: string
  color: string
  order_index: number
  archived: boolean
}

const PRESET_COLORS = ['#ef4444', '#f97316', '#eab308', '#10b981', '#3b82f6', '#8b5cf6', '#a855f7', '#ec4899', '#94a3b8']

export default function LossReasonsSettingsPage() {
  const [reasons, setReasons] = useState<LossReason[]>([])
  const [loading, setLoading] = useState(true)
  const [newLabel, setNewLabel] = useState('')
  const [newColor, setNewColor] = useState('#94a3b8')
  const [creating, setCreating] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/loss-reasons')
      const j = await res.json()
      setReasons(j.reasons || [])
    } catch {
      toast.error('Failed to load loss reasons')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    const label = newLabel.trim()
    if (!label) return
    setCreating(true)
    try {
      const res = await fetch('/api/loss-reasons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, color: newColor, order_index: reasons.length + 1 }),
      })
      const j = await res.json()
      if (j.reason) {
        setReasons(prev => [...prev, j.reason])
        setNewLabel('')
        setNewColor('#94a3b8')
        toast.success('Reason added')
      } else {
        toast.error(j.error || 'Failed to add')
      }
    } catch {
      toast.error('Failed to add')
    }
    setCreating(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Archive this reason?')) return
    try {
      const res = await fetch(`/api/loss-reasons?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setReasons(prev => prev.filter(r => r.id !== id))
        toast.success('Archived')
      } else {
        toast.error('Failed to archive')
      }
    } catch {
      toast.error('Failed to archive')
    }
  }

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><Tag className="w-5 h-5" /> Loss Reasons</h1>
          <p className="page-subtitle">Configure why deals are lost. These appear when marking a deal as lost.</p>
        </div>
        <Link href="/settings" className="btn-secondary btn-sm">Back to Settings</Link>
      </div>

      <div className="card p-4 mb-4">
        <p className="text-[11px] font-bold text-surface-500 uppercase tracking-wider mb-2">Add new reason</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            className="input text-sm flex-1 min-w-[180px]"
            placeholder="e.g. Too expensive"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <div className="flex items-center gap-1">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setNewColor(c)}
                className="w-6 h-6 rounded-full border-2 transition-all"
                style={{ backgroundColor: c, borderColor: newColor === c ? '#0f172a' : 'transparent' }}
                aria-label={c}
              />
            ))}
          </div>
          <button
            onClick={handleAdd}
            disabled={creating || !newLabel.trim()}
            className="btn-primary btn-sm flex items-center gap-1 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-2 border-b border-surface-100 bg-surface-50">
          <p className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">Existing reasons</p>
        </div>
        {loading ? (
          <div className="p-6 text-center text-sm text-surface-400">Loading...</div>
        ) : reasons.length === 0 ? (
          <div className="p-6 text-center text-sm text-surface-400">No reasons yet. Add one above.</div>
        ) : (
          <ul className="divide-y divide-surface-100">
            {reasons.map(r => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: r.color || '#94a3b8' }}
                />
                <span className="text-sm flex-1 text-surface-800">{r.label}</span>
                <button
                  onClick={() => handleDelete(r.id)}
                  className="text-surface-400 hover:text-red-600 transition-colors"
                  aria-label="Archive"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
