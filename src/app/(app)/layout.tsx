import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import GlobalSearch from '@/components/layout/GlobalSearch'
import QuickCreate from '@/components/layout/QuickCreate'
import MobileNav from '@/components/layout/MobileNav'
import Breadcrumbs from '@/components/shared/Breadcrumbs'
import { Toaster } from 'sonner'
import KeyboardShortcuts from '@/components/shared/KeyboardShortcuts'
import InactivityLock from '@/components/shared/InactivityLock'
import InstallPrompt from '@/components/shared/InstallPrompt'
import ErrorBoundary from '@/components/shared/ErrorBoundary'
import GoogleAnalytics from '@/components/shared/GoogleAnalytics'
import FacebookPixel from '@/components/shared/FacebookPixel'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const userName = user.user_metadata?.full_name || ''
  const workspaceName = user.user_metadata?.workspace_name || 'My Workspace'

  const sidebar = (
    <Sidebar
      userEmail={user.email || ''}
      userName={userName}
      workspaceName={workspaceName}
    />
  )

  return (
    <div className="flex h-screen overflow-hidden bg-surface-50">
      <MobileNav>{sidebar}</MobileNav>
      <main className="flex-1 overflow-y-auto min-w-0">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 lg:py-8 pt-14 md:pt-6 lg:pt-8 pb-20 md:pb-6">
          <Breadcrumbs />
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </main>
      <GlobalSearch />
      <QuickCreate />
      <Toaster position="bottom-right" richColors closeButton />
      <KeyboardShortcuts />
      <InactivityLock />
      <InstallPrompt />
      <GoogleAnalytics />
      <FacebookPixel />
    </div>
  )
}
