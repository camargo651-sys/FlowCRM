import { createCrudHandlers } from '@/lib/api/crud'
export const { GET, POST, PUT, DELETE } = createCrudHandlers({
  table: 'suppliers',
  module: 'purchasing',
  searchFields: ['name', 'email', 'phone'],
  allowedFilters: [],
  defaultSort: 'name',
})
