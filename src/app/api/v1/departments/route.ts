import { createCrudHandlers } from '@/lib/api/crud'
export const { GET, POST, PUT, DELETE } = createCrudHandlers({
  table: 'departments',
  searchFields: ['name'],
  defaultSort: 'name',
})
