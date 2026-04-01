'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Building2, Plus, Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Workspace {
  id: string
  name: string
  industry: string | null
  primary_color: string | null
}

export default function WorkspaceSwitcher({ currentName, currentColor }: { currentName: string; currentColor: string }) {
  const supabase = createClient()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [open, setOpen] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [currentId, setCurrentId] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get all workspaces where user is owner or member
      const { data: owned } = await supabase.from('workspaces').select('id, name, industry, primary_color').eq('owner_id', user.id)
      const { data: memberOf } = await supabase.from('profiles').select('workspace_id, workspaces(id, name, industry, primary_color)').eq('id', user.id)

      const all = new Map<string, Workspace>()
      for (const ws of owned || []) all.set(ws.id, ws)
      for (const p of memberOf || []) {
        const ws = (p as any).workspaces
        if (ws) all.set(ws.id, ws)
      }

      setWorkspaces(Array.from(all.values()))

      // Current workspace
      const { data: current } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
      if (current) setCurrentId(current.id)
    }
    load()
  }, [])

  const createWorkspace = async () => {
    if (!newName.trim()) return
    setCreating(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const slug = newName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
    const { data } = await supabase.from('workspaces').insert({
      name: newName, slug, owner_id: user.id, plan: 'free',
    }).select('id').single()

    if (data) {
      await supabase.from('profiles').insert({
        id: user.id, workspace_id: data.id, full_name: user.user_metadata?.full_name || '',
        email: user.email, role: 'admin',
      })
      window.location.reload()
    }
    setCreating(false)
  }

  if (workspaces.length <= 1 && !open) return null

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[10px] text-surface-400 hover:text-surface-600 transition-colors">
        <Building2 className="w-3 h-3" />
        <span>{workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-xl shadow-lg border border-surface-100 z-50 p-1.5">
            {workspaces.map(ws => (
              <button key={ws.id}
                onClick={() => { /* switch workspace logic */ setOpen(false) }}
                className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors text-xs',
                  ws.id === currentId ? 'bg-brand-50 text-brand-700' : 'hover:bg-surface-50 text-surface-700')}>
                <div className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[9px] font-bold"
                  style={{ backgroundColor: ws.primary_color || '#6172f3' }}>
                  {ws.name.charAt(0)}
                </div>
                <span className="flex-1 truncate font-medium">{ws.name}</span>
                {ws.id === currentId && <Check className="w-3 h-3 text-brand-600" />}
              </button>
            ))}

            <div className="border-t border-surface-100 mt-1 pt-1">
              {showNew ? (
                <div className="px-2 py-1.5 space-y-1.5">
                  <input className="w-full px-2 py-1.5 text-xs border border-surface-200 rounded-lg outline-none focus:border-brand-500"
                    placeholder="Company name" value={newName} onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && createWorkspace()} autoFocus />
                  <div className="flex gap-1">
                    <button onClick={() => setShowNew(false)} className="flex-1 px-2 py-1 text-[10px] bg-surface-100 rounded-md font-medium">Cancel</button>
                    <button onClick={createWorkspace} disabled={!newName.trim() || creating}
                      className="flex-1 px-2 py-1 text-[10px] bg-brand-600 text-white rounded-md font-medium">Create</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowNew(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-surface-500 hover:bg-surface-50">
                  <Plus className="w-3.5 h-3.5" /> New workspace
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
