'use client'
import ComingSoon from '@/components/shared/ComingSoon'
import { Percent } from 'lucide-react'

export default function TaxesPage() {
  return (
    <ComingSoon
      title="Taxes"
      description="Tax rules, filings and reports."
      icon={<Percent className="w-7 h-7" />}
      backHref="/accounting"
      backLabel="Go to Accounting"
    />
  )
}
