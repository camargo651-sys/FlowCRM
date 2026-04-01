import Link from 'next/link'

const MODULES = [
  { category: 'Sales & CRM', items: [
    { name: 'Pipeline', desc: 'Kanban deals with drag-drop, AI risk scoring', icon: '🔀' },
    { name: 'Contacts', desc: 'Auto-created from email, WhatsApp, LinkedIn. Engagement scores', icon: '👥' },
    { name: 'Quotes & Proposals', desc: 'View tracking — know when clients read your pricing', icon: '📄' },
    { name: 'Invoicing', desc: 'Create, send, track. Auto-balance on payments. Recurring invoices', icon: '🧾' },
    { name: 'POS', desc: 'Full cashier with barcode scanning, cash/card/transfer payments', icon: '💳' },
    { name: 'E-commerce', desc: 'Public storefront, shopping cart, checkout, order management', icon: '🛒' },
    { name: 'Social Leads', desc: 'Capture leads from Instagram, Facebook, TikTok comments', icon: '📸' },
    { name: 'Contracts', desc: 'Track agreements, renewal alerts, expiry monitoring', icon: '📝' },
    { name: 'Service Tickets', desc: 'Helpdesk with priority, SLA, threaded comments', icon: '🎫' },
  ]},
  { category: 'Operations', items: [
    { name: 'Inventory', desc: '5 product types (basic, apparel, tech, digital, service). Stock alerts', icon: '📦' },
    { name: 'Purchasing', desc: 'Purchase orders, suppliers, auto-receive stock', icon: '🚛' },
    { name: 'Manufacturing', desc: 'Bill of materials, work orders, auto material consumption', icon: '🏭' },
  ]},
  { category: 'Finance', items: [
    { name: 'Accounting', desc: 'Chart of accounts, double-entry journal, P&L, Balance Sheet', icon: '📒' },
    { name: 'Expenses', desc: 'Reports with categories, approval workflow, reimbursement', icon: '💰' },
    { name: 'Financial Reports', desc: 'Profit & Loss, Balance Sheet, Cash Flow — with charts', icon: '📈' },
    { name: 'Payments', desc: 'Stripe integration, multiple methods, auto invoice balance', icon: '💳' },
  ]},
  { category: 'People', items: [
    { name: 'HR & Payroll', desc: 'Employees, departments, leave requests, auto payslip generation', icon: '👔' },
    { name: 'Team', desc: 'Invite members, assign custom roles', icon: '👥' },
    { name: 'Roles & Permissions', desc: '14 modules × 6 actions permission matrix', icon: '🛡️' },
  ]},
  { category: 'AI & Automation', items: [
    { name: 'AI Insights', desc: 'Proactive next-best-action suggestions powered by Claude', icon: '🧠' },
    { name: 'Engagement Scoring', desc: 'Hot/warm/cold contacts with time-decay signals', icon: '🔥' },
    { name: 'Automations', desc: 'If-this-then-that workflows (tasks, WhatsApp, email, webhooks)', icon: '⚡' },
    { name: 'Call Transcription', desc: 'AI analysis of calls — sentiment, topics, auto follow-up tasks', icon: '📞' },
    { name: 'AI Setup', desc: 'Chat with AI to configure your ERP based on your business', icon: '✨' },
  ]},
  { category: 'Integrations', items: [
    { name: 'Gmail & Outlook', desc: 'Auto-sync emails, create contacts, log activities', icon: '📧' },
    { name: 'WhatsApp', desc: 'Send and receive natively from CRM. Chat UI per contact', icon: '💬' },
    { name: 'LinkedIn', desc: 'OAuth import of connections with company and title', icon: '💼' },
    { name: '20+ Integrations', desc: 'Slack, Stripe, Zapier, Twilio, Calendly, and more', icon: '🔌' },
  ]},
  { category: 'Configuration', items: [
    { name: 'Module Manager', desc: 'Enable/disable modules per workspace', icon: '⚙️' },
    { name: 'Form Builder', desc: 'Custom fields for any entity (7 field types)', icon: '🧱' },
    { name: 'Document Templates', desc: 'HTML editor with variables and live preview', icon: '📋' },
    { name: 'Industry Templates', desc: '8 industries with pre-built pipeline, fields, automations', icon: '🏭' },
    { name: 'API (50+ endpoints)', desc: 'Full REST API with Bearer auth, rate limiting, Zod validation', icon: '💻' },
  ]},
]

export default function FeaturesPage() {
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
          <Link href="/pricing" className="text-sm font-medium text-surface-600">Pricing</Link>
          <Link href="/auth/login" className="text-sm font-medium text-surface-600">Sign in</Link>
          <Link href="/auth/signup" className="btn-primary btn-sm">Get started</Link>
        </div>
      </nav>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-extrabold text-surface-900">Every feature you need</h1>
          <p className="text-lg text-surface-500 mt-4">35+ modules. 50+ API endpoints. One platform.</p>
        </div>

        {MODULES.map(section => (
          <div key={section.category} className="mb-12">
            <h2 className="text-xl font-bold text-surface-900 mb-6">{section.category}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {section.items.map(item => (
                <div key={item.name} className="p-5 rounded-xl border border-surface-100 hover:shadow-lg transition-shadow">
                  <span className="text-2xl">{item.icon}</span>
                  <h3 className="text-sm font-bold text-surface-900 mt-3">{item.name}</h3>
                  <p className="text-xs text-surface-500 mt-1 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="text-center mt-16">
          <Link href="/auth/signup" className="px-8 py-3 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 transition-colors text-sm shadow-lg shadow-brand-600/25">
            Start free — No credit card
          </Link>
        </div>
      </section>

      <footer className="border-t border-surface-100 py-8 px-6 text-center">
        <p className="text-xs text-surface-400">&copy; {new Date().getFullYear()} Tracktio. All rights reserved.</p>
      </footer>
    </div>
  )
}
