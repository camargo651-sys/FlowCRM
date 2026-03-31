import { createCrudHandlers } from '@/lib/api/crud'
import { publish } from '@/lib/events/event-bus'
import { z } from 'zod'

const schema = z.object({
  title: z.string().min(1).max(200),
  value: z.number().min(0).optional().nullable(),
  status: z.enum(['open', 'won', 'lost']).optional(),
  contact_id: z.string().uuid().optional().nullable(),
  stage_id: z.string().uuid().optional().nullable(),
  pipeline_id: z.string().uuid().optional().nullable(),
  expected_close_date: z.string().optional().nullable(),
  probability: z.number().min(0).max(100).optional(),
}).passthrough()

export const { GET, POST, PUT, DELETE } = createCrudHandlers({
  table: 'deals',
  module: 'crm',
  schema,
  searchFields: ['title'],
  selectFields: '*, contacts(id, name, email), pipeline_stages(name, color)',
  allowedFilters: ['status', 'stage_id', 'contact_id', 'ai_risk'],
  defaultSort: 'updated_at',
  afterCreate: async (record, ctx) => {
    await publish({ type: 'deal.created', payload: {
      workspaceId: ctx.workspaceId, dealId: record.id,
      dealTitle: record.title, value: record.value,
      contactId: record.contact_id, userId: ctx.userId,
    }}, ctx.supabase)
  },
  afterUpdate: async (record, ctx) => {
    if (record.status === 'won') {
      await publish({ type: 'deal.won', payload: {
        workspaceId: ctx.workspaceId, dealId: record.id,
        dealTitle: record.title, value: record.value,
        contactId: record.contact_id, userId: ctx.userId,
      }}, ctx.supabase)
    } else if (record.status === 'lost') {
      await publish({ type: 'deal.lost', payload: {
        workspaceId: ctx.workspaceId, dealId: record.id,
        dealTitle: record.title, contactId: record.contact_id, userId: ctx.userId,
      }}, ctx.supabase)
    }
  },
})
