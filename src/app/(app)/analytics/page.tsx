'use client'
import { useI18n } from '@/lib/i18n/context'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from 'recharts'
import { formatCurrency, cn } from '@/lib/utils'
import { TrendingUp, DollarSign, Target, Award, Users, Mail, MessageCircle, Phone, Zap, ArrowUpRight, ArrowDownRight } from 'lucide-react'

const COLORS = ['#6172f3','#a78bfa','#34d399','#fbbf24','#f87171','#22d3ee','#f97316','#ec4899']

export default function AnalyticsPage() {
  const supabase = createClient()
  const { t } = useI18n()
  const [deals, setDeals] = useState<any[]>([])
  const [stages, setStages] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [signals, setSignals] = useState<any[]>([])
  const [emailCount, setEmailCount] = useState(0)
  const [waCount, setWaCount] = useState(0)
  const [callCount, setCallCount] = useState(0)
  const [quoteViews, setQuoteViews] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview'|'channels'|'engagement'>('overview')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
      if (!ws) { setLoading(false); return }

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const [dealsRes, stagesRes, contactsRes, signalsRes] = await Promise.all([
        supabase.from('deals').select('id, title, value, status, stage_id, updated_at, created_at').eq('workspace_id', ws.id),
        supabase.from('pipeline_stages').select('*').eq('workspace_id', ws.id).order('order_index'),
        supabase.from('contacts').select('id, name, engagement_score, score_label, created_at, interaction_count').eq('workspace_id', ws.id),
        supabase.from('engagement_signals').select('signal_type, created_at').eq('workspace_id', ws.id).gte('created_at', thirtyDaysAgo),
      ])

      setDeals(dealsRes.data || [])
      setStages(stagesRes.data || [])
      setContacts(contactsRes.data || [])
      setSignals(signalsRes.data || [])

      // Channel counts
      const sigs = signalsRes.data || []
      setEmailCount(sigs.filter(s => s.signal_type.startsWith('email_')).length)
      setWaCount(sigs.filter(s => s.signal_type.startsWith('whatsapp_')).length)
      setCallCount(sigs.filter(s => s.signal_type.startsWith('call_')).length)
      setQuoteViews(sigs.filter(s => s.signal_type === 'quote_viewed').length)

      setLoading(false)
    }
    load()
  }, [])

  const openDeals = deals.filter(d => d.status === 'open')
  const wonDeals = deals.filter(d => d.status === 'won')
  const lostDeals = deals.filter(d => d.status === 'lost')
  const totalValue = openDeals.reduce((s, d) => s + (d.value || 0), 0)
  const wonValue = wonDeals.reduce((s, d) => s + (d.value || 0), 0)
  const conversionRate = deals.length > 0 ? Math.round((wonDeals.length / deals.length) * 100) : 0
  const hotContacts = contacts.filter(c => c.score_label === 'hot')
  const warmContacts = contacts.filter(c => c.score_label === 'warm')

  // Funnel data
  const funnelData = stages.map(s => ({
    name: s.name,
    count: deals.filter(d => d.stage_id === s.id && d.status === 'open').length,
    value: deals.filter(d => d.stage_id === s.id && d.status === 'open').reduce((sum, d) => sum + (d.value || 0), 0),
    color: s.color,
  }))

  // Monthly revenue trend
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (5 - i))
    const month = d.toLocaleDateString('en-US', { month: 'short' })
    const monthDeals = wonDeals.filter(deal => {
      const dd = new Date(deal.updated_at)
      return dd.getMonth() === d.getMonth() && dd.getFullYear() === d.getFullYear()
    })
    const monthContacts = contacts.filter(c => {
      const cd = new Date(c.created_at)
      return cd.getMonth() === d.getMonth() && cd.getFullYear() === d.getFullYear()
    })
    return {
      month,
      revenue: monthDeals.reduce((s, d) => s + (d.value || 0), 0),
      deals: monthDeals.length,
      contacts: monthContacts.length,
    }
  })

  // Engagement distribution
  const engagementDist = [
    { name: 'Hot', value: hotContacts.length, color: '#ef4444' },
    { name: 'Warm', value: warmContacts.length, color: '#f59e0b' },
    { name: 'Cold', value: contacts.filter(c => c.score_label === 'cold').length, color: '#94a3b8' },
    { name: 'Inactive', value: contacts.filter(c => c.score_label === 'inactive' || !c.score_label).length, color: '#e2e8f0' },
  ].filter(d => d.value > 0)

  // Channel breakdown
  const channelData = [
    { name: 'Email', count: emailCount, icon: '📧', color: '#3b82f6' },
    { name: 'WhatsApp', count: waCount, icon: '💬', color: '#25D366' },
    { name: 'Calls', count: callCount, icon: '📞', color: '#f97316' },
    { name: 'Quotes', count: quoteViews, icon: '👁️', color: '#8b5cf6' },
  ]
  const totalInteractions = emailCount + waCount + callCount + quoteViews

  // Daily signal trend (last 14 days)
  const dailySignals = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    const dateStr = d.toISOString().split('T')[0]
    const daySignals = signals.filter(s => s.created_at.startsWith(dateStr))
    return {
      day: d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }),
      signals: daySignals.length,
      email: daySignals.filter(s => s.signal_type.startsWith('email_')).length,
      whatsapp: daySignals.filter(s => s.signal_type.startsWith('whatsapp_')).length,
      calls: daySignals.filter(s => s.signal_type.startsWith('call_')).length,
    }
  })

  // Top engaged contacts
  const topContacts = [...contacts].sort((a, b) => (b.engagement_score || 0) - (a.engagement_score || 0)).slice(0, 5)

  // Status breakdown
  const statusData = [
    { name: 'Open', value: openDeals.length, color: '#6172f3' },
    { name: 'Won', value: wonDeals.length, color: '#34d399' },
    { name: 'Lost', value: lostDeals.length, color: '#f87171' },
  ].filter(d => d.value > 0)

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav.analytics')}</h1>
          <p className="text-sm text-surface-500 mt-0.5">Performance across all channels</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-surface-100 rounded-xl w-fit">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'channels', label: 'Channels' },
          { id: 'engagement', label: 'Engagement' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t.id ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500 hover:text-surface-700')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ===== OVERVIEW TAB ===== */}
      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Pipeline Value', value: formatCurrency(totalValue), icon: DollarSign, color: 'text-brand-600', bg: 'bg-brand-50' },
              { label: 'Won Revenue', value: formatCurrency(wonValue), icon: Award, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Conversion Rate', value: `${conversionRate}%`, icon: Target, color: 'text-violet-600', bg: 'bg-violet-50' },
              { label: 'Hot Contacts', value: hotContacts.length, icon: Zap, color: 'text-red-600', bg: 'bg-red-50' },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="stat-card">
                <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}><Icon className={`w-5 h-5 ${color}`} /></div>
                <p className="text-2xl font-bold text-surface-900 mt-3">{value}</p>
                <p className="text-xs font-semibold text-surface-500">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card p-5">
              <h2 className="font-semibold text-surface-900 mb-4">Revenue & Growth</h2>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6172f3" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#6172f3" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `$${v/1000}k` : `$${v}`} />
                  <Tooltip formatter={(v: any, name: string) => [name === 'revenue' ? formatCurrency(v) : v, name === 'revenue' ? 'Revenue' : 'New Contacts']} contentStyle={{ borderRadius: 12, border: '1px solid #e4e7f0', fontSize: 12 }} />
                  <Area type="monotone" dataKey="revenue" stroke="#6172f3" strokeWidth={2.5} fill="url(#revenue)" />
                  <Line type="monotone" dataKey="contacts" stroke="#a78bfa" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="card p-5">
              <h2 className="font-semibold text-surface-900 mb-4">Deal Status</h2>
              {statusData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={statusData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                        {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e4e7f0', fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-2">
                    {statusData.map(d => (
                      <div key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} /><span className="text-xs text-surface-600">{d.name}</span></div>
                        <span className="text-xs font-bold text-surface-800">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <p className="text-surface-400 text-sm text-center py-8">No data</p>}
            </div>

            {funnelData.some(d => d.count > 0) && (
              <div className="lg:col-span-3 card p-5">
                <h2 className="font-semibold text-surface-900 mb-4">Conversion Funnel</h2>
                <div className="space-y-2">
                  {funnelData.map((stage, i) => {
                    const maxCount = Math.max(...funnelData.map(s => s.count), 1)
                    const width = Math.max(8, (stage.count / maxCount) * 100)
                    return (
                      <div key={stage.name} className="flex items-center gap-3">
                        <span className="text-xs text-surface-600 w-32 text-right truncate">{stage.name}</span>
                        <div className="flex-1 h-8 bg-surface-50 rounded-lg overflow-hidden relative">
                          <div className="h-full rounded-lg transition-all flex items-center px-3"
                            style={{ width: `${width}%`, backgroundColor: stage.color || '#6172f3' }}>
                            <span className="text-[10px] font-bold text-white whitespace-nowrap">
                              {stage.count} · {formatCurrency(stage.value)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== CHANNELS TAB ===== */}
      {tab === 'channels' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {channelData.map(ch => (
              <div key={ch.name} className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{ch.icon}</span>
                  {totalInteractions > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: ch.color + '15', color: ch.color }}>
                      {Math.round(ch.count / totalInteractions * 100)}%
                    </span>
                  )}
                </div>
                <p className="text-2xl font-bold text-surface-900">{ch.count}</p>
                <p className="text-xs text-surface-500 font-semibold">{ch.name} interactions</p>
              </div>
            ))}
          </div>

          <div className="card p-5 mb-6">
            <h2 className="font-semibold text-surface-900 mb-4">Channel Activity (14 days)</h2>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={dailySignals}>
                <defs>
                  <linearGradient id="emailGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="waGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#25D366" stopOpacity={0.2}/><stop offset="95%" stopColor="#25D366" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e4e7f0', fontSize: 12 }} />
                <Area type="monotone" dataKey="email" stroke="#3b82f6" strokeWidth={2} fill="url(#emailGrad)" name="Email" />
                <Area type="monotone" dataKey="whatsapp" stroke="#25D366" strokeWidth={2} fill="url(#waGrad)" name="WhatsApp" />
                <Line type="monotone" dataKey="calls" stroke="#f97316" strokeWidth={2} dot={false} name="Calls" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-5">
            <h2 className="font-semibold text-surface-900 mb-4">Channel Mix</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={channelData} barSize={48}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e4e7f0', fontSize: 12 }} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]} name="Interactions">
                  {channelData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* ===== ENGAGEMENT TAB ===== */}
      {tab === 'engagement' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="stat-card">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center"><span className="text-lg">🔥</span></div>
              <p className="text-2xl font-bold text-surface-900 mt-3">{hotContacts.length}</p>
              <p className="text-xs font-semibold text-surface-500">Hot Contacts</p>
            </div>
            <div className="stat-card">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center"><span className="text-lg">🌡️</span></div>
              <p className="text-2xl font-bold text-surface-900 mt-3">{warmContacts.length}</p>
              <p className="text-xs font-semibold text-surface-500">Warm Contacts</p>
            </div>
            <div className="stat-card">
              <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center"><span className="text-lg">📊</span></div>
              <p className="text-2xl font-bold text-surface-900 mt-3">{signals.length}</p>
              <p className="text-xs font-semibold text-surface-500">Signals (30d)</p>
            </div>
            <div className="stat-card">
              <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center"><span className="text-lg">👁️</span></div>
              <p className="text-2xl font-bold text-surface-900 mt-3">{quoteViews}</p>
              <p className="text-xs font-semibold text-surface-500">Proposal Views</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-5">
              <h2 className="font-semibold text-surface-900 mb-4">Contact Temperature</h2>
              {engagementDist.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={engagementDist} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                        {engagementDist.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e4e7f0', fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-2">
                    {engagementDist.map(d => (
                      <div key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} /><span className="text-xs text-surface-600">{d.name}</span></div>
                        <span className="text-xs font-bold text-surface-800">{d.value} ({contacts.length ? Math.round(d.value / contacts.length * 100) : 0}%)</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <p className="text-surface-400 text-sm text-center py-8">No data</p>}
            </div>

            <div className="card p-5">
              <h2 className="font-semibold text-surface-900 mb-4">Top Engaged Contacts</h2>
              {topContacts.length > 0 ? (
                <div className="space-y-3">
                  {topContacts.map((c, i) => (
                    <div key={c.id} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-surface-400 w-5">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-surface-800 truncate">{c.name}</p>
                        <p className="text-[10px] text-surface-400">{c.interaction_count || 0} interactions</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-2 bg-surface-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{
                            width: `${c.engagement_score || 0}%`,
                            backgroundColor: c.score_label === 'hot' ? '#ef4444' : c.score_label === 'warm' ? '#f59e0b' : '#94a3b8',
                          }} />
                        </div>
                        <span className={cn('text-[10px] font-bold',
                          c.score_label === 'hot' ? 'text-red-600' : c.score_label === 'warm' ? 'text-amber-600' : 'text-surface-400')}>
                          {c.engagement_score || 0}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-surface-400 text-sm text-center py-8">No contacts yet</p>}
            </div>

            <div className="lg:col-span-2 card p-5">
              <h2 className="font-semibold text-surface-900 mb-4">Engagement Trend (14 days)</h2>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={dailySignals}>
                  <defs>
                    <linearGradient id="sigGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6172f3" stopOpacity={0.2}/><stop offset="95%" stopColor="#6172f3" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e4e7f0', fontSize: 12 }} />
                  <Area type="monotone" dataKey="signals" stroke="#6172f3" strokeWidth={2.5} fill="url(#sigGrad)" name="Signals" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
