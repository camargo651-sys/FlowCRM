import { createCrudHandlers } from '@/lib/api/crud'
export const { GET, POST, PUT, DELETE } = createCrudHandlers({
  table: 'quotes',
  searchFields: ['title', 'quote_number'],
  selectFields: '*, contacts(id, name, email), quote_items(*)',
  allowedFilters: ['status', 'contact_id', 'deal_id'],
  defaultSort: 'created_at',
})
