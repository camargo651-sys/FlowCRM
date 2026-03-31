import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function Home() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-600 rounded-xl flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <span className="font-bold text-lg text-surface-900">Tracktio</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="text-sm font-medium text-surface-600 hover:text-surface-900 transition-colors">Sign in</Link>
          <Link href="/auth/signup" className="btn-primary btn-sm">Get started free</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-50 text-brand-700 rounded-full text-xs font-semibold mb-6">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          AI-Powered CRM — Zero Data Entry
        </div>
        <h1 className="text-5xl sm:text-6xl font-extrabold text-surface-900 leading-tight tracking-tight">
          The CRM that works<br />
          <span className="text-brand-600">while you sell</span>
        </h1>
        <p className="text-lg text-surface-500 mt-6 max-w-2xl mx-auto leading-relaxed">
          Tracktio captures every interaction automatically — emails, WhatsApp, calls, LinkedIn — so you never fill a form again.
          AI tells you exactly who to call and what to say, in real time.
        </p>
        <div className="flex items-center justify-center gap-4 mt-10">
          <Link href="/auth/signup" className="px-8 py-3 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 transition-colors text-sm shadow-lg shadow-brand-600/25">
            Start free — No credit card
          </Link>
          <Link href="/auth/login" className="px-8 py-3 bg-surface-100 text-surface-700 font-semibold rounded-xl hover:bg-surface-200 transition-colors text-sm">
            Sign in
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-surface-900">Not just another CRM</h2>
          <p className="text-surface-500 mt-3 max-w-xl mx-auto">Three pillars that make Tracktio fundamentally different</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 rounded-2xl bg-gradient-to-br from-blue-50 to-white border border-blue-100">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl mb-5">👁️</div>
            <h3 className="text-lg font-bold text-surface-900 mb-2">Zero Data Entry</h3>
            <p className="text-sm text-surface-500 leading-relaxed">
              Emails, WhatsApp, calls, and LinkedIn sync automatically. Contacts are created, activities logged, and deals updated — without you touching a form.
            </p>
            <ul className="mt-4 space-y-2 text-xs text-surface-600">
              <li className="flex items-center gap-2"><span className="text-blue-500">&#10003;</span> Gmail & Outlook auto-sync</li>
              <li className="flex items-center gap-2"><span className="text-blue-500">&#10003;</span> WhatsApp Business integration</li>
              <li className="flex items-center gap-2"><span className="text-blue-500">&#10003;</span> Call transcription with AI</li>
              <li className="flex items-center gap-2"><span className="text-blue-500">&#10003;</span> LinkedIn contact import</li>
            </ul>
          </div>

          <div className="p-8 rounded-2xl bg-gradient-to-br from-violet-50 to-white border border-violet-100">
            <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center text-2xl mb-5">🧠</div>
            <h3 className="text-lg font-bold text-surface-900 mb-2">Proactive AI</h3>
            <p className="text-sm text-surface-500 leading-relaxed">
              Instead of showing static dashboards, Tracktio tells you exactly what to do next. "Client X reviewed your pricing 3 times — call now."
            </p>
            <ul className="mt-4 space-y-2 text-xs text-surface-600">
              <li className="flex items-center gap-2"><span className="text-violet-500">&#10003;</span> Engagement scoring (hot/warm/cold)</li>
              <li className="flex items-center gap-2"><span className="text-violet-500">&#10003;</span> Deal risk detection</li>
              <li className="flex items-center gap-2"><span className="text-violet-500">&#10003;</span> Proposal view tracking</li>
              <li className="flex items-center gap-2"><span className="text-violet-500">&#10003;</span> Real-time notifications</li>
            </ul>
          </div>

          <div className="p-8 rounded-2xl bg-gradient-to-br from-emerald-50 to-white border border-emerald-100">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-2xl mb-5">🏭</div>
            <h3 className="text-lg font-bold text-surface-900 mb-2">Built for Your Industry</h3>
            <p className="text-sm text-surface-500 leading-relaxed">
              Not a generic tool you adapt. Pre-built workflows, fields, automations, and KPIs for your specific industry — ready in one click.
            </p>
            <ul className="mt-4 space-y-2 text-xs text-surface-600">
              <li className="flex items-center gap-2"><span className="text-emerald-500">&#10003;</span> Real Estate, Healthcare, B2B, Education</li>
              <li className="flex items-center gap-2"><span className="text-emerald-500">&#10003;</span> Custom pipeline stages</li>
              <li className="flex items-center gap-2"><span className="text-emerald-500">&#10003;</span> Industry-specific automations</li>
              <li className="flex items-center gap-2"><span className="text-emerald-500">&#10003;</span> Configurable inventory module</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Modules */}
      <section className="bg-surface-50 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-surface-900">Everything you need</h2>
            <p className="text-surface-500 mt-3">One platform, every tool</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { icon: '📊', name: 'Dashboard', desc: 'AI insights & industry KPIs' },
              { icon: '🔀', name: 'Pipeline', desc: 'Drag & drop deal management' },
              { icon: '👥', name: 'Contacts', desc: 'Auto-created from all channels' },
              { icon: '💬', name: 'WhatsApp', desc: 'Send & receive from CRM' },
              { icon: '📧', name: 'Email Sync', desc: 'Gmail & Outlook auto-capture' },
              { icon: '📄', name: 'Quotes', desc: 'Track when clients view them' },
              { icon: '📦', name: 'Inventory', desc: '5 product types, stock alerts' },
              { icon: '⚡', name: 'Automations', desc: 'If-this-then-that for sales' },
              { icon: '📈', name: 'Analytics', desc: 'Revenue, channels, engagement' },
              { icon: '🔔', name: 'Notifications', desc: 'Real-time proactive alerts' },
              { icon: '🔍', name: 'Global Search', desc: 'Cmd+K across everything' },
              { icon: '👥', name: 'Team', desc: 'Invite members, assign roles' },
            ].map(m => (
              <div key={m.name} className="p-4 bg-white rounded-xl border border-surface-100">
                <span className="text-xl">{m.icon}</span>
                <p className="text-sm font-semibold text-surface-800 mt-2">{m.name}</p>
                <p className="text-[11px] text-surface-400 mt-0.5">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 text-center">
        <h2 className="text-3xl font-bold text-surface-900">Stop filling forms.<br />Start closing deals.</h2>
        <p className="text-surface-500 mt-4 max-w-lg mx-auto">
          Join sales teams that let AI handle the admin while they focus on what matters — building relationships and closing revenue.
        </p>
        <Link href="/auth/signup" className="inline-flex px-8 py-3 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 transition-colors text-sm shadow-lg shadow-brand-600/25 mt-8">
          Get started for free
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-100 py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-brand-600 rounded-lg flex items-center justify-center">
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
