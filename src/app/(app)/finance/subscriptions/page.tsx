'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getActiveWorkspace } from '@/lib/get-active-workspace'
import { Plus, Pause, Play, X, RefreshCw, Repeat, Calendar, DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'

interface Subscription {
  id: string
  name: string
  amount: number
  currency: string
  interval: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  next_invoice_date: string
  status: 'active' | 'paused' | 'cancelled'
  description?: string
  contact_id?: string
  contacts?: { id: string; name: string; email?: string } | null
}

interface ContactLite { id: string; name: string; email?: string }

const STATUS_STYLES: Record<string, string> = {
  active: 'badge-green',
  paused: 'badge-yellow',
  cancelled: 'badge-gray',
}

export default function SubscriptionsPage() {
  const supabase = createClient()
  const [subs, setSubs] = useState<Subscription[]>([])
  const [contacts, setContacts] = useState<ContactLite[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [running, setRunning] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const ws = await getActiveWorkspace(supabase, user.id, 'id') as { id: string } | null
    if (!ws) { setLoading(false); return }
    const { data } = await supabase
      .from('subscriptions')
      .select('*, contacts(id, name, email)')
      .eq('workspace_id', ws.id)
      .order('created_at', { ascending: false })
    setSubs((data as Subscription[]) || [])
    const { data: cs } = await supabase
      .from('contacts')
      .select('id, name, email')
      .eq('workspace_id', ws.id)
      .order('name')
      .limit(500)
    setContacts((cs as ContactLite[]) || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const updateStatus = async (id: string, status: 'active' | 'paused' | 'cancelled') => {
    const res = await fetch(`/api/subscriptions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) { toast.success(`Subscription ${status}`); load() }
    else toast.error('Failed to update')
  }

  const runNow = async () => {
    setRunning(true)
    const res = await fetch('/api/subscriptions/run', { method: 'POST' })
    const json = await res.json()
    setRunning(false)
    if (res.ok) {
      toast.success(`Generated ${json.data?.generated ?? 0} invoice(s)`)
      load()
    } else toast.error('Failed to run')
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-surface-900 flex items-center gap-2">
            <Repeat className="w-6 h-6 text-brand-600" /> Subscriptions
          </h1>
          <p className="text-sm text-surface-500 mt-1">Recurring invoices on autopilot</p>
        </div>
        <div className="flex gap-2">
          <button onClick={runNow} disabled={running} className="btn-secondary">
            <RefreshCw className={`w-4 h-4 mr-1.5 ${running ? 'animate-spin' : ''}`} /> Run now
          </button>
          <button onClick={() => setShowNew(true)} className="btn-primary">
            <Plus className="w-4 h-4 mr-1.5" /> New subscription
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-surface-400">Loading...</div>
      ) : subs.length === 0 ? (
        <div className="card text-center py-12">
          <Repeat className="w-10 h-10 mx-auto text-surface-300" />
          <p className="mt-3 font-semibold text-surface-700">No subscriptions yet</p>
          <p className="text-sm text-surface-500 mt-1">Create one to start generating recurring invoices automatically.</p>
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-50 text-xs uppercase text-surface-500">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Amount</th>
                <th className="text-left px-4 py-3">Interval</th>
                <th className="text-left px-4 py-3">Next invoice</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {subs.map(s => (
                <tr key={s.id} className="hover:bg-surface-50">
                  <td className="px-4 py-3 font-semibold text-surface-900">{s.name}</td>
                  <td className="px-4 py-3 text-surface-600">{s.contacts?.name || '—'}</td>
                  <td className="px-4 py-3 font-semibold">{formatCurrency(s.amount, s.currency)}</td>
                  <td className="px-4 py-3 capitalize text-surface-600">{s.interval}</td>
                  <td className="px-4 py-3 text-surface-600 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> {s.next_invoice_date}
                  </td>
                  <td className="px-4 py-3"><span className={STATUS_STYLES[s.status]}>{s.status}</span></td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      {s.status === 'active' && (
                        <button onClick={() => updateStatus(s.id, 'paused')} className="btn-icon" title="Pause">
                          <Pause className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {s.status === 'paused' && (
                        <button onClick={() => updateStatus(s.id, 'active')} className="btn-icon" title="Resume">
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {s.status !== 'cancelled' && (
                        <button onClick={() => updateStatus(s.id, 'cancelled')} className="btn-icon text-red-600" title="Cancel">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNew && (
        <NewSubscriptionModal contacts={contacts} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load() }} />
      )}
    </div>
  )
}

function NewSubscriptionModal({ contacts, onClose, onCreated }: { contacts: ContactLite[]; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [interval, setInterval] = useState<'weekly' | 'monthly' | 'quarterly' | 'yearly'>('monthly')
  const [contactId, setContactId] = useState('')
  const [nextDate, setNextDate] = useState(new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const res = await fetch('/api/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        amount: parseFloat(amount),
        currency,
        interval,
        next_invoice_date: nextDate,
        contact_id: contactId || null,
        description: description || null,
      }),
    })
    setSubmitting(false)
    if (res.ok) { toast.success('Subscription created'); onCreated() }
    else toast.error('Failed to create')
  }

  return (
    <div className="modal-overlay">
      <div className="modal-panel max-w-md">
        <div className="modal-header">
          <h2>New Subscription</h2>
          <button onClick={onClose} className="modal-close"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="modal-body space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input" required value={name} onChange={e => setName(e.target.value)} placeholder="Pro plan" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Amount *</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400" />
                <input className="input pl-8" required type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">Currency</label>
              <select className="input" value={currency} onChange={e => setCurrency(e.target.value)}>
                <option>USD</option><option>EUR</option><option>MXN</option><option>GBP</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Interval</label>
              <select className="input" value={interval} onChange={e => setInterval(e.target.value as 'weekly' | 'monthly' | 'quarterly' | 'yearly')}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="label">Next invoice date</label>
              <input className="input" type="date" value={nextDate} onChange={e => setNextDate(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="label">Customer</label>
            <select className="input" value={contactId} onChange={e => setContactId(e.target.value)}>
              <option value="">— None —</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary">{submitting ? 'Creating...' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
