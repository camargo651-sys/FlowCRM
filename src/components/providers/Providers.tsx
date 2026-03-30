'use client'
import { I18nProvider } from '@/lib/i18n/context'
import { WorkspaceProvider } from '@/lib/workspace-context'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <WorkspaceProvider>
        {children}
      </WorkspaceProvider>
    </I18nProvider>
  )
}
