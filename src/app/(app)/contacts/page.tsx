'use client'
import { toast } from 'sonner'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Mail, Phone, Building2, User, X, Globe, FileText, Upload, Download, GitMerge, MapPin, ChevronDown, Tag } from 'lucide-react'
import { getInitials, cn } from '@/lib/utils'
import BulkActions from '@/components/shared/BulkActions'
import ViewToggle from '@/components/shared/ViewToggle'
import InlineEdit from '@/components/shared/InlineEdit'
import { deleteWithUndo } from '@/lib/utils/undo'
import { useWorkspace } from '@/lib/workspace-context'
import { useI18n } from '@/lib/i18n/context'
import type { Contact, DbRow } from '@/types'
import { getActiveWorkspace } from '@/lib/get-active-workspace'

const AVATAR_COLORS = ['bg-brand-500','bg-violet-500','bg-emerald-500','bg-amber-500','bg-rose-500','bg-cyan-500']
const avatarColor = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]

function NewContactModal({ onClose, onSave, workspaceId, customFields, template }: {
  onClose: () => void; onSave: (c: Partial<Contact>) => void; workspaceId: string;
  customFields: { entity: string; label: string; key: string; type: string; options?: string[] }[];
  template: { name?: string; contactLabel: { singular: string; plural: string } };
}) {
  const [type, setType] = useState<'person' | 'company'>('person')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [website, setWebsite] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [customValues, setCustomValues] = useState<DbRow>({})
  const [socialOpen, setSocialOpen] = useState(false)
  const [socialProfiles, setSocialProfiles] = useState<{ instagram: string; linkedin: string; facebook: string; tiktok: string }>({ instagram: '', linkedin: '', facebook: '', tiktok: '' })

  const contactFields = customFields.filter(f => f.entity === 'contact')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const sp = Object.fromEntries(Object.entries(socialProfiles).filter(([, v]) => v))
    onSave({
      type, name, email: email || undefined, phone: phone || undefined,
      company_name: company || undefined, job_title: jobTitle || undefined,
      website: website || undefined, address: address || undefined,
      notes: notes || undefined,
      workspace_id: workspaceId,
      custom_fields: Object.keys(customValues).length > 0 ? customValues : undefined,
      social_profiles: Object.keys(sp).length > 0 ? sp : undefined,
    } as Partial<Contact>)
    onClose()
  }

  return (
    <div className="modal-overlay">
      <div className="modal-panel max-w-lg">
        <div className="modal-header">
          <h2>New {template.contactLabel.singular}</h2>
          <button onClick={onClose} className="modal-close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body space-y-4">
          {/* Type toggle */}
          <div className="flex gap-2 p-1 bg-surface-100 rounded-xl">
            {(['person', 'company'] as const).map(t => (
              <button key={t} type="button" onClick={() => setType(t)}
                className={cn('flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-sm font-medium transition-all', type === t ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500 hover:text-surface-700')}>
                {t === 'person' ? <User className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}
                {t === 'person' ? 'Person' : 'Company'}
              </button>
            ))}
          </div>

          <div>
            <label className="label">{type === 'person' ? 'Full name' : 'Company name'} *</label>
            <input className="input" required value={name} onChange={e => setName(e.target.value)} placeholder={type === 'person' ? 'Jane Smith' : 'Acme Corp'} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Email</label>
              <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400" />
                <input className="input pl-8" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@acme.com" />
              </div>
            </div>
            <div>
              <label className="label">Phone</label>
              <div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400" />
                <input className="input pl-8" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 555 0000" />
              </div>
            </div>
          </div>

          {type === 'person' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Company</label>
                <div className="relative"><Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400" />
                  <input className="input pl-8" value={company} onChange={e => setCompany(e.target.value)} placeholder="Acme Corp" />
                </div>
              </div>
              <div>
                <label className="label">Job title</label>
                <input className="input" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="Sales Director" />
              </div>
            </div>
          )}

          <div>
            <label className="label">Website</label>
            <div className="relative"><Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400" />
              <input className="input pl-8" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://acme.com" />
            </div>
          </div>

          <div>
            <label className="label">Address</label>
            <div className="relative"><MapPin className="absolute left-3 top-3 w-3.5 h-3.5 text-surface-400" />
              <textarea className="input pl-8 resize-none" rows={2} value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St, City, Country" />
            </div>
          </div>

          {/* Social Profiles */}
          <div className="border border-surface-100 rounded-xl overflow-hidden">
            <button type="button" onClick={() => setSocialOpen(!socialOpen)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50 transition-colors">
              Social Profiles
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', socialOpen && 'rotate-180')} />
            </button>
            {socialOpen && (
              <div className="px-3 pb-3 space-y-2">
                {(['instagram', 'linkedin', 'facebook', 'tiktok'] as const).map(platform => (
                  <div key={platform}>
                    <label className="label capitalize">{platform}</label>
                    <input className="input" value={socialProfiles[platform]}
                      onChange={e => setSocialProfiles(p => ({ ...p, [platform]: e.target.value }))}
                      placeholder={`${platform} URL or username`} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Industry-specific custom fields */}
          {contactFields.length > 0 && (
            <div className="pt-2 border-t border-surface-100">
              <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wide mb-3">
                {template.name} Details
              </p>
              <div className="space-y-3">
                {contactFields.map(field => (
                  <div key={field.key}>
                    <label className="label">{field.label}</label>
                    {field.type === 'select' && field.options ? (
                      <select className="input" value={customValues[field.key] || ''}
                        onChange={e => setCustomValues(v => ({ ...v, [field.key]: e.target.value }))}>
                        <option value="">Select...</option>
                        {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : field.type === 'date' ? (
                      <input type="date" className="input" value={customValues[field.key] || ''}
                        onChange={e => setCustomValues(v => ({ ...v, [field.key]: e.target.value }))} />
                    ) : field.type === 'number' || field.type === 'currency' ? (
                      <input type="number" className="input" value={customValues[field.key] || ''} placeholder="0"
                        onChange={e => setCustomValues(v => ({ ...v, [field.key]: e.target.value }))} />
                    ) : field.type === 'url' ? (
                      <input type="url" className="input" value={customValues[field.key] || ''} placeholder="https://..."
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

          <div>
            <label className="label">Notes</label>
            <div className="relative"><FileText className="absolute left-3 top-3 w-3.5 h-3.5 text-surface-400" />
              <textarea className="input pl-8 resize-none" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes..." />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1">Save {template.contactLabel.singular}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ContactsPage() {
  const supabase = createClient()
  const router = useRouter()
  const { template, customFields } = useWorkspace()
  const { t } = useI18n()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [workspaceId, setWorkspaceId] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'person' | 'company'>('all')
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [view, setView] = useState<'table' | 'grid' | 'kanban'>('table')
  const [showDuplicates, setShowDuplicates] = useState(false)
  const [duplicateGroups, setDuplicateGroups] = useState<Contact[][]>([])
  const [selectedPrimary, setSelectedPrimary] = useState<Record<number, string>>({})
  const [merging, setMerging] = useState(false)
  const [findingDups, setFindingDups] = useState(false)
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [filterScore, setFilterScore] = useState('all')
  const [filterOwner, setFilterOwner] = useState('all')
  const [userId, setUserId] = useState('')
  const [lastInteractions, setLastInteractions] = useState<Record<string, string>>({})
  const [showTagFilter, setShowTagFilter] = useState(false)

  const loadContacts = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const ws = await getActiveWorkspace(supabase, user.id, 'id')
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)
    const { data } = await supabase.from('contacts').select('*').eq('workspace_id', ws.id).order('name')
    setContacts(data || [])

    // Load last interaction per contact
    if (data && data.length > 0) {
      const contactIds = data.map(c => c.id)
      const { data: activities } = await supabase
        .from('activities')
        .select('contact_id, created_at')
        .in('contact_id', contactIds)
        .order('created_at', { ascending: false })
      if (activities) {
        const map: Record<string, string> = {}
        for (const a of activities) {
          if (a.contact_id && !map[a.contact_id]) {
            map[a.contact_id] = a.created_at
          }
        }
        setLastInteractions(map)
      }
    }

    setLoading(false)
  }, [])

  useEffect(() => { loadContacts() }, [loadContacts])

  const findDuplicates = useCallback(async () => {
    setFindingDups(true)
    const groups: Contact[][] = []
    const visited = new Set<string>()

    for (const c of contacts) {
      if (visited.has(c.id)) continue
      const dups = contacts.filter(o => {
        if (o.id === c.id || visited.has(o.id)) return false
        // Same email
        if (c.email && o.email && c.email.toLowerCase() === o.email.toLowerCase()) return true
        // Same phone
        if (c.phone && o.phone && c.phone.replace(/\D/g, '') === o.phone.replace(/\D/g, '')) return true
        // Similar name (first 3+ chars match)
        if (c.name && o.name && c.name.length >= 3 && o.name.length >= 3 &&
          c.name.substring(0, 3).toLowerCase() === o.name.substring(0, 3).toLowerCase() &&
          c.name.toLowerCase() !== o.name.toLowerCase().replace(/\s/g, '') // avoid overly broad matches
        ) return true
        return false
      })
      if (dups.length > 0) {
        const group = [c, ...dups]
        group.forEach(g => visited.add(g.id))
        groups.push(group)
      }
    }
    setDuplicateGroups(groups)
    const primaries: Record<number, string> = {}
    groups.forEach((g, i) => { primaries[i] = g[0].id })
    setSelectedPrimary(primaries)
    setShowDuplicates(true)
    setFindingDups(false)
  }, [contacts])

  const mergeGroup = async (groupIndex: number) => {
    const group = duplicateGroups[groupIndex]
    const primaryId = selectedPrimary[groupIndex]
    if (!primaryId || !group) return
    const duplicateIds = group.filter(c => c.id !== primaryId).map(c => c.id)
    if (duplicateIds.length === 0) return

    setMerging(true)
    try {
      const res = await fetch('/api/contacts/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryId, duplicateIds }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err?.error?.message || 'Merge failed')
      } else {
        toast.success(`Merged ${duplicateIds.length + 1} contacts`)
        setDuplicateGroups(prev => prev.filter((_, i) => i !== groupIndex))
        loadContacts()
      }
    } catch { toast.error('Merge request failed') }
    setMerging(false)
  }

  const updateField = async (id: string, field: string, value: string) => {
    await supabase.from('contacts').update({ [field]: value || null }).eq('id', id)
    setContacts(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
    toast.success('Updated')
  }

  const handleCreate = async (contactData: Partial<Contact>) => {
    const { data, error } = await supabase.from('contacts').insert([contactData]).select().single()
    if (error) { toast.error('Failed to create contact'); return }
    if (data) { setContacts(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name))); toast.success(`${data.name} created`) }
  }

  // Collect unique tags for filter dropdown
  const allTags = Array.from(new Set(contacts.flatMap(c => c.tags || [])))

  // Helper to format relative time
  const timeAgo = (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const seconds = Math.floor(diff / 1000)
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days}d ago`
    return `${Math.floor(days / 30)}mo ago`
  }

  const filtered = contacts.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()) || c.company_name?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || c.type === filter
    const matchTags = filterTags.length === 0 || filterTags.some(t => (c.tags || []).includes(t))
    const matchScore = filterScore === 'all' || (c.score_label || 'cold') === filterScore
    const matchOwner = filterOwner === 'all' || c.owner_id === userId
    return matchSearch && matchFilter && matchTags && matchScore && matchOwner
  })

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{template.contactLabel.plural}</h1>
          <p className="page-subtitle">{contacts.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input className="input pl-9 w-56 text-xs" placeholder={`Search ${template.contactLabel.plural.toLowerCase()}...`} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={findDuplicates} disabled={findingDups} className="btn-secondary btn-sm">
            <GitMerge className="w-3.5 h-3.5" /> {findingDups ? 'Searching...' : 'Find Duplicates'}
          </button>
          <a href="/api/export?type=contacts" className="btn-ghost btn-sm">
            <Download className="w-3.5 h-3.5" /> Export
          </a>
          <label className={cn('btn-secondary btn-sm cursor-pointer', importing && 'opacity-50')}>
            <Upload className="w-3.5 h-3.5" /> Import CSV
            <input type="file" accept=".csv" className="sr-only" disabled={importing} onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              setImporting(true); setImportResult(null)
              const form = new FormData()
              form.append('file', file)
              form.append('type', 'contacts')
              const res = await fetch('/api/import', { method: 'POST', body: form })
              const data = await res.json()
              setImportResult(`Imported ${data.imported}, skipped ${data.skipped}`)
              setImporting(false)
              loadContacts()
              e.target.value = ''
            }} />
          </label>
          <ViewToggle view={view} onChange={setView} />
          <button onClick={() => setShowNew(true)} className="btn-primary btn-sm">
            <Plus className="w-3.5 h-3.5" /> Add {template.contactLabel.singular}
          </button>
        </div>
      </div>

      {importResult && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
          <span className="text-sm text-emerald-700 font-medium">{importResult}</span>
          <button onClick={() => setImportResult(null)} className="text-emerald-500 hover:text-emerald-700"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="segmented-control mb-4">
        {(['all', 'person', 'company'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            data-active={filter === f}
            className={cn(filter === f && 'active')}>
            {f === 'all' ? `All (${contacts.length})` : f === 'person' ? `People (${contacts.filter(c => c.type === 'person').length})` : `Companies (${contacts.filter(c => c.type === 'company').length})`}
          </button>
        ))}
      </div>

      {/* Advanced filters row */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {/* Tag filter */}
        <div className="relative">
          <button onClick={() => setShowTagFilter(!showTagFilter)}
            className={cn('btn-secondary btn-sm', filterTags.length > 0 && 'ring-2 ring-brand-200')}>
            <Tag className="w-3.5 h-3.5" /> Tags {filterTags.length > 0 && `(${filterTags.length})`}
            <ChevronDown className="w-3 h-3" />
          </button>
          {showTagFilter && (
            <div className="absolute z-20 mt-1 bg-white border border-surface-200 rounded-xl shadow-lg p-2 min-w-[180px] max-h-60 overflow-y-auto">
              {allTags.length === 0 ? (
                <p className="text-xs text-surface-400 p-2">No tags found</p>
              ) : (
                <>
                  {allTags.map(tag => (
                    <label key={tag} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-50 cursor-pointer">
                      <input type="checkbox" className="rounded border-surface-300 accent-brand-600"
                        checked={filterTags.includes(tag)}
                        onChange={e => {
                          if (e.target.checked) setFilterTags(prev => [...prev, tag])
                          else setFilterTags(prev => prev.filter(t => t !== tag))
                        }} />
                      <span className="text-xs text-surface-700">{tag}</span>
                    </label>
                  ))}
                  {filterTags.length > 0 && (
                    <button onClick={() => setFilterTags([])} className="text-xs text-brand-600 hover:underline px-2 pt-1">Clear all</button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Score filter */}
        <select value={filterScore} onChange={e => setFilterScore(e.target.value)}
          className={cn('btn-secondary btn-sm appearance-none pr-7 cursor-pointer', filterScore !== 'all' && 'ring-2 ring-brand-200')}>
          <option value="all">All Scores</option>
          <option value="hot">Hot</option>
          <option value="warm">Warm</option>
          <option value="cold">Cold</option>
        </select>

        {/* Owner filter */}
        <select value={filterOwner} onChange={e => setFilterOwner(e.target.value)}
          className={cn('btn-secondary btn-sm appearance-none pr-7 cursor-pointer', filterOwner !== 'all' && 'ring-2 ring-brand-200')}>
          <option value="all">All Owners</option>
          <option value="mine">Mine</option>
        </select>

        {/* Clear all filters */}
        {(filterTags.length > 0 || filterScore !== 'all' || filterOwner !== 'all') && (
          <button onClick={() => { setFilterTags([]); setFilterScore('all'); setFilterOwner('all') }}
            className="text-xs text-brand-600 hover:underline">
            Clear filters
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <User className="w-7 h-7 text-surface-300" />
          </div>
          <p className="empty-state-title">No {template.contactLabel.plural.toLowerCase()} yet</p>
          <p className="empty-state-desc">Add your first {template.contactLabel.singular.toLowerCase()} to get started</p>
          <button onClick={() => setShowNew(true)} className="btn-primary"><Plus className="w-3.5 h-3.5" /> Add {template.contactLabel.singular}</button>
        </div>
      ) : view === 'kanban' ? (
        /* ====== KANBAN VIEW ====== */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(['hot', 'warm', 'cold', 'unscored'] as const).map(label => {
            const items = filtered.filter(c => {
              const sl = c.score_label || 'cold'
              if (label === 'unscored') return !c.score_label || c.score_label === 'inactive'
              return sl === label
            })
            const colorMap: Record<string, string> = {
              hot: 'border-t-red-500 bg-red-50/30',
              warm: 'border-t-amber-500 bg-amber-50/30',
              cold: 'border-t-blue-500 bg-blue-50/30',
              unscored: 'border-t-surface-300 bg-surface-50/30',
            }
            return (
              <div key={label} className={cn('rounded-xl border border-surface-200 border-t-4 p-3 min-h-[200px]', colorMap[label])}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold capitalize text-surface-700">{label}</h3>
                  <span className="text-[10px] font-semibold bg-white px-2 py-0.5 rounded-full text-surface-500 shadow-sm">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map(contact => (
                    <div key={contact.id} onClick={() => router.push(`/contacts/${contact.id}`)}
                      className="bg-white rounded-lg p-3 shadow-sm hover:shadow-card-hover cursor-pointer transition-all border border-surface-100">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0 ${avatarColor(contact.name)}`}>
                          {getInitials(contact.name)}
                        </div>
                        <p className="text-xs font-semibold text-surface-800 truncate">{contact.name}</p>
                      </div>
                      {contact.email && <p className="text-[10px] text-brand-600 truncate">{contact.email}</p>}
                      {contact.company_name && <p className="text-[10px] text-surface-400 truncate">{contact.company_name}</p>}
                    </div>
                  ))}
                  {items.length === 0 && (
                    <p className="text-xs text-surface-400 text-center py-4">No contacts</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(contact => (
            <div key={contact.id} onClick={() => router.push(`/contacts/${contact.id}`)}
              className="card p-4 hover:shadow-card-hover cursor-pointer transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className={`avatar-sm ${avatarColor(contact.name)}`}>{getInitials(contact.name)}</div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-surface-800 truncate">{contact.name}</p>
                  <p className="text-[10px] text-surface-400 truncate">{contact.job_title || contact.company_name || ''}</p>
                </div>
              </div>
              {contact.email && <p className="text-xs text-brand-600 truncate mb-1">{contact.email}</p>}
              {contact.phone && <p className="text-xs text-surface-500">{contact.phone}</p>}
              <div className="flex items-center gap-2 mt-2">
                <span className={cn('badge text-[10px]', contact.type === 'company' ? 'badge-blue' : 'badge-gray')}>{contact.type}</span>
                {(contact as { score_label?: string }).score_label && (contact as { score_label?: string }).score_label !== 'cold' && (
                  <span className={cn('text-[10px] font-bold', (contact as { score_label?: string }).score_label === 'hot' ? 'text-red-600' : 'text-amber-600')}>
                    {(contact as { score_label?: string }).score_label}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-100">
                <th className="px-4 py-3 w-8">
                  <input type="checkbox" className="rounded border-surface-300"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={e => setSelected(e.target.checked ? new Set(filtered.map(c => c.id)) : new Set())} />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide hidden lg:table-cell">Company</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide hidden lg:table-cell">Phone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide hidden xl:table-cell">Score</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide hidden lg:table-cell">Last Activity</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((contact, i) => (
                <tr key={contact.id}
                  onClick={(e) => { if ((e.target as HTMLElement).tagName !== 'INPUT') router.push(`/contacts/${contact.id}`) }}
                  className="border-b border-surface-50 last:border-0 hover:bg-surface-50 cursor-pointer transition-colors animate-fade-in"
                  style={{ animationDelay: `${i * 30}ms` }}>
                  <td className="px-4 py-3 w-8" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" className="rounded border-surface-300"
                      checked={selected.has(contact.id)}
                      onChange={e => setSelected(prev => { const next = new Set(prev); e.target.checked ? next.add(contact.id) : next.delete(contact.id); return next })} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`avatar-sm ${avatarColor(contact.name)} flex-shrink-0`}>{getInitials(contact.name)}</div>
                      <div>
                        <InlineEdit value={contact.name} className="text-sm font-semibold text-surface-800" onSave={v => updateField(contact.id, 'name', v)} />
                        {contact.job_title && <p className="text-xs text-surface-400">{contact.job_title}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell" onClick={e => e.stopPropagation()}>
                    <InlineEdit value={contact.email || ''} type="email" className="text-xs text-brand-600" placeholder="Add email" onSave={v => updateField(contact.id, 'email', v)} />
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell" onClick={e => e.stopPropagation()}>
                    <InlineEdit value={contact.company_name || ''} className="text-xs text-surface-600" placeholder="Add company" onSave={v => updateField(contact.id, 'company_name', v)} />
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell" onClick={e => e.stopPropagation()}>
                    <InlineEdit value={contact.phone || ''} type="tel" className="text-xs text-surface-600" placeholder="Add phone" onSave={v => updateField(contact.id, 'phone', v)} />
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    {(contact as { score_label?: string }).score_label && (contact as { score_label?: string }).score_label !== 'cold' ? (
                      <div className="flex items-center gap-1.5">
                        <div className={cn('w-2 h-2 rounded-full',
                          (contact as { score_label?: string }).score_label === 'hot' ? 'bg-red-500' :
                          (contact as { score_label?: string }).score_label === 'warm' ? 'bg-amber-500' : 'bg-surface-300')} />
                        <span className={cn('text-[10px] font-semibold capitalize',
                          (contact as { score_label?: string }).score_label === 'hot' ? 'text-red-600' :
                          (contact as { score_label?: string }).score_label === 'warm' ? 'text-amber-600' : 'text-surface-400')}>
                          {(contact as { score_label?: string }).score_label} ({(contact as { engagement_score?: number }).engagement_score || 0})
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-surface-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {lastInteractions[contact.id] ? (
                      <span className="text-xs text-surface-500">Last: {timeAgo(lastInteractions[contact.id])}</span>
                    ) : (
                      <span className="text-xs text-surface-300">--</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('badge text-[10px]', contact.type === 'company' ? 'badge-blue' : 'badge-gray')}>
                      {contact.type}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}

      <BulkActions
        count={selected.size}
        onClear={() => setSelected(new Set())}
        onExport={() => window.open('/api/export?type=contacts')}
        onDelete={async () => {
          if (!confirm(`Delete ${selected.size} contacts?`)) return
          for (const id of Array.from(selected)) { await supabase.from('contacts').delete().eq('id', id) }
          toast.success(`${selected.size} contacts deleted`)
          setSelected(new Set())
          loadContacts()
        }}
        onTag={async (tag) => {
          for (const id of Array.from(selected)) {
            const { data: c } = await supabase.from('contacts').select('tags').eq('id', id).single()
            const tags = Array.from(new Set([...(c?.tags || []), tag]))
            await supabase.from('contacts').update({ tags }).eq('id', id)
          }
          toast.success(`Tagged ${selected.size} contacts with "${tag}"`)
          setSelected(new Set())
          loadContacts()
        }}
      />

      {showNew && (
        <NewContactModal
          workspaceId={workspaceId}
          customFields={customFields}
          template={template}
          onClose={() => setShowNew(false)}
          onSave={handleCreate}
        />
      )}

      {showDuplicates && (
        <div className="modal-overlay">
          <div className="modal-panel max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="modal-header">
              <h2>Duplicate {template.contactLabel.plural}</h2>
              <button onClick={() => setShowDuplicates(false)} className="modal-close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="modal-body space-y-4">
              {duplicateGroups.length === 0 ? (
                <p className="text-sm text-surface-500 py-4 text-center">No duplicates found</p>
              ) : (
                duplicateGroups.map((group, gi) => (
                  <div key={gi} className="border border-surface-100 rounded-xl p-4">
                    <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-3">
                      Group {gi + 1} — {group.length} contacts
                    </p>
                    <div className="space-y-2">
                      {group.map(c => (
                        <label key={c.id} className={cn(
                          'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors',
                          selectedPrimary[gi] === c.id ? 'bg-brand-50 border border-brand-200' : 'hover:bg-surface-50'
                        )}>
                          <input
                            type="radio"
                            name={`dup-group-${gi}`}
                            checked={selectedPrimary[gi] === c.id}
                            onChange={() => setSelectedPrimary(prev => ({ ...prev, [gi]: c.id }))}
                            className="accent-brand-600"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-surface-800 truncate">{c.name}</p>
                            <p className="text-xs text-surface-400 truncate">
                              {[c.email, c.phone, c.company_name].filter(Boolean).join(' · ') || 'No details'}
                            </p>
                          </div>
                          {selectedPrimary[gi] === c.id && (
                            <span className="badge badge-blue text-[10px]">Primary</span>
                          )}
                        </label>
                      ))}
                    </div>
                    <button
                      onClick={() => mergeGroup(gi)}
                      disabled={merging}
                      className="btn-primary btn-sm mt-3 w-full"
                    >
                      <GitMerge className="w-3.5 h-3.5" /> {merging ? 'Merging...' : 'Merge Group'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
