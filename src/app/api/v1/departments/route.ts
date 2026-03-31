import { createCrudHandlers } from '@/lib/api/crud'
export const { GET, POST, PUT, DELETE } = createCrudHandlers({
  table: 'departments',
  module: 'hr',
  searchFields: ['name'],
  defaultSort: 'name',
})
