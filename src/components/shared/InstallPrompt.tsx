'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Download, Share } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const STORAGE_KEY = 'tracktio-install-dismissed'
const VIEW_COUNT_KEY = 'tracktio-page-views'
const MIN_VIEWS = 3

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // Check if already dismissed
    if (localStorage.getItem(STORAGE_KEY)) return

    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) return

    // Increment page view count
    const views = parseInt(localStorage.getItem(VIEW_COUNT_KEY) || '0', 10) + 1
    localStorage.setItem(VIEW_COUNT_KEY, String(views))
    if (views < MIN_VIEWS) return

    // Detect iOS
    const ua = navigator.userAgent
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
    setIsIOS(isIOSDevice)

    if (isIOSDevice) {
      // iOS doesn't fire beforeinstallprompt, show manual instructions
      setShowBanner(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowBanner(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowBanner(false)
    }
    setDeferredPrompt(null)
  }, [deferredPrompt])

  const handleDismiss = useCallback(() => {
    setShowBanner(false)
    localStorage.setItem(STORAGE_KEY, 'true')
  }, [])

  if (!showBanner) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="flex items-center gap-3 rounded-xl border border-surface-200 bg-white p-4 shadow-lg">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-600">
          <Download className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-surface-900">Install Tracktio</p>
          {isIOS ? (
            <p className="text-xs text-surface-500 mt-0.5">
              Tap <Share className="inline h-3 w-3" /> Share, then &quot;Add to Home Screen&quot;
            </p>
          ) : (
            <p className="text-xs text-surface-500 mt-0.5">
              Get a faster, app-like experience
            </p>
          )}
        </div>
        {!isIOS && (
          <button
            onClick={handleInstall}
            className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 transition-colors"
          >
            Install
          </button>
        )}
        <button
          onClick={handleDismiss}
          className="shrink-0 rounded-md p-1 text-surface-400 hover:text-surface-600 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
