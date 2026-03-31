import { createCrudHandlers } from '@/lib/api/crud'

export const { GET, POST, PUT, DELETE } = createCrudHandlers({
  table: 'products',
  searchFields: ['name', 'sku', 'brand', 'barcode'],
  selectFields: '*, product_categories(name, type)',
  allowedFilters: ['status', 'category_id'],
  defaultSort: 'name',
})
