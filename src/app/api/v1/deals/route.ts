import { createCrudHandlers } from '@/lib/api/crud'

export const { GET, POST, PUT, DELETE } = createCrudHandlers({
  table: 'deals',
  searchFields: ['title'],
  selectFields: '*, contacts(id, name, email), pipeline_stages(name, color)',
  allowedFilters: ['status', 'stage_id', 'contact_id', 'ai_risk'],
  defaultSort: 'updated_at',
})
