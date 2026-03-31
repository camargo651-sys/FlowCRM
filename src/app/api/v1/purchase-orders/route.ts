import { createCrudHandlers } from '@/lib/api/crud'

export const { GET, POST, PUT, DELETE } = createCrudHandlers({
  table: 'purchase_orders',
  searchFields: ['po_number', 'notes'],
  selectFields: '*, suppliers(name), purchase_order_items(*)',
  allowedFilters: ['status', 'supplier_id'],
  defaultSort: 'created_at',
  afterUpdate: async (record, ctx) => {
    // Auto-receive stock when PO status changes to 'received'
    if (record.status === 'received') {
      const { data: items } = await ctx.supabase
        .from('purchase_order_items')
        .select('product_id, quantity, received_qty, unit_cost')
        .eq('purchase_order_id', record.id)

      for (const item of items || []) {
        if (!item.product_id) continue
        const toReceive = item.quantity - (item.received_qty || 0)
        if (toReceive <= 0) continue

        const { data: product } = await ctx.supabase
          .from('products').select('stock_quantity').eq('id', item.product_id).single()
        if (!product) continue

        const newStock = product.stock_quantity + toReceive
        await ctx.supabase.from('products').update({ stock_quantity: newStock, cost_price: item.unit_cost || undefined }).eq('id', item.product_id)
        await ctx.supabase.from('stock_movements').insert({
          workspace_id: record.workspace_id,
          product_id: item.product_id,
          type: 'purchase',
          quantity: toReceive,
          previous_stock: product.stock_quantity,
          new_stock: newStock,
          unit_cost: item.unit_cost,
          reference: `PO ${record.po_number}`,
        })
        await ctx.supabase.from('purchase_order_items').update({ received_qty: item.quantity }).eq('purchase_order_id', record.id).eq('product_id', item.product_id)
      }
    }
  },
})
