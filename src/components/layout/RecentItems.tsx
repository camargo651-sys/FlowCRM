'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, TrendingUp, Receipt, Ticket, Sparkles, FileText, Clock } from 'lucide-react'
import { getRecent, RecentItem, RecentItemType } from '@/lib/recent/items'
import { cn } from '@/lib/utils'

const ICON_MAP: Record<RecentItemType, React.ComponentType<{ className?: string }>> = {
  contact: User,
  deal: TrendingUp,
  invoice: Receipt,
  ticket: Ticket,
  lead: Sparkles,
  quote: FileText,
}

export default function RecentItems() {
  const router = useRouter()
  const [items, setItems] = useState<RecentItem[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const refresh = () => setItems(getRecent().slice(0, 5))
    refresh()
    window.addEventListener('tracktio:recent-updated', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('tracktio:recent-updated', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  if (!mounted || items.length === 0) return null

  return (
    <div className="px-2.5 pt-2 pb-2 border-t border-surface-100/80">
      <p className="text-[9px] font-bold text-surface-400 uppercase tracking-widest mb-1.5 px-1 flex items-center gap-1">
        <Clock className="w-2.5 h-2.5" /> Recientes
      </p>
      <div className="space-y-0.5">
        {items.map(item => {
          const Icon = ICON_MAP[item.type] || User
          return (
            <button
              key={`${item.type}-${item.id}`}
              onClick={() => router.push(item.href)}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] text-surface-500 hover:bg-surface-50 hover:text-surface-800 transition-colors text-left'
              )}
              title={item.label}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0 text-surface-400" />
              <span className="truncate flex-1">{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
