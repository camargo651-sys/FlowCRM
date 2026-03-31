import { createCrudHandlers } from '@/lib/api/crud'
export const { GET, POST, PUT, DELETE } = createCrudHandlers({
  table: 'bill_of_materials',
  module: 'inventory',
  searchFields: ['name'],
  selectFields: '*, products(name, sku), bom_lines(*, products(name, sku, cost_price))',
  allowedFilters: ['product_id', 'active'],
  defaultSort: 'name',
})
