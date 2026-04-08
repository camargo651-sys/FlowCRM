import { SupabaseClient } from '@supabase/supabase-js'
import { emitSignal } from '@/lib/ai/signal-emitter'
import { fireTrigger } from '@/lib/automations/engine'
import { fireOutgoingWebhooks } from '@/lib/api/outgoing-webhooks'
import { logAudit } from '@/lib/api/audit'

// ============================================================
// Domain Events — the nervous system of the ERP
// Each module publishes events, others subscribe and react
// ============================================================

export type DomainEvent =
  | { type: 'deal.created'; payload: { workspaceId: string; dealId: string; dealTitle: string; value?: number; contactId?: string; contactName?: string; userId: string } }
  | { type: 'deal.won'; payload: { workspaceId: string; dealId: string; dealTitle: string; value?: number; contactId?: string; contactName?: string; userId: string } }
  | { type: 'deal.lost'; payload: { workspaceId: string; dealId: string; dealTitle: string; contactId?: string; userId: string } }
  | { type: 'deal.stage_changed'; payload: { workspaceId: string; dealId: string; dealTitle: string; stageName: string; previousStageName?: string; contactId?: string; userId: string } }
  | { type: 'quote.accepted'; payload: { workspaceId: string; quoteId: string; quoteTitle: string; total: number; contactId?: string; userId: string; items: { product_id?: string; quantity?: number; description?: string }[] } }
  | { type: 'quote.sent'; payload: { workspaceId: string; quoteId: string; quoteTitle: string; contactId?: string; userId: string } }
  | { type: 'invoice.paid'; payload: { workspaceId: string; invoiceId: string; invoiceNumber: string; amount: number; contactId?: string; userId: string } }
  | { type: 'invoice.created'; payload: { workspaceId: string; invoiceId: string; invoiceNumber: string; total: number; contactId?: string; userId: string } }
  | { type: 'payment.received'; payload: { workspaceId: string; paymentId: string; amount: number; invoiceId?: string; contactId?: string; userId: string } }
  | { type: 'contact.created'; payload: { workspaceId: string; contactId: string; contactName: string; source?: string; userId: string } }
  | { type: 'product.low_stock'; payload: { workspaceId: string; productId: string; productName: string; currentStock: number; minStock: number } }
  | { type: 'po.received'; payload: { workspaceId: string; poId: string; poNumber: string; supplierId?: string; userId: string } }
  | { type: 'employee.created'; payload: { workspaceId: string; employeeId: string; employeeName: string; userId: string } }
  | { type: 'leave.requested'; payload: { workspaceId: string; employeeId: string; employeeName: string; type: string; days: number } }

// Common fields across all event payloads — used for handlers that work with any event type
type EventPayloadCommon = {
  workspaceId: string
  userId?: string
  dealId?: string
  dealTitle?: string
  dealValue?: number
  value?: number
  contactId?: string
  contactName?: string
  contactPhone?: string
  invoiceId?: string
  invoiceNumber?: string
  productId?: string
  productName?: string
  employeeId?: string
  employeeName?: string
  quoteId?: string
  quoteTitle?: string
  stageName?: string
  previousStageName?: string
  amount?: number
  total?: number
  source?: string
  items?: { product_id?: string; quantity?: number; description?: string }[]
  currentStock?: number
  minStock?: number
  poId?: string
  poNumber?: string
  supplierId?: string
  type?: string
  days?: number
  paymentId?: string
}
type EventHandler = (event: DomainEvent, supabase: SupabaseClient) => Promise<void>

const handlers: Map<string, EventHandler[]> = new Map()

/**
 * Subscribe a handler to an event type
 */
export function on(eventType: string, handler: EventHandler) {
  const existing = handlers.get(eventType) || []
  handlers.set(eventType, [...existing, handler])
}

/**
 * Publish a domain event — all subscribers are notified asynchronously
 */
export async function publish(event: DomainEvent, supabase: SupabaseClient) {
  const eventHandlers = handlers.get(event.type) || []
  const wildcardHandlers = handlers.get('*') || []

  // Execute all handlers concurrently but don't block
  const allHandlers = [...eventHandlers, ...wildcardHandlers]
  await Promise.allSettled(allHandlers.map(h => h(event, supabase)))
}

// ============================================================
// Built-in Event Handlers (cross-module reactions)
// ============================================================

// When a deal is won → create invoice, emit signal, fire automations
on('deal.won', async (event, supabase) => {
  const p = event.payload as EventPayloadCommon

  // Emit engagement signal
  if (p.contactId) {
    await emitSignal(supabase, {
      workspaceId: p.workspaceId,
      contactId: p.contactId,
      dealId: p.dealId,
      signalType: 'quote_accepted', // reuse as deal closed signal
      source: 'crm',
    })
  }

  // Fire automations
  await fireTrigger(supabase, {
    workspaceId: p.workspaceId,
    triggerType: 'deal_won',
    dealId: p.dealId,
    dealTitle: p.dealTitle,
    dealValue: p.value,
    contactId: p.contactId,
    contactName: p.contactName,
    userId: p.userId,
  })

  // Create notification
  const { data: ws } = await supabase.from('workspaces').select('owner_id').eq('id', p.workspaceId).single()
  if (ws) {
    await supabase.from('notifications').insert({
      workspace_id: p.workspaceId,
      user_id: ws.owner_id,
      type: 'deal_won',
      title: `Deal won: ${p.dealTitle}`,
      body: p.value ? `$${p.value.toLocaleString()} closed with ${p.contactName || 'client'}` : `Closed with ${p.contactName || 'client'}`,
      priority: 'high',
      action_url: '/pipeline',
      deal_id: p.dealId,
      contact_id: p.contactId,
    })
  }
})

// When deal stage changes → fire automations, emit signal
on('deal.stage_changed', async (event, supabase) => {
  const p = event.payload as EventPayloadCommon
  await fireTrigger(supabase, {
    workspaceId: p.workspaceId,
    triggerType: 'deal_stage_changed',
    dealId: p.dealId,
    dealTitle: p.dealTitle,
    stageName: p.stageName,
    previousStageName: p.previousStageName,
    contactId: p.contactId,
    userId: p.userId,
  })

  if (p.contactId) {
    await emitSignal(supabase, {
      workspaceId: p.workspaceId,
      contactId: p.contactId,
      dealId: p.dealId,
      signalType: 'deal_stage_changed',
      source: 'crm',
    })
  }
})

// When quote accepted → deduct stock for linked products
on('quote.accepted', async (event, supabase) => {
  const p = event.payload as EventPayloadCommon
  for (const item of p.items || []) {
    if (!item.product_id) continue
    const { data: product } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single()
    if (!product) continue
    const newStock = product.stock_quantity - (item.quantity || 0)
    await supabase.from('products').update({ stock_quantity: newStock }).eq('id', item.product_id)
    await supabase.from('stock_movements').insert({
      workspace_id: p.workspaceId, product_id: item.product_id,
      type: 'sale', quantity: item.quantity,
      previous_stock: product.stock_quantity, new_stock: newStock,
      reference: `Quote accepted: ${p.quoteTitle}`,
    })

    // Check low stock
    const { data: updated } = await supabase.from('products').select('min_stock, name').eq('id', item.product_id).single()
    if (updated && newStock <= updated.min_stock) {
      await publish({ type: 'product.low_stock', payload: {
        workspaceId: p.workspaceId, productId: item.product_id,
        productName: updated.name, currentStock: newStock, minStock: updated.min_stock,
      }}, supabase)
    }
  }
})

// When product hits low stock → notify
on('product.low_stock', async (event, supabase) => {
  const p = event.payload as EventPayloadCommon
  const { data: ws } = await supabase.from('workspaces').select('owner_id').eq('id', p.workspaceId).single()
  if (ws) {
    await supabase.from('notifications').insert({
      workspace_id: p.workspaceId,
      user_id: ws.owner_id,
      type: 'system',
      title: `Low stock: ${p.productName}`,
      body: `Only ${p.currentStock} left (minimum: ${p.minStock}). Reorder soon.`,
      priority: 'high',
      action_url: '/inventory',
    })
  }
})

// When contact created → emit signal, fire automations
on('contact.created', async (event, supabase) => {
  const p = event.payload as EventPayloadCommon
  await emitSignal(supabase, {
    workspaceId: p.workspaceId, contactId: p.contactId,
    signalType: 'contact_created', source: p.source || 'manual',
  })
  await fireTrigger(supabase, {
    workspaceId: p.workspaceId, triggerType: 'contact_created',
    contactId: p.contactId, contactName: p.contactName, userId: p.userId,
  })
})

// When payment received → update invoice, emit webhook
on('payment.received', async (event, supabase) => {
  const p = event.payload as EventPayloadCommon
  if (p.invoiceId) {
    const { data: invoice } = await supabase.from('invoices').select('total, amount_paid').eq('id', p.invoiceId).single()
    if (invoice) {
      const newPaid = (invoice.amount_paid || 0) + p.amount
      const balance = invoice.total - newPaid
      await supabase.from('invoices').update({
        amount_paid: newPaid, balance_due: balance,
        status: balance <= 0 ? 'paid' : 'partial',
        ...(balance <= 0 ? { paid_at: new Date().toISOString() } : {}),
      }).eq('id', p.invoiceId)
    }
  }
})

// Wildcard: audit log + outgoing webhooks for all events
on('*', async (event, supabase) => {
  const p = event.payload as EventPayloadCommon

  // Audit log
  await logAudit(supabase, {
    workspaceId: p.workspaceId,
    userId: p.userId,
    action: event.type,
    entityType: event.type.split('.')[0],
    entityId: p.dealId || p.contactId || p.invoiceId || p.productId || p.employeeId,
    entityName: p.dealTitle || p.contactName || p.invoiceNumber || p.productName || p.employeeName,
  })

  // Outgoing webhooks
  await fireOutgoingWebhooks(supabase, p.workspaceId, event.type, p)
})
