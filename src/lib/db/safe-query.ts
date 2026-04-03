import { SupabaseClient } from '@supabase/supabase-js'

// Cache of known columns per table
const columnCache = new Map<string, Set<string>>()

/**
 * Discover which columns exist in a table by doing a minimal query.
 * Caches results to avoid repeated calls.
 */
export async function getTableColumns(supabase: SupabaseClient, table: string): Promise<Set<string>> {
  if (columnCache.has(table)) return columnCache.get(table)!

  try {
    // Query one row to discover columns
    const { data, error } = await supabase.from(table).select('*').limit(1)
    if (error || !data?.length) {
      // Table might be empty — try insert/select to get column names
      // Fallback: return empty set (will use safe defaults)
      columnCache.set(table, new Set())
      return new Set()
    }
    const cols = new Set(Object.keys(data[0]))
    columnCache.set(table, cols)
    return cols
  } catch {
    columnCache.set(table, new Set())
    return new Set()
  }
}

/**
 * Filter an object to only include keys that exist as columns in the table.
 * Prevents 400 errors from inserting non-existent columns.
 */
export async function sanitizeForInsert(
  supabase: SupabaseClient,
  table: string,
  data: Record<string, any>,
): Promise<Record<string, any>> {
  const columns = await getTableColumns(supabase, table)
  if (columns.size === 0) return data // Can't validate, pass through

  const clean: Record<string, any> = {}
  for (const [key, value] of Object.entries(data)) {
    if (columns.has(key)) {
      clean[key] = value
    }
  }
  return clean
}

/**
 * Build a safe select string — only include columns that exist.
 * Falls back to '*' if we can't determine columns.
 */
export async function safeSelect(
  supabase: SupabaseClient,
  table: string,
  requestedColumns: string[],
): Promise<string> {
  const columns = await getTableColumns(supabase, table)
  if (columns.size === 0) return requestedColumns.join(', ')

  const safe = requestedColumns.filter(col => {
    // Handle relation columns like "contacts(name)"
    if (col.includes('(')) return true // Let Supabase handle relations
    return columns.has(col.trim())
  })

  return safe.length > 0 ? safe.join(', ') : 'id'
}

/**
 * Clear column cache (call after schema changes)
 */
export function clearColumnCache() {
  columnCache.clear()
}
