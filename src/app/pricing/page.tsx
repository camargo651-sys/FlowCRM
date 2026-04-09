import Link from 'next/link'
import { PLANS } from '@/lib/pricing/plans'

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-surface-100/60">
        <div className="flex items-center justify-between px-6 py-3.5 max-w-7xl mx-auto">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center shadow-lg shadow-brand-600/20">
              <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <span className="font-bold text-xl tracking-tight text-surface-900">Tracktio</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/features" className="text-sm font-medium text-surface-600 hover:text-surface-900 transition-colors hidden sm:block">Features</Link>
            <Link href="/auth/login" className="text-sm font-medium text-surface-600 hover:text-surface-900 transition-colors hidden sm:block">Sign in</Link>
            <Link href="/auth/signup" className="px-5 py-2 bg-surface-900 text-white font-semibold rounded-xl hover:bg-surface-800 transition-all text-sm shadow-sm">Start free</Link>
          </div>
        </div>
      </nav>

      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">Pricing</p>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-surface-900">Simple, transparent pricing</h1>
        <p className="text-lg text-surface-500 mt-4 max-w-xl mx-auto">All 27 modules included in every plan. Start free, upgrade as you grow. No hidden fees.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-16">
          {PLANS.map((plan, i) => (
            <div key={plan.key} className={`rounded-2xl p-7 text-left border-2 transition-all duration-200 ${i === 2 ? 'border-brand-500 bg-brand-50/30 ring-2 ring-brand-500/20 shadow-xl shadow-brand-600/10 scale-[1.02]' : 'border-surface-100 hover:border-surface-200 hover:shadow-lg'}`}>
              {i === 2 && <div className="text-[10px] font-bold text-brand-600 uppercase mb-3 tracking-wider">Most Popular</div>}
              <h3 className="text-lg font-bold text-surface-900">{plan.name}</h3>
              <div className="mt-4 mb-6">
                <span className="text-4xl font-extrabold text-surface-900">${plan.price}</span>
                {plan.price > 0 && <span className="text-surface-400 text-sm">/month</span>}
              </div>
              <Link href="/auth/signup" className={`block text-center py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${i === 2 ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-600/25' : 'bg-surface-100 text-surface-700 hover:bg-surface-200'}`}>
                {plan.price === 0 ? 'Start Free' : 'Get Started'}
              </Link>
              <ul className="mt-6 space-y-3">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-2.5 text-sm text-surface-600">
                    <span className="text-emerald-500 mt-0.5 flex-shrink-0">&#10003;</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-surface-50 py-24">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-surface-900 text-center mb-12">Frequently asked questions</h2>
          <div className="space-y-6">
            {[
              { q: 'Can I really start for free?', a: 'Yes. The free plan includes all 27 modules, 1 user, and 100 contacts. No credit card required. No time limit.' },
              { q: 'What happens when I upgrade?', a: 'Your data stays exactly where it is. Upgrading unlocks more users, contacts, and storage. Takes 10 seconds.' },
              { q: 'Can I switch plans anytime?', a: 'Absolutely. Upgrade, downgrade, or cancel anytime from your settings. No lock-in contracts.' },
              { q: 'Do you offer annual billing?', a: 'Yes. Annual plans save 20%. Contact us for custom enterprise pricing.' },
              { q: 'Is my data secure?', a: 'Your data is hosted on Supabase (powered by AWS). Row-level security, encryption at rest, and automatic backups included.' },
              { q: 'Can I import data from other tools?', a: 'Yes. Our AI-powered importer handles CSV files from any tool. It auto-maps columns and deduplicates records.' },
            ].map(faq => (
              <div key={faq.q} className="card p-6">
                <h3 className="text-sm font-bold text-surface-900 mb-2">{faq.q}</h3>
                <p className="text-sm text-surface-500 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 text-center px-6">
        <h2 className="text-3xl font-extrabold text-surface-900">Ready to simplify your business?</h2>
        <p className="text-surface-500 mt-4 max-w-lg mx-auto">
          Join hundreds of teams running their entire business from Tracktio.
        </p>
        <Link href="/auth/signup" className="inline-flex px-8 py-3.5 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 transition-all text-sm shadow-xl shadow-brand-600/25 mt-8">
          Start free — takes 60 seconds
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-100 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 bg-gradient-to-br from-brand-500 to-brand-700 rounded-lg flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <span className="text-sm font-semibold text-surface-600">Tracktio</span>
          </div>
          <p className="text-xs text-surface-400">&copy; {new Date().getFullYear()} Tracktio. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
