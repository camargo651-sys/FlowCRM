'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import SignaturePad from '@/components/shared/SignaturePad'
import { CheckCircle2, FileSignature, Zap } from 'lucide-react'

export default function SignPage() {
  const { token } = useParams()
  const [doc, setDoc] = useState<{ type: string; data: Record<string, unknown>; already_signed: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState(false)
  const [signed, setSigned] = useState(false)
  const [signerName, setSignerName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/sign?token=${token}`).then(r => r.json()).then(d => {
      if (d.type) setDoc(d)
      else setError(d.error || 'Document not found')
      setLoading(false)
    }).catch(() => { setError('Could not load document'); setLoading(false) })
  }, [token])

  const handleSign = async (signatureDataUrl: string) => {
    setSigning(true)
    try {
      const res = await fetch('/api/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, signature_data: signatureDataUrl, signer_name: signerName }),
      })
      const result = await res.json()
      if (result.success) setSigned(true)
      else setError(result.error || 'Failed to sign')
    } catch { setError('Failed to sign') }
    setSigning(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
    </div>
  )

  if (error || !doc) return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <FileSignature className="w-12 h-12 text-surface-300 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-surface-900 mb-2">Document not found</h1>
        <p className="text-sm text-surface-500">{error || 'This signing link is invalid or has expired.'}</p>
      </div>
    </div>
  )

  const d = doc.data as Record<string, unknown>
  const workspace = d.workspaces as { name?: string; primary_color?: string; logo_url?: string } | null
  const contact = d.contacts as { name?: string; email?: string } | null
  const color = workspace?.primary_color || '#0891B2'

  if (signed || doc.already_signed) return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-6">
      <div className="text-center max-w-sm animate-fade-in">
        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold text-surface-900 mb-2">Document signed!</h1>
        <p className="text-sm text-surface-500 mb-6">
          {doc.already_signed ? 'This document has already been signed.' : 'Your signature has been recorded. The sender has been notified.'}
        </p>
        <p className="text-xs text-surface-400">Powered by Tracktio</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <div className="bg-white border-b border-surface-100 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white" style={{ background: color }}>
              {workspace?.logo_url ? <img src={workspace.logo_url} alt="" className="w-4 h-4 object-contain" /> : <Zap className="w-4 h-4" />}
            </div>
            <span className="font-bold text-surface-900">{workspace?.name || 'Tracktio'}</span>
          </div>
          <span className="badge badge-blue text-xs">E-Sign</span>
        </div>
      </div>

      {/* Document */}
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="card p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <FileSignature className="w-6 h-6" style={{ color }} />
            <div>
              <h1 className="text-lg font-bold text-surface-900">{d.title as string}</h1>
              <p className="text-xs text-surface-400">
                {doc.type === 'contract' ? `Contract ${d.contract_number}` : `Quote ${d.quote_number}`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            {Number(d.value) > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Value</p>
                <p className="text-sm font-bold text-surface-900">${Number(d.value).toLocaleString()}</p>
              </div>
            )}
            {Number(d.total) > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">Total</p>
                <p className="text-sm font-bold text-surface-900">${Number(d.total).toLocaleString()}</p>
              </div>
            )}
            {(String(d.start_date || '') || String(d.valid_until || '')) && (
              <div>
                <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">{doc.type === 'contract' ? 'Period' : 'Valid Until'}</p>
                <p className="text-sm text-surface-700">
                  {doc.type === 'contract'
                    ? `${String(d.start_date || '')} — ${String(d.end_date || 'Ongoing')}`
                    : String(d.valid_until || '')}
                </p>
              </div>
            )}
          </div>

          {String(d.notes || '') && (
            <div className="p-4 bg-surface-50 rounded-xl mb-6">
              <p className="text-xs text-surface-500 whitespace-pre-wrap">{d.notes as string}</p>
            </div>
          )}

          <div className="border-t border-surface-100 pt-6">
            <p className="text-sm font-semibold text-surface-900 mb-4">Your signature</p>

            <div className="mb-4">
              <label className="label">Full name</label>
              <input className="input max-w-xs" placeholder={contact?.name || 'Your full name'}
                value={signerName} onChange={e => setSignerName(e.target.value)} />
            </div>

            <SignaturePad onSign={handleSign} />

            {signing && (
              <div className="flex items-center justify-center gap-2 mt-4 text-sm text-surface-500">
                <div className="w-4 h-4 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
                Submitting signature...
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-surface-400">
          By signing, you agree to the terms of this document. Your signature and IP address will be recorded.
        </p>
      </div>
    </div>
  )
}
