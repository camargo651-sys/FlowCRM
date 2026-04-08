import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

function getSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )
}

export async function POST(request: Request) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const { confirm } = await request.json()
  if (confirm !== 'RESET') return NextResponse.json({ error: 'Must confirm with "RESET"' }, { status: 400 })

  // Delete all data in order (respecting foreign keys)
  const tables = [
    'activities', 'quote_items', 'invoice_items', 'purchase_order_items',
    'pos_transaction_items', 'pos_transactions', 'pos_sessions',
    'store_order_items', 'store_orders', 'stock_movements',
    'bom_lines', 'work_orders', 'bill_of_materials',
    'journal_lines', 'journal_entries', 'payslips', 'payroll_runs',
    'expense_items', 'expense_reports', 'leave_requests',
    'ticket_comments', 'tickets', 'contracts', 'social_leads',
    'payment_milestones', 'payments', 'quotes', 'invoices',
    'deals', 'email_messages', 'email_sync_log', 'email_accounts',
    'whatsapp_messages', 'whatsapp_contacts', 'whatsapp_accounts',
    'linkedin_connections', 'linkedin_accounts',
    'call_logs', 'engagement_signals', 'quote_views',
    'approval_requests', 'notifications', 'audit_log',
    'products', 'product_categories', 'contacts',
    'pipeline_stages', 'pipelines', 'custom_field_defs',
    'automations', 'custom_roles', 'integrations',
    'employees', 'departments', 'team_invitations',
    'portal_tokens', 'document_templates', 'api_keys', 'attachments',
  ]

  const deleted: string[] = []
  for (const table of tables) {
    try {
      await supabase.from(table).delete().eq('workspace_id', ws.id)
      deleted.push(table)
    } catch {}
  }

  // Reset workspace settings but keep the workspace itself
  await supabase.from('workspaces').update({
    onboarding_completed: false,
    enabled_modules: null,
    industry: null,
    terminology: null,
  }).eq('id', ws.id)

  return NextResponse.json({ success: true, tables_cleared: deleted.length })
}
