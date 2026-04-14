'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { KeyRound, Plus, Trash2, Copy, AlertTriangle, X } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  scopes: string[]
  created_at: string
  last_used_at: string | null
}

const SCOPE_OPTIONS = ['read', 'write', 'admin']

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newScopes, setNewScopes] = useState<string[]>(['read', 'write'])
  const [creating, setCreating] = useState(false)
  const [generated, setGenerated] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/api-keys')
      const j = await res.json()
      setKeys(j.keys || [])
    } catch { toast.error('Failed to load API keys') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const create = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), scopes: newScopes }),
      })
      const j = await res.json()
      if (j.error) { toast.error(j.error); setCreating(false); return }
      setGenerated(j.plaintext)
      setKeys(prev => [j.key, ...prev])
      setNewName('')
      setNewScopes(['read', 'write'])
    } catch { toast.error('Failed to create key') }
    setCreating(false)
  }

  const remove = async (id: string) => {
    if (!confirm('Revoke this API key? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/api-keys?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setKeys(prev => prev.filter(k => k.id !== id))
        toast.success('Key revoked')
      }
    } catch { toast.error('Failed to revoke key') }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied')
  }

  const closeModal = () => {
    setShowCreate(false)
    setGenerated(null)
    setNewName('')
  }

  const toggleScope = (s: string) => {
    setNewScopes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <Link href="/settings" className="text-xs text-surface-500 hover:text-surface-800">← Settings</Link>
        <div className="flex items-center justify-between mt-2">
          <div>
            <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
              <KeyRound className="w-6 h-6 text-brand-600" /> API keys
            </h1>
            <p className="text-sm text-surface-500 mt-1">Generate API keys for programmatic access to your workspace.</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Generate new key
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="p-6 text-sm text-surface-400">Loading…</div>
        ) : keys.length === 0 ? (
          <div className="p-12 text-center">
            <KeyRound className="w-10 h-10 text-surface-300 mx-auto mb-3" />
            <p className="text-sm text-surface-500">No API keys yet</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="text-[11px] uppercase text-surface-400 border-b border-surface-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Name</th>
                <th className="text-left px-4 py-3 font-semibold">Prefix</th>
                <th className="text-left px-4 py-3 font-semibold">Scopes</th>
                <th className="text-left px-4 py-3 font-semibold">Created</th>
                <th className="text-left px-4 py-3 font-semibold">Last used</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {keys.map(k => (
                <tr key={k.id} className="border-b border-surface-50 text-sm">
                  <td className="px-4 py-3 font-medium text-surface-900">{k.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-surface-500">{k.key_prefix}…</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {k.scopes?.map(s => (
                        <span key={s} className="px-2 py-0.5 bg-surface-50 rounded text-[10px] font-semibold uppercase">{s}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-surface-500">{formatDate(k.created_at)}</td>
                  <td className="px-4 py-3 text-surface-500">{k.last_used_at ? formatDate(k.last_used_at) : 'Never'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => remove(k.id)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-float max-w-md w-full">
            <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between">
              <h2 className="font-semibold text-surface-900">{generated ? 'API key generated' : 'Generate API key'}</h2>
              <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {!generated ? (
                <>
                  <div>
                    <label className="label">Key name</label>
                    <input
                      className="input"
                      placeholder="e.g. Production server"
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="label">Scopes</label>
                    <div className="flex gap-2">
                      {SCOPE_OPTIONS.map(s => (
                        <label key={s} className="flex items-center gap-1.5 px-3 py-1.5 border border-surface-100 rounded-lg cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newScopes.includes(s)}
                            onChange={() => toggleScope(s)}
                          />
                          <span className="text-sm capitalize">{s}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800">
                      <strong>Save it now, you won't see it again.</strong> Store this key securely — it grants access to your workspace.
                    </p>
                  </div>
                  <div className="p-3 bg-surface-900 text-white rounded-lg font-mono text-xs break-all">
                    {generated}
                  </div>
                  <button onClick={() => copyToClipboard(generated)} className="btn-secondary w-full">
                    <Copy className="w-3.5 h-3.5" /> Copy to clipboard
                  </button>
                </>
              )}
            </div>
            <div className="px-6 py-4 border-t border-surface-100 flex justify-end gap-2">
              {!generated ? (
                <>
                  <button onClick={closeModal} className="btn-secondary">Cancel</button>
                  <button onClick={create} disabled={creating || !newName.trim()} className="btn-primary disabled:opacity-50">
                    {creating ? 'Generating…' : 'Generate'}
                  </button>
                </>
              ) : (
                <button onClick={closeModal} className="btn-primary">Done</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
