import Link from 'next/link'
import { PLANS } from '@/lib/pricing/plans'

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-600 rounded-xl flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <span className="font-bold text-lg text-surface-900">Tracktio</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="text-sm font-medium text-surface-600">Sign in</Link>
          <Link href="/auth/signup" className="btn-primary btn-sm">Get started</Link>
        </div>
      </nav>

      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h1 className="text-4xl font-extrabold text-surface-900">Simple, transparent pricing</h1>
        <p className="text-lg text-surface-500 mt-4 max-w-xl mx-auto">Start free. Upgrade as you grow. No hidden fees.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-16">
          {PLANS.map((plan, i) => (
            <div key={plan.key} className={`rounded-2xl p-6 text-left border-2 ${i === 2 ? 'border-brand-500 bg-brand-50/30 ring-2 ring-brand-500/20' : 'border-surface-100'}`}>
              {i === 2 && <div className="text-[10px] font-bold text-brand-600 uppercase mb-2">Most Popular</div>}
              <h3 className="text-lg font-bold text-surface-900">{plan.name}</h3>
              <div className="mt-3 mb-6">
                <span className="text-4xl font-extrabold text-surface-900">${plan.price}</span>
                {plan.price > 0 && <span className="text-surface-400 text-sm">/month</span>}
              </div>
              <Link href="/auth/signup" className={`block text-center py-2.5 rounded-xl font-semibold text-sm transition-colors ${i === 2 ? 'bg-brand-600 text-white hover:bg-brand-700' : 'bg-surface-100 text-surface-700 hover:bg-surface-200'}`}>
                {plan.price === 0 ? 'Start Free' : 'Get Started'}
              </Link>
              <ul className="mt-6 space-y-2.5">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-surface-600">
                    <span className="text-emerald-500 mt-0.5">&#10003;</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-surface-100 py-8 px-6 text-center">
        <p className="text-xs text-surface-400">&copy; {new Date().getFullYear()} Tracktio. All rights reserved.</p>
      </footer>
    </div>
  )
}
