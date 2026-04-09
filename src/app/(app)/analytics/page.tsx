'use client'
import { useI18n } from '@/lib/i18n/context'
import { BarChart2 } from 'lucide-react'

export default function AnalyticsPage() {
  const { t } = useI18n()

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav.analytics')}</h1>
          <p className="text-sm text-surface-500 mt-0.5">Business intelligence and reports</p>
        </div>
      </div>

      <div className="card text-center py-20">
        <div className="empty-state-icon mx-auto">
          <BarChart2 className="w-7 h-7 text-surface-400" />
        </div>
        <p className="text-base font-semibold text-surface-700 mt-4 mb-1">Analytics coming soon</p>
        <p className="text-sm text-surface-400 max-w-xs mx-auto">
          Revenue trends, channel performance, and custom dashboards are on the way.
        </p>
      </div>
    </div>
  )
}
