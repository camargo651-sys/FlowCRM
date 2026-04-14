import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

function getSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(toSet: { name: string; value: string; options?: CookieOptions }[]) {
          try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    },
  )
}

// Tables to export — order matters for CSV output only
const TABLES = [
  'contacts',
  'companies',
  'deals',
  'pipeline_stages',
  'pipelines',
  'activities',
  'notes',
  'calls',
  'email_messages',
  'tickets',
  'invoices',
  'invoice_items',
  'quotes',
  'quote_items',
  'payments',
  'products',
  'product_categories',
  'suppliers',
  'purchase_orders',
  'purchase_order_items',
  'employees',
  'departments',
  'contracts',
  'subscriptions',
  'accounts',
  'journal_entries',
  'expenses',
  'tasks',
  'automations',
  'sequences',
  'campaigns',
  'forms',
  'form_submissions',
  'custom_fields',
  'webhooks',
  'api_keys',
  'leads',
  'social_leads',
  'bookings',
  'booking_links',
  'loss_reasons',
  'templates',
  'approval_rules',
  'approval_requests',
  'quotas',
]

type Row = Record<string, unknown>

async function fetchTable(
  supabase: ReturnType<typeof getSupabase>,
  table: string,
  workspaceId: string,
): Promise<Row[]> {
  try {
    const { data, error } = await supabase.from(table).select('*').eq('workspace_id', workspaceId)
    if (error) return []
    return (data as Row[]) || []
  } catch {
    return []
  }
}

function escapeCsv(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function toCsv(rows: Row[]): string {
  if (rows.length === 0) return ''
  const headers = Array.from(
    rows.reduce<Set<string>>((set, r) => {
      Object.keys(r).forEach((k) => set.add(k))
      return set
    }, new Set()),
  )
  const lines = [headers.join(',')]
  for (const r of rows) {
    lines.push(headers.map((h) => escapeCsv(r[h])).join(','))
  }
  return lines.join('\n')
}

export async function GET(req: NextRequest) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only workspace owner can export
  const { data: ws } = await supabase
    .from('workspaces')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at')
    .limit(1)
    .single()
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const workspaceId = ws.id as string
  const format = req.nextUrl.searchParams.get('format') || 'json'
  const dateStr = new Date().toISOString().slice(0, 10)

  const tableData: Record<string, Row[]> = {}
  await Promise.all(
    TABLES.map(async (t) => {
      tableData[t] = await fetchTable(supabase, t, workspaceId)
    }),
  )

  const totalRecords = Object.values(tableData).reduce((sum, rows) => sum + rows.length, 0)

  if (format === 'csv') {
    // Single text file with CSV sections per table (simpler than zip, no extra deps)
    const parts: string[] = []
    parts.push(`# Tracktio workspace export`)
    parts.push(`# Workspace: ${workspaceId}`)
    parts.push(`# Exported: ${new Date().toISOString()}`)
    parts.push(`# Total records: ${totalRecords}`)
    parts.push('')
    for (const t of TABLES) {
      const rows = tableData[t] || []
      parts.push(`## TABLE: ${t} (${rows.length} rows)`)
      parts.push(toCsv(rows))
      parts.push('')
    }
    const body = parts.join('\n')
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="tracktio-${workspaceId}-${dateStr}.csv"`,
      },
    })
  }

  const exportData = {
    _meta: {
      format: 'tracktio-workspace-export-v1',
      exported_at: new Date().toISOString(),
      exported_by: user.email,
      workspace_id: workspaceId,
      workspace_name: ws.name,
      total_records: totalRecords,
      table_counts: Object.fromEntries(TABLES.map((t) => [t, (tableData[t] || []).length])),
    },
    workspace: ws,
    ...tableData,
  }

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="tracktio-${workspaceId}-${dateStr}.json"`,
    },
  })
}
