import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const NAV_LOGO = (
  <div className="flex items-center gap-2.5">
    <div className="w-9 h-9 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center shadow-lg shadow-brand-600/20">
      <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
    </div>
    <span className="font-bold text-xl tracking-tight text-surface-900">Tracktio</span>
  </div>
)

export default async function Home() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-white">
      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-surface-100/60">
        <div className="flex items-center justify-between px-6 py-3.5 max-w-7xl mx-auto">
          <Link href="/">{NAV_LOGO}</Link>
          <div className="hidden md:flex items-center gap-8">
            <Link href="/features" className="text-sm font-medium text-surface-500 hover:text-surface-900 transition-colors">Features</Link>
            <Link href="/pricing" className="text-sm font-medium text-surface-500 hover:text-surface-900 transition-colors">Pricing</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm font-medium text-surface-600 hover:text-surface-900 transition-colors hidden sm:block">Sign in</Link>
            <Link href="/auth/signup" className="px-5 py-2 bg-surface-900 text-white font-semibold rounded-xl hover:bg-surface-800 transition-all text-sm shadow-sm">
              Start free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-50/40 via-white to-white" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-brand-400/8 rounded-full blur-3xl" />
        <div className="relative max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-brand-50 border border-brand-100 text-brand-700 rounded-full text-xs font-semibold mb-8 shadow-sm">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            Now in open beta — free for early teams
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-surface-900 leading-[1.08] tracking-tight">
            Run your business,<br />
            <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">not your software.</span>
          </h1>
          <p className="text-lg sm:text-xl text-surface-500 mt-8 max-w-2xl mx-auto leading-relaxed">
            CRM, invoicing, inventory, manufacturing, HR, accounting, POS, and e-commerce — unified in one AI-powered platform. Ready in 60 seconds.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
            <Link href="/auth/signup" className="px-8 py-3.5 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 transition-all text-sm shadow-xl shadow-brand-600/25 hover:shadow-brand-600/40 hover:-translate-y-0.5 duration-200 w-full sm:w-auto text-center">
              Start free — no credit card needed
            </Link>
            <Link href="/features" className="px-8 py-3.5 bg-white text-surface-700 font-semibold rounded-xl border border-surface-200 hover:border-surface-300 hover:bg-surface-50 transition-all text-sm w-full sm:w-auto text-center">
              See all 27 modules
            </Link>
          </div>
          <p className="text-xs text-surface-400 mt-5">
            <Link href="/auth/login?demo=true" className="text-brand-600 font-semibold hover:underline">Try the live demo</Link>
            {' '} — no signup required
          </p>
        </div>
      </section>

      {/* ── SOCIAL PROOF BAR ── */}
      <section className="border-y border-surface-100 bg-surface-50/50 py-8">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-xs font-semibold text-surface-400 uppercase tracking-widest mb-6">Replacing the tools you already use</p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-40">
            {['Odoo', 'SAP B1', 'Zoho', 'Monday', 'HubSpot', 'Freshworks'].map(name => (
              <span key={name} className="text-lg font-bold text-surface-900 tracking-tight">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">How it works</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-surface-900">Up and running in three steps</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { step: '01', title: 'Sign up & pick your industry', desc: 'Choose from 8+ industry templates. Pipelines, fields, and automations are pre-configured for your business type.' },
            { step: '02', title: 'Import or connect your data', desc: 'Upload a CSV, connect Gmail, WhatsApp, or LinkedIn. AI maps your columns and deduplicates records automatically.' },
            { step: '03', title: 'Let AI do the work', desc: 'Contacts are created from emails. Deals move through stages. Invoices generate from quotes. You focus on selling.' },
          ].map(item => (
            <div key={item.step} className="relative">
              <span className="text-6xl font-black text-surface-100 leading-none">{item.step}</span>
              <h3 className="text-base font-bold text-surface-900 mt-3 mb-2">{item.title}</h3>
              <p className="text-sm text-surface-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── WHY SWITCH ── */}
      <section className="bg-surface-950 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-brand-400 uppercase tracking-widest mb-3">Why teams switch</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Three things that make us<br className="hidden sm:block" /> fundamentally different</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-8 rounded-2xl bg-gradient-to-br from-surface-900 to-surface-950 border border-surface-800 group hover:border-brand-600/40 transition-colors duration-300">
              <div className="w-12 h-12 bg-brand-600/10 rounded-xl flex items-center justify-center mb-5">
                <svg className="w-6 h-6 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Zero Data Entry</h3>
              <p className="text-sm text-surface-400 leading-relaxed mb-5">
                Emails, WhatsApp, calls, and LinkedIn sync automatically. Contacts are created and deals updated — without touching a form.
              </p>
              <ul className="space-y-2.5 text-xs text-surface-300">
                <li className="flex items-center gap-2"><span className="text-brand-400">&#10003;</span> Gmail & Outlook auto-sync</li>
                <li className="flex items-center gap-2"><span className="text-brand-400">&#10003;</span> WhatsApp Business integration</li>
                <li className="flex items-center gap-2"><span className="text-brand-400">&#10003;</span> Call transcription with AI</li>
                <li className="flex items-center gap-2"><span className="text-brand-400">&#10003;</span> LinkedIn contact import</li>
              </ul>
            </div>
            <div className="p-8 rounded-2xl bg-gradient-to-br from-surface-900 to-surface-950 border border-surface-800 group hover:border-violet-500/40 transition-colors duration-300">
              <div className="w-12 h-12 bg-violet-500/10 rounded-xl flex items-center justify-center mb-5">
                <svg className="w-6 h-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Proactive AI</h3>
              <p className="text-sm text-surface-400 leading-relaxed mb-5">
                Not dashboards you stare at. Tracktio tells you what to do next: "Client X viewed your pricing 3 times — call now."
              </p>
              <ul className="space-y-2.5 text-xs text-surface-300">
                <li className="flex items-center gap-2"><span className="text-violet-400">&#10003;</span> Engagement scoring (hot/warm/cold)</li>
                <li className="flex items-center gap-2"><span className="text-violet-400">&#10003;</span> Deal risk detection</li>
                <li className="flex items-center gap-2"><span className="text-violet-400">&#10003;</span> Proposal view tracking</li>
                <li className="flex items-center gap-2"><span className="text-violet-400">&#10003;</span> Smart next-action suggestions</li>
              </ul>
            </div>
            <div className="p-8 rounded-2xl bg-gradient-to-br from-surface-900 to-surface-950 border border-surface-800 group hover:border-emerald-500/40 transition-colors duration-300">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-5">
                <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Built for Your Industry</h3>
              <p className="text-sm text-surface-400 leading-relaxed mb-5">
                Not a generic tool you spend weeks adapting. Pre-built workflows, fields, and KPIs for your specific industry — one click.
              </p>
              <ul className="space-y-2.5 text-xs text-surface-300">
                <li className="flex items-center gap-2"><span className="text-emerald-400">&#10003;</span> Real Estate, Healthcare, B2B, Education</li>
                <li className="flex items-center gap-2"><span className="text-emerald-400">&#10003;</span> Custom pipeline stages per industry</li>
                <li className="flex items-center gap-2"><span className="text-emerald-400">&#10003;</span> Industry-specific automations</li>
                <li className="flex items-center gap-2"><span className="text-emerald-400">&#10003;</span> Pre-configured inventory & fields</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── MODULES ── */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">All-in-one platform</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-surface-900">27 modules. One subscription.</h2>
            <p className="text-surface-500 mt-4 max-w-lg mx-auto">Replace 10 different tools. Stop paying for seats across Salesforce, QuickBooks, Shopify, Monday, and more.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { icon: '📊', name: 'Dashboard', tag: 'AI' },
              { icon: '🔀', name: 'CRM Pipeline', tag: '' },
              { icon: '👥', name: 'Contacts', tag: 'AI' },
              { icon: '🧾', name: 'Invoicing', tag: '' },
              { icon: '📄', name: 'Quotes', tag: '' },
              { icon: '📦', name: 'Inventory', tag: '' },
              { icon: '🏭', name: 'Manufacturing', tag: '' },
              { icon: '🛒', name: 'E-commerce', tag: '' },
              { icon: '💳', name: 'Point of Sale', tag: '' },
              { icon: '📒', name: 'Accounting', tag: '' },
              { icon: '🚛', name: 'Purchasing', tag: '' },
              { icon: '👔', name: 'HR & Payroll', tag: '' },
              { icon: '💬', name: 'WhatsApp', tag: '' },
              { icon: '📧', name: 'Email Sync', tag: 'AI' },
              { icon: '📈', name: 'Analytics', tag: '' },
              { icon: '⚡', name: 'Automations', tag: '' },
              { icon: '💰', name: 'Expenses', tag: '' },
              { icon: '📸', name: 'Social Leads', tag: '' },
              { icon: '📝', name: 'Contracts', tag: '' },
              { icon: '🎫', name: 'Tickets', tag: '' },
              { icon: '📞', name: 'Call Tracking', tag: 'AI' },
              { icon: '💼', name: 'LinkedIn Sync', tag: '' },
              { icon: '🔌', name: 'Integrations', tag: '' },
              { icon: '🧱', name: 'Form Builder', tag: '' },
              { icon: '📋', name: 'Templates', tag: '' },
              { icon: '🛡️', name: 'Roles & RBAC', tag: '' },
              { icon: '💻', name: 'REST API', tag: '' },
            ].map(m => (
              <div key={m.name} className="group p-4 bg-white rounded-xl border border-surface-100 hover:border-brand-200 hover:shadow-lg transition-all duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-xl">{m.icon}</span>
                  {m.tag && <span className="text-[9px] font-bold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-full">{m.tag}</span>}
                </div>
                <p className="text-sm font-semibold text-surface-800 mt-2.5">{m.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPARISON ── */}
      <section className="bg-surface-50 py-24">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">Honest comparison</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-surface-900">Tracktio vs. the competition</h2>
          </div>
          <div className="overflow-x-auto card p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-surface-200">
                  <th className="text-left py-4 px-5 text-surface-500 font-semibold text-xs uppercase tracking-wider">Feature</th>
                  <th className="text-center py-4 px-5 font-bold text-brand-600 text-xs uppercase tracking-wider bg-brand-50/40">Tracktio</th>
                  <th className="text-center py-4 px-5 text-surface-400 text-xs uppercase tracking-wider">Odoo</th>
                  <th className="text-center py-4 px-5 text-surface-400 text-xs uppercase tracking-wider">SAP B1</th>
                  <th className="text-center py-4 px-5 text-surface-400 text-xs uppercase tracking-wider">Zoho</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {[
                  ['Setup time', '60 sec', '2-6 weeks', '3-6 months', '1-2 weeks'],
                  ['Implementation cost', '$0', '$5K-50K', '$50K-500K', '$2K-10K'],
                  ['Specialist needed', 'No', 'Yes', 'Yes', 'Partial'],
                  ['WhatsApp native', 'Yes', 'Add-on', 'No', 'No'],
                  ['AI proactive scoring', 'Yes', 'No', 'No', 'Partial'],
                  ['Email auto-sync', 'Yes', 'Add-on', 'No', 'Partial'],
                  ['Manufacturing / BOM', 'Included', 'Included', 'Included', 'No'],
                  ['POS included', 'Yes', 'Add-on', 'No', 'Add-on'],
                  ['E-commerce', 'Included', 'Included', 'No', 'Add-on'],
                  ['HR & Payroll', 'Included', 'Partial', 'No', 'Partial'],
                  ['Proposal tracking', 'Yes', 'No', 'No', 'No'],
                  ['Industry templates', '8+', 'Limited', 'No', 'No'],
                ].map(([feature, tracktio, odoo, sap, zoho], i) => (
                  <tr key={i} className="border-b border-surface-100 last:border-0">
                    <td className="py-3 px-5 font-medium text-surface-700">{feature}</td>
                    <td className="py-3 px-5 text-center font-bold text-brand-600 bg-brand-50/40">{tracktio}</td>
                    <td className="py-3 px-5 text-center text-surface-500">{odoo}</td>
                    <td className="py-3 px-5 text-center text-surface-500">{sap}</td>
                    <td className="py-3 px-5 text-center text-surface-500">{zoho}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">From our users</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-surface-900">Trusted by growing teams</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { quote: 'The pipeline view alone saved us 5 hours a week. We stopped losing deals in spreadsheets.', name: 'Maria Rodriguez', role: 'Sales Director', company: 'SolarTech EMEA' },
              { quote: 'We replaced Odoo, Monday, and QuickBooks with one tool. Our team actually uses it because it\'s simple.', name: 'Carlos Mendez', role: 'COO', company: 'LogiTrack MX' },
              { quote: 'The AI told us a client viewed our proposal 4 times. We called, they signed that day. Game changer.', name: 'Ana Ruiz', role: 'Founder', company: 'Estudio Volta' },
            ].map(t => (
              <div key={t.name} className="card p-8">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                  ))}
                </div>
                <p className="text-sm text-surface-600 leading-relaxed mb-6">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold text-xs">
                    {t.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-surface-900">{t.name}</p>
                    <p className="text-xs text-surface-400">{t.role}, {t.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING PREVIEW ── */}
      <section className="bg-surface-50 py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">Simple pricing</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-surface-900">Free to start. Scales with you.</h2>
          <p className="text-surface-500 mt-4 max-w-lg mx-auto">
            All 27 modules included in every plan. No per-module fees. No surprises.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
            {[
              { name: 'Free', price: '$0', desc: '1 user, 100 contacts' },
              { name: 'Starter', price: '$29', desc: '5 users, 1K contacts' },
              { name: 'Growth', price: '$79', desc: '20 users, unlimited', pop: true },
              { name: 'Scale', price: '$199', desc: 'Unlimited everything' },
            ].map(p => (
              <div key={p.name} className={`card p-5 text-center ${p.pop ? 'ring-2 ring-brand-500 shadow-lg shadow-brand-600/10' : ''}`}>
                {p.pop && <p className="text-[9px] font-bold text-brand-600 uppercase mb-1">Most popular</p>}
                <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide">{p.name}</p>
                <p className="text-2xl font-extrabold text-surface-900 mt-1">{p.price}<span className="text-sm font-medium text-surface-400">/mo</span></p>
                <p className="text-xs text-surface-400 mt-1">{p.desc}</p>
              </div>
            ))}
          </div>
          <Link href="/pricing" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700 mt-8 transition-colors">
            Compare all plans <span aria-hidden>&#8594;</span>
          </Link>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600 via-brand-700 to-surface-950" />
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.15) 0%, transparent 50%)' }} />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
            Stop juggling 10 tools.<br />Run everything from one place.
          </h2>
          <p className="text-brand-200 mt-5 max-w-lg mx-auto text-base leading-relaxed">
            Join hundreds of teams that replaced their entire software stack with Tracktio. Free forever on the starter plan.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
            <Link href="/auth/signup" className="px-8 py-3.5 bg-white text-brand-700 font-bold rounded-xl hover:bg-brand-50 transition-all text-sm shadow-xl w-full sm:w-auto text-center">
              Start free — takes 60 seconds
            </Link>
            <Link href="/auth/login?demo=true" className="px-8 py-3.5 text-white font-semibold rounded-xl border border-white/20 hover:bg-white/10 transition-all text-sm w-full sm:w-auto text-center">
              Try the live demo
            </Link>
          </div>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section className="bg-white py-20">
        <div className="max-w-md mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-surface-900 mb-2">Questions? Let's talk.</h2>
          <p className="text-surface-500 text-sm mb-8">We respond within 24 hours.</p>
          <form action="https://formspree.io/f/placeholder" method="POST" className="space-y-3">
            <input type="text" name="name" required placeholder="Your name" className="input" />
            <input type="email" name="email" required placeholder="Work email" className="input" />
            <textarea name="message" required rows={3} placeholder="How can we help?" className="input resize-none" />
            <button type="submit" className="btn-primary w-full py-3">Send message</button>
          </form>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-surface-950 text-surface-400 py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <span className="text-white font-bold text-lg">Tracktio</span>
              </div>
              <p className="text-sm leading-relaxed">AI-powered ERP for growing businesses. CRM, invoicing, inventory, and 24 more modules in one platform.</p>
            </div>
            <div>
              <p className="text-xs font-bold text-white uppercase tracking-wider mb-4">Product</p>
              <ul className="space-y-2.5 text-sm">
                <li><Link href="/features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/auth/login?demo=true" className="hover:text-white transition-colors">Live Demo</Link></li>
                <li><Link href="/auth/signup" className="hover:text-white transition-colors">Get Started</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold text-white uppercase tracking-wider mb-4">Modules</p>
              <ul className="space-y-2.5 text-sm">
                <li><span className="hover:text-white transition-colors">CRM & Pipeline</span></li>
                <li><span className="hover:text-white transition-colors">Invoicing</span></li>
                <li><span className="hover:text-white transition-colors">Inventory</span></li>
                <li><Link href="/features" className="text-brand-400 hover:text-brand-300 transition-colors">See all 27 &rarr;</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold text-white uppercase tracking-wider mb-4">Company</p>
              <ul className="space-y-2.5 text-sm">
                <li><span className="hover:text-white transition-colors">About</span></li>
                <li><span className="hover:text-white transition-colors">Blog</span></li>
                <li><span className="hover:text-white transition-colors">Privacy Policy</span></li>
                <li><span className="hover:text-white transition-colors">Terms of Service</span></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-surface-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs">&copy; {new Date().getFullYear()} Tracktio. All rights reserved.</p>
            <p className="text-xs">Made for businesses that move fast.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
