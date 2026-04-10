import { SupabaseClient } from '@supabase/supabase-js'

export interface FormulaConfig {
  type: 'formula'
  source: string
  aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'last'
  field: string | null
  time_filter: string | null
  status_filter: string | null
  relationship: string
}

/** Map of source entities to the numeric fields available for aggregation */
export const SOURCE_NUMERIC_FIELDS: Record<string, { value: string; label: string }[]> = {
  deals: [
    { value: 'value', label: 'Deal value' },
    { value: 'probability', label: 'Probability' },
  ],
  quotes: [
    { value: 'subtotal', label: 'Subtotal' },
    { value: 'total', label: 'Total' },
    { value: 'tax_amount', label: 'Tax amount' },
    { value: 'discount_value', label: 'Discount value' },
  ],
  invoices: [
    { value: 'subtotal', label: 'Subtotal' },
    { value: 'total', label: 'Total' },
    { value: 'amount_paid', label: 'Amount paid' },
    { value: 'balance_due', label: 'Balance due' },
    { value: 'tax_amount', label: 'Tax amount' },
  ],
  activities: [],
  social_leads: [],
  whatsapp_messages: [],
  products: [
    { value: 'unit_price', label: 'Unit price' },
    { value: 'cost_price', label: 'Cost price' },
    { value: 'stock_quantity', label: 'Stock quantity' },
  ],
}

/** Status options per source entity */
export const SOURCE_STATUS_OPTIONS: Record<string, { value: string; label: string }[]> = {
  deals: [
    { value: 'open', label: 'Open' },
    { value: 'won', label: 'Won' },
    { value: 'lost', label: 'Lost' },
  ],
  quotes: [
    { value: 'draft', label: 'Draft' },
    { value: 'sent', label: 'Sent' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'expired', label: 'Expired' },
  ],
  invoices: [
    { value: 'draft', label: 'Draft' },
    { value: 'sent', label: 'Sent' },
    { value: 'paid', label: 'Paid' },
    { value: 'partial', label: 'Partial' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'cancelled', label: 'Cancelled' },
  ],
  activities: [],
  social_leads: [
    { value: 'new', label: 'New' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'qualified', label: 'Qualified' },
    { value: 'converted', label: 'Converted' },
    { value: 'discarded', label: 'Discarded' },
  ],
  whatsapp_messages: [
    { value: 'sent', label: 'Sent' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'read', label: 'Read' },
    { value: 'failed', label: 'Failed' },
  ],
  products: [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'discontinued', label: 'Discontinued' },
  ],
}

/** Relationship columns per source entity — how each source connects to the parent entity */
export const SOURCE_RELATIONSHIPS: Record<string, Record<string, string>> = {
  deals: { contact: 'contact_id', company: 'company_id' },
  quotes: { contact: 'contact_id', deal: 'deal_id' },
  invoices: { contact: 'contact_id', deal: 'deal_id' },
  activities: { contact: 'contact_id', deal: 'deal_id' },
  social_leads: { contact: 'contact_id', deal: 'deal_id' },
  whatsapp_messages: { contact: 'contact_id', deal: 'deal_id' },
  products: {},
}

export const TIME_FILTER_OPTIONS = [
  { value: '', label: 'All time' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '60d', label: 'Last 60 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'this_year', label: 'This year' },
]

export const AGGREGATION_OPTIONS = [
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
  { value: 'last', label: 'Last value' },
]

export const SOURCE_ENTITY_OPTIONS = [
  { value: 'deals', label: 'Deals' },
  { value: 'quotes', label: 'Quotes' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'activities', label: 'Activities' },
  { value: 'social_leads', label: 'Social Leads' },
  { value: 'whatsapp_messages', label: 'WhatsApp Messages' },
  { value: 'products', label: 'Products' },
]

function getTimeFilterDate(timeFilter: string): string | null {
  const now = new Date()
  if (timeFilter === '7d') {
    now.setDate(now.getDate() - 7)
    return now.toISOString()
  }
  if (timeFilter === '30d') {
    now.setDate(now.getDate() - 30)
    return now.toISOString()
  }
  if (timeFilter === '60d') {
    now.setDate(now.getDate() - 60)
    return now.toISOString()
  }
  if (timeFilter === '90d') {
    now.setDate(now.getDate() - 90)
    return now.toISOString()
  }
  if (timeFilter === 'this_month') {
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  }
  if (timeFilter === 'this_year') {
    return new Date(now.getFullYear(), 0, 1).toISOString()
  }
  return null
}

/**
 * Compute a formula field value at runtime by querying Supabase.
 */
export async function computeFormulaField(
  supabase: SupabaseClient,
  formulaConfig: FormulaConfig,
  entityId: string,
  entityType: string,
  workspaceId: string,
): Promise<number | string | null> {
  const { source, aggregation, field, time_filter, status_filter, relationship } = formulaConfig

  // Determine the relationship column
  const relColumn = relationship || SOURCE_RELATIONSHIPS[source]?.[entityType]
  if (!relColumn) return null

  // For 'last' aggregation, fetch the most recent row
  if (aggregation === 'last') {
    let query = supabase
      .from(source)
      .select(field || 'created_at')
      .eq('workspace_id', workspaceId)
      .eq(relColumn, entityId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (time_filter) {
      const cutoff = getTimeFilterDate(time_filter)
      if (cutoff) query = query.gte('created_at', cutoff)
    }
    if (status_filter) {
      query = query.eq('status', status_filter)
    }

    const { data } = await query
    if (!data || data.length === 0) return null
    const row = data[0] as unknown as Record<string, unknown>
    return field ? (row[field] as string | number) : (row.created_at as string)
  }

  // For count, sum, avg, min, max — use a select with the appropriate field
  const selectField = (aggregation === 'count') ? 'id' : (field || 'id')

  let query = supabase
    .from(source)
    .select(selectField)
    .eq('workspace_id', workspaceId)
    .eq(relColumn, entityId)

  if (time_filter) {
    const cutoff = getTimeFilterDate(time_filter)
    if (cutoff) query = query.gte('created_at', cutoff)
  }
  if (status_filter) {
    query = query.eq('status', status_filter)
  }

  const { data } = await query

  if (!data) return null

  if (aggregation === 'count') {
    return data.length
  }

  const values = data
    .map(row => Number((row as unknown as Record<string, unknown>)[selectField]))
    .filter(v => !isNaN(v))

  if (values.length === 0) return 0

  switch (aggregation) {
    case 'sum':
      return Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100
    case 'avg':
      return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100
    case 'min':
      return Math.min(...values)
    case 'max':
      return Math.max(...values)
    default:
      return null
  }
}

/**
 * Generate a human-readable summary of a formula config for display.
 */
export function describeFormula(config: FormulaConfig): string {
  const agg = AGGREGATION_OPTIONS.find(a => a.value === config.aggregation)?.label || config.aggregation
  const src = SOURCE_ENTITY_OPTIONS.find(s => s.value === config.source)?.label || config.source
  const fieldLabel = config.field
    ? SOURCE_NUMERIC_FIELDS[config.source]?.find(f => f.value === config.field)?.label || config.field
    : ''
  const time = config.time_filter
    ? TIME_FILTER_OPTIONS.find(t => t.value === config.time_filter)?.label || ''
    : ''
  const status = config.status_filter || ''

  let desc = `${agg} of ${src}`
  if (fieldLabel) desc += ` → ${fieldLabel}`
  if (status) desc += ` [${status}]`
  if (time) desc += ` (${time})`
  return desc
}

/**
 * Generate a sample/placeholder value for a formula in the preview panel.
 */
export function formulaPreviewValue(config: FormulaConfig): string {
  switch (config.aggregation) {
    case 'count':
      return '12'
    case 'sum':
      return '$45,200'
    case 'avg':
      return '$3,766'
    case 'min':
      return '$500'
    case 'max':
      return '$15,000'
    case 'last':
      return '2026-04-01'
    default:
      return '—'
  }
}
