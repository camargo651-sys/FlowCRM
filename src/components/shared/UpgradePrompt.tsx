'use client'
import { Zap, Lock, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface UpgradePromptProps {
  feature: string
  currentPlan: string
  requiredPlan?: string
  type?: 'banner' | 'page' | 'inline'
}

export default function UpgradePrompt({ feature, currentPlan, requiredPlan, type = 'page' }: UpgradePromptProps) {
  if (type === 'banner') {
    return (
      <div className="card bg-gradient-to-r from-brand-50 to-violet-50 border-brand-200 p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-brand-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-surface-900">
              You've reached your {currentPlan} plan limit
            </p>
            <p className="text-xs text-surface-500">
              Upgrade to add more {feature}
            </p>
          </div>
        </div>
        <Link href="/pricing" className="btn-primary btn-sm whitespace-nowrap">
          Upgrade <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    )
  }

  if (type === 'inline') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs">
        <Lock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
        <span className="text-amber-800">
          {feature} requires the <strong>{requiredPlan || 'Starter'}</strong> plan.
        </span>
        <Link href="/pricing" className="text-brand-600 font-semibold hover:underline ml-auto whitespace-nowrap">
          Upgrade
        </Link>
      </div>
    )
  }

  // Full page block
  return (
    <div className="animate-fade-in">
      <div className="max-w-md mx-auto text-center py-20">
        <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-brand-100">
          <Lock className="w-7 h-7 text-brand-600" />
        </div>
        <h2 className="text-xl font-bold text-surface-900 mb-2">
          {feature} is a {requiredPlan || 'paid'} feature
        </h2>
        <p className="text-sm text-surface-500 mb-1">
          You're on the <strong className="text-surface-700">{currentPlan}</strong> plan.
        </p>
        <p className="text-sm text-surface-400 mb-8">
          Upgrade to unlock {feature.toLowerCase()} and more powerful tools.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/pricing" className="btn-primary">
            See plans & pricing
          </Link>
          <Link href="/dashboard" className="btn-secondary">
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
