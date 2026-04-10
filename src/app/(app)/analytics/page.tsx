'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Analytics now redirects to BI Dashboard — the more powerful replacement.
 * Keeping this route alive so existing links/bookmarks don't break.
 */
export default function AnalyticsPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/bi') }, [router])
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
    </div>
  )
}
