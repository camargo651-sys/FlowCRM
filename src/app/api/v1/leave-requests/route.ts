import { createCrudHandlers } from '@/lib/api/crud'
export const { GET, POST, PUT, DELETE } = createCrudHandlers({
  table: 'leave_requests',
  module: 'hr',
  searchFields: ['notes'],
  selectFields: '*, employees(first_name, last_name)',
  allowedFilters: ['status', 'type', 'employee_id'],
  defaultSort: 'created_at',
})
