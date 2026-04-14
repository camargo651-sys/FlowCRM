'use client'
import ComingSoon from '@/components/shared/ComingSoon'
import { CreditCard } from 'lucide-react'

export default function PaymentsPage() {
  return (
    <ComingSoon
      title="Payments"
      description="Track incoming and outgoing payments in one place."
      icon={<CreditCard className="w-7 h-7" />}
      backHref="/invoices"
      backLabel="Go to Invoices"
    />
  )
}
