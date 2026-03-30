'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Mail, Phone, Building2, User, X, Globe, FileText } from 'lucide-react'
import { getInitials, cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace-context'
import { useI18n } from '@/lib/i18n/context'
import type { Contact } from '@/types'

const AVATAR_COLORS = ['bg-brand-500','bg-violet-500','bg-emerald-500','bg-amber-500','bg-rose-500','bg-cyan-500']
const avatarColor = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]

function NewContactModal({ onClose, onSave, workspaceId, customFields, template }: {
  onClose: () => void; onSave: (c: Partial<Contact>) => void; workspaceId: string;
  customFields: { entity: string; label: string; key: string; type: string; options?: string[] }[];
  template: any;
}) {
  const [type, setType] = useState<'person' | 'company'>('person')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [website, setWebsite] = useState('')
  const [notes, setNotes] = useState('')
  const [customValues, setCustomValues] = useState<Record<string, any>>({})

  const contactFields = customFields.filter(f => f.entity === 'contact')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      type, name, email: email || undefined, phone: phone || undefined,
      company_name: company || undefined, job_title: jobTitle || undefined,
      website: website || undefined, notes: notes || undefined,
      workspace_id: workspaceId,
      custom_fields: Object.keys(customValues).length > 0 ? customValues : undefined,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-lg animate-slide-up max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-surface-100 flex-shrink-0">
          <h2 className="font-semibold text-surface-900">New {template.contactLabel.singular}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100 transition-colors">
            <X className="w-4 h-4 text-surface-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
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

          <div className="grid grid-cols-2 gap-3">
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
            <div className="grid grid-cols-2 gap-3">
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

  const loadContacts = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)
    const { data } = await supabase.from('contacts').select('*').eq('workspace_id', ws.id).order('name')
    setContacts(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadContacts() }, [loadContacts])

  const handleCreate = async (contactData: Partial<Contact>) => {
    const { data } = await supabase.from('contacts').insert([contactData]).select().single()
    if (data) setContacts(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
  }

  const filtered = contacts.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()) || c.company_name?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || c.type === filter
    return matchSearch && matchFilter
  })

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{template.contactLabel.plural}</h1>
          <p className="text-sm text-surface-500 mt-0.5">{contacts.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input className="input pl-9 w-56 text-xs" placeholder={`Search ${template.contactLabel.plural.toLowerCase()}...`} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={() => setShowNew(true)} className="btn-primary btn-sm">
            <Plus className="w-3.5 h-3.5" /> Add {template.contactLabel.singular}
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6">
        {(['all', 'person', 'company'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize', filter === f ? 'bg-brand-600 text-white' : 'text-surface-500 hover:bg-surface-100')}>
            {f === 'all' ? `All (${contacts.length})` : f === 'person' ? `People (${contacts.filter(c => c.type === 'person').length})` : `Companies (${contacts.filter(c => c.type === 'company').length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-14 h-14 bg-surface-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <User className="w-7 h-7 text-surface-400" />
          </div>
          <p className="text-surface-600 font-medium mb-1">No {template.contactLabel.plural.toLowerCase()} yet</p>
          <p className="text-surface-400 text-sm mb-4">Add your first {template.contactLabel.singular.toLowerCase()} to get started</p>
          <button onClick={() => setShowNew(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> Add {template.contactLabel.singular}</button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide hidden lg:table-cell">Company</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide hidden lg:table-cell">Phone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide hidden xl:table-cell">Score</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((contact, i) => (
                <tr key={contact.id}
                  onClick={() => router.push(`/contacts/${contact.id}`)}
                  className="border-b border-surface-50 last:border-0 hover:bg-surface-50 cursor-pointer transition-colors animate-fade-in"
                  style={{ animationDelay: `${i * 30}ms` }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`avatar-sm ${avatarColor(contact.name)} flex-shrink-0`}>{getInitials(contact.name)}</div>
                      <div>
                        <p className="text-sm font-semibold text-surface-800">{contact.name}</p>
                        {contact.job_title && <p className="text-xs text-surface-400">{contact.job_title}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {contact.email ? <a href={`mailto:${contact.email}`} onClick={e => e.stopPropagation()} className="text-xs text-brand-600 hover:underline">{contact.email}</a> : <span className="text-xs text-surface-300">—</span>}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-surface-600">{contact.company_name || '—'}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-surface-600">{contact.phone || '—'}</span>
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    {(contact as any).score_label && (contact as any).score_label !== 'cold' ? (
                      <div className="flex items-center gap-1.5">
                        <div className={cn('w-2 h-2 rounded-full',
                          (contact as any).score_label === 'hot' ? 'bg-red-500' :
                          (contact as any).score_label === 'warm' ? 'bg-amber-500' : 'bg-surface-300')} />
                        <span className={cn('text-[10px] font-semibold capitalize',
                          (contact as any).score_label === 'hot' ? 'text-red-600' :
                          (contact as any).score_label === 'warm' ? 'text-amber-600' : 'text-surface-400')}>
                          {(contact as any).score_label} ({(contact as any).engagement_score || 0})
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-surface-300">—</span>
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

      {showNew && (
        <NewContactModal
          workspaceId={workspaceId}
          customFields={customFields}
          template={template}
          onClose={() => setShowNew(false)}
          onSave={handleCreate}
        />
      )}
    </div>
  )
}
