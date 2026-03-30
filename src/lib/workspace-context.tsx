'use client'
import { createContext, useContext, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getTemplate, type IndustryTemplate } from '@/lib/industry-templates'

interface WorkspaceConfig {
  id: string
  name: string
  industry: string
  primaryColor: string
  logoUrl: string
  template: IndustryTemplate
  customFields: { entity: string; label: string; key: string; type: string; options?: string[] }[]
  loading: boolean
}

const defaultTemplate = getTemplate('generic')

const WorkspaceContext = createContext<WorkspaceConfig>({
  id: '', name: '', industry: 'generic', primaryColor: '#6172f3',
  logoUrl: '', template: defaultTemplate, customFields: [], loading: true,
})

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<WorkspaceConfig>({
    id: '', name: '', industry: 'generic', primaryColor: '#6172f3',
    logoUrl: '', template: defaultTemplate, customFields: [], loading: true,
  })

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setConfig(c => ({ ...c, loading: false })); return }

      const { data: ws } = await supabase.from('workspaces')
        .select('id, name, industry, primary_color, logo_url, terminology')
        .eq('owner_id', user.id).single()
      if (!ws) { setConfig(c => ({ ...c, loading: false })); return }

      // Start from industry template, then override with custom terminology
      const template = { ...getTemplate(ws.industry || 'generic') }
      const terminology = ws.terminology as any
      if (terminology) {
        if (terminology.deal) template.dealLabel = terminology.deal
        if (terminology.contact) template.contactLabel = terminology.contact
      }

      const { data: fields } = await supabase.from('custom_field_defs')
        .select('entity, label, key, type, options')
        .eq('workspace_id', ws.id)
        .order('order_index')

      setConfig({
        id: ws.id,
        name: ws.name,
        industry: ws.industry || 'generic',
        primaryColor: ws.primary_color || '#6172f3',
        logoUrl: ws.logo_url || '',
        template,
        customFields: fields || [],
        loading: false,
      })
    }
    load()
  }, [])

  return (
    <WorkspaceContext.Provider value={config}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export const useWorkspace = () => useContext(WorkspaceContext)
