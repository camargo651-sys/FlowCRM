'use client'
import { useEffect, useState } from 'react'
import { Plus, Trash2, Copy, Calendar, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

interface BookingLink {
  id: string
  workspace_id: string
  slug: string
  title: string
  description: string | null
  duration_minutes: number
  buffer_minutes: number
  availability: Record<string, string[]>
  timezone: string
  active: boolean
}

const DAYS: { key: string; label: string }[] = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
]

const DEFAULT_AVAIL = {
  mon: ['09:00-17:00'],
  tue: ['09:00-17:00'],
  wed: ['09:00-17:00'],
  thu: ['09:00-17:00'],
  fri: ['09:00-17:00'],
}

export default function SchedulerPage() {
  const [links, setLinks] = useState<BookingLink[]>([])
  const [workspaceId, setWorkspaceId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)

  const [slug, setSlug] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState(30)
  const [buffer, setBuffer] = useState(15)
  const [availability, setAvailability] = useState<Record<string, string>>({
    mon: '09:00-17:00', tue: '09:00-17:00', wed: '09:00-17:00', thu: '09:00-17:00', fri: '09:00-17:00',
    sat: '', sun: '',
  })

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/booking-links')
      const j = await res.json()
      setLinks(j.links || [])
      if (j.workspace_id) setWorkspaceId(j.workspace_id)
    } catch {
      toast.error('Failed to load')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const resetForm = () => {
    setSlug(''); setTitle(''); setDescription(''); setDuration(30); setBuffer(15)
    setAvailability({ mon: '09:00-17:00', tue: '09:00-17:00', wed: '09:00-17:00', thu: '09:00-17:00', fri: '09:00-17:00', sat: '', sun: '' })
  }

  const handleCreate = async () => {
    if (!slug.trim() || !title.trim()) {
      toast.error('Slug and title required')
      return
    }
    setCreating(true)
    const avail: Record<string, string[]> = {}
    for (const d of DAYS) {
      const v = availability[d.key].trim()
      if (v) avail[d.key] = v.split(',').map(s => s.trim()).filter(Boolean)
    }
    try {
      const res = await fetch('/api/booking-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug, title, description, duration_minutes: duration, buffer_minutes: buffer,
          availability: Object.keys(avail).length ? avail : DEFAULT_AVAIL,
        }),
      })
      const j = await res.json()
      if (j.link) {
        setLinks(prev => [j.link, ...prev])
        toast.success('Booking link created')
        resetForm()
        setShowForm(false)
      } else {
        toast.error(j.error || 'Failed')
      }
    } catch {
      toast.error('Failed')
    }
    setCreating(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this booking link?')) return
    try {
      const res = await fetch(`/api/booking-links?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setLinks(prev => prev.filter(l => l.id !== id))
        toast.success('Deleted')
      } else {
        toast.error('Failed')
      }
    } catch {
      toast.error('Failed')
    }
  }

  const publicUrl = (link: BookingLink) => {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    return `${base}/book/${link.workspace_id}/${link.slug}`
  }

  const copyLink = (link: BookingLink) => {
    navigator.clipboard.writeText(publicUrl(link))
    toast.success('Link copied')
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Meeting Scheduler</h1>
          <p className="text-sm text-surface-500 mt-1">Share booking links so contacts can self-schedule meetings.</p>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition"
        >
          <Plus className="w-4 h-4" /> New link
        </button>
      </div>

      {showForm && (
        <div className="mb-6 bg-white border border-surface-100 rounded-2xl p-5 shadow-sm">
          <h2 className="text-base font-semibold text-surface-900 mb-4">Create booking link</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-surface-600 mb-1">Slug</label>
              <input
                value={slug} onChange={e => setSlug(e.target.value)}
                placeholder="intro-call"
                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-600 mb-1">Title</label>
              <input
                value={title} onChange={e => setTitle(e.target.value)}
                placeholder="30 min intro call"
                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm focus:outline-none focus:border-brand-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-surface-600 mb-1">Description</label>
              <textarea
                value={description} onChange={e => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-600 mb-1">Duration (min)</label>
              <input
                type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value) || 30)}
                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-600 mb-1">Buffer (min)</label>
              <input
                type="number" value={buffer} onChange={e => setBuffer(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-xs font-medium text-surface-600 mb-2">Weekly availability (e.g. 09:00-12:00, 13:00-17:00)</label>
            <div className="space-y-2">
              {DAYS.map(d => (
                <div key={d.key} className="flex items-center gap-3">
                  <span className="w-12 text-xs font-semibold text-surface-700">{d.label}</span>
                  <input
                    value={availability[d.key]}
                    onChange={e => setAvailability(prev => ({ ...prev, [d.key]: e.target.value }))}
                    placeholder="leave empty = unavailable"
                    className="flex-1 px-3 py-2 rounded-lg border border-surface-200 text-sm focus:outline-none focus:border-brand-500"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              onClick={() => { setShowForm(false); resetForm() }}
              className="px-4 py-2 rounded-lg text-sm font-medium text-surface-600 hover:bg-surface-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create link'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-surface-400">Loading...</div>
      ) : links.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-surface-200 rounded-2xl">
          <Calendar className="w-10 h-10 text-surface-300 mx-auto mb-3" />
          <p className="text-sm text-surface-500">No booking links yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {links.map(link => (
            <div key={link.id} className="bg-white border border-surface-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-base font-semibold text-surface-900">{link.title}</h3>
                  <p className="text-xs text-surface-500 mt-0.5">{link.duration_minutes} minutes</p>
                </div>
                <button
                  onClick={() => handleDelete(link.id)}
                  className="text-surface-400 hover:text-red-600 p-1"
                  aria-label="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {link.description && <p className="text-sm text-surface-600 mb-3">{link.description}</p>}
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={() => copyLink(link)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-50 text-surface-700 text-xs font-medium hover:bg-surface-100"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy link
                </button>
                <a
                  href={publicUrl(link)}
                  target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 text-brand-700 text-xs font-medium hover:bg-brand-100"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Preview
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
