import { createCrudHandlers } from '@/lib/api/crud'
import { publish } from '@/lib/events/event-bus'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  type: z.enum(['person', 'company']).optional(),
  company_name: z.string().max(200).optional().nullable(),
  job_title: z.string().max(200).optional().nullable(),
  website: z.string().url().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  tags: z.array(z.string()).optional(),
}).passthrough()

export const { GET, POST, PUT, DELETE } = createCrudHandlers({
  table: 'contacts',
  module: 'crm',
  schema,
  searchFields: ['name', 'email', 'phone', 'company_name'],
  selectFields: '*, deals(id, title, value, status)',
  allowedFilters: ['type', 'score_label'],
  defaultSort: 'name',
  afterCreate: async (record, ctx) => {
    await publish({ type: 'contact.created', payload: {
      workspaceId: ctx.workspaceId, contactId: record.id,
      contactName: record.name, userId: ctx.userId,
    }}, ctx.supabase)
  },
})
