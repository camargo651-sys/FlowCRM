'use client'

import { useState } from 'react'
import { Phone, PhoneOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  contactId: string
  dealId?: string
  phone: string | null | undefined
  size?: 'sm' | 'md'
  variant?: 'icon' | 'full'
  contactName?: string
}

export default function CallButton({ contactId, dealId, phone, size = 'sm', variant = 'icon', contactName }: Props) {
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const disabled = !phone || !phone.trim()

  const handleClick = async () => {
    if (disabled || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/calls/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: contactId, deal_id: dealId, to_number: phone }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Could not start call')
        return
      }
      if (data.mode === 'tel' && data.dial_url) {
        window.location.href = data.dial_url
      } else if (data.mode === 'twilio') {
        toast.success('Call started')
        setShowModal(true)
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Call failed')
    } finally {
      setLoading(false)
    }
  }

  const iconSize = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5'
  const padding = size === 'md' ? 'p-2' : 'p-1.5'

  const title = disabled ? 'No phone number' : `Call ${phone}`

  if (variant === 'full') {
    return (
      <>
        <button
          onClick={handleClick}
          disabled={disabled || loading}
          title={title}
          className="btn-primary btn-sm inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className={`${iconSize} animate-spin`} /> : <Phone className={iconSize} />}
          Call
        </button>
        {showModal && <CallingModal name={contactName || phone || ''} onClose={() => setShowModal(false)} />}
      </>
    )
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={disabled || loading}
        title={title}
        className={`inline-flex items-center justify-center rounded-lg ${padding} text-surface-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed`}
      >
        {loading ? <Loader2 className={`${iconSize} animate-spin`} /> : <Phone className={iconSize} />}
      </button>
      {showModal && <CallingModal name={contactName || phone || ''} onClose={() => setShowModal(false)} />}
    </>
  )
}

function CallingModal({ name, onClose }: { name: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={onClose}>
      <div className="card p-6 w-full max-w-xs text-center" onClick={e => e.stopPropagation()}>
        <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-3">
          <Phone className="w-6 h-6 text-emerald-600 animate-pulse" />
        </div>
        <p className="text-sm font-semibold text-surface-900">Calling {name}...</p>
        <p className="text-[11px] text-surface-500 mt-1">Answer on your Twilio-connected device.</p>
        <button onClick={onClose} className="mt-4 inline-flex items-center gap-1.5 btn-danger btn-sm">
          <PhoneOff className="w-3.5 h-3.5" /> Hang up
        </button>
      </div>
    </div>
  )
}
