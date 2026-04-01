import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="text-3xl font-extrabold text-surface-900 mb-2">Page not found</h1>
        <p className="text-surface-500 mb-8">The page you're looking for doesn't exist or has been moved.</p>
        <div className="flex gap-3 justify-center">
          <Link href="/dashboard" className="btn-primary btn-sm px-6">Go to Dashboard</Link>
          <Link href="/" className="btn-secondary btn-sm px-6">Home</Link>
        </div>
      </div>
    </div>
  )
}
