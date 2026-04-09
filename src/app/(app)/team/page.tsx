'use client'
import { toast } from 'sonner'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Mail, Clock, X, Trash2, CheckCircle2 } from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { getActiveWorkspace } from '@/lib/get-active-workspace'

interface Member {
  id: string
  full_name: string
  email: string
  role: string
  avatar_url: string | null
  created_at: string
}

interface CustomRole {
  id: string; name: string; color: string;
}

interface Invitation {
  id: string
  email: string
  role: string
  status: string
  created_at: string
  expires_at: string
}

export default function TeamPage() {
  const supabase = createClient()
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([])
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const ws = await getActiveWorkspace(supabase, user.id, 'id')
    if (!ws) { setLoading(false); return }

    const [membersRes, invitesRes, rolesRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, role, avatar_url, created_at').eq('workspace_id', ws.id),
      supabase.from('team_invitations').select('*').eq('workspace_id', ws.id).eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('custom_roles').select('id, name, color').eq('workspace_id', ws.id).order('name'),
    ])

    setMembers(membersRes.data || [])
    setInvitations(invitesRes.data || [])
    setCustomRoles(rolesRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const sendInvitation = async () => {
    if (!inviteEmail) return
    setSending(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const ws = await getActiveWorkspace(supabase, user.id, 'id')
    if (!ws) return

    const token = crypto.randomUUID()

    await supabase.from('team_invitations').insert({
      workspace_id: ws.id,
      email: inviteEmail,
      role: inviteRole,
      invited_by: user.id,
      token,
    })

    setSending(false)
    setSent(true)
    setTimeout(() => { setSent(false); setShowInvite(false); setInviteEmail('') }, 2000)
    load()
  }

  const revokeInvitation = async (id: string) => {
    await supabase.from('team_invitations').update({ status: 'revoked' }).eq('id', id)
    load()
  }

  const updateRole = async (memberId: string, newRole: string) => {
    await supabase.from('profiles').update({ role: newRole }).eq('id', memberId)
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m))
  }

  const ROLE_COLORS: Record<string, string> = {
    admin: 'badge-blue',
    manager: 'badge-green',
    member: 'badge-gray',
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Team</h1>
          <p className="text-sm text-surface-500 mt-0.5">{members.length} member{members.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowInvite(true)} className="btn-primary btn-sm">
          <Plus className="w-3.5 h-3.5" /> Invite Member
        </button>
      </div>

      {/* Members */}
      <div className="card overflow-hidden mb-6">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Member</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden md:table-cell">Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Role</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {members.map(member => (
              <tr key={member.id} className="border-b border-surface-50 last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="avatar-sm bg-brand-500 flex-shrink-0">{getInitials(member.full_name || member.email)}</div>
                    <span className="text-sm font-semibold text-surface-800">{member.full_name || 'Unnamed'}</span>
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-xs text-surface-500">{member.email}</span>
                </td>
                <td className="px-4 py-3">
                  <select value={member.role} onChange={e => updateRole(member.id, e.target.value)}
                    className="text-[10px] font-semibold border-0 bg-transparent cursor-pointer p-0">
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="member">Member</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span className={cn('badge text-[10px]', ROLE_COLORS[member.role])}>{member.role}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-surface-700 mb-3">Pending Invitations</h2>
          <div className="space-y-2 mb-6">
            {invitations.map(inv => (
              <div key={inv.id} className="card p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                    <Mail className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-surface-800">{inv.email}</p>
                    <p className="text-[10px] text-surface-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Expires {new Date(inv.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge badge-gray text-[10px]">{inv.role}</span>
                  <button onClick={() => revokeInvitation(inv.id)} className="text-surface-300 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Invite Modal */}
      {showInvite && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-surface-100">
              <h2 className="font-semibold text-surface-900">Invite Team Member</h2>
              <button onClick={() => setShowInvite(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100">
                <X className="w-4 h-4 text-surface-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Email address</label>
                <input className="input" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com" />
              </div>
              <div>
                <label className="label">Role</label>
                <select className="input" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                  {customRoles.length > 0 ? (
                    customRoles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)
                  ) : (
                    <>
                      <option value="admin">Admin — Full access</option>
                      <option value="manager">Manager — Can manage deals & contacts</option>
                      <option value="member">Member — View & edit assigned items</option>
                    </>
                  )}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowInvite(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={sendInvitation} disabled={!inviteEmail || sending} className="btn-primary flex-1">
                  {sending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : sent ? <CheckCircle2 className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                  {sent ? 'Sent!' : 'Send Invitation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
