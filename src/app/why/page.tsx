import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Why Tracktio — Compare vs HubSpot, Salesforce, Pipedrive, Odoo',
  description:
    'See how Tracktio stacks up against HubSpot, Salesforce, Pipedrive, Zoho, and Odoo. Transparent pricing, no seat minimums, AI built in.',
}

type Cell = true | false | 'partial' | 'paid' | string

interface Row {
  label: string
  tracktio: Cell
  hubspot: Cell
  salesforce: Cell
  pipedrive: Cell
  zoho: Cell
  odoo: Cell
}

const ROWS: Row[] = [
  { label: 'Starting price (per user/mo)',     tracktio: '$9',   hubspot: '$20',  salesforce: '$25',  pipedrive: '$15', zoho: '$14', odoo: '$25' },
  { label: 'Free plan available',              tracktio: true,   hubspot: true,   salesforce: false,  pipedrive: false, zoho: true,  odoo: 'partial' },
  { label: 'Per-module pricing (pay only for what you use)', tracktio: true, hubspot: false, salesforce: false, pipedrive: false, zoho: false, odoo: true },
  { label: 'Visual form & page builder (no HTML)', tracktio: true, hubspot: 'paid', salesforce: 'paid', pipedrive: false, zoho: 'partial', odoo: 'partial' },
  { label: 'Real-time collaborative pipeline', tracktio: true,   hubspot: 'partial', salesforce: 'partial', pipedrive: true, zoho: 'partial', odoo: false },
  { label: 'AI Next Best Action suggestions', tracktio: true,   hubspot: 'paid', salesforce: 'paid', pipedrive: 'paid', zoho: 'paid', odoo: false },
  { label: 'Click-to-call built in',           tracktio: true,   hubspot: 'paid', salesforce: 'paid', pipedrive: 'paid', zoho: true,  odoo: 'partial' },
  { label: 'WhatsApp native integration',      tracktio: true,   hubspot: 'paid', salesforce: 'paid', pipedrive: false, zoho: 'partial', odoo: 'partial' },
  { label: 'Unlimited users',                  tracktio: true,   hubspot: false,  salesforce: false,  pipedrive: false, zoho: false, odoo: false },
  { label: 'No seat minimums',                 tracktio: true,   hubspot: false,  salesforce: false,  pipedrive: false, zoho: false, odoo: false },
  { label: '5+ languages native',              tracktio: true,   hubspot: true,   salesforce: true,   pipedrive: true,  zoho: true,  odoo: true },
  { label: 'GDPR data export (1-click)',       tracktio: true,   hubspot: 'partial', salesforce: 'partial', pipedrive: 'partial', zoho: 'partial', odoo: 'partial' },
  { label: 'Public product roadmap',           tracktio: true,   hubspot: false,  salesforce: false,  pipedrive: false, zoho: false, odoo: true },
  { label: 'Natural language commands',        tracktio: true,   hubspot: 'paid', salesforce: 'paid', pipedrive: false, zoho: 'paid', odoo: false },
  { label: 'Dark mode',                        tracktio: true,   hubspot: false,  salesforce: false,  pipedrive: true,  zoho: true,  odoo: false },
  { label: 'Mobile-first responsive UI',       tracktio: true,   hubspot: 'partial', salesforce: 'partial', pipedrive: true, zoho: true, odoo: 'partial' },
  { label: 'Offline mode',                     tracktio: true,   hubspot: false,  salesforce: 'partial', pipedrive: 'partial', zoho: false, odoo: false },
  { label: 'Universal undo',                   tracktio: true,   hubspot: false,  salesforce: false,  pipedrive: false, zoho: false, odoo: false },
  { label: 'Custom form builder',              tracktio: true,   hubspot: 'paid', salesforce: 'paid', pipedrive: 'paid', zoho: true,  odoo: true },
  { label: 'Document templates',               tracktio: true,   hubspot: 'paid', salesforce: 'paid', pipedrive: 'paid', zoho: true,  odoo: true },
  { label: 'Configurable loss reasons',        tracktio: true,   hubspot: true,   salesforce: true,   pipedrive: true,  zoho: true,  odoo: 'partial' },
  { label: 'Approval workflows',               tracktio: true,   hubspot: 'paid', salesforce: 'paid', pipedrive: false, zoho: 'paid', odoo: true },
  { label: 'Recurring invoices',               tracktio: true,   hubspot: 'paid', salesforce: 'paid', pipedrive: false, zoho: true,  odoo: true },
  { label: 'Customer health score',            tracktio: true,   hubspot: 'paid', salesforce: 'paid', pipedrive: false, zoho: 'partial', odoo: false },
  { label: 'Meeting scheduler',                tracktio: true,   hubspot: true,   salesforce: 'paid', pipedrive: true,  zoho: true,  odoo: 'partial' },
  { label: '2FA built in',                     tracktio: true,   hubspot: true,   salesforce: true,   pipedrive: true,  zoho: true,  odoo: true },
]

function renderCell(v: Cell) {
  if (v === true) return <span className="text-emerald-600 font-bold text-lg" aria-label="Yes">✓</span>
  if (v === false) return <span className="text-red-500 font-bold text-lg" aria-label="No">✕</span>
  if (v === 'partial') return <span className="text-amber-500 font-bold text-lg" aria-label="Partial">◐</span>
  if (v === 'paid') return <span className="text-amber-600 font-semibold text-xs">$ paid add-on</span>
  return <span className="text-surface-700 text-sm font-semibold">{v}</span>
}

const TESTIMONIALS = [
  {
    quote: 'We switched from HubSpot and cut our CRM bill by 70%. Tracktio has features we literally couldn\'t afford on Enterprise.',
    name: 'Marco Delgado',
    title: 'Head of Sales, Solaris Energy',
  },
  {
    quote: 'Migration took 30 minutes. The AI actually catches deals we would have lost. Never going back to Salesforce.',
    name: 'Priya Ramaswamy',
    title: 'VP Revenue, Northwind Health',
  },
  {
    quote: 'Finally a CRM that doesn\'t charge per seat. We added our whole ops team without a second thought.',
    name: 'Jens Bauer',
    title: 'COO, Meridian Logistics',
  },
]

export default function WhyTracktioPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-surface-100/60">
        <div className="flex items-center justify-between px-6 py-3.5 max-w-7xl mx-auto">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center shadow-lg shadow-brand-600/20">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="font-bold text-xl tracking-tight text-surface-900">Tracktio</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link href="/features" className="text-sm font-medium text-surface-500 hover:text-surface-900">Features</Link>
            <Link href="/pricing" className="text-sm font-medium text-surface-500 hover:text-surface-900">Pricing</Link>
            <Link href="/why" className="text-sm font-semibold text-surface-900">Why Tracktio</Link>
          </div>
          <Link href="/auth/sign-up" className="px-4 py-2 bg-emerald-500 text-white font-semibold rounded-xl hover:bg-emerald-600 text-sm shadow-sm">
            Start free
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-12 text-center">
        <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider mb-4">Why switch</p>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-surface-900 mb-6">
          Why teams switch from <span className="text-brand-600">HubSpot</span>, <span className="text-brand-600">Salesforce</span>,<br />
          <span className="text-brand-600">Pipedrive</span>, and <span className="text-brand-600">Odoo</span> to Tracktio
        </h1>
        <p className="text-lg text-surface-600 max-w-2xl mx-auto mb-10">
          Transparent pricing, no seat minimums, AI built into every workflow, and every feature they make you pay extra for — included.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/settings/migrate" className="px-8 py-4 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 text-sm shadow-lg shadow-brand-600/20">
            Migrate in 1 click →
          </Link>
          <Link href="/auth/sign-up" className="px-8 py-4 bg-white text-surface-900 font-semibold rounded-xl border border-surface-200 hover:border-surface-300 text-sm">
            Start free — no credit card
          </Link>
        </div>
      </section>

      {/* COMPARISON TABLE */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="overflow-x-auto rounded-2xl border border-surface-200 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-50 border-b border-surface-200">
                <th className="text-left p-4 font-semibold text-surface-700 sticky left-0 bg-surface-50 z-10 min-w-[240px]">Feature</th>
                <th className="p-4 font-bold text-brand-600 bg-brand-50/50 min-w-[110px]">Tracktio</th>
                <th className="p-4 font-semibold text-surface-700 min-w-[110px]">HubSpot</th>
                <th className="p-4 font-semibold text-surface-700 min-w-[110px]">Salesforce</th>
                <th className="p-4 font-semibold text-surface-700 min-w-[110px]">Pipedrive</th>
                <th className="p-4 font-semibold text-surface-700 min-w-[110px]">Zoho</th>
                <th className="p-4 font-semibold text-surface-700 min-w-[110px]">Odoo</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => (
                <tr key={row.label} className={i % 2 === 0 ? 'bg-white' : 'bg-surface-50/40'}>
                  <td className="p-4 text-surface-700 sticky left-0 bg-inherit font-medium">{row.label}</td>
                  <td className="p-4 text-center bg-brand-50/30">{renderCell(row.tracktio)}</td>
                  <td className="p-4 text-center">{renderCell(row.hubspot)}</td>
                  <td className="p-4 text-center">{renderCell(row.salesforce)}</td>
                  <td className="p-4 text-center">{renderCell(row.pipedrive)}</td>
                  <td className="p-4 text-center">{renderCell(row.zoho)}</td>
                  <td className="p-4 text-center">{renderCell(row.odoo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-surface-400 mt-3 text-center">
          ✓ Included &nbsp;·&nbsp; ◐ Partial &nbsp;·&nbsp; $ Paid add-on &nbsp;·&nbsp; ✕ Not available &nbsp;·&nbsp; Prices as of Q1 2026, public plans only.
        </p>
      </section>

      {/* TESTIMONIALS */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-surface-900 text-center mb-10">Teams that made the switch</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="p-6 rounded-2xl border border-surface-200 bg-white shadow-sm">
              <p className="text-sm text-surface-700 leading-relaxed mb-4">&ldquo;{t.quote}&rdquo;</p>
              <div className="flex items-center gap-3 pt-4 border-t border-surface-100">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold text-sm">
                  {t.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div>
                  <p className="text-sm font-semibold text-surface-900">{t.name}</p>
                  <p className="text-xs text-surface-500">{t.title}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-surface-900 mb-4">Ready to switch?</h2>
        <p className="text-lg text-surface-600 mb-8">Migrate your data from any major CRM in a single click. We do the heavy lifting.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/settings/migrate" className="px-8 py-4 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 text-sm shadow-lg shadow-brand-600/20">
            Migrate from HubSpot, Salesforce, Pipedrive →
          </Link>
          <Link href="/pricing" className="px-8 py-4 bg-white text-surface-900 font-semibold rounded-xl border border-surface-200 hover:border-surface-300 text-sm">
            See pricing
          </Link>
        </div>
      </section>

      <footer className="border-t border-surface-100 py-8 text-center text-xs text-surface-400">
        © 2026 Tracktio · <Link href="/features" className="hover:text-surface-600">Features</Link> · <Link href="/pricing" className="hover:text-surface-600">Pricing</Link> · <Link href="/why" className="hover:text-surface-600">Why Tracktio</Link>
      </footer>
    </div>
  )
}
