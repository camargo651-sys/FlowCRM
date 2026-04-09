'use client'
import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { useWorkspace } from '@/lib/workspace-context'
import { CreditCard, Check, ExternalLink, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    features: [
      '100 contacts',
      '1 user',
      '1 pipeline',
      'Basic reports',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 29,
    features: [
      '1,000 contacts',
      '3 users',
      '3 pipelines',
      'WhatsApp bot',
      'Sequences',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 79,
    popular: true,
    features: [
      '10,000 contacts',
      '10 users',
      'Unlimited pipelines',
      'AI auto-reply',
      'Custom reports',
    ],
  },
  {
    id: 'scale',
    name: 'Scale',
    price: 199,
    features: [
      'Unlimited contacts',
      'Unlimited users',
      'Unlimited pipelines',
      'White-label',
      'Priority support',
      'API access',
    ],
  },
]

export default function BillingPage() {
  const { t } = useI18n()
  const { plan: currentPlan } = useWorkspace()
  const [loading, setLoading] = useState<string | null>(null)

  const handleUpgrade = async (planId: string) => {
    if (planId === currentPlan || planId === 'free') return
    setLoading(planId)
    try {
      const res = await fetch('/api/payments/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      // handle error silently
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="animate-fade-in max-w-5xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav.billing')}</h1>
          <p className="page-subtitle">Manage your subscription and billing</p>
        </div>
      </div>

      {/* Current Plan */}
      <div className="card p-5 mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-surface-900">Current Plan</p>
            <p className="text-xs text-surface-500">You are on the <span className="font-bold text-brand-600 capitalize">{currentPlan || 'free'}</span> plan</p>
          </div>
        </div>
        {currentPlan && currentPlan !== 'free' && (
          <a href="/api/payments/stripe?action=portal" className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1">
            Manage Subscription <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map(plan => {
          const isCurrent = (currentPlan || 'free') === plan.id
          return (
            <div key={plan.id} className={cn(
              'card p-5 flex flex-col relative',
              plan.popular && 'ring-2 ring-brand-500',
              isCurrent && 'bg-brand-50/50'
            )}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-brand-600 text-white text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Popular
                  </span>
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-bold text-surface-900">{plan.name}</h3>
                <div className="mt-2">
                  <span className="text-3xl font-extrabold text-surface-900">${plan.price}</span>
                  <span className="text-sm text-surface-400">/mo</span>
                </div>
              </div>

              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map(feature => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-surface-600">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="w-full py-2.5 px-4 rounded-xl bg-green-50 text-green-700 text-sm font-semibold text-center border border-green-200">
                  Current Plan
                </div>
              ) : plan.id === 'free' ? (
                <div className="w-full py-2.5 px-4 rounded-xl bg-surface-100 text-surface-400 text-sm font-medium text-center">
                  Free
                </div>
              ) : (
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={!!loading}
                  className={cn(
                    'w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-all',
                    plan.popular
                      ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm'
                      : 'bg-surface-900 text-white hover:bg-surface-800'
                  )}
                >
                  {loading === plan.id ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                  ) : (
                    'Upgrade'
                  )}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Feature Comparison */}
      <div className="card mt-8 overflow-hidden">
        <div className="p-5 border-b border-surface-100">
          <h2 className="font-semibold text-surface-900">Feature Comparison</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-100">
                <th className="text-left p-4 text-surface-500 font-medium">Feature</th>
                {PLANS.map(p => (
                  <th key={p.id} className={cn('text-center p-4 font-semibold', (currentPlan || 'free') === p.id ? 'text-brand-600' : 'text-surface-900')}>
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Contacts', values: ['100', '1,000', '10,000', 'Unlimited'] },
                { label: 'Users', values: ['1', '3', '10', 'Unlimited'] },
                { label: 'Pipelines', values: ['1', '3', 'Unlimited', 'Unlimited'] },
                { label: 'Reports', values: ['Basic', 'Basic', 'Custom', 'Custom'] },
                { label: 'WhatsApp Bot', values: [false, true, true, true] },
                { label: 'Sequences', values: [false, true, true, true] },
                { label: 'AI Auto-Reply', values: [false, false, true, true] },
                { label: 'White-Label', values: [false, false, false, true] },
                { label: 'Priority Support', values: [false, false, false, true] },
                { label: 'API Access', values: [false, false, false, true] },
              ].map(row => (
                <tr key={row.label} className="border-b border-surface-50 hover:bg-surface-25">
                  <td className="p-4 text-surface-700 font-medium">{row.label}</td>
                  {row.values.map((val, i) => (
                    <td key={i} className="text-center p-4">
                      {typeof val === 'boolean' ? (
                        val ? <Check className="w-4 h-4 text-green-500 mx-auto" /> : <span className="text-surface-300">--</span>
                      ) : (
                        <span className="text-surface-600">{val}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
