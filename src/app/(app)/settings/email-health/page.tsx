'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getActiveWorkspace } from '@/lib/get-active-workspace'
import { Mail, Shield, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Send, TrendingDown, Globe } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type TrafficStatus = 'good' | 'warn' | 'bad' | 'na'

interface DnsResult {
  spf: boolean
  dkim: boolean
  dmarc: boolean
  dkimSelector?: string
  records?: { spf?: string; dkim?: string; dmarc?: string }
}

interface VolumeStats {
  sent: number
  bounced: number
  complaints: number
  delivered: number
}

function statusColor(s: TrafficStatus): string {
  switch (s) {
    case 'good': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20'
    case 'warn': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20'
    case 'bad': return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20'
    default: return 'bg-surface-50 text-surface-600 border-surface-200 dark:bg-surface-800 dark:text-surface-400 dark:border-surface-700'
  }
}

function StatusIcon({ s }: { s: TrafficStatus }) {
  if (s === 'good') return <CheckCircle2 className="w-5 h-5 text-emerald-600" />
  if (s === 'warn') return <AlertTriangle className="w-5 h-5 text-amber-600" />
  if (s === 'bad') return <XCircle className="w-5 h-5 text-red-600" />
  return <AlertTriangle className="w-5 h-5 text-surface-400" />
}

export default function EmailHealthPage() {
  const supabase = createClient()
  const [workspaceId, setWorkspaceId] = useState('')
  const [customDomain, setCustomDomain] = useState('')
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [dns, setDns] = useState<DnsResult | null>(null)
  const [stats, setStats] = useState<VolumeStats>({ sent: 0, bounced: 0, complaints: 0, delivered: 0 })

  const loadStats = useCallback(async (wsId: string) => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const safe = async (q: PromiseLike<{ count: number | null; error: unknown }>) => {
      try { const r = await q; return r.count || 0 } catch { return 0 }
    }
    const sent = await safe(
      supabase.from('email_messages').select('id', { count: 'exact', head: true })
        .eq('workspace_id', wsId).eq('direction', 'outbound').gte('created_at', since)
    )
    const bounced = await safe(
      supabase.from('email_messages').select('id', { count: 'exact', head: true })
        .eq('workspace_id', wsId).eq('direction', 'outbound').contains('labels', ['bounced']).gte('created_at', since)
    )
    const complaints = await safe(
      supabase.from('email_messages').select('id', { count: 'exact', head: true })
        .eq('workspace_id', wsId).eq('direction', 'outbound').contains('labels', ['complaint']).gte('created_at', since)
    )
    setStats({ sent, bounced, complaints, delivered: Math.max(0, sent - bounced) })
  }, [supabase])

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const ws = await getActiveWorkspace(supabase, user.id, '*')
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)
    setCustomDomain(ws.custom_domain || '')
    await loadStats(ws.id)
    setLoading(false)
  }, [supabase, loadStats])

  useEffect(() => { load() }, [load])

  const runCheck = async () => {
    if (!customDomain) return
    setChecking(true)
    try {
      const res = await fetch('/api/email-health/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: customDomain }),
      })
      if (res.ok) {
        const data = (await res.json()) as DnsResult
        setDns(data)
      }
    } catch {}
    setChecking(false)
  }

  useEffect(() => {
    if (customDomain && !dns) runCheck()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customDomain])

  const bounceRate = stats.sent > 0 ? (stats.bounced / stats.sent) * 100 : 0
  const complaintRate = stats.sent > 0 ? (stats.complaints / stats.sent) * 100 : 0
  const deliveryRate = stats.sent > 0 ? (stats.delivered / stats.sent) * 100 : 0

  const bounceStatus: TrafficStatus = stats.sent === 0 ? 'na' : bounceRate < 2 ? 'good' : bounceRate < 5 ? 'warn' : 'bad'
  const complaintStatus: TrafficStatus = stats.sent === 0 ? 'na' : complaintRate < 0.1 ? 'good' : complaintRate < 0.3 ? 'warn' : 'bad'
  const deliveryStatus: TrafficStatus = stats.sent === 0 ? 'na' : deliveryRate > 98 ? 'good' : deliveryRate > 95 ? 'warn' : 'bad'
  const sentStatus: TrafficStatus = stats.sent > 0 ? 'good' : 'na'

  const dnsStatus = (ok: boolean | undefined): TrafficStatus => {
    if (!customDomain) return 'na'
    if (ok === undefined) return 'na'
    return ok ? 'good' : 'bad'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in max-w-5xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">Email Deliverability</h1>
          <p className="text-sm text-surface-500 mt-0.5">
            Monitor DNS records and sending reputation for your custom domain.
          </p>
        </div>
        {customDomain && (
          <button onClick={runCheck} disabled={checking} className="btn-primary">
            <RefreshCw className={cn('w-4 h-4', checking && 'animate-spin')} />
            {checking ? 'Checking...' : 'Re-check DNS'}
          </button>
        )}
      </div>

      {!customDomain && (
        <div className="card p-6 mb-6 border-amber-200 bg-amber-50/50 dark:bg-amber-500/5">
          <div className="flex items-start gap-3">
            <Globe className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-surface-900 dark:text-surface-50">Configure a custom domain</h3>
              <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">
                SPF, DKIM, and DMARC records can only be verified against a custom sending domain.
              </p>
              <Link href="/settings" className="inline-flex mt-3 text-sm font-semibold text-brand-600 hover:text-brand-700">
                Configure custom domain →
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <HealthCard
          title="SPF"
          subtitle="Sender Policy Framework"
          status={dnsStatus(dns?.spf)}
          value={dns?.spf ? 'Valid' : customDomain ? 'Missing' : 'N/A'}
          detail={dns?.records?.spf}
          icon={<Shield className="w-5 h-5" />}
        />
        <HealthCard
          title="DKIM"
          subtitle="DomainKeys Identified Mail"
          status={dnsStatus(dns?.dkim)}
          value={dns?.dkim ? 'Valid' : customDomain ? 'Missing' : 'N/A'}
          detail={dns?.dkimSelector ? `Selector: ${dns.dkimSelector}` : undefined}
          icon={<Shield className="w-5 h-5" />}
        />
        <HealthCard
          title="DMARC"
          subtitle="Domain-based Message Auth"
          status={dnsStatus(dns?.dmarc)}
          value={dns?.dmarc ? 'Valid' : customDomain ? 'Missing' : 'N/A'}
          detail={dns?.records?.dmarc}
          icon={<Shield className="w-5 h-5" />}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <HealthCard
          title="Sent (30d)"
          subtitle="Outbound messages"
          status={sentStatus}
          value={stats.sent.toLocaleString()}
          icon={<Send className="w-5 h-5" />}
        />
        <HealthCard
          title="Delivery rate"
          subtitle="Delivered / Sent"
          status={deliveryStatus}
          value={stats.sent > 0 ? `${deliveryRate.toFixed(1)}%` : '—'}
          icon={<CheckCircle2 className="w-5 h-5" />}
        />
        <HealthCard
          title="Bounce rate"
          subtitle="Target: < 2%"
          status={bounceStatus}
          value={stats.sent > 0 ? `${bounceRate.toFixed(2)}%` : '—'}
          detail={`${stats.bounced} bounced`}
          icon={<TrendingDown className="w-5 h-5" />}
        />
        <HealthCard
          title="Complaint rate"
          subtitle="Target: < 0.1%"
          status={complaintStatus}
          value={stats.sent > 0 ? `${complaintRate.toFixed(2)}%` : '—'}
          detail={`${stats.complaints} complaints`}
          icon={<Mail className="w-5 h-5" />}
        />
      </div>

      <div className="card p-6 mt-6">
        <h3 className="font-semibold text-surface-900 dark:text-surface-50 mb-2">Tips to improve deliverability</h3>
        <ul className="space-y-2 text-sm text-surface-600 dark:text-surface-400 list-disc pl-5">
          <li>Keep bounce rate under 2% — remove invalid addresses regularly.</li>
          <li>Authenticate every outbound message with SPF + DKIM + DMARC alignment.</li>
          <li>Use a dedicated subdomain (e.g. <code>mail.yourdomain.com</code>) for marketing sends.</li>
          <li>Warm up new sending IPs gradually over 2–4 weeks.</li>
        </ul>
      </div>
    </div>
  )
}

function HealthCard({
  title,
  subtitle,
  status,
  value,
  detail,
  icon,
}: {
  title: string
  subtitle: string
  status: TrafficStatus
  value: string
  detail?: string
  icon: React.ReactNode
}) {
  return (
    <div className={cn('card p-5 border', statusColor(status))}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-50">{title}</h3>
            <p className="text-[11px] text-surface-500">{subtitle}</p>
          </div>
        </div>
        <StatusIcon s={status} />
      </div>
      <p className="text-2xl font-bold text-surface-900 dark:text-surface-50 mb-1">{value}</p>
      {detail && <p className="text-[11px] text-surface-500 truncate" title={detail}>{detail}</p>}
    </div>
  )
}
