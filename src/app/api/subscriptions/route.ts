import { createCrudHandlers } from '@/lib/api/crud'

const crud = createCrudHandlers({
  table: 'subscriptions',
  searchFields: ['name'],
  selectFields: '*, contacts(id, name, email)',
  allowedFilters: ['status', 'contact_id', 'interval'],
  defaultSort: 'created_at',
})

export const GET = crud.GET
export const POST = crud.POST
export const PUT = crud.PUT
export const DELETE = crud.DELETE
