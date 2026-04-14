'use client'
import ComingSoon from '@/components/shared/ComingSoon'
import { FileText } from 'lucide-react'

export default function FormsPage() {
  return (
    <ComingSoon
      title="Forms"
      description="Build lead-capture forms that sync directly to your CRM."
      icon={<FileText className="w-7 h-7" />}
      backHref="/settings/form-builder"
      backLabel="Try the Form Builder"
    />
  )
}
