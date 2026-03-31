import { createCrudHandlers } from '@/lib/api/crud'

export const { GET, POST, PUT, DELETE } = createCrudHandlers({
  table: 'invoices',
  searchFields: ['invoice_number', 'notes'],
  selectFields: '*, contacts(id, name, email), invoice_items(*)',
  allowedFilters: ['status', 'type', 'contact_id'],
  defaultSort: 'created_at',
  beforeCreate: async (data) => {
    // Auto-calculate balance
    data.balance_due = (data.total || 0) - (data.amount_paid || 0)
    return data
  },
  afterUpdate: async (record, ctx) => {
    // Update balance when payment changes
    if (record.amount_paid !== undefined) {
      const balance = record.total - record.amount_paid
      await ctx.supabase.from('invoices').update({
        balance_due: balance,
        status: balance <= 0 ? 'paid' : balance < record.total ? 'partial' : record.status,
      }).eq('id', record.id)
    }
  },
})
