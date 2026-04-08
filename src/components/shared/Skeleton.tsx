'use client'
import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-surface-100/80 rounded-lg animate-pulse', className)} />
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-surface-100 p-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => <Skeleton key={i} className="h-3 flex-1" />)}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-3 flex gap-4 border-b border-surface-50">
          {Array.from({ length: cols }).map((_, j) => <Skeleton key={j} className={cn('h-4', j === 0 ? 'w-40' : 'flex-1')} />)}
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-4 flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-xl" />
          <div className="flex-1"><Skeleton className="h-5 w-16 mb-1" /><Skeleton className="h-2 w-20" /></div>
        </div>
      ))}
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div><Skeleton className="h-7 w-40 mb-2" /><Skeleton className="h-3 w-24" /></div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <CardSkeleton />
      <div className="mt-6"><TableSkeleton /></div>
    </div>
  )
}
