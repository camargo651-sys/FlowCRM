import { SupabaseClient } from '@supabase/supabase-js'

interface SeedConfig {
  workspaceId: string
  userId: string
  industry: string
  pipelineId: string
  stages: { id: string; name: string }[]
}

const DEMO_CONTACTS: Record<string, { name: string; email: string; phone: string; company: string; type: string; job_title: string }[]> = {
  real_estate: [
    { name: 'María García', email: 'maria@example.com', phone: '+573001234567', company: '', type: 'person', job_title: 'Buyer' },
    { name: 'Carlos López', email: 'carlos@example.com', phone: '+573009876543', company: '', type: 'person', job_title: 'Seller' },
    { name: 'Inversiones Urbanas', email: 'info@invurbanas.com', phone: '+573005551234', company: 'Inversiones Urbanas', type: 'company', job_title: '' },
    { name: 'Ana Rodríguez', email: 'ana.r@example.com', phone: '+573007771234', company: '', type: 'person', job_title: 'Investor' },
  ],
  b2b_sales: [
    { name: 'John Smith', email: 'john@acmecorp.com', phone: '+14155551234', company: 'Acme Corp', type: 'person', job_title: 'VP of Operations' },
    { name: 'Sarah Chen', email: 'sarah@techstart.io', phone: '+14155559876', company: 'TechStart', type: 'person', job_title: 'CTO' },
    { name: 'Global Solutions Inc', email: 'contact@globalsol.com', phone: '+14155550000', company: 'Global Solutions Inc', type: 'company', job_title: '' },
    { name: 'David Müller', email: 'david@eurotech.de', phone: '+491701234567', company: 'EuroTech GmbH', type: 'person', job_title: 'Head of Procurement' },
  ],
  healthcare: [
    { name: 'Laura Martínez', email: 'laura.m@email.com', phone: '+573001112233', company: '', type: 'person', job_title: '' },
    { name: 'Roberto Sánchez', email: 'roberto.s@email.com', phone: '+573004445566', company: '', type: 'person', job_title: '' },
    { name: 'Carmen Vega', email: 'carmen.v@email.com', phone: '+573007778899', company: '', type: 'person', job_title: '' },
  ],
  education: [
    { name: 'Pedro Jiménez', email: 'pedro.j@email.com', phone: '+573001234000', company: '', type: 'person', job_title: 'Student' },
    { name: 'Isabel Torres', email: 'isabel.t@email.com', phone: '+573005678000', company: '', type: 'person', job_title: 'Parent' },
    { name: 'Empresa Capacitación SA', email: 'rrhh@empcap.com', phone: '+573009012000', company: 'Empresa Capacitación SA', type: 'company', job_title: '' },
  ],
  generic: [
    { name: 'Demo Contact', email: 'demo@example.com', phone: '+1234567890', company: 'Demo Company', type: 'person', job_title: 'Manager' },
    { name: 'Sample Client', email: 'client@example.com', phone: '+0987654321', company: 'Sample Corp', type: 'person', job_title: 'Director' },
  ],
}

const DEMO_PRODUCTS: Record<string, { name: string; sku: string; price: number; cost: number; stock: number }[]> = {
  distribution: [
    { name: 'Product A - 500ml', sku: 'PA-500', price: 5.99, cost: 2.50, stock: 200 },
    { name: 'Product B - 1L', sku: 'PB-1L', price: 12.99, cost: 6.00, stock: 150 },
    { name: 'Product C - Pack x12', sku: 'PC-12', price: 45.00, cost: 22.00, stock: 80 },
  ],
  generic: [
    { name: 'Standard Service', sku: 'SVC-001', price: 100, cost: 40, stock: 999 },
    { name: 'Premium Package', sku: 'PKG-001', price: 500, cost: 200, stock: 50 },
  ],
}

const DEFAULT_ACCOUNTS = [
  { code: '1000', name: 'Cash', type: 'asset' },
  { code: '1100', name: 'Accounts Receivable', type: 'asset' },
  { code: '1200', name: 'Inventory', type: 'asset' },
  { code: '1500', name: 'Equipment', type: 'asset' },
  { code: '2000', name: 'Accounts Payable', type: 'liability' },
  { code: '2100', name: 'Taxes Payable', type: 'liability' },
  { code: '2500', name: 'Loans Payable', type: 'liability' },
  { code: '3000', name: 'Owner Equity', type: 'equity' },
  { code: '3100', name: 'Retained Earnings', type: 'equity' },
  { code: '4000', name: 'Sales Revenue', type: 'revenue' },
  { code: '4100', name: 'Service Revenue', type: 'revenue' },
  { code: '4200', name: 'Other Income', type: 'revenue' },
  { code: '5000', name: 'Cost of Goods Sold', type: 'expense' },
  { code: '5100', name: 'Salaries & Wages', type: 'expense' },
  { code: '5200', name: 'Rent', type: 'expense' },
  { code: '5300', name: 'Utilities', type: 'expense' },
  { code: '5400', name: 'Marketing', type: 'expense' },
  { code: '5500', name: 'Office Supplies', type: 'expense' },
  { code: '5600', name: 'Insurance', type: 'expense' },
  { code: '5700', name: 'Professional Services', type: 'expense' },
]

const DEFAULT_DEPARTMENTS = [
  'Sales', 'Marketing', 'Operations', 'Finance', 'Human Resources',
]

export async function seedWorkspaceData(supabase: SupabaseClient, config: SeedConfig) {
  const { workspaceId, userId, industry, pipelineId, stages } = config

  // 1. Seed contacts
  const contactTemplates = DEMO_CONTACTS[industry] || DEMO_CONTACTS.generic
  const contactIds: string[] = []
  for (const c of contactTemplates) {
    const { data } = await supabase.from('contacts').insert({
      workspace_id: workspaceId, owner_id: userId,
      name: c.name, email: c.email, phone: c.phone,
      company_name: c.company || null, type: c.type,
      job_title: c.job_title || null, tags: ['demo'],
    }).select('id').single()
    if (data) contactIds.push(data.id)
  }

  // 2. Seed deals across pipeline stages
  if (stages.length > 0 && contactIds.length > 0) {
    const dealNames: Record<string, string[]> = {
      real_estate: ['Apartment Downtown', 'House Suburbs', 'Commercial Space'],
      b2b_sales: ['Enterprise License', 'Annual Contract', 'Custom Integration'],
      healthcare: ['Dental Treatment', 'Physical Therapy', 'Consultation'],
      education: ['Web Development Course', 'MBA Enrollment', 'Corporate Training'],
      generic: ['New Opportunity', 'Partnership Deal', 'Service Contract'],
    }
    const names = dealNames[industry] || dealNames.generic
    for (let i = 0; i < Math.min(names.length, stages.length - 1); i++) {
      await supabase.from('deals').insert({
        workspace_id: workspaceId, pipeline_id: pipelineId,
        stage_id: stages[i].id, title: names[i],
        value: Math.round((Math.random() * 50000 + 5000) / 100) * 100,
        contact_id: contactIds[i % contactIds.length],
        owner_id: userId, status: 'open', order_index: 0,
      })
    }
  }

  // 3. Seed products (if applicable)
  const productTemplates = DEMO_PRODUCTS[industry] || DEMO_PRODUCTS.generic
  for (const p of productTemplates) {
    await supabase.from('products').insert({
      workspace_id: workspaceId,
      name: p.name, sku: p.sku, unit_price: p.price,
      cost_price: p.cost, stock_quantity: p.stock, min_stock: 10,
      status: 'active', tags: ['demo'],
    })
  }

  // 4. Seed chart of accounts
  for (const acc of DEFAULT_ACCOUNTS) {
    await supabase.from('chart_of_accounts').upsert({
      workspace_id: workspaceId,
      code: acc.code, name: acc.name, type: acc.type, is_system: true,
    }, { onConflict: 'workspace_id,code' })
  }

  // 5. Seed departments
  for (const dept of DEFAULT_DEPARTMENTS) {
    await supabase.from('departments').upsert({
      workspace_id: workspaceId, name: dept,
    }, { onConflict: 'workspace_id,name' })
  }

  // 6. Create a sample quote
  if (contactIds.length > 0) {
    const viewToken = crypto.randomUUID()
    await supabase.from('quotes').insert({
      workspace_id: workspaceId,
      quote_number: 'Q-0001',
      title: 'Sample Proposal',
      contact_id: contactIds[0],
      status: 'draft',
      subtotal: 5000, total: 5000, currency: 'USD',
      view_token: viewToken,
      notes: 'This is a demo quote. Edit or delete it anytime.',
    })
  }

  return { contacts: contactIds.length, products: productTemplates.length, accounts: DEFAULT_ACCOUNTS.length }
}
