'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Calendar, Clock, CheckCircle2, ChevronLeft } from 'lucide-react'

interface LinkData {
  id: string
  slug: string
  title: string
  description: string | null
  duration_minutes: number
  timezone: string
  workspace_id: string
}

interface Day {
  date: string
  slots: string[]
}

export default function PublicBookingPage() {
  const params = useParams<{ workspace: string; slug: string }>()
  const [loading, setLoading] = useState(true)
  const [link, setLink] = useState<LinkData | null>(null)
  const [days, setDays] = useState<Day[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/booking-links/${params.slug}/availability?workspace_id=${params.workspace}`)
        const j = await res.json()
        if (!res.ok) { setError(j.error || 'Not found'); return }
        setLink(j.link)
        setDays(j.days || [])
        if (j.days && j.days[0]) setSelectedDate(j.days[0].date)
      } catch {
        setError('Failed to load')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.workspace, params.slug])

  const submit = async () => {
    if (!link || !selectedSlot || !name.trim() || !email.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          link_id: link.id,
          guest_name: name,
          guest_email: email,
          guest_phone: phone || undefined,
          scheduled_at: selectedSlot,
          notes: notes || undefined,
        }),
      })
      const j = await res.json()
      if (j.booking) {
        setConfirmed(true)
      } else {
        setError(j.error || 'Failed')
      }
    } catch {
      setError('Failed')
    }
    setSubmitting(false)
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-surface-400">Loading...</div>
  }
  if (error || !link) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-surface-500">{error || 'Not found'}</p>
        </div>
      </div>
    )
  }

  if (confirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-surface-50">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-surface-900 mb-2">Booking confirmed</h1>
          <p className="text-sm text-surface-600">
            You are scheduled for <strong>{new Date(selectedSlot!).toLocaleString()}</strong>.
          </p>
          <p className="text-xs text-surface-500 mt-4">A confirmation has been sent to {email}.</p>
        </div>
      </div>
    )
  }

  const selectedDay = days.find(d => d.date === selectedDate)

  return (
    <div className="min-h-screen bg-surface-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3">
          {/* Left: Info */}
          <div className="p-6 md:p-8 border-b md:border-b-0 md:border-r border-surface-100 bg-surface-50/50">
            <h1 className="text-xl font-bold text-surface-900 mb-2">{link.title}</h1>
            <div className="flex items-center gap-2 text-sm text-surface-600 mb-3">
              <Clock className="w-4 h-4" /> {link.duration_minutes} minutes
            </div>
            {link.description && (
              <p className="text-sm text-surface-600 leading-relaxed">{link.description}</p>
            )}
          </div>

          {/* Right: Calendar / form */}
          <div className="p-6 md:p-8 md:col-span-2">
            {!selectedSlot ? (
              <>
                <h2 className="text-base font-semibold text-surface-900 mb-4 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Select a date & time
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-surface-500 mb-2">Date</p>
                    <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                      {days.length === 0 && (
                        <p className="text-sm text-surface-400">No availability</p>
                      )}
                      {days.map(d => {
                        const dt = new Date(d.date + 'T00:00:00')
                        const active = d.date === selectedDate
                        return (
                          <button
                            key={d.date}
                            onClick={() => setSelectedDate(d.date)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                              active
                                ? 'bg-brand-600 text-white font-semibold'
                                : 'bg-surface-50 text-surface-700 hover:bg-surface-100'
                            }`}
                          >
                            {dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-surface-500 mb-2">Time</p>
                    <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                      {selectedDay?.slots.map(s => (
                        <button
                          key={s}
                          onClick={() => setSelectedSlot(s)}
                          className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm text-surface-700 hover:border-brand-500 hover:text-brand-700 transition"
                        >
                          {new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </button>
                      ))}
                      {(!selectedDay || selectedDay.slots.length === 0) && (
                        <p className="text-sm text-surface-400">Pick a date first</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={() => setSelectedSlot(null)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-surface-500 hover:text-surface-800 mb-4"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <h2 className="text-base font-semibold text-surface-900 mb-1">Your details</h2>
                <p className="text-xs text-surface-500 mb-4">{new Date(selectedSlot).toLocaleString()}</p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-surface-600 mb-1">Name *</label>
                    <input
                      value={name} onChange={e => setName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-600 mb-1">Email *</label>
                    <input
                      type="email" value={email} onChange={e => setEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-600 mb-1">Phone</label>
                    <input
                      value={phone} onChange={e => setPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-600 mb-1">Notes</label>
                    <textarea
                      value={notes} onChange={e => setNotes(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <button
                    onClick={submit}
                    disabled={submitting || !name.trim() || !email.trim()}
                    className="w-full px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50"
                  >
                    {submitting ? 'Booking...' : 'Confirm booking'}
                  </button>
                  {error && <p className="text-xs text-red-600">{error}</p>}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
