'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Webhook, Plus, Trash2, X, Activity, Power } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface WebhookRow {
  id: string
  name: string
  url: string
  events: string[]
  active: boolean
  last_triggered_at: string | null
  fail_count: number
  secret: string | null
}

const EVENT_OPTIONS = [
  { key: 'deal.created', label: 'Deal created' },
  { key: 'deal.won', label: 'Deal won' },
  { key: 'deal.lost', label: 'Deal lost' },
  { key: 'contact.created', label: 'Contact created' },
  { key: 'invoice.paid', label: 'Invoice paid' },
  { key: 'ticket.created', label: 'Ticket created' },
]

export default function WebhooksPage() {
  const [hooks, setHooks] = useState<WebhookRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<string[]>([])
  const [creating, setCreating] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/webhooks-out')
      const j = await res.json()
      setHooks(j.webhooks || [])
    } catch { toast.error('Failed to load webhooks') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const create = async () => {
    if (!name.trim() || !url.trim() || events.length === 0) return
    setCreating(true)
    try {
      const res = await fetch('/api/webhooks-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), url: url.trim(), events }),
      })
      const j = await res.json()
      if (j.error) { toast.error(j.error); setCreating(false); return }
      setHooks(prev => [j.webhook, ...prev])
      setShowCreate(false)
      setName(''); setUrl(''); setEvents([])
      toast.success('Webhook created')
    } catch { toast.error('Failed to create webhook') }
    setCreating(false)
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this webhook?')) return
    try {
      const res = await fetch(`/api/webhooks-out?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setHooks(prev => prev.filter(h => h.id !== id))
        toast.success('Deleted')
      }
    } catch { toast.error('Delete failed') }
  }

  const toggle = async (h: WebhookRow) => {
    try {
      const res = await fetch('/api/webhooks-out', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: h.id, active: !h.active }),
      })
      const j = await res.json()
      if (j.webhook) setHooks(prev => prev.map(x => x.id === h.id ? j.webhook : x))
    } catch { toast.error('Toggle failed') }
  }

  const toggleEvent = (k: string) => {
    setEvents(prev => prev.includes(k) ? prev.filter(e => e !== k) : [...prev, k])
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <Link href="/settings" className="text-xs text-surface-500 hover:text-surface-800">← Settings</Link>
        <div className="flex items-center justify-between mt-2">
          <div>
            <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
              <Webhook className="w-6 h-6 text-brand-600" /> Outbound webhooks
            </h1>
            <p className="text-sm text-surface-500 mt-1">Send real-time event notifications to your endpoints.</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> New webhook
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="p-6 text-sm text-surface-400">Loading…</div>
        ) : hooks.length === 0 ? (
          <div className="p-12 text-center">
            <Webhook className="w-10 h-10 text-surface-300 mx-auto mb-3" />
            <p className="text-sm text-surface-500">No webhooks configured</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-50">
            {hooks.map(h => (
              <div key={h.id} className="p-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-surface-900">{h.name}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${h.active ? 'bg-emerald-50 text-emerald-700' : 'bg-surface-100 text-surface-500'}`}>
                      {h.active ? 'ACTIVE' : 'PAUSED'}
                    </span>
                    {h.fail_count > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700">
                        {h.fail_count} fails
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-xs text-surface-500 truncate mt-1">{h.url}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {h.events.map(e => (
                      <span key={e} className="px-1.5 py-0.5 bg-surface-50 rounded text-[10px] font-mono">{e}</span>
                    ))}
                  </div>
                  {h.last_triggered_at && (
                    <p className="text-[10px] text-surface-400 mt-2 flex items-center gap-1">
                      <Activity className="w-3 h-3" /> Last delivery {formatDate(h.last_triggered_at)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => toggle(h)} className="p-2 text-surface-500 hover:text-surface-900 hover:bg-surface-50 rounded-lg" title={h.active ? 'Pause' : 'Resume'}>
                    <Power className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(h.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-float max-w-lg w-full">
            <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between">
              <h2 className="font-semibold text-surface-900">New webhook</h2>
              <button onClick={() => setShowCreate(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Name</label>
                <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Slack notifier" />
              </div>
              <div>
                <label className="label">Endpoint URL</label>
                <input className="input" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/webhook" />
              </div>
              <div>
                <label className="label">Events</label>
                <div className="space-y-2">
                  {EVENT_OPTIONS.map(opt => (
                    <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={events.includes(opt.key)} onChange={() => toggleEvent(opt.key)} />
                      <span className="text-sm">{opt.label}</span>
                      <code className="text-[10px] text-surface-400">{opt.key}</code>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-surface-100 flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
              <button onClick={create} disabled={creating || !name.trim() || !url.trim() || events.length === 0} className="btn-primary disabled:opacity-50">
                {creating ? 'Creating…' : 'Create webhook'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
