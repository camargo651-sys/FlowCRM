'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import OnboardingWizard from '@/components/onboarding/OnboardingWizard'

export default function DashboardClient() {
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [workspaceId, setWorkspaceId] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')

  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: ws } = await supabase.from('workspaces').select('id, name, onboarding_completed').eq('owner_id', user.id).single()
      if (ws && !ws.onboarding_completed) {
        setWorkspaceId(ws.id)
        setWorkspaceName(ws.name)
        setShowOnboarding(true)
      }
    }
    check()
  }, [])

  if (!showOnboarding) return null

  return (
    <OnboardingWizard
      workspaceId={workspaceId}
      workspaceName={workspaceName}
      onComplete={() => setShowOnboarding(false)}
    />
  )
}
