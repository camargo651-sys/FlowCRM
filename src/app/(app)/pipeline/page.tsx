'use client'
import { toast } from 'sonner'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Filter, X, DollarSign, Calendar, User } from 'lucide-react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { formatCurrency, getInitials, cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace-context'
import { useI18n } from '@/lib/i18n/context'
import type { Deal, PipelineStage, Contact, DbRow } from '@/types'

interface DealWithContact extends Deal {
  contacts?: { name: string; email?: string } | null
}

interface Column extends PipelineStage {
  deals: DealWithContact[]
}

// --- NEW DEAL MODAL ---
function NewDealModal({ stages, contacts, onClose, onSave, workspaceId, customFields, template }: {
  stages: PipelineStage[], contacts: Pick<Contact, 'id' | 'name' | 'email'>[], onClose: () => void,
  onSave: (deal: Partial<Deal>) => void, workspaceId: string,
  customFields: { entity: string; label: string; key: string; type: string; options?: string[] }[],
  template: { key?: string; name?: string; dealLabel: { singular: string; plural: string }; contactLabel: { singular: string; plural: string } },
}) {
  const [title, setTitle] = useState('')
  const [value, setValue] = useState('')
  const [stageId, setStageId] = useState(stages[0]?.id || '')
  const [contactId, setContactId] = useState('')
  const [closeDate, setCloseDate] = useState('')
  const [customValues, setCustomValues] = useState<DbRow>({})

  const dealFields = customFields.filter(f => f.entity === 'deal')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      title, value: value ? parseFloat(value) : undefined,
      stage_id: stageId, contact_id: contactId || undefined,
      expected_close_date: closeDate || undefined,
      workspace_id: workspaceId, status: 'open', currency: 'USD', order_index: 0,
      custom_fields: Object.keys(customValues).length > 0 ? customValues : undefined,
    })
    onClose()
  }

  return (
    <div className="modal-overlay">
      <div className="modal-panel max-w-md">
        <div className="modal-header">
          <h2>New {template.dealLabel.singular}</h2>
          <button onClick={onClose} className="modal-close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body space-y-4">
          <div>
            <label className="label">{template.dealLabel.singular} title *</label>
            <input className="input" required value={title} onChange={e => setTitle(e.target.value)}
              placeholder={template.key === 'real_estate' ? 'e.g. 3BR Apartment Downtown' : template.key === 'distribution' ? 'e.g. Weekly Order - Store #42' : 'e.g. Acme Corp - Enterprise Plan'} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Value</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400" />
                <input className="input pl-8" type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div>
              <label className="label">{template.key === 'distribution' ? 'Delivery date' : 'Close date'}</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400" />
                <input className="input pl-8" type="date" value={closeDate} onChange={e => setCloseDate(e.target.value)} />
              </div>
            </div>
          </div>
          <div>
            <label className="label">Stage</label>
            <select className="input" value={stageId} onChange={e => setStageId(e.target.value)}>
              {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{template.contactLabel.singular}</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400" />
              <select className="input pl-8" value={contactId} onChange={e => setContactId(e.target.value)}>
                <option value="">No {template.contactLabel.singular.toLowerCase()}</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Industry-specific custom fields */}
          {dealFields.length > 0 && (
            <div className="pt-2 border-t border-surface-100">
              <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wide mb-3">
                {template.name} Details
              </p>
              <div className="space-y-3">
                {dealFields.map(field => (
                  <div key={field.key}>
                    <label className="label">{field.label}</label>
                    {field.type === 'select' && field.options ? (
                      <select className="input" value={customValues[field.key] || ''}
                        onChange={e => setCustomValues(v => ({ ...v, [field.key]: e.target.value }))}>
                        <option value="">Select...</option>
                        {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : field.type === 'boolean' ? (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={customValues[field.key] || false}
                          onChange={e => setCustomValues(v => ({ ...v, [field.key]: e.target.checked }))}
                          className="w-4 h-4 accent-brand-600" />
                        <span className="text-sm text-surface-600">{field.label}</span>
                      </label>
                    ) : field.type === 'date' ? (
                      <input type="date" className="input" value={customValues[field.key] || ''}
                        onChange={e => setCustomValues(v => ({ ...v, [field.key]: e.target.value }))} />
                    ) : field.type === 'number' || field.type === 'currency' ? (
                      <input type="number" className="input" value={customValues[field.key] || ''}
                        placeholder="0"
                        onChange={e => setCustomValues(v => ({ ...v, [field.key]: e.target.value }))} />
                    ) : field.type === 'url' ? (
                      <input type="url" className="input" value={customValues[field.key] || ''}
                        placeholder="https://..."
                        onChange={e => setCustomValues(v => ({ ...v, [field.key]: e.target.value }))} />
                    ) : (
                      <input type="text" className="input" value={customValues[field.key] || ''}
                        onChange={e => setCustomValues(v => ({ ...v, [field.key]: e.target.value }))} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1">Create {template.dealLabel.singular}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// --- DEAL CARD ---
function DealCard({ deal, onClick }: { deal: DealWithContact; onClick: () => void }) {
  return (
    <div onClick={onClick} className="deal-card">
      <p className="text-sm font-semibold text-surface-800 mb-1 leading-snug">{deal.title}</p>
      {deal.contacts?.name && (
        <p className="text-xs text-surface-400 mb-2.5 flex items-center gap-1">
          <span className="w-4 h-4 bg-violet-100 text-violet-600 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0">
            {getInitials(deal.contacts.name)}
          </span>
          {deal.contacts.name}
        </p>
      )}
      {/* Show some custom fields on card */}
      {deal.custom_fields && typeof deal.custom_fields === 'object' && Object.keys(deal.custom_fields as object).length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {Object.entries(deal.custom_fields as DbRow).slice(0, 2).map(([key, val]) => (
            val && <span key={key} className="badge-gray text-[9px]">{String(val)}</span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between mt-2">
        {deal.value ? (
          <span className="text-sm font-bold text-surface-900">{formatCurrency(deal.value)}</span>
        ) : (
          <span className="text-xs text-surface-300">No value set</span>
        )}
        {deal.expected_close_date && (
          <span className="text-[10px] text-surface-400 font-medium">
            {new Date(deal.expected_close_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
    </div>
  )
}

// --- MAIN PAGE ---
interface PipelineInfo {
  id: string
  name: string
  color: string
  contact_id?: string | null
  contacts?: { name: string } | null
}

export default function PipelinePage() {
  const supabase = createClient()
  const { template, customFields } = useWorkspace()
  const { t } = useI18n()
  const [pipelines, setPipelines] = useState<PipelineInfo[]>([])
  const [activePipelineId, setActivePipelineId] = useState<string>('')
  const [columns, setColumns] = useState<Column[]>([])
  const [contacts, setContacts] = useState<Pick<Contact, 'id' | 'name' | 'email'>[]>([])
  const [workspaceId, setWorkspaceId] = useState<string>('')
  const [showNewDeal, setShowNewDeal] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async (pipelineId?: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)

    // Load all pipelines
    const { data: pipelinesData } = await supabase.from('pipelines').select('id, name, color, contact_id, contacts(name)').eq('workspace_id', ws.id).order('order_index')
    const allPipelines = pipelinesData || []
    setPipelines(allPipelines as unknown as PipelineInfo[])

    // Pick active pipeline
    const activeId = pipelineId || allPipelines[0]?.id || ''
    setActivePipelineId(activeId)

    if (!activeId) { setLoading(false); return }

    const [stagesRes, dealsRes, contactsRes] = await Promise.all([
      supabase.from('pipeline_stages').select('*').eq('pipeline_id', activeId).order('order_index'),
      supabase.from('deals').select('*, contacts(name, email)').eq('workspace_id', ws.id).eq('pipeline_id', activeId).eq('status', 'open').order('order_index'),
      supabase.from('contacts').select('id, name, email').eq('workspace_id', ws.id).order('name'),
    ])

    const stages: PipelineStage[] = stagesRes.data || []
    const deals: DealWithContact[] = dealsRes.data || []
    setContacts(contactsRes.data || [])

    setColumns(stages.map(stage => ({
      ...stage,
      deals: deals.filter(d => d.stage_id === stage.id),
    })))
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const switchPipeline = (pipelineId: string) => {
    setLoading(true)
    loadData(pipelineId)
  }

  const handleCreateDeal = async (dealData: Partial<Deal>) => {
    const dataWithPipeline = { ...dealData, pipeline_id: activePipelineId }
    const { data } = await supabase.from('deals').insert([dataWithPipeline]).select('*, contacts(name, email)').single()
    if (data) {
      setColumns(prev => prev.map(col =>
        col.id === dealData.stage_id ? { ...col, deals: [...col.deals, data] } : col
      ))
    }
  }

  const handleMoveDeal = async (dealId: string, newStageId: string) => {
    await supabase.from('deals').update({ stage_id: newStageId }).eq('id', dealId)
    setColumns(prev => {
      const deal = prev.flatMap(c => c.deals).find(d => d.id === dealId)
      if (!deal) return prev
      return prev.map(col => ({
        ...col,
        deals: col.id === newStageId
          ? [...col.deals.filter(d => d.id !== dealId), { ...deal, stage_id: newStageId }]
          : col.deals.filter(d => d.id !== dealId),
      }))
    })
  }

  const filteredColumns = columns.map(col => ({
    ...col,
    deals: col.deals.filter(d =>
      !search || d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.contacts?.name?.toLowerCase().includes(search.toLowerCase())
    ),
  }))

  const totalValue = columns.flatMap(c => c.deals).reduce((s, d) => s + (d.value || 0), 0)
  const totalDeals = columns.flatMap(c => c.deals).length
  const activePipeline = pipelines.find(p => p.id === activePipelineId)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="animate-fade-in flex flex-col h-full">
      {/* Header */}
      <div className="page-header flex-shrink-0">
        <div>
          <h1 className="page-title">{template.dealLabel.plural}</h1>
          <p className="page-subtitle">
            {totalDeals} {template.dealLabel.plural.toLowerCase()} · {formatCurrency(totalValue)} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input className="input pl-9 w-56 text-xs"
              placeholder={`Search ${template.dealLabel.plural.toLowerCase()}...`}
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={() => setShowNewDeal(true)} className="btn-primary btn-sm">
            <Plus className="w-3.5 h-3.5" /> New {template.dealLabel.singular}
          </button>
        </div>
      </div>

      {/* Pipeline selector - only show if multiple pipelines */}
      {pipelines.length > 1 && (
        <div className="segmented-control mb-4 flex-shrink-0 overflow-x-auto no-scrollbar">
          {pipelines.map(p => (
            <button key={p.id} onClick={() => switchPipeline(p.id)}
              data-active={activePipelineId === p.id}
              className={cn(activePipelineId === p.id && 'active')}>
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
              <span>{p.name}</span>
              {p.contacts?.name && (
                <span className="text-[10px] px-1.5 py-0.5 bg-surface-200/50 rounded-full text-surface-400 font-medium">
                  {p.contacts.name}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* No pipeline */}
      {columns.length === 0 && pipelines.length === 0 && (
        <div className="empty-state flex-1">
          <div className="empty-state-icon">
            <Filter className="w-7 h-7 text-surface-300" />
          </div>
          <p className="empty-state-title">No pipeline yet</p>
          <p className="empty-state-desc">Go to Settings to create your pipeline and start tracking deals.</p>
          <a href="/settings" className="btn-primary">Set up pipeline</a>
        </div>
      )}

      {/* Kanban with drag-drop */}
      {columns.length > 0 && (
        <DragDropContext onDragEnd={(result: DropResult) => {
          if (!result.destination) return
          const dealId = result.draggableId
          const newStageId = result.destination.droppableId
          if (result.source.droppableId !== newStageId) {
            handleMoveDeal(dealId, newStageId)
          }
        }}>
          <div className="flex gap-4 overflow-x-auto pb-4 flex-1 no-scrollbar">
            {filteredColumns.map(col => {
              const colValue = col.deals.reduce((s, d) => s + (d.value || 0), 0)
              return (
                <div key={col.id} className="flex-shrink-0 w-72 flex flex-col">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color || '#6172f3' }} />
                      <span className="text-xs font-bold text-surface-700 dark:text-surface-300 uppercase tracking-wide">{col.name}</span>
                      <span className="text-[10px] text-surface-400 font-semibold bg-surface-100 dark:bg-surface-800 px-1.5 py-0.5 rounded-full">{col.deals.length}</span>
                    </div>
                    {colValue > 0 && <span className="text-xs font-semibold text-surface-500">{formatCurrency(colValue)}</span>}
                  </div>

                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div ref={provided.innerRef} {...provided.droppableProps}
                        className={cn('flex-1 space-y-2 min-h-20 p-2 rounded-xl transition-colors',
                          snapshot.isDraggingOver ? 'bg-brand-50 dark:bg-brand-950 border-2 border-brand-200' : 'bg-surface-100/50 dark:bg-surface-800/50')}>
                        {col.deals.map((deal, index) => (
                          <Draggable key={deal.id} draggableId={deal.id} index={index}>
                            {(provided, snapshot) => (
                              <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                                className={cn(snapshot.isDragging && 'opacity-80 rotate-1 scale-105')}>
                                <DealCard deal={deal} onClick={() => {}} />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {col.deals.length === 0 && !snapshot.isDraggingOver && (
                          <div className="h-16 flex items-center justify-center text-xs text-surface-400 border-2 border-dashed border-surface-200 dark:border-surface-700 rounded-xl">
                            Drop here
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>

                  <button onClick={() => setShowNewDeal(true)}
                    className="mt-2 w-full flex items-center gap-1.5 p-2 rounded-xl text-xs text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Add {template.dealLabel.singular.toLowerCase()}
                  </button>
                </div>
              )
            })}
          </div>
        </DragDropContext>
      )}

      {showNewDeal && (
        <NewDealModal
          stages={columns}
          contacts={contacts}
          workspaceId={workspaceId}
          customFields={customFields}
          template={template}
          onClose={() => setShowNewDeal(false)}
          onSave={handleCreateDeal}
        />
      )}
    </div>
  )
}
