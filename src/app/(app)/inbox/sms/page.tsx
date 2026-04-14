'use client'
import ComingSoon from '@/components/shared/ComingSoon'
import { MessageSquare } from 'lucide-react'

export default function InboxSmsPage() {
  return (
    <ComingSoon
      title="SMS Inbox"
      description="Two-way SMS conversations tied to contacts."
      icon={<MessageSquare className="w-7 h-7" />}
      backHref="/whatsapp"
      backLabel="Go to WhatsApp inbox"
    />
  )
}
