'use client'

import { Zap, WifiOff } from 'lucide-react'

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-50 px-4">
      <div className="text-center max-w-sm">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600">
          <Zap className="h-8 w-8 text-white" />
        </div>
        <WifiOff className="mx-auto mb-4 h-10 w-10 text-surface-400" />
        <h1 className="text-xl font-semibold text-surface-900 mb-2">You're offline</h1>
        <p className="text-surface-500 mb-6">
          Tracktio needs an internet connection to work. Check your connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  )
}
