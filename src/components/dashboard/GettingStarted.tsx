'use client'
import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, ArrowRight, X, Rocket, Zap, Users, TrendingUp, Package, Receipt, Plug, UserPlus, MessageSquare, Bot, Smartphone } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface OnboardingData {
  contacts: number
  deals: number
  products: number
  invoices: number
  integrations: number
  members: number
  hasWhatsApp: boolean
  hasBotConfig: boolean
  pipelineStages: number
}

interface CheckItem {
  key: string
  label: string
  description: string
  href: string
  icon: typeof Users
  color: string
  check: (data: OnboardingData) => boolean
}

const CHECKLIST: CheckItem[] = [
  { key: 'contact', label: 'Add your first contact', description: 'Import a CSV or create a contact manually', href: '/contacts', icon: Users, color: 'bg-brand-50 text-brand-600', check: d => d.contacts > 0 },
  { key: 'deal', label: 'Create a deal', description: 'Track an opportunity through your pipeline', href: '/pipeline', icon: TrendingUp, color: 'bg-emerald-50 text-emerald-600', check: d => d.deals > 0 },
  { key: 'whatsapp', label: 'Connect WhatsApp', description: 'Receive and reply to messages directly from the CRM', href: '/integrations', icon: MessageSquare, color: 'bg-green-50 text-green-600', check: d => d.hasWhatsApp },
  { key: 'pipeline', label: 'Set up your pipeline', description: 'Customize stages to match your sales process', href: '/pipeline', icon: TrendingUp, color: 'bg-indigo-50 text-indigo-600', check: d => d.pipelineStages > 3 },
  { key: 'bot', label: 'Configure your bot', description: 'Automate WhatsApp replies with an AI-powered bot', href: '/whatsapp/bot', icon: Bot, color: 'bg-purple-50 text-purple-600', check: d => d.hasBotConfig },
  { key: 'product', label: 'Set up a product or service', description: 'Build your catalog for quotes and invoices', href: '/inventory', icon: Package, color: 'bg-violet-50 text-violet-600', check: d => d.products > 0 },
  { key: 'invoice', label: 'Send your first invoice', description: 'Get paid faster with professional invoices', href: '/invoices', icon: Receipt, color: 'bg-amber-50 text-amber-600', check: d => d.invoices > 0 },
  { key: 'integration', label: 'Connect your email', description: 'Enable zero data entry by syncing Gmail or Outlook', href: '/integrations', icon: Plug, color: 'bg-blue-50 text-blue-600', check: d => d.integrations > 0 },
  { key: 'mobile', label: 'Install the mobile app', description: 'Add Tracktio to your home screen for on-the-go access', href: '/settings', icon: Smartphone, color: 'bg-cyan-50 text-cyan-600', check: () => false },
  { key: 'team', label: 'Invite a team member', description: 'Collaborate in real time with your team', href: '/team', icon: UserPlus, color: 'bg-rose-50 text-rose-600', check: d => d.members > 1 },
]

export default function GettingStarted() {
  const { createClient } = require('@/lib/supabase/client')
  const supabase = createClient()
  const [data, setData] = useState<OnboardingData | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        setUserName(user.user_metadata?.full_name?.split(' ')[0] || '')
        const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
        if (!ws) return

        const stored = localStorage.getItem('tracktio_getting_started_dismissed')
        if (stored === 'true') { setDismissed(true); setLoading(false); return }

        const [contacts, deals, products, invoices, integrations, members, waAccounts, botConfig, stages] = await Promise.all([
          supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('workspace_id', ws.id),
          supabase.from('deals').select('id', { count: 'exact', head: true }).eq('workspace_id', ws.id),
          supabase.from('products').select('id', { count: 'exact', head: true }).eq('workspace_id', ws.id),
          supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('workspace_id', ws.id),
          supabase.from('integrations').select('id', { count: 'exact', head: true }).eq('workspace_id', ws.id).eq('enabled', true),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('workspace_id', ws.id),
          supabase.from('whatsapp_accounts').select('id', { count: 'exact', head: true }).eq('workspace_id', ws.id).eq('status', 'active'),
          supabase.from('workspaces').select('whatsapp_bot_config').eq('id', ws.id).single(),
          supabase.from('pipeline_stages').select('id', { count: 'exact', head: true }).eq('pipeline_id', ws.id),
        ])

        // Get actual pipeline stage count
        let stageCount = stages.count || 0
        if (stageCount === 0) {
          // Try to get stages from the first pipeline
          const { data: pipeline } = await supabase.from('pipelines').select('id').eq('workspace_id', ws.id).limit(1).single()
          if (pipeline) {
            const { count } = await supabase.from('pipeline_stages').select('id', { count: 'exact', head: true }).eq('pipeline_id', pipeline.id)
            stageCount = count || 0
          }
        }

        setData({
          contacts: contacts.count || 0,
          deals: deals.count || 0,
          products: products.count || 0,
          invoices: invoices.count || 0,
          integrations: integrations.count || 0,
          members: members.count || 0,
          hasWhatsApp: (waAccounts.count || 0) > 0,
          hasBotConfig: !!botConfig.data?.whatsapp_bot_config,
          pipelineStages: stageCount,
        })
      } catch {}
      setLoading(false)
    }
    load()
  }, [])

  if (loading || dismissed || !data) return null

  const completed = CHECKLIST.filter(item => item.check(data))
  const remaining = CHECKLIST.filter(item => !item.check(data))
  const progress = Math.round((completed.length / CHECKLIST.length) * 100)

  if (remaining.length === 0) return null

  const isNewUser = completed.length === 0
  const nextStep = remaining[0]

  return (
    <div className="mb-6">
      {/* Welcome hero for brand-new users */}
      {isNewUser && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-700 to-surface-950 p-8 mb-4">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10">
                <Zap className="w-5 h-5 text-white" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {userName ? `Welcome, ${userName}!` : 'Welcome to Tracktio!'}
            </h2>
            <p className="text-brand-200 text-sm max-w-md leading-relaxed">
              Your workspace is ready. Complete these steps to get the most out of your ERP. Each step takes less than 2 minutes.
            </p>
            <div className="flex items-center gap-3 mt-6">
              <Link href={nextStep.href}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-brand-700 font-semibold rounded-xl hover:bg-brand-50 transition-all text-sm shadow-lg">
                {nextStep.label} <ArrowRight className="w-4 h-4" />
              </Link>
              <span className="text-brand-300 text-xs">0 of {CHECKLIST.length} completed</span>
            </div>
          </div>
        </div>
      )}

      {/* Checklist card */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-brand-50 rounded-xl flex items-center justify-center">
              <Rocket className="w-4 h-4 text-brand-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-surface-900">Set up your workspace</h3>
              <p className="text-[10px] text-surface-500">{completed.length} of {CHECKLIST.length} completed</p>
            </div>
          </div>
          <button onClick={() => { setDismissed(true); localStorage.setItem('tracktio_getting_started_dismissed', 'true') }}
            className="text-surface-300 hover:text-surface-500 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        {/* Progress bar */}
        <div className="mx-5 mb-4">
          <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-brand-500 to-brand-600 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="px-3 pb-3 space-y-0.5">
          {CHECKLIST.map(item => {
            const done = item.check(data)
            const Icon = item.icon
            return (
              <Link key={item.key} href={item.href}
                className={cn('flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group',
                  done ? 'opacity-50' : 'hover:bg-surface-50')}>
                {done ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                ) : (
                  <div className={cn('w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 ring-1 ring-inset ring-surface-200', )}>
                    <Circle className="w-3 h-3 text-surface-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium', done ? 'text-surface-400 line-through' : 'text-surface-800')}>{item.label}</p>
                  {!done && <p className="text-[11px] text-surface-400 mt-0.5">{item.description}</p>}
                </div>
                {!done && (
                  <ArrowRight className="w-3.5 h-3.5 text-surface-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
