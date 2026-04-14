'use client'
import ComingSoon from '@/components/shared/ComingSoon'
import { Package } from 'lucide-react'

export default function CatalogPage() {
  return (
    <ComingSoon
      title="Catalog"
      description="Manage your product catalog across POS, store and quotes."
      icon={<Package className="w-7 h-7" />}
      backHref="/inventory"
      backLabel="Go to Inventory"
    />
  )
}
