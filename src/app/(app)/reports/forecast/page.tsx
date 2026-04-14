'use client'
import ComingSoon from '@/components/shared/ComingSoon'
import { TrendingUp } from 'lucide-react'

export default function ForecastPage() {
  return (
    <ComingSoon
      title="Forecast"
      description="Revenue forecasting based on your pipeline."
      icon={<TrendingUp className="w-7 h-7" />}
      backHref="/reports"
      backLabel="Go to Reports"
    />
  )
}
