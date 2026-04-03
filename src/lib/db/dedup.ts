import { SupabaseClient } from '@supabase/supabase-js'

export interface DuplicateResult {
  isDuplicate: boolean
  existingId?: string
  existingRecord?: any
  matchField?: string
  matchValue?: string
}

/**
 * Check if a record is a duplicate before inserting.
 * Checks by email, name, phone, or title depending on entity type.
 */
export async function checkDuplicate(
  supabase: SupabaseClient,
  table: string,
  workspaceId: string,
  record: Record<string, any>,
): Promise<DuplicateResult> {
  // Contacts: check by email first, then name+phone
  if (table === 'contacts') {
    if (record.email) {
      const { data } = await supabase.from('contacts').select('id, name, email')
        .eq('workspace_id', workspaceId).ilike('email', record.email).single()
      if (data) return { isDuplicate: true, existingId: data.id, existingRecord: data, matchField: 'email', matchValue: record.email }
    }
    if (record.name) {
      const { data } = await supabase.from('contacts').select('id, name, email, phone')
        .eq('workspace_id', workspaceId).ilike('name', record.name).single()
      if (data) return { isDuplicate: true, existingId: data.id, existingRecord: data, matchField: 'name', matchValue: record.name }
    }
  }

  // Products: check by SKU or name
  if (table === 'products') {
    if (record.sku) {
      const { data } = await supabase.from('products').select('id, name, sku')
        .eq('workspace_id', workspaceId).ilike('sku', record.sku).single()
      if (data) return { isDuplicate: true, existingId: data.id, existingRecord: data, matchField: 'sku', matchValue: record.sku }
    }
    if (record.name) {
      const { data } = await supabase.from('products').select('id, name')
        .eq('workspace_id', workspaceId).ilike('name', record.name).single()
      if (data) return { isDuplicate: true, existingId: data.id, existingRecord: data, matchField: 'name', matchValue: record.name }
    }
  }

  // Deals: check by title
  if (table === 'deals') {
    if (record.title) {
      const { data } = await supabase.from('deals').select('id, title')
        .eq('workspace_id', workspaceId).ilike('title', record.title).single()
      if (data) return { isDuplicate: true, existingId: data.id, existingRecord: data, matchField: 'title', matchValue: record.title }
    }
  }

  return { isDuplicate: false }
}

export type DuplicateStrategy = 'skip' | 'update' | 'create_anyway'
