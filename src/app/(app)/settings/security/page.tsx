'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Shield, Copy, KeyRound, Check } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface TwoFAStatus {
  enabled: boolean
}

export default function SecuritySettingsPage() {
  const supabase = createClient()
  const [status, setStatus] = useState<TwoFAStatus>({ enabled: false })
  const [loading, setLoading] = useState(true)
  const [setup, setSetup] = useState<{ secret: string; qr_url: string } | null>(null)
  const [token, setToken] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)

  const load = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase.from('user_2fa').select('enabled').eq('user_id', user.id).maybeSingle()
    setStatus({ enabled: !!data?.enabled })
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const startSetup = async () => {
    const res = await fetch('/api/security/2fa/setup', { method: 'POST' })
    const j = await res.json()
    if (j.error) { toast.error(j.error); return }
    setSetup({ secret: j.secret, qr_url: j.qr_url })
  }

  const verify = async () => {
    if (!token) return
    setVerifying(true)
    const res = await fetch('/api/security/2fa/enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const j = await res.json()
    setVerifying(false)
    if (j.error) { toast.error(j.error); return }
    setBackupCodes(j.backup_codes)
    setSetup(null)
    setToken('')
    setStatus({ enabled: true })
    toast.success('2FA enabled')
  }

  const disable = async () => {
    if (!confirm('Disable two-factor authentication?')) return
    const res = await fetch('/api/security/2fa/disable', { method: 'POST' })
    const j = await res.json()
    if (j.error) { toast.error(j.error); return }
    setStatus({ enabled: false })
    setBackupCodes(null)
    toast.success('2FA disabled')
  }

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied')
  }

  const qrImage = setup
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setup.qr_url)}`
    : null

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <Link href="/settings" className="text-xs text-surface-500 hover:text-surface-800">← Settings</Link>
        <h1 className="text-2xl font-bold text-surface-900 mt-2 flex items-center gap-2">
          <Shield className="w-6 h-6 text-brand-600" /> Security
        </h1>
        <p className="text-sm text-surface-500 mt-1">Manage two-factor authentication and account security.</p>
      </div>

      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="font-semibold text-surface-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4" /> Two-factor authentication (TOTP)
            </h2>
            <p className="text-xs text-surface-500 mt-1">Use an authenticator app like Google Authenticator, 1Password or Authy.</p>
          </div>
          <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${status.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-surface-100 text-surface-500'}`}>
            {status.enabled ? 'ENABLED' : 'DISABLED'}
          </span>
        </div>

        {loading && <p className="text-sm text-surface-400">Loading…</p>}

        {!loading && !status.enabled && !setup && (
          <button onClick={startSetup} className="btn-primary">
            Enable 2FA
          </button>
        )}

        {!loading && status.enabled && !backupCodes && (
          <div className="flex gap-2">
            <button onClick={disable} className="btn-secondary">Disable 2FA</button>
            <button onClick={startSetup} className="btn-secondary">Generate new backup codes</button>
          </div>
        )}

        {setup && (
          <div className="space-y-4 mt-4 border-t border-surface-100 pt-4">
            <p className="text-sm text-surface-700">Scan this QR code with your authenticator app, then enter the 6-digit code below.</p>
            {qrImage && <img src={qrImage} alt="2FA QR" className="w-48 h-48 border border-surface-100 rounded-lg" />}
            <div>
              <label className="label">Or enter this secret manually:</label>
              <div className="flex gap-2 items-center">
                <code className="px-3 py-2 bg-surface-50 rounded text-xs flex-1 break-all">{setup.secret}</code>
                <button onClick={() => copyText(setup.secret)} className="btn-secondary btn-sm"><Copy className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <div>
              <label className="label">Verification code</label>
              <input
                className="input w-40 tracking-widest text-center"
                placeholder="000000"
                maxLength={6}
                value={token}
                onChange={e => setToken(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={verify} disabled={verifying || token.length !== 6} className="btn-primary disabled:opacity-50">
                {verifying ? 'Verifying…' : 'Verify & enable'}
              </button>
              <button onClick={() => { setSetup(null); setToken('') }} className="btn-secondary">Cancel</button>
            </div>
          </div>
        )}

        {backupCodes && (
          <div className="mt-4 border-t border-surface-100 pt-4 space-y-3">
            <div className="flex items-center gap-2 text-emerald-700">
              <Check className="w-4 h-4" />
              <p className="text-sm font-semibold">Save your backup codes</p>
            </div>
            <p className="text-xs text-surface-500">Each code can be used once if you lose access to your authenticator. They will not be shown again.</p>
            <div className="grid grid-cols-2 gap-2 p-4 bg-surface-50 rounded-lg font-mono text-sm">
              {backupCodes.map(c => <div key={c}>{c}</div>)}
            </div>
            <button onClick={() => copyText(backupCodes.join('\n'))} className="btn-secondary btn-sm">
              <Copy className="w-3.5 h-3.5" /> Copy all
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
