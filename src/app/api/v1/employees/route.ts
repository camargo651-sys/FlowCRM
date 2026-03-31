import { createCrudHandlers } from '@/lib/api/crud'

export const { GET, POST, PUT, DELETE } = createCrudHandlers({
  table: 'employees',
  module: 'hr',
  searchFields: ['first_name', 'last_name', 'email', 'employee_number'],
  selectFields: '*, departments(name)',
  allowedFilters: ['status', 'department_id', 'employment_type'],
  defaultSort: 'last_name',
})
