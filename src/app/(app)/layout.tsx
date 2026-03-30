import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import GlobalSearch from '@/components/layout/GlobalSearch'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const userName = user.user_metadata?.full_name || ''
  const workspaceName = user.user_metadata?.workspace_name || 'My Workspace'

  return (
    <div className="flex h-screen overflow-hidden bg-surface-50">
      <Sidebar
        userEmail={user.email || ''}
        userName={userName}
        workspaceName={workspaceName}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-8">
          {children}
        </div>
      </main>
      <GlobalSearch />
    </div>
  )
}
