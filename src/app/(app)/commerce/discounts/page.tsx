'use client'
import ComingSoon from '@/components/shared/ComingSoon'
import { Tag } from 'lucide-react'

export default function DiscountsPage() {
  return (
    <ComingSoon
      title="Discounts"
      description="Promo codes, bulk discounts and loyalty rules."
      icon={<Tag className="w-7 h-7" />}
    />
  )
}
