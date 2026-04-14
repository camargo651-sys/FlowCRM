'use client'
import ComingSoon from '@/components/shared/ComingSoon'
import { Clock } from 'lucide-react'

export default function SlaPage() {
  return (
    <ComingSoon
      title="SLA"
      description="Service-level agreements, response targets and escalation."
      icon={<Clock className="w-7 h-7" />}
      backHref="/tickets"
      backLabel="Go to Tickets"
    />
  )
}
