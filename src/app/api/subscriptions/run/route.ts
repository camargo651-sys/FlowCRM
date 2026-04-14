import { NextRequest } from 'next/server'
import { authenticateRequest, apiSuccess, apiError } from '@/lib/api/auth'

function advanceDate(date: string, interval: string): string {
  const d = new Date(date)
  switch (interval) {
    case 'weekly': d.setDate(d.getDate() + 7); break
    case 'monthly': d.setMonth(d.getMonth() + 1); break
    case 'quarterly': d.setMonth(d.getMonth() + 3); break
    case 'yearly': d.setFullYear(d.getFullYear() + 1); break
  }
  return d.toISOString().slice(0, 10)
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth instanceof Response) return auth

  const today = new Date().toISOString().slice(0, 10)
  const { data: due, error } = await auth.supabase
    .from('subscriptions')
    .select('*')
    .eq('workspace_id', auth.workspaceId)
    .eq('status', 'active')
    .lte('next_invoice_date', today)

  if (error) return apiError(error.message, 500)

  let generated = 0
  for (const sub of due || []) {
    const { count } = await auth.supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', auth.workspaceId)
    const num = (count || 0) + 1
    const issueDate = sub.next_invoice_date
    const dueDate = new Date(issueDate); dueDate.setDate(dueDate.getDate() + 30)

    const { error: invErr } = await auth.supabase.from('invoices').insert({
      workspace_id: auth.workspaceId,
      invoice_number: `INV-${String(num).padStart(4, '0')}`,
      contact_id: sub.contact_id,
      subtotal: sub.amount,
      total: sub.amount,
      balance_due: sub.amount,
      currency: sub.currency || 'USD',
      status: 'draft',
      issue_date: issueDate,
      due_date: dueDate.toISOString().slice(0, 10),
      notes: `Auto-generated from subscription: ${sub.name}`,
      subscription_id: sub.id,
    })
    if (invErr) continue

    await auth.supabase.from('subscriptions').update({
      next_invoice_date: advanceDate(sub.next_invoice_date, sub.interval),
    }).eq('id', sub.id)

    generated++
  }

  return apiSuccess({ generated })
}
