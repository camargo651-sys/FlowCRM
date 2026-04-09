'use client'
import { DbRow } from '@/types'
import { toast } from 'sonner'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Save, FileText, Eye, Trash2, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Strip dangerous tags/attributes from HTML to prevent XSS */
function sanitizeHTML(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?>/gi, '')
    .replace(/<link[\s\S]*?>/gi, '')
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]*/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '')
}

const TEMPLATE_TYPES = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'quote', label: 'Quote / Proposal' },
  { value: 'contract', label: 'Contract' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'custom', label: 'Custom' },
]

const VARIABLES = {
  invoice: ['{{company_name}}', '{{company_address}}', '{{company_tax_id}}', '{{client_name}}', '{{client_email}}', '{{invoice_number}}', '{{issue_date}}', '{{due_date}}', '{{items_table}}', '{{subtotal}}', '{{tax}}', '{{total}}', '{{notes}}', '{{terms}}'],
  quote: ['{{company_name}}', '{{client_name}}', '{{quote_number}}', '{{date}}', '{{valid_until}}', '{{items_table}}', '{{subtotal}}', '{{total}}', '{{notes}}', '{{terms}}'],
  contract: ['{{company_name}}', '{{client_name}}', '{{contract_number}}', '{{start_date}}', '{{end_date}}', '{{value}}', '{{terms}}'],
  receipt: ['{{company_name}}', '{{client_name}}', '{{amount}}', '{{payment_date}}', '{{method}}', '{{reference}}'],
  custom: ['{{company_name}}', '{{client_name}}', '{{date}}'],
}

const DEFAULT_TEMPLATE = `<div style="font-family: -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px;">
  <div style="display: flex; justify-content: space-between; margin-bottom: 40px;">
    <div>
      <h1 style="font-size: 28px; font-weight: 800; color: #1e293b; margin: 0;">{{company_name}}</h1>
      <p style="color: #64748b; font-size: 13px; margin-top: 4px;">{{company_address}}</p>
    </div>
    <div style="text-align: right;">
      <h2 style="font-size: 24px; font-weight: 800; color: #6172f3; margin: 0;">INVOICE</h2>
      <p style="color: #64748b; font-size: 13px;">{{invoice_number}}</p>
    </div>
  </div>
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
    <div style="background: #f8fafc; padding: 16px; border-radius: 8px;">
      <p style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 600;">Bill To</p>
      <p style="font-weight: 600; margin-top: 4px;">{{client_name}}</p>
    </div>
    <div style="background: #f8fafc; padding: 16px; border-radius: 8px;">
      <p style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 600;">Details</p>
      <p style="font-size: 13px; margin-top: 4px;">Date: {{issue_date}}</p>
      <p style="font-size: 13px;">Due: {{due_date}}</p>
    </div>
  </div>
  {{items_table}}
  <div style="text-align: right; margin-top: 20px;">
    <p style="font-size: 14px; color: #64748b;">Subtotal: {{subtotal}}</p>
    <p style="font-size: 14px; color: #64748b;">Tax: {{tax}}</p>
    <p style="font-size: 22px; font-weight: 800; color: #6172f3; margin-top: 8px;">Total: {{total}}</p>
  </div>
  <div style="margin-top: 30px; font-size: 12px; color: #94a3b8;">{{notes}}</div>
  <div style="margin-top: 10px; font-size: 11px; color: #cbd5e1;">{{terms}}</div>
</div>`

export default function TemplatesPage() {
  const supabase = createClient()
  const [templates, setTemplates] = useState<DbRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<DbRow | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [workspaceId, setWorkspaceId] = useState('')
  const [form, setForm] = useState({ name: '', type: 'invoice', html_content: DEFAULT_TEMPLATE })
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)
    const { data } = await supabase.from('document_templates').select('*').eq('workspace_id', ws.id).order('name')
    setTemplates(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const saveTemplate = async () => {
    if (!form.name) return
    setSaving(true)
    const vars = (form.html_content.match(/\{\{(\w+)\}\}/g) || [])
    if (editing) {
      await supabase.from('document_templates').update({ name: form.name, type: form.type, html_content: form.html_content, variables: vars }).eq('id', editing.id)
    } else {
      await supabase.from('document_templates').insert({ workspace_id: workspaceId, name: form.name, type: form.type, html_content: form.html_content, variables: vars })
    }
    setForm({ name: '', type: 'invoice', html_content: DEFAULT_TEMPLATE })
    setShowNew(false); setEditing(null); setSaving(false)
    toast.success('Template saved')
    load()
  }

  const editTemplate = (t: DbRow) => {
    setEditing(t)
    setForm({ name: t.name, type: t.type, html_content: t.html_content })
    setShowNew(true)
  }

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return
    await supabase.from('document_templates').delete().eq('id', id)
    toast.success('Template deleted')
    load()
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in max-w-5xl">
      <div className="page-header">
        <div><h1 className="page-title">Document Templates</h1><p className="text-sm text-surface-500 mt-0.5">{templates.length} templates</p></div>
        <button onClick={() => { setEditing(null); setForm({ name: '', type: 'invoice', html_content: DEFAULT_TEMPLATE }); setShowNew(true) }} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New Template</button>
      </div>

      {templates.length === 0 ? (
        <div className="card text-center py-16"><FileText className="w-10 h-10 text-surface-300 mx-auto mb-3" /><p className="text-surface-500">No templates yet</p><p className="text-xs text-surface-400 mt-1">Create templates for invoices, quotes, contracts, and more</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates.map(t => (
            <div key={t.id} className="card p-4 hover:shadow-card-hover transition-all">
              <div className="flex items-start justify-between mb-2">
                <div><h3 className="text-sm font-bold text-surface-900">{t.name}</h3><p className="text-[10px] text-surface-400 capitalize">{t.type}</p></div>
                <div className="flex gap-1"><button onClick={() => editTemplate(t)} className="text-surface-300 hover:text-brand-600"><FileText className="w-3.5 h-3.5" /></button><button onClick={() => deleteTemplate(t.id)} className="text-surface-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></div>
              </div>
              <div className="h-24 bg-surface-50 rounded-lg overflow-hidden text-[6px] p-2 leading-tight text-surface-400" dangerouslySetInnerHTML={{ __html: sanitizeHTML(t.html_content.slice(0, 500)) }} />
              {t.variables?.length > 0 && <p className="text-[9px] text-surface-300 mt-2">{t.variables.length} variables</p>}
            </div>
          ))}
        </div>
      )}

      {/* Editor */}
      {showNew && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col animate-slide-up">
            <div className="flex items-center justify-between p-4 border-b border-surface-100 flex-shrink-0">
              <h2 className="font-semibold text-surface-900">{editing ? 'Edit Template' : 'New Template'}</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => setPreview(!preview)} className={cn('btn-ghost btn-sm text-[10px]', preview && 'bg-brand-50 text-brand-600')}><Eye className="w-3 h-3" /> Preview</button>
                <button onClick={() => { setShowNew(false); setEditing(null) }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100"><X className="w-4 h-4 text-surface-500" /></button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden flex">
              {/* Editor side */}
              <div className={cn('flex-1 flex flex-col', preview && 'w-1/2')}>
                <div className="p-3 space-y-2 border-b border-surface-100">
                  <div className="flex gap-2">
                    <input className="input text-xs flex-1" placeholder="Template name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                    <select className="input text-xs w-32" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                      {TEMPLATE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(VARIABLES[form.type as keyof typeof VARIABLES] || VARIABLES.custom).map(v => (
                      <button key={v} onClick={() => {
                        const el = document.getElementById('template-editor') as HTMLTextAreaElement
                        if (el) { const pos = el.selectionStart; const before = form.html_content.slice(0, pos); const after = form.html_content.slice(pos); setForm(f => ({ ...f, html_content: before + v + after })) }
                      }} className="text-[9px] px-1.5 py-0.5 bg-brand-50 text-brand-600 rounded font-mono hover:bg-brand-100">{v}</button>
                    ))}
                  </div>
                </div>
                <textarea id="template-editor" className="flex-1 p-3 text-xs font-mono resize-none outline-none border-none"
                  value={form.html_content} onChange={e => setForm(f => ({ ...f, html_content: e.target.value }))} />
              </div>

              {/* Preview side */}
              {preview && (
                <div className="w-1/2 border-l border-surface-100 overflow-y-auto bg-white p-4">
                  <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(form.html_content
                    .replace(/\{\{company_name\}\}/g, 'Your Company')
                    .replace(/\{\{client_name\}\}/g, 'John Doe')
                    .replace(/\{\{invoice_number\}\}/g, 'INV-0001')
                    .replace(/\{\{issue_date\}\}/g, new Date().toLocaleDateString())
                    .replace(/\{\{due_date\}\}/g, new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString())
                    .replace(/\{\{items_table\}\}/g, '<table style="width:100%;border-collapse:collapse"><tr style="border-bottom:2px solid #e2e8f0"><th style="text-align:left;padding:8px;font-size:11px;color:#94a3b8">Item</th><th style="text-align:right;padding:8px;font-size:11px;color:#94a3b8">Amount</th></tr><tr style="border-bottom:1px solid #f1f5f9"><td style="padding:8px;font-size:13px">Sample Service</td><td style="padding:8px;font-size:13px;text-align:right">$1,000</td></tr></table>')
                    .replace(/\{\{subtotal\}\}/g, '$1,000')
                    .replace(/\{\{tax\}\}/g, '$0')
                    .replace(/\{\{total\}\}/g, '$1,000')
                    .replace(/\{\{\w+\}\}/g, '—')
                  ) }} />
                </div>
              )}
            </div>

            <div className="flex gap-2 p-4 border-t border-surface-100 flex-shrink-0">
              <button onClick={() => { setShowNew(false); setEditing(null) }} className="btn-secondary flex-1">Cancel</button>
              <button onClick={saveTemplate} disabled={!form.name || saving} className="btn-primary flex-1"><Save className="w-3.5 h-3.5" /> Save Template</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
