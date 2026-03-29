'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, DollarSign, Target, Award } from 'lucide-react'

const COLORS = ['#6172f3','#a78bfa','#34d399','#fbbf24','#f87171','#22d3ee']

export default function AnalyticsPage() {
  const supabase = createClient()
  const [deals, setDeals] = useState<any[]>([])
  const [stages, setStages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
      if (!ws) { setLoading(false); return }
      const [dealsRes, stagesRes] = await Promise.all([
        supabase.from('deals').select('*').eq('workspace_id', ws.id),
        supabase.from('pipeline_stages').select('*').eq('workspace_id', ws.id).order('order_index'),
      ])
      setDeals(dealsRes.data || [])
      setStages(stagesRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

  // Compute stats
  const openDeals = deals.filter(d => d.status === 'open')
  const wonDeals = deals.filter(d => d.status === 'won')
  const lostDeals = deals.filter(d => d.status === 'lost')
  const totalValue = openDeals.reduce((s, d) => s + (d.value || 0), 0)
  const wonValue = wonDeals.reduce((s, d) => s + (d.value || 0), 0)
  const conversionRate = deals.length > 0 ? Math.round((wonDeals.length / deals.length) * 100) : 0

  // Pipeline data
  const pipelineData = stages.map(s => ({
    name: s.name,
    count: deals.filter(d => d.stage_id === s.id && d.status === 'open').length,
    value: deals.filter(d => d.stage_id === s.id && d.status === 'open').reduce((sum, d) => sum + (d.value || 0), 0),
  }))

  // Monthly won deals (last 6 months)
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (5 - i))
    const month = d.toLocaleDateString('en-US', { month: 'short' })
    const monthDeals = wonDeals.filter(deal => {
      const dealDate = new Date(deal.updated_at)
      return dealDate.getMonth() === d.getMonth() && dealDate.getFullYear() === d.getFullYear()
    })
    return { month, value: monthDeals.reduce((s, d) => s + (d.value || 0), 0), count: monthDeals.length }
  })

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
          <h1 className="page-title">Analytics</h1>
          <p className="text-sm text-surface-500 mt-0.5">Your sales performance at a glance</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Pipeline Value', value: formatCurrency(totalValue), icon: DollarSign, color: 'text-brand-600', bg: 'bg-brand-50' },
          { label: 'Won Revenue', value: formatCurrency(wonValue), icon: Award, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Conversion Rate', value: `${conversionRate}%`, icon: Target, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Total Deals', value: deals.length, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="stat-card">
            <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}><Icon className={`w-5 h-5 ${color}`} /></div>
            <p className="text-2xl font-bold text-surface-900 mt-3">{value}</p>
            <p className="text-xs font-semibold text-surface-500">{label}</p>
          </div>
        ))}
      </div>

      {deals.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="w-16 h-16 bg-surface-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-8 h-8 text-surface-400" />
          </div>
          <p className="text-surface-600 font-semibold mb-1">No data yet</p>
          <p className="text-surface-400 text-sm">Add deals to your pipeline to see analytics</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Monthly revenue */}
          <div className="lg:col-span-2 card p-5">
            <h2 className="font-semibold text-surface-900 mb-4">Won Revenue (Last 6 months)</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `$${v/1000}k` : `$${v}`} />
                <Tooltip formatter={(v: any) => [formatCurrency(v), 'Revenue']} contentStyle={{ borderRadius: 12, border: '1px solid #e4e7f0', fontSize: 12 }} />
                <Line type="monotone" dataKey="value" stroke="#6172f3" strokeWidth={2.5} dot={{ fill: '#6172f3', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Status breakdown */}
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

          {/* Pipeline by stage */}
          {pipelineData.some(d => d.count > 0) && (
            <div className="lg:col-span-3 card p-5">
              <h2 className="font-semibold text-surface-900 mb-4">Pipeline by Stage</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={pipelineData} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ba3c0' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: any, name: string) => [name === 'value' ? formatCurrency(v) : v, name === 'value' ? 'Value' : 'Deals']} contentStyle={{ borderRadius: 12, border: '1px solid #e4e7f0', fontSize: 12 }} />
                  <Bar dataKey="count" fill="#6172f3" radius={[6, 6, 0, 0]} name="count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
