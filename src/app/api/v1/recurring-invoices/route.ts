import { createCrudHandlers } from '@/lib/api/crud'
import { authenticateRequest, apiSuccess, apiError } from '@/lib/api/auth'
import { NextRequest } from 'next/server'

const crud = createCrudHandlers({
  table: 'recurring_invoices',
  searchFields: ['title'],
  selectFields: '*, contacts(name, email)',
  allowedFilters: ['active', 'frequency', 'contact_id'],
  defaultSort: 'next_date',
})

const { GET: _GET, POST: _POST, PUT: _PUT, DELETE: _DELETE } = crud
export { _GET as GET, _PUT as PUT, _DELETE as DELETE }

// Override POST to also handle generation
export async function POST(request: NextRequest) {
  const url = new URL(request.url)
  const action = url.searchParams.get('action')

  // Generate invoices from recurring
  if (action === 'generate') {
    const auth = await authenticateRequest(request)
    if (auth instanceof Response) return auth

    const today = new Date().toISOString().split('T')[0]
    const { data: dueRecurrings } = await auth.supabase
      .from('recurring_invoices')
      .select('*')
      .eq('workspace_id', auth.workspaceId)
      .eq('active', true)
      .lte('next_date', today)

    let generated = 0

    for (const rec of dueRecurrings || []) {
      // Check end date
      if (rec.end_date && rec.next_date > rec.end_date) {
        await auth.supabase.from('recurring_invoices').update({ active: false }).eq('id', rec.id)
        continue
      }

      // Count existing invoices
      const { count } = await auth.supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('workspace_id', auth.workspaceId)
      const num = (count || 0) + 1

      // Create invoice
      const { data: inv } = await auth.supabase.from('invoices').insert({
        workspace_id: auth.workspaceId,
        invoice_number: `INV-${String(num).padStart(4, '0')}`,
        contact_id: rec.contact_id,
        subtotal: rec.subtotal,
        tax_rate: rec.tax_rate,
        tax_amount: rec.subtotal * (rec.tax_rate / 100),
        total: rec.total,
        balance_due: rec.total,
        status: rec.auto_send ? 'sent' : 'draft',
        issue_date: rec.next_date,
        due_date: calculateDueDate(rec.next_date, 30),
        notes: `Auto-generated from recurring: ${rec.title}`,
        metadata: { recurring_invoice_id: rec.id },
      }).select('id').single()

      // Create invoice items
      if (inv && rec.items) {
        const items = (typeof rec.items === 'string' ? JSON.parse(rec.items) : rec.items) as any[]
        if (items.length) {
          await auth.supabase.from('invoice_items').insert(
            items.map((item: any, i: number) => ({
              invoice_id: inv.id,
              description: item.description,
              quantity: item.quantity || 1,
              unit_price: item.unit_price || 0,
              total: (item.quantity || 1) * (item.unit_price || 0),
              order_index: i,
            }))
          )
        }
      }

      // Calculate next date
      const nextDate = calculateNextDate(rec.next_date, rec.frequency)

      await auth.supabase.from('recurring_invoices').update({
        next_date: nextDate,
        invoices_generated: (rec.invoices_generated || 0) + 1,
        last_generated_at: new Date().toISOString(),
      }).eq('id', rec.id)

      generated++
    }

    return apiSuccess({ generated, checked: (dueRecurrings || []).length })
  }

  // Default: create recurring invoice
  return _POST(request)
}

function calculateNextDate(current: string, frequency: string): string {
  const date = new Date(current)
  switch (frequency) {
    case 'weekly': date.setDate(date.getDate() + 7); break
    case 'biweekly': date.setDate(date.getDate() + 14); break
    case 'monthly': date.setMonth(date.getMonth() + 1); break
    case 'quarterly': date.setMonth(date.getMonth() + 3); break
    case 'yearly': date.setFullYear(date.getFullYear() + 1); break
  }
  return date.toISOString().split('T')[0]
}

function calculateDueDate(issueDate: string, days: number): string {
  const date = new Date(issueDate)
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}
