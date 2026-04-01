'use client'
import { List, LayoutGrid, Table2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type ViewMode = 'table' | 'grid' | 'kanban'

interface ViewToggleProps {
  view: ViewMode
  onChange: (view: ViewMode) => void
  options?: ViewMode[]
}

export default function ViewToggle({ view, onChange, options = ['table', 'grid'] }: ViewToggleProps) {
  const ICONS: Record<ViewMode, any> = { table: List, grid: LayoutGrid, kanban: Table2 }

  return (
    <div className="flex bg-surface-100 dark:bg-surface-800 rounded-lg p-0.5">
      {options.map(mode => {
        const Icon = ICONS[mode]
        return (
          <button key={mode} onClick={() => onChange(mode)}
            className={cn('p-1.5 rounded-md transition-all',
              view === mode ? 'bg-white dark:bg-surface-700 shadow-sm text-surface-900 dark:text-white' : 'text-surface-400 hover:text-surface-600')}>
            <Icon className="w-3.5 h-3.5" />
          </button>
        )
      })}
    </div>
  )
}
