'use client'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">⚠️</span>
        </div>
        <h2 className="text-lg font-bold text-surface-900 mb-2">Something went wrong</h2>
        <p className="text-sm text-surface-500 mb-6">{error.message || 'An unexpected error occurred. Please try again.'}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="btn-primary btn-sm">Try again</button>
          <a href="/dashboard" className="btn-secondary btn-sm">Go to Dashboard</a>
        </div>
      </div>
    </div>
  )
}
