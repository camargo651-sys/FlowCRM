'use client'
import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { requestPushPermission } from '@/lib/notifications/push'

const DISMISS_KEY = 'tracktio_notif_dismissed'

export default function NotificationSetup() {
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window)) return
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return
    } catch {}
    if (Notification.permission === 'default') setShow(true)
  }, [])

  const enable = async () => {
    setBusy(true)
    const ok = await requestPushPermission()
    setBusy(false)
    if (ok) setShow(false)
  }

  const dismiss = () => {
    try {
      if (typeof window !== 'undefined') localStorage.setItem(DISMISS_KEY, '1')
    } catch {}
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 shadow-sm animate-fade-in">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white flex-shrink-0">
        <Bell className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-surface-900">Activar notificaciones</p>
        <p className="text-[11px] text-surface-500">
          Recibe alertas de recordatorios, tickets urgentes y mas.
        </p>
      </div>
      <button
        onClick={enable}
        disabled={busy}
        className="btn-primary btn-sm flex-shrink-0"
      >
        {busy ? 'Activando...' : 'Activar'}
      </button>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="flex h-7 w-7 items-center justify-center rounded-lg text-surface-400 hover:bg-surface-100 hover:text-surface-600 flex-shrink-0"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
