import { createCrudHandlers } from '@/lib/api/crud'

export const { GET, POST, PUT, DELETE } = createCrudHandlers({
  table: 'chart_of_accounts',
  module: 'accounting',
  searchFields: ['name', 'code'],
  allowedFilters: ['type', 'subtype', 'active'],
  defaultSort: 'code',
})
