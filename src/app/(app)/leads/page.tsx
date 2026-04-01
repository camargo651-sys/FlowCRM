'use client'
import { toast } from 'sonner'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, X, UserPlus, MessageCircle, ArrowRight, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📸', facebook: '📘', tiktok: '🎵', linkedin: '💼', twitter: '🐦', youtube: '📺', other: '🌐',
}
const STATUS_STYLES: Record<string, string> = {
  new: 'badge-blue', contacted: 'badge-yellow', qualified: 'badge-violet', converted: 'badge-green', discarded: 'badge-gray',
}

export default function LeadsPage() {
  const supabase = createClient()
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPlatform, setFilterPlatform] = useState('all')
  const [workspaceId, setWorkspaceId] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ author_name: '', author_username: '', platform: 'instagram', source_type: 'comment', message: '', post_url: '' })

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)
    const { data } = await supabase.from('social_leads').select('*').eq('workspace_id', ws.id).order('created_at', { ascending: false })
    setLeads(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const createLead = async () => {
    if (!form.author_name) return
    await supabase.from('social_leads').insert({
      workspace_id: workspaceId, ...form,
    })
    setForm({ author_name: '', author_username: '', platform: 'instagram', source_type: 'comment', message: '', post_url: '' })
    setShowNew(false)
    toast.success('Lead added')
    load()
  }

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('social_leads').update({ status }).eq('id', id)
    toast.success(`Lead marked as ${status}`)
    load()
  }

  const convertToContact = async (lead: any) => {
    const { data: contact } = await supabase.from('contacts').insert({
      workspace_id: workspaceId, name: lead.author_name,
      notes: `From ${lead.platform}: ${lead.message || ''}`,
      tags: [lead.platform, 'social-lead'],
      type: 'person',
    }).select('id').single()

    if (contact) {
      await supabase.from('social_leads').update({ status: 'converted', contact_id: contact.id }).eq('id', lead.id)
      toast.success(`${lead.author_name} converted to contact`)
      load()
    }
  }

  const filtered = leads.filter(l => {
    if (filterStatus !== 'all' && l.status !== filterStatus) return false
    if (filterPlatform !== 'all' && l.platform !== filterPlatform) return false
    if (search && !l.author_name?.toLowerCase().includes(search.toLowerCase()) && !l.message?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const newCount = leads.filter(l => l.status === 'new').length
  const platforms = Array.from(new Set(leads.map(l => l.platform)))

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Social Leads</h1><p className="text-sm text-surface-500 mt-0.5">{leads.length} leads · {newCount} new</p></div>
        <button onClick={() => setShowNew(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> Add Lead</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="card p-4 flex items-center gap-3"><span className="text-2xl">📸</span><div><p className="text-lg font-bold">{leads.filter(l => l.platform === 'instagram').length}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Instagram</p></div></div>
        <div className="card p-4 flex items-center gap-3"><span className="text-2xl">📘</span><div><p className="text-lg font-bold">{leads.filter(l => l.platform === 'facebook').length}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">Facebook</p></div></div>
        <div className="card p-4 flex items-center gap-3"><span className="text-2xl">🎵</span><div><p className="text-lg font-bold">{leads.filter(l => l.platform === 'tiktok').length}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">TikTok</p></div></div>
        <div className="card p-4 flex items-center gap-3"><span className="text-2xl">💼</span><div><p className="text-lg font-bold">{leads.filter(l => l.platform === 'linkedin').length}</p><p className="text-[10px] text-surface-500 font-semibold uppercase">LinkedIn</p></div></div>
      </div>

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" /><input className="input pl-9 text-xs" placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <select className="input w-auto text-xs" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Status</option><option value="new">New</option><option value="contacted">Contacted</option><option value="qualified">Qualified</option><option value="converted">Converted</option><option value="discarded">Discarded</option>
        </select>
        <select className="input w-auto text-xs" value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}>
          <option value="all">All Platforms</option>
          {platforms.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-16">
          <MessageCircle className="w-10 h-10 text-surface-300 mx-auto mb-3" />
          <p className="text-surface-600 font-medium mb-1">No social leads yet</p>
          <p className="text-xs text-surface-400 mb-4">Leads appear here when captured from social media comments, DMs, or added manually</p>
          <p className="text-[10px] text-surface-300">Webhook: <code className="bg-surface-100 px-1 rounded">your-domain.com/api/webhooks/social</code></p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(lead => (
            <div key={lead.id} className="card p-4 flex items-start gap-3">
              <span className="text-xl mt-0.5">{PLATFORM_ICONS[lead.platform] || '🌐'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-surface-900">{lead.author_name}</span>
                  {lead.author_username && <span className="text-[10px] text-surface-400">@{lead.author_username}</span>}
                  <span className={cn('badge text-[10px]', STATUS_STYLES[lead.status])}>{lead.status}</span>
                  <span className="text-[10px] text-surface-300">{lead.source_type}</span>
                </div>
                {lead.message && <p className="text-xs text-surface-600 line-clamp-2">{lead.message}</p>}
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[10px] text-surface-300">{new Date(lead.created_at).toLocaleString()}</span>
                  {lead.post_url && <a href={lead.post_url} target="_blank" className="text-[10px] text-brand-600 hover:underline flex items-center gap-0.5"><ExternalLink className="w-2.5 h-2.5" /> View post</a>}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {lead.status === 'new' && <button onClick={() => updateStatus(lead.id, 'contacted')} className="btn-secondary btn-sm text-[10px]">Contacted</button>}
                {(lead.status === 'new' || lead.status === 'contacted') && <button onClick={() => updateStatus(lead.id, 'qualified')} className="btn-secondary btn-sm text-[10px]">Qualify</button>}
                {lead.status !== 'converted' && lead.status !== 'discarded' && (
                  <button onClick={() => convertToContact(lead)} className="btn-sm bg-brand-600 text-white text-[10px] rounded-lg px-2 py-1 inline-flex items-center gap-1"><UserPlus className="w-3 h-3" /> Convert</button>
                )}
                {lead.status !== 'discarded' && lead.status !== 'converted' && (
                  <button onClick={() => updateStatus(lead.id, 'discarded')} className="btn-ghost btn-sm text-[10px] text-red-500">Discard</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100">
              <h2 className="font-semibold text-surface-900">Add Lead Manually</h2>
              <button onClick={() => setShowNew(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Name *</label><input className="input" value={form.author_name} onChange={e => setForm(f => ({ ...f, author_name: e.target.value }))} /></div>
                <div><label className="label">Username</label><input className="input" value={form.author_username} onChange={e => setForm(f => ({ ...f, author_username: e.target.value }))} placeholder="@username" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Platform</label>
                  <select className="input" value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
                    <option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="tiktok">TikTok</option><option value="linkedin">LinkedIn</option><option value="twitter">Twitter/X</option><option value="youtube">YouTube</option><option value="other">Other</option>
                  </select>
                </div>
                <div><label className="label">Source</label>
                  <select className="input" value={form.source_type} onChange={e => setForm(f => ({ ...f, source_type: e.target.value }))}>
                    <option value="comment">Comment</option><option value="dm">DM</option><option value="mention">Mention</option><option value="form">Form</option><option value="ad">Ad</option><option value="manual">Manual</option>
                  </select>
                </div>
              </div>
              <div><label className="label">Message</label><textarea className="input resize-none" rows={3} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} /></div>
              <div><label className="label">Post URL</label><input className="input" value={form.post_url} onChange={e => setForm(f => ({ ...f, post_url: e.target.value }))} placeholder="https://..." /></div>
              <div className="flex gap-2">
                <button onClick={() => setShowNew(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={createLead} disabled={!form.author_name} className="btn-primary flex-1">Add Lead</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
