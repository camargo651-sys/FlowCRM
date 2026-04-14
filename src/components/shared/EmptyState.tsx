'use client'
import Link from 'next/link'
import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ActionDef {
  label: string
  onClick?: () => void
  href?: string
  icon?: ReactNode
}

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: string
  action?: ActionDef
  secondaryAction?: ActionDef
  className?: string
}

function ActionButton({ action, variant }: { action: ActionDef; variant: 'primary' | 'secondary' }) {
  const cls = cn(
    'btn-sm inline-flex items-center gap-1.5',
    variant === 'primary' ? 'btn-primary' : 'border border-surface-200 text-surface-600 hover:bg-surface-50 rounded-lg px-3 py-1.5 text-xs font-medium'
  )
  if (action.href) {
    return (
      <Link href={action.href} className={cls}>
        {action.icon}
        {action.label}
      </Link>
    )
  }
  return (
    <button onClick={action.onClick} className={cls}>
      {action.icon}
      {action.label}
    </button>
  )
}

export default function EmptyState({ icon, title, description, action, secondaryAction, className }: EmptyStateProps) {
  return (
    <div className={cn('text-center py-20 px-6 animate-fade-in', className)}>
      <div className="w-16 h-16 bg-surface-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-surface-400">
        {icon}
      </div>
      <p className="text-surface-800 font-semibold text-base mb-1.5">{title}</p>
      {description && (
        <p className="text-surface-500 text-sm max-w-sm mx-auto mb-5">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {action && <ActionButton action={action} variant="primary" />}
          {secondaryAction && <ActionButton action={secondaryAction} variant="secondary" />}
        </div>
      )}
    </div>
  )
}
