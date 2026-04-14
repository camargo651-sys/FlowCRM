'use client'
import ComingSoon from '@/components/shared/ComingSoon'
import { Users } from 'lucide-react'

export default function ClientPortalsPage() {
  return (
    <ComingSoon
      title="Client Portals"
      description="Branded portals where clients can view invoices, tickets and files."
      icon={<Users className="w-7 h-7" />}
    />
  )
}
