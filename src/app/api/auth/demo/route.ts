import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/api/rate-limit'

const DEMO_EMAIL = 'demo@tracktio.app'
const DEMO_PASSWORD = 'demo-tracktio-2026'

function getServiceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

// POST: Create or login to demo account
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  const { allowed } = checkRateLimit(ip, 'demo')
  if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const supabase = getServiceSupabase()
  if (!supabase) return NextResponse.json({ error: 'Demo not available' }, { status: 503 })

  // Try to sign in first
  const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL, password: DEMO_PASSWORD,
  })

  if (signIn?.session) {
    return NextResponse.json({
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
    })
  }

  // Create demo account if doesn't exist
  const { data: signUp, error: signUpError } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: 'Demo User',
      workspace_name: 'Tracktio Demo',
      workspace_slug: 'demo',
    },
  })

  if (signUpError) {
    return NextResponse.json({ error: 'Could not create demo' }, { status: 500 })
  }

  // Sign in the new user
  const { data: newSession } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL, password: DEMO_PASSWORD,
  })

  if (!newSession?.session) {
    return NextResponse.json({ error: 'Demo login failed' }, { status: 500 })
  }

  // Seed rich demo data
  try {
    const userId = newSession.session.user.id
    const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', userId).single()
    if (ws) {
      await seedRichDemoData(supabase, ws.id, userId)
    }
  } catch {
    // Seed may fail if data already exists — non-critical
  }

  return NextResponse.json({
    access_token: newSession.session.access_token,
    refresh_token: newSession.session.refresh_token,
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function seedRichDemoData(supabase: any, wsId: string, userId: string) {
  // Check if already seeded
  const { count } = await supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('workspace_id', wsId)
  if ((count || 0) > 5) return // Already seeded

  // ── CONTACTS (50) ──
  const contacts = [
    { name: 'María García', email: 'maria@solartech.com', phone: '+573001234567', company_name: 'SolarTech EMEA', type: 'person', job_title: 'Sales Director', engagement_score: 85, score_label: 'hot' },
    { name: 'Carlos Mendez', email: 'carlos@logitrack.mx', phone: '+5215551234567', company_name: 'LogiTrack MX', type: 'person', job_title: 'COO', engagement_score: 72, score_label: 'warm' },
    { name: 'Ana Ruiz', email: 'ana@estudiovolta.com', phone: '+34612345678', company_name: 'Estudio Volta', type: 'person', job_title: 'Founder', engagement_score: 90, score_label: 'hot' },
    { name: 'David Kim', email: 'david@nexgen.io', phone: '+14155551234', company_name: 'NexGen Systems', type: 'person', job_title: 'VP Engineering', engagement_score: 60, score_label: 'warm' },
    { name: 'Sarah Chen', email: 'sarah@cloudpeak.com', phone: '+14155559876', company_name: 'CloudPeak', type: 'person', job_title: 'CTO', engagement_score: 45, score_label: 'warm' },
    { name: 'Roberto Silva', email: 'roberto@constrular.co', phone: '+573009876543', company_name: 'Constrular', type: 'person', job_title: 'Project Manager', engagement_score: 30, score_label: 'cold' },
    { name: 'Elena Martínez', email: 'elena@freshfood.cl', phone: '+56912345678', company_name: 'FreshFood Chile', type: 'person', job_title: 'Purchasing Manager', engagement_score: 78, score_label: 'hot' },
    { name: 'James Wilson', email: 'james@globalfreight.com', phone: '+442071234567', company_name: 'Global Freight Ltd', type: 'person', job_title: 'Director', engagement_score: 55, score_label: 'warm' },
    { name: 'Lucía Fernández', email: 'lucia@pharmaplus.pe', phone: '+51987654321', company_name: 'PharmaPlus', type: 'person', job_title: 'General Manager', engagement_score: 68, score_label: 'warm' },
    { name: 'NexGen Systems', email: 'info@nexgen.io', phone: '+14155550000', company_name: 'NexGen Systems', type: 'company', job_title: '', engagement_score: 65, score_label: 'warm' },
    { name: 'SolarTech EMEA', email: 'sales@solartech.com', phone: '+34911234567', company_name: 'SolarTech EMEA', type: 'company', job_title: '', engagement_score: 80, score_label: 'hot' },
    { name: 'CloudPeak', email: 'hello@cloudpeak.com', phone: '+14155558888', company_name: 'CloudPeak', type: 'company', job_title: '', engagement_score: 50, score_label: 'warm' },
    { name: 'Pedro Gómez', email: 'pedro@autoparts.com.ar', phone: '+5491112345678', company_name: 'AutoParts SA', type: 'person', job_title: 'Buyer', engagement_score: 40, score_label: 'cold' },
    { name: 'Valentina López', email: 'vale@creativostudio.co', phone: '+573001111222', company_name: 'Creativo Studio', type: 'person', job_title: 'Creative Director', engagement_score: 88, score_label: 'hot' },
    { name: 'Michael Brown', email: 'mike@steelworks.us', phone: '+12125551234', company_name: 'SteelWorks Inc', type: 'person', job_title: 'Operations Manager', engagement_score: 35, score_label: 'cold' },
    { name: 'Carmen Vega', email: 'carmen@healthfirst.mx', phone: '+5215559876543', company_name: 'HealthFirst', type: 'person', job_title: 'HR Director', engagement_score: 62, score_label: 'warm' },
    { name: 'Liu Wei', email: 'liu@techbridge.cn', phone: '+8613812345678', company_name: 'TechBridge Asia', type: 'person', job_title: 'Partnership Lead', engagement_score: 70, score_label: 'warm' },
    { name: 'Isabel Torres', email: 'isabel@educaonline.com', phone: '+573005678000', company_name: 'EducaOnline', type: 'person', job_title: 'CEO', engagement_score: 92, score_label: 'hot' },
    { name: 'FreshFood Chile', email: 'ventas@freshfood.cl', phone: '+56228765432', company_name: 'FreshFood Chile', type: 'company', job_title: '', engagement_score: 75, score_label: 'warm' },
    { name: 'Daniel Ortiz', email: 'daniel@financeplus.co', phone: '+573002223344', company_name: 'FinancePlus', type: 'person', job_title: 'CFO', engagement_score: 58, score_label: 'warm' },
  ]

  const contactIds: string[] = []
  for (const c of contacts) {
    const { data } = await supabase.from('contacts').insert({
      workspace_id: wsId, owner_id: userId, ...c, tags: ['demo'],
    }).select('id').single()
    if (data) contactIds.push(data.id)
  }

  // ── PIPELINE & STAGES ──
  const { data: pipelineRows } = await supabase.from('pipelines').select('id').eq('workspace_id', wsId).limit(1)
  let pipelineId = pipelineRows?.[0]?.id
  if (!pipelineId) {
    const { data: newP } = await supabase.from('pipelines').insert({
      workspace_id: wsId, name: 'Sales Pipeline', color: '#0891B2',
    }).select('id').single()
    pipelineId = newP?.id
  }

  const { data: existingStages } = await supabase.from('pipeline_stages').select('id, name').eq('pipeline_id', pipelineId).order('order_index')
  let stageIds = existingStages?.map((s: { id: string }) => s.id) || []

  if (stageIds.length === 0) {
    const stageNames = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost']
    for (let i = 0; i < stageNames.length; i++) {
      const { data: s } = await supabase.from('pipeline_stages').insert({
        pipeline_id: pipelineId, name: stageNames[i], order_index: i,
        color: ['#6b75a0', '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444'][i],
        is_won: stageNames[i] === 'Closed Won', is_lost: stageNames[i] === 'Closed Lost',
      }).select('id').single()
      if (s) stageIds.push(s.id)
    }
  }

  // ── DEALS (15) ──
  const deals = [
    { title: 'SolarTech Annual Contract', value: 48000, stage: 0, contact: 0, prob: 20 },
    { title: 'LogiTrack Fleet System', value: 125000, stage: 1, contact: 1, prob: 40 },
    { title: 'Estudio Volta Branding', value: 15000, stage: 2, contact: 2, prob: 60 },
    { title: 'NexGen API Integration', value: 85000, stage: 2, contact: 3, prob: 55 },
    { title: 'CloudPeak Migration', value: 200000, stage: 3, contact: 4, prob: 75 },
    { title: 'Constrular Site License', value: 32000, stage: 0, contact: 5, prob: 15 },
    { title: 'FreshFood Supply Chain', value: 67000, stage: 1, contact: 6, prob: 35 },
    { title: 'Global Freight Expansion', value: 310000, stage: 3, contact: 7, prob: 80 },
    { title: 'PharmaPlus ERP Setup', value: 45000, stage: 2, contact: 8, prob: 50 },
    { title: 'EducaOnline Platform', value: 92000, stage: 4, contact: 17, prob: 100 },
    { title: 'FinancePlus Consulting', value: 28000, stage: 4, contact: 19, prob: 100 },
    { title: 'AutoParts Inventory System', value: 55000, stage: 1, contact: 12, prob: 30 },
    { title: 'Creativo Studio Website', value: 18000, stage: 3, contact: 13, prob: 70 },
    { title: 'SteelWorks Quote', value: 78000, stage: 5, contact: 14, prob: 0 },
    { title: 'TechBridge Partnership', value: 150000, stage: 2, contact: 16, prob: 45 },
  ]

  for (const d of deals) {
    await supabase.from('deals').insert({
      workspace_id: wsId, pipeline_id: pipelineId,
      stage_id: stageIds[d.stage] || stageIds[0],
      title: d.title, value: d.value,
      contact_id: contactIds[d.contact] || contactIds[0],
      owner_id: userId, status: d.stage === 4 ? 'won' : d.stage === 5 ? 'lost' : 'open',
      probability: d.prob, order_index: 0,
      expected_close_date: new Date(Date.now() + (Math.random() * 60 + 5) * 86400000).toISOString().split('T')[0],
    })
  }

  // ── PRODUCTS (8) ──
  const products = [
    { name: 'Starter Plan - Monthly', sku: 'PLN-STR-M', unit_price: 29, cost_price: 5, stock_quantity: 999, description: 'Starter subscription, billed monthly' },
    { name: 'Growth Plan - Monthly', sku: 'PLN-GRW-M', unit_price: 79, cost_price: 12, stock_quantity: 999, description: 'Growth subscription, billed monthly' },
    { name: 'Scale Plan - Monthly', sku: 'PLN-SCL-M', unit_price: 199, cost_price: 30, stock_quantity: 999, description: 'Scale subscription, billed monthly' },
    { name: 'Implementation Package', sku: 'SVC-IMPL', unit_price: 2500, cost_price: 800, stock_quantity: 50, description: 'White-glove onboarding and setup' },
    { name: 'Custom Integration', sku: 'SVC-INTG', unit_price: 5000, cost_price: 2000, stock_quantity: 20, description: 'Custom API integration development' },
    { name: 'Training Workshop (8h)', sku: 'SVC-TRNG', unit_price: 1200, cost_price: 400, stock_quantity: 30, description: '8-hour on-site or remote training' },
    { name: 'Priority Support - Annual', sku: 'SUP-PRI-A', unit_price: 4800, cost_price: 1200, stock_quantity: 100, description: 'Dedicated support with 1h SLA' },
    { name: 'Data Migration Service', sku: 'SVC-MIGR', unit_price: 3000, cost_price: 1000, stock_quantity: 25, description: 'Full data migration from existing ERP' },
  ]

  for (const p of products) {
    await supabase.from('products').insert({
      workspace_id: wsId, ...p, min_stock: 5, status: 'active', tags: ['demo'],
    })
  }

  // ── INVOICES (5) ──
  const invoiceData = [
    { client: 'EducaOnline', contact: 17, total: 92000, status: 'paid', num: 'INV-0001' },
    { client: 'FinancePlus', contact: 19, total: 28000, status: 'paid', num: 'INV-0002' },
    { client: 'Estudio Volta', contact: 2, total: 7500, status: 'sent', num: 'INV-0003' },
    { client: 'NexGen Systems', contact: 3, total: 42500, status: 'sent', num: 'INV-0004' },
    { client: 'SolarTech EMEA', contact: 0, total: 12000, status: 'overdue', num: 'INV-0005' },
  ]

  for (const inv of invoiceData) {
    await supabase.from('invoices').insert({
      workspace_id: wsId, invoice_number: inv.num,
      contact_id: contactIds[inv.contact] || contactIds[0],
      client_name: inv.client, status: inv.status,
      subtotal: inv.total, total: inv.total,
      amount_paid: inv.status === 'paid' ? inv.total : 0,
      balance_due: inv.status === 'paid' ? 0 : inv.total,
      issue_date: new Date(Date.now() - Math.random() * 30 * 86400000).toISOString().split('T')[0],
      due_date: new Date(Date.now() + (inv.status === 'overdue' ? -5 : 25) * 86400000).toISOString().split('T')[0],
      currency: 'USD',
    })
  }

  // ── ACTIVITIES (10) ──
  const activities = [
    { title: 'Follow up with María about contract', type: 'task', done: false, contact: 0, days: 1 },
    { title: 'Call Carlos re: fleet pricing', type: 'call', done: false, contact: 1, days: 0 },
    { title: 'Send proposal to Ana', type: 'email', done: true, contact: 2, days: -2 },
    { title: 'Demo for David Kim', type: 'meeting', done: false, contact: 3, days: 3 },
    { title: 'Review CloudPeak contract', type: 'task', done: false, contact: 4, days: 2 },
    { title: 'Call Elena about Q2 order', type: 'call', done: true, contact: 6, days: -1 },
    { title: 'Send case study to James', type: 'email', done: false, contact: 7, days: 1 },
    { title: 'Lunch with Isabel Torres', type: 'meeting', done: true, contact: 17, days: -3 },
    { title: 'Prepare SOW for TechBridge', type: 'task', done: false, contact: 16, days: 4 },
    { title: 'Update pricing sheet', type: 'note', done: false, contact: null, days: 0 },
  ]

  for (const a of activities) {
    await supabase.from('activities').insert({
      workspace_id: wsId, owner_id: userId,
      title: a.title, type: a.type, done: a.done,
      contact_id: a.contact !== null ? (contactIds[a.contact] || null) : null,
      due_date: new Date(Date.now() + a.days * 86400000).toISOString(),
    })
  }

  // ── SEQUENCES (1) ──
  await supabase.from('sequences').insert({
    workspace_id: wsId, name: 'Welcome Follow-up',
    description: 'Automatic follow-up for new leads',
    enabled: true,
    steps: [
      { order: 0, channel: 'whatsapp', message: 'Hi {{name}}! Thanks for your interest. How can we help?', delay_hours: 0 },
      { order: 1, channel: 'whatsapp', message: 'Hi {{first_name}}, just following up. Do you have any questions?', delay_hours: 24, condition: 'no_reply' },
      { order: 2, channel: 'whatsapp', message: '{{first_name}}, we don\'t want you to miss out! Last chance to book a free consultation.', delay_hours: 72, condition: 'no_reply' },
    ],
    enrolled_count: 8, completed_count: 3,
  })

  // ── SOCIAL LEADS (8) ──
  const socialLeads = [
    { author_name: 'Laura Gómez', author_username: 'lauragmz', platform: 'instagram', source_type: 'comment', message: 'Me interesa! Cómo puedo agendar?', status: 'converted' },
    { author_name: 'Diego Torres', author_username: 'diegot_', platform: 'facebook', source_type: 'dm', message: 'Hola, quisiera información sobre sus servicios', status: 'qualified' },
    { author_name: 'Camila Ruiz', author_username: 'camilaruiz', platform: 'instagram', source_type: 'comment', message: 'Precio?', status: 'new' },
    { author_name: 'Andrés Peña', author_username: 'andrespena', platform: 'tiktok', source_type: 'comment', message: 'Muy bueno el video! Cómo contacto?', status: 'contacted' },
    { author_name: 'Sofia Chen', author_username: 'sofiac', platform: 'facebook', source_type: 'form', message: 'Interested in consultation', status: 'converted' },
    { author_name: 'Manuel López', author_username: 'mlopez', platform: 'instagram', source_type: 'dm', message: 'Tienen disponibilidad esta semana?', status: 'qualified' },
    { author_name: 'Isabella Vargas', author_username: 'isav', platform: 'tiktok', source_type: 'comment', message: 'Info por favor', status: 'new', metadata: { has_phone: false } },
    { author_name: 'Roberto Sánchez', author_username: 'robsanchez', platform: 'linkedin', source_type: 'dm', message: 'Looking for legal consulting services', status: 'contacted' },
  ]
  for (const lead of socialLeads) {
    await supabase.from('social_leads').insert({ workspace_id: wsId, ...lead, metadata: (lead as Record<string, unknown>).metadata || {} })
  }

  // ── CHART OF ACCOUNTS ──
  const accounts = [
    { code: '1000', name: 'Cash', type: 'asset' },
    { code: '1100', name: 'Accounts Receivable', type: 'asset' },
    { code: '1200', name: 'Inventory', type: 'asset' },
    { code: '2000', name: 'Accounts Payable', type: 'liability' },
    { code: '3000', name: 'Owner Equity', type: 'equity' },
    { code: '4000', name: 'Sales Revenue', type: 'revenue' },
    { code: '5000', name: 'Cost of Goods Sold', type: 'expense' },
    { code: '5100', name: 'Salaries & Wages', type: 'expense' },
  ]

  for (const acc of accounts) {
    await supabase.from('chart_of_accounts').upsert({
      workspace_id: wsId, code: acc.code, name: acc.name, type: acc.type, is_system: true,
    }, { onConflict: 'workspace_id,code' })
  }
}
