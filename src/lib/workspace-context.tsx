'use client'
import { createContext, useContext, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getTemplate, type IndustryTemplate } from '@/lib/industry-templates'

interface WorkspaceConfig {
  id: string
  name: string
  industry: string
  plan: string
  primaryColor: string
  logoUrl: string
  template: IndustryTemplate
  customFields: { entity: string; label: string; key: string; type: string; options?: string[] }[]
  loading: boolean
}

const defaultTemplate = getTemplate('generic')

const WorkspaceContext = createContext<WorkspaceConfig>({
  id: '', name: '', industry: 'generic', plan: 'free', primaryColor: '#6172f3',
  logoUrl: '', template: defaultTemplate, customFields: [], loading: true,
})

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<WorkspaceConfig>({
    id: '', name: '', industry: 'generic', plan: 'free', primaryColor: '#6172f3',
    logoUrl: '', template: defaultTemplate, customFields: [], loading: true,
  })

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setConfig(c => ({ ...c, loading: false })); return }

      // Ensure workspace/profile exist (safety net for when DB trigger fails)
      try { await fetch('/api/auth/ensure-workspace', { method: 'POST' }) } catch {}

      // Load active workspace (from localStorage or first owned)
      const activeWsId = typeof window !== 'undefined' ? localStorage.getItem('tracktio_active_workspace') : null

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let ws: any = null
      if (activeWsId) {
        const { data } = await supabase.from('workspaces')
          .select('id, name, industry, plan, primary_color, logo_url, terminology')
          .eq('id', activeWsId).eq('owner_id', user.id).limit(1)
        ws = data?.[0] || null
      }
      if (!ws) {
        const { data } = await supabase.from('workspaces')
          .select('id, name, industry, plan, primary_color, logo_url, terminology')
          .eq('owner_id', user.id).order('created_at').limit(1)
        ws = data?.[0] || null
        if (ws && typeof window !== 'undefined') {
          localStorage.setItem('tracktio_active_workspace', ws.id as string)
        }
      }
      if (!ws) { setConfig(c => ({ ...c, loading: false })); return }

      // Start from industry template, then override with custom terminology
      const template = { ...getTemplate(ws.industry || 'generic') }
      const terminology = ws.terminology as Record<string, { singular: string; plural: string }> | null
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
        plan: ws.plan || 'free',
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
