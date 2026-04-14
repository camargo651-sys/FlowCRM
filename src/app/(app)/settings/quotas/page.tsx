'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Plus, Trash2, Target, ArrowLeft } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Quota {
  id: string
  user_id: string | null
  period: 'monthly' | 'quarterly' | 'yearly'
  target_amount: number
  start_date: string
  end_date: string
  metric: 'won_value' | 'deal_count' | 'calls_count'
}

interface TeamUser { id: string; name: string; email: string }

function periodRange(period: 'monthly' | 'quarterly' | 'yearly'): { start: string; end: string } {
  const now = new Date()
  const y = now.getFullYear()
  if (period === 'monthly') {
    const m = now.getMonth()
    const start = new Date(y, m, 1)
    const end = new Date(y, m + 1, 0)
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
  }
  if (period === 'quarterly') {
    const q = Math.floor(now.getMonth() / 3)
    const start = new Date(y, q * 3, 1)
    const end = new Date(y, q * 3 + 3, 0)
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
  }
  return { start: `${y}-01-01`, end: `${y}-12-31` }
}

export default function QuotasSettingsPage() {
  const [quotas, setQuotas] = useState<Quota[]>([])
  const [users, setUsers] = useState<TeamUser[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  // Form
  const [userId, setUserId] = useState<string>('')
  const [period, setPeriod] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly')
  const [target, setTarget] = useState<string>('')
  const [metric, setMetric] = useState<'won_value' | 'deal_count' | 'calls_count'>('won_value')

  const load = async () => {
    setLoading(true)
    try {
      const [qRes, tRes] = await Promise.all([
        fetch('/api/quotas').then(r => r.json()),
        fetch('/api/team').then(r => r.json()),
      ])
      setQuotas(qRes.quotas || [])
      setUsers(tRes.users || [])
    } catch {
      toast.error('Failed to load quotas')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!target || Number(target) <= 0) {
      toast.error('Enter a valid target amount')
      return
    }
    setCreating(true)
    const range = periodRange(period)
    try {
      const res = await fetch('/api/quotas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId || null,
          period,
          target_amount: Number(target),
          start_date: range.start,
          end_date: range.end,
          metric,
        }),
      })
      const j = await res.json()
      if (j.quota) {
        setQuotas(prev => [j.quota, ...prev])
        setTarget('')
        toast.success('Quota added')
      } else {
        toast.error(j.error || 'Failed to add quota')
      }
    } catch {
      toast.error('Failed to add quota')
    }
    setCreating(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this quota?')) return
    try {
      const res = await fetch(`/api/quotas?id=${id}`, { method: 'DELETE' })
      const j = await res.json()
      if (j.ok) {
        setQuotas(prev => prev.filter(q => q.id !== id))
        toast.success('Quota deleted')
      } else {
        toast.error(j.error || 'Failed to delete')
      }
    } catch {
      toast.error('Failed to delete')
    }
  }

  return (
    <div className="animate-fade-in max-w-4xl">
      <div className="mb-6">
        <Link href="/settings" className="text-xs text-surface-500 hover:text-surface-700 flex items-center gap-1 mb-2">
          <ArrowLeft className="w-3 h-3" /> Settings
        </Link>
        <h1 className="text-xl font-bold text-surface-900 dark:text-surface-50 flex items-center gap-2">
          <Target className="w-5 h-5 text-violet-600" /> Sales Quotas
        </h1>
        <p className="text-xs text-surface-500 mt-1">Set sales targets per rep or for the whole workspace.</p>
      </div>

      <div className="card p-4 mb-6">
        <h2 className="text-sm font-semibold mb-3">Add new quota</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="text-[10px] font-semibold uppercase text-surface-500">Rep</label>
            <select className="input text-sm mt-1" value={userId} onChange={e => setUserId(e.target.value)}>
              <option value="">Workspace-wide</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase text-surface-500">Period</label>
            <select className="input text-sm mt-1" value={period} onChange={e => setPeriod(e.target.value as 'monthly' | 'quarterly' | 'yearly')}>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase text-surface-500">Metric</label>
            <select className="input text-sm mt-1" value={metric} onChange={e => setMetric(e.target.value as 'won_value' | 'deal_count' | 'calls_count')}>
              <option value="won_value">Won value</option>
              <option value="deal_count">Deal count</option>
              <option value="calls_count">Calls count</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase text-surface-500">Target</label>
            <input type="number" className="input text-sm mt-1" placeholder="0" value={target} onChange={e => setTarget(e.target.value)} />
          </div>
          <div className="flex items-end">
            <button onClick={handleCreate} disabled={creating} className="btn-primary text-sm w-full disabled:opacity-50">
              <Plus className="w-3.5 h-3.5 inline mr-1" /> Add
            </button>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <h2 className="text-sm font-semibold mb-3">Existing quotas</h2>
        {loading ? (
          <p className="text-xs text-surface-400">Loading...</p>
        ) : quotas.length === 0 ? (
          <p className="text-xs text-surface-400">No quotas yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase text-surface-500 border-b border-surface-100 dark:border-surface-800">
                  <th className="py-2 pr-3">Rep</th>
                  <th className="py-2 pr-3">Period</th>
                  <th className="py-2 pr-3">Metric</th>
                  <th className="py-2 pr-3">Target</th>
                  <th className="py-2 pr-3">Range</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {quotas.map(q => {
                  const userName = q.user_id ? (users.find(u => u.id === q.user_id)?.name || 'Unknown') : 'Workspace-wide'
                  return (
                    <tr key={q.id} className="border-b border-surface-50 dark:border-surface-800/40">
                      <td className="py-2 pr-3">{userName}</td>
                      <td className="py-2 pr-3 capitalize">{q.period}</td>
                      <td className="py-2 pr-3 text-xs text-surface-600">{q.metric.replace('_', ' ')}</td>
                      <td className="py-2 pr-3 font-semibold">
                        {q.metric === 'won_value' ? formatCurrency(Number(q.target_amount)) : Number(q.target_amount)}
                      </td>
                      <td className="py-2 pr-3 text-xs text-surface-500">
                        {new Date(q.start_date).toLocaleDateString()} → {new Date(q.end_date).toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <button onClick={() => handleDelete(q.id)} className="text-red-500 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
