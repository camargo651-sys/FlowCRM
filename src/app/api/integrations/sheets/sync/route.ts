import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, apiSuccess, apiError } from '@/lib/api/auth'
import { syncToSheet } from '@/lib/integrations/google-sheets'
import { z } from 'zod'

const syncSchema = z.object({
  type: z.enum(['leads', 'deals', 'contacts']),
  spreadsheetId: z.string().min(1),
  sheetName: z.string().min(1),
})

export async function POST(request: NextRequest) {
  // Support CRON_SECRET or user auth
  const cronSecret = request.headers.get('x-cron-secret')
  const isCron = cronSecret && cronSecret === process.env.CRON_SECRET

  let supabase: Awaited<ReturnType<typeof authenticateRequest>> extends infer T
    ? T extends Response ? never : T : never
  let workspaceId: string

  if (isCron) {
    // For cron jobs, workspace_id must be in the body or query
    const { createClient } = await import('@supabase/supabase-js')
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const url = new URL(request.url)
    workspaceId = url.searchParams.get('workspace_id') || ''
    if (!workspaceId) return apiError('workspace_id required for cron calls', 400)
    supabase = {
      supabase: adminSupabase,
      workspaceId,
      userId: 'cron',
      role: 'admin',
    } as typeof supabase
  } else {
    const auth = await authenticateRequest(request)
    if (auth instanceof Response) return auth
    supabase = auth
    workspaceId = auth.workspaceId
  }

  let body: z.infer<typeof syncSchema>
  try {
    body = syncSchema.parse(await request.json())
  } catch {
    return apiError('Invalid body: type, spreadsheetId, sheetName required', 400)
  }

  const { type, spreadsheetId, sheetName } = body
  const sb = supabase.supabase

  // Get integration config for access token + last sync timestamp
  const { data: integration } = await sb
    .from('integrations')
    .select('id, config')
    .eq('workspace_id', workspaceId)
    .eq('key', 'google_sheets')
    .single()

  if (!integration) {
    return apiError('Google Sheets integration not configured. Add integration with key "google_sheets" and config.access_token.', 400)
  }

  const config = integration.config as Record<string, unknown>
  const accessToken = config.access_token as string
  if (!accessToken) {
    return apiError('Google Sheets access_token missing in integration config', 400)
  }

  const lastSyncAt = (config.last_sync_at as string) || null

  // Query entity data, only records created/updated since last sync
  let query = sb.from(
    type === 'leads' ? 'social_leads' : type
  ).select('*').eq('workspace_id', workspaceId)

  if (lastSyncAt) {
    query = query.or(`created_at.gte.${lastSyncAt},updated_at.gte.${lastSyncAt}`)
  }

  const { data: records, error: qErr } = await query.order('created_at', { ascending: true }).limit(1000)

  if (qErr) return apiError(`Query failed: ${qErr.message}`, 500)
  if (!records || records.length === 0) {
    return apiSuccess({ synced: 0, message: 'No new records to sync' })
  }

  // Format records as flat string rows
  const rows = records.map(r => {
    const row: Record<string, string> = {}
    for (const [key, val] of Object.entries(r)) {
      row[key] = val === null || val === undefined ? '' : String(val)
    }
    return row
  })

  const result = await syncToSheet({ spreadsheetId, sheetName, accessToken }, rows)

  if (!result.success) {
    return apiError(result.error || 'Sync failed', 502)
  }

  // Update last_sync_at
  await sb
    .from('integrations')
    .update({
      config: { ...config, last_sync_at: new Date().toISOString() },
    })
    .eq('id', integration.id)

  return apiSuccess({
    synced: result.updatedRows,
    type,
    spreadsheetId,
    sheetName,
  })
}
