'use client'
import ComingSoon from '@/components/shared/ComingSoon'
import { StickyNote } from 'lucide-react'

export default function WorkspaceNotesPage() {
  return (
    <ComingSoon
      title="Notes"
      description="Team notes and docs, right next to your work."
      icon={<StickyNote className="w-7 h-7" />}
      backHref="/tasks"
      backLabel="Go to Tasks"
    />
  )
}
