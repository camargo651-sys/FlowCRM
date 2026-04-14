'use client'
import Link from 'next/link'
import { CreditCard, ExternalLink, Zap } from 'lucide-react'

export default function PaymentsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-surface-900 flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-brand-600" /> Payments
        </h1>
        <p className="text-sm text-surface-500 mt-1">Track incoming payments and configure providers</p>
      </div>

      <div className="card">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">
            <Zap className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-surface-900">Connect Stripe to accept online payments</h2>
            <p className="text-sm text-surface-600 mt-1">
              Generate one-click payment links on every invoice and let your customers pay by card, Apple Pay or bank transfer.
            </p>
            <div className="mt-4 flex gap-2">
              <Link href="/integrations" className="btn-primary">
                <ExternalLink className="w-4 h-4 mr-1.5" /> Set up Stripe
              </Link>
              <Link href="/invoices" className="btn-secondary">View invoices</Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 card">
        <h3 className="font-semibold text-surface-900">Recurring billing</h3>
        <p className="text-sm text-surface-500 mt-1">Use subscriptions to auto-generate invoices on a schedule.</p>
        <Link href="/finance/subscriptions" className="btn-secondary mt-3 inline-flex">Manage subscriptions</Link>
      </div>
    </div>
  )
}
