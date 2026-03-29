'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, GripVertical, Save, Settings, Kanban, Palette, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PipelineStage } from '@/types'

const STAGE_COLORS = ['#6172f3','#8b5cf6','#ec4899','#f97316','#f59e0b','#10b981','#06b6d4','#64748b']

export default function SettingsPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<'pipeline' | 'workspace' | 'team'>('pipeline')
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [workspaceId, setWorkspaceId] = useState('')
  const [pipelineId, setPipelineId] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: ws } = await supabase.from('workspaces').select('*').eq('owner_id', user.id).single()
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)
    setWorkspaceName(ws.name)

    let pipeline = await supabase.from('pipelines').select('*').eq('workspace_id', ws.id).single()
    if (!pipeline.data) {
      const { data: newPipeline } = await supabase.from('pipelines').insert([{ workspace_id: ws.id, name: 'Sales Pipeline', color: '#6172f3', order_index: 0 }]).select().single()
      pipeline = { data: newPipeline } as any
    }
    if (!pipeline.data) { setLoading(false); return }
    setPipelineId(pipeline.data.id)

    const { data: stagesData } = await supabase.from('pipeline_stages').select('*').eq('workspace_id', ws.id).order('order_index')
    if (stagesData && stagesData.length > 0) {
      setStages(stagesData)
    } else {
      // Default stages
      const defaults = ['Lead','Qualified','Proposal','Negotiation','Closed Won'].map((name, i) => ({
        pipeline_id: pipeline.data!.id, workspace_id: ws.id, name, order_index: i,
        color: STAGE_COLORS[i], win_stage: name === 'Closed Won', lost_stage: false,
      }))
      const { data: created } = await supabase.from('pipeline_stages').insert(defaults).select()
      setStages(created || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const addStage = () => {
    const newStage: Partial<PipelineStage> = {
      id: `temp-${Date.now()}`, pipeline_id: pipelineId, workspace_id: workspaceId,
      name: 'New Stage', order_index: stages.length, color: STAGE_COLORS[stages.length % STAGE_COLORS.length],
      win_stage: false, lost_stage: false, created_at: new Date().toISOString(),
    }
    setStages(prev => [...prev, newStage as PipelineStage])
  }

  const updateStage = (id: string, field: string, value: any) => {
    setStages(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  const removeStage = (id: string) => {
    setStages(prev => prev.filter(s => s.id !== id))
  }

  const saveStages = async () => {
    setSaving(true)
    const toUpsert = stages.map((s, i) => ({ ...s, order_index: i, id: s.id.startsWith('temp-') ? undefined : s.id }))
    // Delete removed stages
    const existing = stages.filter(s => !s.id.startsWith('temp-')).map(s => s.id)
    if (existing.length > 0) {
      await supabase.from('pipeline_stages').delete().eq('workspace_id', workspaceId).not('id', 'in', `(${existing.join(',')})`)
    }
    for (const stage of toUpsert) {
      if (!stage.id) {
        await supabase.from('pipeline_stages').insert([stage])
      } else {
        await supabase.from('pipeline_stages').update(stage).eq('id', stage.id)
      }
    }
    await load()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const saveWorkspace = async () => {
    setSaving(true)
    await supabase.from('workspaces').update({ name: workspaceName }).eq('id', workspaceId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const TABS = [
    { id: 'pipeline', label: 'Pipeline', icon: Kanban },
    { id: 'workspace', label: 'Workspace', icon: Palette },
    { id: 'team', label: 'Team', icon: Users },
  ] as const

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in max-w-3xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="text-sm text-surface-500 mt-0.5">Configure your workspace</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-surface-100 rounded-xl w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all', tab === id ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500 hover:text-surface-700')}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* Pipeline tab */}
      {tab === 'pipeline' && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-surface-900">Pipeline Stages</h2>
              <p className="text-xs text-surface-500 mt-0.5">Drag to reorder. Configure your sales stages.</p>
            </div>
            <button onClick={addStage} className="btn-secondary btn-sm"><Plus className="w-3.5 h-3.5" /> Add Stage</button>
          </div>

          <div className="space-y-2 mb-5">
            {stages.map((stage, i) => (
              <div key={stage.id} className="flex items-center gap-3 p-3 bg-surface-50 rounded-xl border border-surface-100">
                <GripVertical className="w-4 h-4 text-surface-300 flex-shrink-0 cursor-grab" />
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {/* Color picker */}
                  <div className="relative flex-shrink-0">
                    <div className="w-7 h-7 rounded-lg border-2 border-white shadow-sm cursor-pointer flex items-center justify-center" style={{ backgroundColor: stage.color }}>
                      <input type="color" value={stage.color} onChange={e => updateStage(stage.id, 'color', e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                    </div>
                  </div>
                  <input value={stage.name} onChange={e => updateStage(stage.id, 'name', e.target.value)}
                    className="flex-1 bg-transparent text-sm font-medium text-surface-800 focus:outline-none border-b border-transparent focus:border-brand-400 pb-0.5 min-w-0" />
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={stage.win_stage} onChange={e => updateStage(stage.id, 'win_stage', e.target.checked)} className="w-3.5 h-3.5 accent-emerald-500" />
                    <span className="text-[10px] font-semibold text-emerald-600 uppercase">Won</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={stage.lost_stage} onChange={e => updateStage(stage.id, 'lost_stage', e.target.checked)} className="w-3.5 h-3.5 accent-red-500" />
                    <span className="text-[10px] font-semibold text-red-500 uppercase">Lost</span>
                  </label>
                  <button onClick={() => removeStage(stage.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-surface-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button onClick={saveStages} disabled={saving} className="btn-primary">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? 'Saved!' : 'Save Pipeline'}
          </button>
        </div>
      )}

      {/* Workspace tab */}
      {tab === 'workspace' && (
        <div className="card p-6">
          <h2 className="font-semibold text-surface-900 mb-4">Workspace Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Workspace Name</label>
              <input className="input" value={workspaceName} onChange={e => setWorkspaceName(e.target.value)} placeholder="My Company" />
            </div>
            <button onClick={saveWorkspace} disabled={saving} className="btn-primary">
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              {saved ? 'Saved!' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Team tab */}
      {tab === 'team' && (
        <div className="card p-6">
          <h2 className="font-semibold text-surface-900 mb-1">Team Members</h2>
          <p className="text-sm text-surface-500 mb-4">Invite teammates to collaborate on your workspace.</p>
          <div className="p-8 text-center border-2 border-dashed border-surface-200 rounded-xl">
            <Users className="w-10 h-10 text-surface-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-surface-600">Team invitations</p>
            <p className="text-xs text-surface-400 mt-1">Coming in the next update</p>
          </div>
        </div>
      )}
    </div>
  )
}
