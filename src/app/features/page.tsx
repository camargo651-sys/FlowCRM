import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Features',
  description: 'Explore all 27 Tracktio modules: CRM, invoicing, inventory, manufacturing, HR, accounting, POS, e-commerce, and more — all AI-powered.',
  openGraph: {
    title: 'Tracktio Features — 27 modules, one AI-powered platform',
    description: 'CRM, invoicing, inventory, manufacturing, HR, accounting, POS, e-commerce, and more.',
  },
}

const MODULES = [
  { category: 'Sales & CRM', desc: 'Manage your entire sales cycle from lead to close.', items: [
    { name: 'Pipeline', desc: 'Kanban deals with drag-drop, AI risk scoring, and stage conditions', icon: '🔀' },
    { name: 'Contacts', desc: 'Auto-created from email, WhatsApp, LinkedIn. Engagement scores track interest', icon: '👥' },
    { name: 'Quotes & Proposals', desc: 'View tracking — know exactly when clients read your pricing', icon: '📄' },
    { name: 'Invoicing', desc: 'Create, send, track payments. Auto-balance. Recurring invoices supported', icon: '🧾' },
    { name: 'POS', desc: 'Full cashier system with barcode scanning, multi-payment methods', icon: '💳' },
    { name: 'E-commerce', desc: 'Public storefront, shopping cart, checkout, and order management', icon: '🛒' },
    { name: 'Social Leads', desc: 'Capture leads from Instagram, Facebook, TikTok comments and DMs', icon: '📸' },
    { name: 'Contracts', desc: 'Track agreements, set renewal alerts, monitor expiry dates', icon: '📝' },
    { name: 'Service Tickets', desc: 'Helpdesk with priority levels, SLA tracking, threaded comments', icon: '🎫' },
  ]},
  { category: 'Operations', desc: 'Streamline your supply chain and production.', items: [
    { name: 'Inventory', desc: '5 product types (basic, apparel, tech, digital, service). Real-time stock alerts', icon: '📦' },
    { name: 'Purchasing', desc: 'Purchase orders, supplier management, auto-receive stock on delivery', icon: '🚛' },
    { name: 'Manufacturing', desc: 'Bill of materials, work orders, automatic material consumption tracking', icon: '🏭' },
  ]},
  { category: 'Finance', desc: 'Complete financial management without an accountant.', items: [
    { name: 'Accounting', desc: 'Chart of accounts, double-entry journal, P&L, and Balance Sheet reports', icon: '📒' },
    { name: 'Expenses', desc: 'Expense reports with categories, approval workflows, and reimbursement', icon: '💰' },
    { name: 'Financial Reports', desc: 'Profit & Loss, Balance Sheet, Cash Flow — all with visual charts', icon: '📈' },
    { name: 'Payments', desc: 'Stripe integration, multiple methods, automatic invoice balance updates', icon: '💳' },
  ]},
  { category: 'People', desc: 'Manage your team, payroll, and tasks.', items: [
    { name: 'HR & Payroll', desc: 'Employees, departments, leave requests, automatic payslip generation', icon: '👔' },
    { name: 'Team Management', desc: 'Invite members, assign roles, manage workspace access', icon: '👥' },
    { name: 'Roles & Permissions', desc: '14 modules x 6 actions — granular permission matrix for any team', icon: '🛡️' },
  ]},
  { category: 'AI & Automation', desc: 'Let AI handle the repetitive work.', items: [
    { name: 'AI Insights', desc: 'Proactive next-best-action suggestions. Not dashboards — actual recommendations', icon: '🧠' },
    { name: 'Engagement Scoring', desc: 'Hot/warm/cold contacts scored by email opens, page views, and interactions', icon: '🔥' },
    { name: 'Automations', desc: 'If-this-then-that workflows: auto-send WhatsApp, emails, create tasks', icon: '⚡' },
    { name: 'Call Transcription', desc: 'AI analysis of calls — sentiment, topics, auto follow-up tasks', icon: '📞' },
    { name: 'AI Setup', desc: 'Chat with AI to configure your ERP based on your specific business needs', icon: '✨' },
  ]},
  { category: 'Integrations', desc: 'Connect with the tools you already use.', items: [
    { name: 'Gmail & Outlook', desc: 'Auto-sync emails, create contacts, log activities — no manual entry', icon: '📧' },
    { name: 'WhatsApp', desc: 'Send and receive natively from your CRM. Full chat UI per contact', icon: '💬' },
    { name: 'LinkedIn', desc: 'OAuth import of connections with company, title, and profile data', icon: '💼' },
    { name: '20+ Integrations', desc: 'Slack, Stripe, Zapier, Twilio, Calendly, Google Calendar, and more', icon: '🔌' },
  ]},
  { category: 'Configuration', desc: 'Make it yours — no developer needed.', items: [
    { name: 'Module Manager', desc: 'Enable or disable any of the 27 modules per workspace', icon: '⚙️' },
    { name: 'Form Builder', desc: 'Add custom fields to any entity (text, number, date, select, and more)', icon: '🧱' },
    { name: 'Document Templates', desc: 'HTML editor with dynamic variables and live preview for quotes and invoices', icon: '📋' },
    { name: 'Industry Templates', desc: '8+ industries with pre-built pipelines, custom fields, and automations', icon: '🏭' },
    { name: 'REST API', desc: '50+ endpoints with Bearer auth, rate limiting, and Zod validation', icon: '💻' },
  ]},
]

export default function FeaturesPage() {
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
            <Link href="/pricing" className="text-sm font-medium text-surface-600 hover:text-surface-900 transition-colors hidden sm:block">Pricing</Link>
            <Link href="/auth/login" className="text-sm font-medium text-surface-600 hover:text-surface-900 transition-colors hidden sm:block">Sign in</Link>
            <Link href="/auth/signup" className="px-5 py-2 bg-surface-900 text-white font-semibold rounded-xl hover:bg-surface-800 transition-all text-sm shadow-sm">Start free</Link>
          </div>
        </div>
      </nav>

      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-20">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">Features</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-surface-900">Everything your business needs</h1>
          <p className="text-lg text-surface-500 mt-4">35+ modules. 50+ API endpoints. One platform. Zero configuration.</p>
        </div>

        {MODULES.map(section => (
          <div key={section.category} className="mb-20">
            <div className="mb-8">
              <h2 className="text-2xl font-extrabold text-surface-900">{section.category}</h2>
              <p className="text-sm text-surface-500 mt-1">{section.desc}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {section.items.map(item => (
                <div key={item.name} className="p-6 rounded-2xl border border-surface-100 hover:border-brand-200 hover:shadow-lg transition-all duration-200 group">
                  <span className="text-2xl">{item.icon}</span>
                  <h3 className="text-sm font-bold text-surface-900 mt-4 mb-1.5">{item.name}</h3>
                  <p className="text-xs text-surface-500 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="text-center mt-8 py-16 rounded-2xl bg-surface-50 border border-surface-100">
          <h3 className="text-2xl font-extrabold text-surface-900 mb-3">Ready to try it?</h3>
          <p className="text-surface-500 text-sm mb-6">All features included in the free plan. No credit card required.</p>
          <Link href="/auth/signup" className="px-8 py-3.5 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 transition-all text-sm shadow-xl shadow-brand-600/25">
            Start free — 60 seconds to set up
          </Link>
        </div>
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
