'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Tag } from 'lucide-react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'

interface LossReason {
  id: string
  label: string
  color: string
  order_index: number
  archived: boolean
}

const PRESET_COLORS = ['#ef4444', '#f97316', '#eab308', '#10b981', '#3b82f6', '#8b5cf6', '#a855f7', '#ec4899', '#94a3b8']

export default function LossReasonsSettingsPage() {
  const { t } = useI18n()
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
      toast.error(t('settings.lr.load_failed'))
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
        toast.success(t('settings.lr.added'))
      } else {
        toast.error(j.error || t('settings.lr.add_failed'))
      }
    } catch {
      toast.error(t('settings.lr.add_failed'))
    }
    setCreating(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('settings.lr.archive_confirm'))) return
    try {
      const res = await fetch(`/api/loss-reasons?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setReasons(prev => prev.filter(r => r.id !== id))
        toast.success(t('settings.lr.archived'))
      } else {
        toast.error(t('settings.lr.archive_failed'))
      }
    } catch {
      toast.error(t('settings.lr.archive_failed'))
    }
  }

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><Tag className="w-5 h-5" /> {t('settings.lr.title')}</h1>
          <p className="page-subtitle">{t('settings.lr.desc')}</p>
        </div>
        <Link href="/settings" className="btn-secondary btn-sm">{t('settings.back')}</Link>
      </div>

      <div className="card p-4 mb-4">
        <p className="text-[11px] font-bold text-surface-500 uppercase tracking-wider mb-2">{t('settings.lr.add_new')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            className="input text-sm flex-1 min-w-[180px]"
            placeholder={t('settings.lr.placeholder')}
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
            <Plus className="w-3.5 h-3.5" /> {t('settings.lr.add')}
          </button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-2 border-b border-surface-100 bg-surface-50">
          <p className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">{t('settings.lr.existing')}</p>
        </div>
        {loading ? (
          <div className="p-6 text-center text-sm text-surface-400">{t('settings.lr.loading')}</div>
        ) : reasons.length === 0 ? (
          <div className="p-6 text-center text-sm text-surface-400">{t('settings.lr.empty')}</div>
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
                  aria-label={t('settings.lr.archived')}
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
