'use client'
import { useEffect, useState } from 'react'
import { WifiOff, Wifi } from 'lucide-react'
import { toast } from 'sonner'

export default function OfflineBanner() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    if (typeof navigator === 'undefined') return
    setOffline(!navigator.onLine)

    const handleOffline = () => setOffline(true)
    const handleOnline = () => {
      setOffline(false)
      toast.success('Back online', { duration: 3000, icon: <Wifi className="h-4 w-4" /> })
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  if (!offline) return null

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-xs font-medium text-white shadow">
      <WifiOff className="h-3.5 w-3.5" />
      You&apos;re offline — changes will sync when you reconnect
    </div>
  )
}
