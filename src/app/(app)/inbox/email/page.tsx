'use client'
import ComingSoon from '@/components/shared/ComingSoon'
import { Mail } from 'lucide-react'

export default function InboxEmailPage() {
  return (
    <ComingSoon
      title="Email Inbox"
      description="Unified email inbox connected to your CRM."
      icon={<Mail className="w-7 h-7" />}
      backHref="/whatsapp"
      backLabel="Go to WhatsApp inbox"
    />
  )
}
