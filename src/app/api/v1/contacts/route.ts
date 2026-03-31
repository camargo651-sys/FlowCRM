import { createCrudHandlers } from '@/lib/api/crud'

export const { GET, POST, PUT, DELETE } = createCrudHandlers({
  table: 'contacts',
  searchFields: ['name', 'email', 'phone', 'company_name'],
  selectFields: '*, deals(id, title, value, status)',
  allowedFilters: ['type', 'score_label'],
  defaultSort: 'name',
})
