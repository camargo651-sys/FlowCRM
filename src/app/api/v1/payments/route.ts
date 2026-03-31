import { createCrudHandlers } from '@/lib/api/crud'

export const { GET, POST, PUT, DELETE } = createCrudHandlers({
  table: 'payments',
  module: 'invoicing',
  searchFields: ['reference', 'notes'],
  selectFields: '*, invoices(invoice_number, total, balance_due), contacts(name)',
  allowedFilters: ['status', 'method', 'invoice_id', 'contact_id'],
  defaultSort: 'created_at',
  afterCreate: async (record, ctx) => {
    // Update invoice balance when payment is created
    if (record.invoice_id && record.status === 'completed') {
      const { data: invoice } = await ctx.supabase
        .from('invoices').select('total, amount_paid').eq('id', record.invoice_id).single()
      if (invoice) {
        const newPaid = (invoice.amount_paid || 0) + record.amount
        const balance = invoice.total - newPaid
        await ctx.supabase.from('invoices').update({
          amount_paid: newPaid,
          balance_due: balance,
          status: balance <= 0 ? 'paid' : 'partial',
          ...(balance <= 0 ? { paid_at: new Date().toISOString() } : {}),
        }).eq('id', record.invoice_id)
      }
    }
  },
})
