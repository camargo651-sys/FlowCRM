import { createCrudHandlers } from '@/lib/api/crud'

export const { GET, POST, PUT, DELETE } = createCrudHandlers({
  table: 'work_orders',
  module: 'inventory',
  searchFields: ['wo_number', 'notes'],
  selectFields: '*, products(name, sku), bill_of_materials(name)',
  allowedFilters: ['status', 'priority', 'product_id', 'bom_id'],
  defaultSort: 'created_at',
  afterUpdate: async (record, ctx) => {
    // When work order is completed, produce the product and consume materials
    if (record.status === 'completed' && record.bom_id) {
      // Get BOM lines
      const { data: bomLines } = await ctx.supabase
        .from('bom_lines')
        .select('material_id, quantity, waste_percent')
        .eq('bom_id', record.bom_id)

      const consumed: { material_id?: string; product_id?: string; name?: string; product_name?: string; qty?: number; quantity_consumed?: number; previous_stock?: number; new_stock?: number }[] = []

      // Consume materials
      for (const line of bomLines || []) {
        const qtyNeeded = line.quantity * record.quantity * (1 + (line.waste_percent || 0) / 100)
        const { data: material } = await ctx.supabase
          .from('products').select('stock_quantity, name').eq('id', line.material_id).single()
        if (material) {
          const newStock = material.stock_quantity - qtyNeeded
          await ctx.supabase.from('products').update({ stock_quantity: newStock }).eq('id', line.material_id)
          await ctx.supabase.from('stock_movements').insert({
            workspace_id: record.workspace_id, product_id: line.material_id,
            type: 'adjustment', quantity: Math.ceil(qtyNeeded),
            previous_stock: material.stock_quantity, new_stock: Math.max(0, newStock),
            reference: `WO ${record.wo_number} - consumed`, notes: `Manufacturing: ${record.wo_number}`,
          })
          consumed.push({ material_id: line.material_id, name: material.name, qty: qtyNeeded })
        }
      }

      // Produce finished product
      const { data: product } = await ctx.supabase
        .from('products').select('stock_quantity').eq('id', record.product_id).single()
      if (product) {
        const newStock = product.stock_quantity + record.quantity
        await ctx.supabase.from('products').update({ stock_quantity: newStock }).eq('id', record.product_id)
        await ctx.supabase.from('stock_movements').insert({
          workspace_id: record.workspace_id, product_id: record.product_id,
          type: 'adjustment', quantity: record.quantity,
          previous_stock: product.stock_quantity, new_stock: newStock,
          reference: `WO ${record.wo_number} - produced`, notes: `Manufacturing output`,
        })
      }

      // Save consumed materials
      await ctx.supabase.from('work_orders').update({
        materials_consumed: consumed,
        actual_end: new Date().toISOString(),
      }).eq('id', record.id)
    }

    // Set actual_start when status changes to in_progress
    if (record.status === 'in_progress') {
      await ctx.supabase.from('work_orders').update({
        actual_start: new Date().toISOString(),
      }).eq('id', record.id)
    }
  },
})
