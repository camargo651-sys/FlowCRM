'use client'
import ComingSoon from '@/components/shared/ComingSoon'
import { BookOpen } from 'lucide-react'

export default function KnowledgeBasePage() {
  return (
    <ComingSoon
      title="Knowledge Base"
      description="Self-serve help articles for your customers."
      icon={<BookOpen className="w-7 h-7" />}
    />
  )
}
