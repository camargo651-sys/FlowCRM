'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'

interface DashboardChartsProps {
  trendData: { day: string; value: number }[]
  leadsByPlatform: Record<string, number>
}

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📸', facebook: '📘', tiktok: '🎵', linkedin: '💼', twitter: '🐦', youtube: '📺', website: '🌐', other: '🌐',
}

export default function DashboardCharts({ trendData, leadsByPlatform }: DashboardChartsProps) {
  const hasTrend = trendData.some(d => d.value > 0)
  const hasLeads = Object.keys(leadsByPlatform).length > 0

  if (!hasTrend && !hasLeads) return null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      {/* Revenue Trend (Last 7 Days) */}
      {hasTrend && (
        <div className="card p-4">
          <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-3">Revenue — Last 7 Days</p>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0891B2" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#0891B2" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`} />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v: number) => [formatCurrency(v), 'Won']} />
              <Area type="monotone" dataKey="value" stroke="#0891B2" strokeWidth={2} fill="url(#trendGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Leads by Source */}
      {hasLeads && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide">Leads by Source</p>
            <Link href="/leads" className="text-[10px] text-brand-600 hover:underline">View all</Link>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={Object.entries(leadsByPlatform).sort(([,a], [,b]) => b - a).map(([platform, count]) => ({
              platform: platform.charAt(0).toUpperCase() + platform.slice(1),
              count,
              icon: PLATFORM_ICONS[platform] || '🌐',
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" vertical={false} />
              <XAxis dataKey="platform" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v: number) => [v, 'Leads']} />
              <Bar dataKey="count" fill="#0891B2" radius={[6, 6, 0, 0]} barSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
