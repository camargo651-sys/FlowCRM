'use client'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'

interface ComingSoonProps {
  title: string
  description?: string
  icon?: React.ReactNode
  backHref?: string
  backLabel?: string
}

export default function ComingSoon({ title, description, icon, backHref, backLabel }: ComingSoonProps) {
  return (
    <div className="p-6">
      <h1 className="page-title mb-1">{title}</h1>
      <p className="text-sm text-surface-500 mb-6">{description || 'This area is under construction.'}</p>
      <div className="card p-10 flex flex-col items-center text-center max-w-2xl">
        <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
          {icon ?? <Sparkles className="w-7 h-7" />}
        </div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-[11px] font-semibold mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Coming soon
        </div>
        <h2 className="text-lg font-bold text-surface-900 mb-1">{title}</h2>
        <p className="text-sm text-surface-500 max-w-md mb-5">
          {description || 'We are working on this feature. Stay tuned.'}
        </p>
        {backHref && (
          <Link href={backHref} className="text-sm font-semibold text-brand-600 hover:text-brand-700">
            {backLabel || 'Go back'}
          </Link>
        )}
      </div>
    </div>
  )
}
