'use client'
import { useI18n } from '@/lib/i18n/context'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts'
import { cn } from '@/lib/utils'
import type { DbRow } from '@/types'

const COLORS = ['#6172f3', '#34d399', '#f59e0b', '#f87171', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']

export default function AnalyticsPage() {
  const { t } = useI18n()
  const [tab, setTab] = useState<'leads'|'deals'|'activities'>('leads')
  const [loading, setLoading] = useState(true)

  // Lead analytics
  const [leadsByPlatform, setLeadsByPlatform] = useState<{ name: string; value: number }[]>([])
  const [leadsByStatus, setLeadsByStatus] = useState<{ name: string; value: number }[]>([])
  const [leadsOverTime, setLeadsOverTime] = useState<{ month: string; count: number }[]>([])

  // Deal analytics
  const [dealsByStage, setDealsByStage] = useState<{ name: string; value: number }[]>([])
  const [winLoss, setWinLoss] = useState<{ name: string; value: number }[]>([])
  const [avgCycleDays, setAvgCycleDays] = useState(0)
  const [dealCycleByMonth, setDealCycleByMonth] = useState<{ month: string; days: number }[]>([])

  // Activity analytics
  const [activitiesByType, setActivitiesByType] = useState<{ name: string; value: number }[]>([])
  const [activitiesOverTime, setActivitiesOverTime] = useState<{ month: string; count: number }[]>([])
  const [busiestDay, setBusiestDay] = useState<{ name: string; value: number }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
    if (!ws) { setLoading(false); return }

    const [leadsRes, dealsRes, stagesRes, activitiesRes] = await Promise.all([
      supabase.from('social_leads').select('id, platform, status, created_at').eq('workspace_id', ws.id),
      supabase.from('deals').select('id, value, status, stage_id, created_at, updated_at').eq('workspace_id', ws.id),
      supabase.from('pipeline_stages').select('id, name').eq('workspace_id', ws.id),
      supabase.from('activities').select('id, type, due_date, created_at, done').eq('workspace_id', ws.id),
    ])

    const leads = leadsRes.data || []
    const deals = dealsRes.data || []
    const stages = stagesRes.data || []
    const activities = activitiesRes.data || []
    const stageMap: Record<string, string> = {}
    stages.forEach((s: DbRow) => { stageMap[s.id] = s.name })

    // --- LEAD ANALYTICS ---
    // By platform
    const platformCounts: Record<string, number> = {}
    leads.forEach((l: DbRow) => { platformCounts[l.platform] = (platformCounts[l.platform] || 0) + 1 })
    setLeadsByPlatform(Object.entries(platformCounts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1), value,
    })).sort((a, b) => b.value - a.value))

    // By status
    const statusCounts: Record<string, number> = {}
    leads.forEach((l: DbRow) => { statusCounts[l.status] = (statusCounts[l.status] || 0) + 1 })
    setLeadsByStatus(Object.entries(statusCounts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1), value,
    })))

    // Over time (last 6 months)
    const now = new Date()
    const monthlyLeads: { month: string; count: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      const y = d.getFullYear(); const m = d.getMonth()
      const count = leads.filter((l: DbRow) => {
        const c = new Date(l.created_at)
        return c.getFullYear() === y && c.getMonth() === m
      }).length
      monthlyLeads.push({ month: label, count })
    }
    setLeadsOverTime(monthlyLeads)

    // --- DEAL ANALYTICS ---
    // By stage (open deals only)
    const stageCounts: Record<string, number> = {}
    deals.filter((d: DbRow) => d.status === 'open').forEach((d: DbRow) => {
      const stageName = stageMap[d.stage_id] || 'Unknown'
      stageCounts[stageName] = (stageCounts[stageName] || 0) + 1
    })
    setDealsByStage(Object.entries(stageCounts).map(([name, value]) => ({ name, value })))

    // Win/loss ratio
    const won = deals.filter((d: DbRow) => d.status === 'won').length
    const lost = deals.filter((d: DbRow) => d.status === 'lost').length
    const open = deals.filter((d: DbRow) => d.status === 'open').length
    setWinLoss([
      { name: 'Won', value: won },
      { name: 'Lost', value: lost },
      { name: 'Open', value: open },
    ].filter(e => e.value > 0))

    // Average deal cycle
    const closedDeals = deals.filter((d: DbRow) => d.status === 'won' || d.status === 'lost')
    if (closedDeals.length > 0) {
      const totalDays = closedDeals.reduce((sum: number, d: DbRow) => {
        const created = new Date(d.created_at).getTime()
        const closed = new Date(d.updated_at).getTime()
        return sum + Math.max(0, (closed - created) / (1000 * 60 * 60 * 24))
      }, 0)
      setAvgCycleDays(Math.round(totalDays / closedDeals.length))
    }

    // Deal cycle by month
    const cycleMonths: { month: string; days: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      const y = d.getFullYear(); const m = d.getMonth()
      const monthClosed = closedDeals.filter((deal: DbRow) => {
        const u = new Date(deal.updated_at)
        return u.getFullYear() === y && u.getMonth() === m
      })
      const avgDays = monthClosed.length > 0
        ? Math.round(monthClosed.reduce((s: number, deal: DbRow) => {
            return s + Math.max(0, (new Date(deal.updated_at).getTime() - new Date(deal.created_at).getTime()) / (1000 * 60 * 60 * 24))
          }, 0) / monthClosed.length)
        : 0
      cycleMonths.push({ month: label, days: avgDays })
    }
    setDealCycleByMonth(cycleMonths)

    // --- ACTIVITY ANALYTICS ---
    // By type
    const typeCounts: Record<string, number> = {}
    activities.forEach((a: DbRow) => { typeCounts[a.type] = (typeCounts[a.type] || 0) + 1 })
    setActivitiesByType(Object.entries(typeCounts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1), value,
    })).sort((a, b) => b.value - a.value))

    // Over time (last 6 months)
    const monthlyActivities: { month: string; count: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      const y = d.getFullYear(); const m = d.getMonth()
      const count = activities.filter((a: DbRow) => {
        const c = new Date(a.created_at)
        return c.getFullYear() === y && c.getMonth() === m
      }).length
      monthlyActivities.push({ month: label, count })
    }
    setActivitiesOverTime(monthlyActivities)

    // Busiest day of week
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dayCounts = [0, 0, 0, 0, 0, 0, 0]
    activities.forEach((a: DbRow) => {
      const dateStr = a.due_date || a.created_at
      if (dateStr) {
        const day = new Date(dateStr).getDay()
        dayCounts[day]++
      }
    })
    setBusiestDay(dayNames.map((name, i) => ({ name: name.slice(0, 3), value: dayCounts[i] })))

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  const renderCustomLabel = ({ name, percent }: { name: string; percent: number }) => {
    if (percent < 0.05) return null
    return `${name} ${(percent * 100).toFixed(0)}%`
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav.analytics')}</h1>
          <p className="text-sm text-surface-500 mt-0.5">Business intelligence and insights</p>
        </div>
      </div>

      <div className="segmented-control mb-8">
        {[{ id: 'leads', label: 'Lead Analytics' }, { id: 'deals', label: 'Deal Analytics' }, { id: 'activities', label: 'Activity Analytics' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as 'leads'|'deals'|'activities')}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all', tab === t.id ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Lead Analytics */}
      {tab === 'leads' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Leads by Platform - Pie */}
            <div className="card p-5">
              <h3 className="font-semibold text-surface-900 mb-4">Leads by Platform</h3>
              {leadsByPlatform.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={leadsByPlatform} cx="50%" cy="50%" labelLine={false} label={renderCustomLabel}
                      outerRadius={100} dataKey="value">
                      {leadsByPlatform.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-surface-400 text-sm py-10 text-center">No lead data yet</p>}
            </div>

            {/* Leads by Status - Bar */}
            <div className="card p-5">
              <h3 className="font-semibold text-surface-900 mb-4">Leads by Status</h3>
              {leadsByStatus.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={leadsByStatus}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                    <Bar dataKey="value" fill="#6172f3" radius={[4,4,0,0]} name="Leads" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-surface-400 text-sm py-10 text-center">No lead data yet</p>}
            </div>
          </div>

          {/* Leads Over Time - Line */}
          <div className="card p-5">
            <h3 className="font-semibold text-surface-900 mb-4">Leads Over Time (Last 6 Months)</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={leadsOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Line type="monotone" dataKey="count" stroke="#6172f3" strokeWidth={2.5} dot={{ r: 4, fill: '#6172f3' }} name="Leads" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Deal Analytics */}
      {tab === 'deals' && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="card p-4">
              <p className="text-lg font-bold text-brand-600">{winLoss.find(w => w.name === 'Won')?.value || 0}</p>
              <p className="text-[10px] text-surface-500 font-semibold uppercase">Deals Won</p>
            </div>
            <div className="card p-4">
              <p className="text-lg font-bold text-red-600">{winLoss.find(w => w.name === 'Lost')?.value || 0}</p>
              <p className="text-[10px] text-surface-500 font-semibold uppercase">Deals Lost</p>
            </div>
            <div className="card p-4">
              <p className="text-lg font-bold text-violet-600">{avgCycleDays} days</p>
              <p className="text-[10px] text-surface-500 font-semibold uppercase">Avg Deal Cycle</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Deals by Stage - Bar */}
            <div className="card p-5">
              <h3 className="font-semibold text-surface-900 mb-4">Open Deals by Stage</h3>
              {dealsByStage.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={dealsByStage} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} width={100} />
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                    <Bar dataKey="value" fill="#6172f3" radius={[0,4,4,0]} name="Deals" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-surface-400 text-sm py-10 text-center">No open deals</p>}
            </div>

            {/* Win/Loss Donut */}
            <div className="card p-5">
              <h3 className="font-semibold text-surface-900 mb-4">Win / Loss Ratio</h3>
              {winLoss.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={winLoss} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                      labelLine={false} label={renderCustomLabel} dataKey="value">
                      {winLoss.map((entry, i) => (
                        <Cell key={i} fill={entry.name === 'Won' ? '#34d399' : entry.name === 'Lost' ? '#f87171' : '#9ba3c0'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-surface-400 text-sm py-10 text-center">No closed deals yet</p>}
            </div>
          </div>

          {/* Deal Cycle Trend */}
          <div className="card p-5">
            <h3 className="font-semibold text-surface-900 mb-4">Avg Deal Cycle (Days) — Last 6 Months</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={dealCycleByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v: number) => [`${v} days`, 'Avg Cycle']} />
                <Line type="monotone" dataKey="days" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 4, fill: '#8b5cf6' }} name="Days" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Activity Analytics */}
      {tab === 'activities' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Activities by Type - Bar */}
            <div className="card p-5">
              <h3 className="font-semibold text-surface-900 mb-4">Activities by Type</h3>
              {activitiesByType.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={activitiesByType}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                    <Bar dataKey="value" fill="#6172f3" radius={[4,4,0,0]} name="Activities">
                      {activitiesByType.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-surface-400 text-sm py-10 text-center">No activities yet</p>}
            </div>

            {/* Busiest Day of Week - Bar */}
            <div className="card p-5">
              <h3 className="font-semibold text-surface-900 mb-4">Busiest Day of Week</h3>
              {busiestDay.some(d => d.value > 0) ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={busiestDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                    <Bar dataKey="value" fill="#f59e0b" radius={[4,4,0,0]} name="Activities" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-surface-400 text-sm py-10 text-center">No activities yet</p>}
            </div>
          </div>

          {/* Activities Over Time - Line */}
          <div className="card p-5">
            <h3 className="font-semibold text-surface-900 mb-4">Activities Over Time (Last 6 Months)</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={activitiesOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Line type="monotone" dataKey="count" stroke="#34d399" strokeWidth={2.5} dot={{ r: 4, fill: '#34d399' }} name="Activities" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
