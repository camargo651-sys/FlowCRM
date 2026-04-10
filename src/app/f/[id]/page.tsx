'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, Zap, Send } from 'lucide-react'

export default function PublicFormPage() {
  const { id } = useParams()
  const [config, setConfig] = useState<{ workspace: { name: string; color: string; logo?: string }; fields: { label: string; key: string; type: string; options?: string[]; required?: boolean }[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<Record<string, string>>({ name: '', email: '', phone: '', company: '', message: '' })

  useEffect(() => {
    fetch(`/api/forms?id=${id}`).then(r => r.json()).then(d => {
      if (d.workspace) setConfig(d)
      else setError('Form not found')
      setLoading(false)
    }).catch(() => { setError('Failed to load form'); setLoading(false) })
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.email) return
    setSubmitting(true)
    setError('')

    const customFields: Record<string, string> = {}
    config?.fields.forEach(f => { if (form[f.key]) customFields[f.key] = form[f.key] })

    try {
      const res = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: id,
          name: form.name, email: form.email, phone: form.phone,
          company: form.company, message: form.message,
          source: 'web-form', custom_fields: customFields,
        }),
      })
      const result = await res.json()
      if (result.success) setSubmitted(true)
      else setError(result.error || 'Submission failed')
    } catch { setError('Submission failed') }
    setSubmitting(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: '-apple-system, sans-serif' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #e2e8f0', borderTop: '3px solid #0891B2', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (error && !config) return (
    <div style={{ textAlign: 'center', padding: '80px 20px', fontFamily: '-apple-system, sans-serif' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b' }}>Form not available</h1>
      <p style={{ color: '#64748b', marginTop: 8 }}>{error}</p>
    </div>
  )

  if (!config) return null
  const color = config.workspace.color || '#0891B2'

  if (submitted) return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-6">
      <div className="text-center max-w-sm animate-fade-in">
        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold text-surface-900 mb-2">Thank you!</h1>
        <p className="text-sm text-surface-500">Your information has been submitted. We'll be in touch shortly.</p>
        <p className="text-xs text-surface-400 mt-6">Powered by Tracktio</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-surface-50">
      <div className="max-w-md mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: color }}>
            {config.workspace.logo ? <img src={config.workspace.logo} alt="" className="w-5 h-5 object-contain" /> : <Zap className="w-4 h-4" />}
          </div>
          <span className="font-bold text-lg text-surface-900">{config.workspace.name}</span>
        </div>

        <div className="card p-8">
          <h1 className="text-xl font-bold text-surface-900 mb-1">Get in touch</h1>
          <p className="text-sm text-surface-500 mb-6">Fill out the form below and we'll get back to you soon.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Name *</label>
              <input className="input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Your full name" />
            </div>
            <div>
              <label className="label">Email *</label>
              <input className="input" type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@company.com" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 (555) 000-0000" />
            </div>
            <div>
              <label className="label">Company</label>
              <input className="input" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Company name" />
            </div>

            {/* Custom fields */}
            {config.fields.map(field => (
              <div key={field.key}>
                <label className="label">{field.label}{field.required && ' *'}</label>
                {field.type === 'select' && field.options ? (
                  <select className="input" required={field.required} value={form[field.key] || ''} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}>
                    <option value="">Select...</option>
                    {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea className="input resize-none" rows={3} required={field.required} value={form[field.key] || ''} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))} />
                ) : (
                  <input className="input" type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                    required={field.required} value={form[field.key] || ''} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))} />
                )}
              </div>
            ))}

            <div>
              <label className="label">Message</label>
              <textarea className="input resize-none" rows={3} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="How can we help?" />
            </div>

            {error && <p className="text-red-600 text-xs">{error}</p>}

            <button type="submit" disabled={submitting} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm transition-all" style={{ background: color }}>
              {submitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send className="w-4 h-4" /> Submit</>}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-surface-400 mt-6">Powered by <span className="font-semibold">Tracktio</span></p>
      </div>
    </div>
  )
}
