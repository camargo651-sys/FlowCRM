// ============================================================
// Pricing Plans — feature gating for monetization
// ============================================================

export interface Plan {
  key: string
  name: string
  price: number  // monthly USD
  yearlyPrice: number
  features: string[]
  limits: {
    contacts: number
    deals: number
    products: number
    invoices: number
    employees: number
    storage_mb: number
    api_requests_day: number
    users: number
    modules: string[]
  }
}

export const PLANS: Plan[] = [
  {
    key: 'free',
    name: 'Free',
    price: 0,
    yearlyPrice: 0,
    features: [
      'CRM with pipeline',
      'Up to 100 contacts',
      'Up to 50 deals',
      'Basic invoicing',
      'Email integration',
      '1 user',
    ],
    limits: {
      contacts: 100,
      deals: 50,
      products: 25,
      invoices: 20,
      employees: 0,
      storage_mb: 100,
      api_requests_day: 100,
      users: 1,
      modules: ['crm', 'invoicing', 'automations'],
    },
  },
  {
    key: 'starter',
    name: 'Starter',
    price: 29,
    yearlyPrice: 290,
    features: [
      'Everything in Free',
      'Up to 1,000 contacts',
      'Unlimited deals',
      'Inventory management',
      'POS',
      'WhatsApp integration',
      'Up to 5 users',
      '1 GB storage',
    ],
    limits: {
      contacts: 1000,
      deals: -1, // unlimited
      products: 200,
      invoices: -1,
      employees: 10,
      storage_mb: 1024,
      api_requests_day: 1000,
      users: 5,
      modules: ['crm', 'invoicing', 'inventory', 'pos', 'automations', 'ecommerce'],
    },
  },
  {
    key: 'growth',
    name: 'Growth',
    price: 79,
    yearlyPrice: 790,
    features: [
      'Everything in Starter',
      'Unlimited contacts',
      'Accounting & reports',
      'HR & Payroll',
      'Manufacturing',
      'Purchasing',
      'Contracts & tickets',
      'Up to 20 users',
      '10 GB storage',
      'API access',
    ],
    limits: {
      contacts: -1,
      deals: -1,
      products: -1,
      invoices: -1,
      employees: -1,
      storage_mb: 10240,
      api_requests_day: 10000,
      users: 20,
      modules: ['crm', 'invoicing', 'inventory', 'pos', 'automations', 'ecommerce', 'accounting', 'hr', 'expenses', 'manufacturing', 'purchasing'],
    },
  },
  {
    key: 'scale',
    name: 'Scale',
    price: 199,
    yearlyPrice: 1990,
    features: [
      'Everything in Growth',
      'Unlimited everything',
      'Multi-company',
      'Custom roles',
      'Priority support',
      'Custom integrations',
      'White-label branding',
      'Unlimited users',
      '100 GB storage',
    ],
    limits: {
      contacts: -1,
      deals: -1,
      products: -1,
      invoices: -1,
      employees: -1,
      storage_mb: 102400,
      api_requests_day: -1,
      users: -1,
      modules: ['crm', 'invoicing', 'inventory', 'pos', 'automations', 'ecommerce', 'accounting', 'hr', 'expenses', 'manufacturing', 'purchasing', 'reports'],
    },
  },
]

export function getPlan(key: string): Plan {
  return PLANS.find(p => p.key === key) || PLANS[0]
}

export function checkLimit(plan: Plan, resource: keyof Plan['limits'], current: number): { allowed: boolean; limit: number; usage: number } {
  const limit = plan.limits[resource] as number
  if (limit === -1) return { allowed: true, limit: -1, usage: current }
  return { allowed: current < limit, limit, usage: current }
}

export function canAccessModule(plan: Plan, module: string): boolean {
  return plan.limits.modules.includes(module)
}
