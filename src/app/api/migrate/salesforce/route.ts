import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getValidSalesforceToken,
  refreshSalesforceToken,
  type IntegrationRow,
} from '@/lib/integrations/salesforce-token'

function getSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    },
  )
}

async function sfQuery<T>(
  supabase: SupabaseClient,
  row: IntegrationRow,
  soql: string,
): Promise<T[]> {
  const results: T[] = []
  let { access_token, instance_url } = await getValidSalesforceToken(supabase, row)
  let next: string | null =
    `${instance_url}/services/data/v59.0/query?q=${encodeURIComponent(soql)}`
  let guard = 0
  let refreshed = false

  while (next && guard < 20) {
    guard++
    const res: Response = await fetch(next, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
    })
    if (res.status === 401 && !refreshed) {
      // Token may have expired mid-pagination. Refresh once and retry.
      refreshed = true
      const fresh = await refreshSalesforceToken(supabase, row)
      access_token = fresh.access_token
      instance_url = fresh.instance_url
      continue
    }
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Salesforce query failed: ${res.status} ${text.slice(0, 200)}`)
    }
    const json = (await res.json()) as { records: T[]; done?: boolean; nextRecordsUrl?: string }
    results.push(...(json.records || []))
    next = json.done === false && json.nextRecordsUrl
      ? `${instance_url}${json.nextRecordsUrl}`
      : null
  }
  return results
}

interface SFContact { Id: string; Name?: string; Email?: string; Phone?: string; Title?: string }
interface SFAccount { Id: string; Name?: string; Phone?: string; Website?: string; Industry?: string }
interface SFOpportunity { Id: string; Name?: string; Amount?: number; StageName?: string; CloseDate?: string }

export async function POST(request: NextRequest) {
  if (!process.env.SF_CLIENT_ID || !process.env.SF_CLIENT_SECRET) {
    return NextResponse.json(
      { error: 'Salesforce not configured. Set SF_CLIENT_ID and SF_CLIENT_SECRET env vars, then click "Connect Salesforce".' },
      { status: 501 },
    )
  }

  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const { data: integration } = await supabase
    .from('integrations')
    .select('id, workspace_id, key, config')
    .eq('workspace_id', ws.id)
    .eq('key', 'salesforce')
    .eq('enabled', true)
    .maybeSingle()

  if (!integration || !integration.config || !(integration.config as { refresh_token?: string }).refresh_token && !(integration.config as { access_token?: string }).access_token) {
    return NextResponse.json(
      { error: 'Salesforce not connected. Visit /api/migrate/salesforce/start to authorize.' },
      { status: 400 },
    )
  }

  const row = integration as IntegrationRow

  const body = await request.json().catch(() => ({})) as { entities?: string[]; preview?: boolean }
  const entities = body.entities || ['contacts', 'companies', 'deals']
  const preview = Boolean(body.preview)

  const result: Record<string, { imported: number; total: number; errors: string[] }> = {}

  try {
    if (entities.includes('contacts')) {
      const contacts = await sfQuery<SFContact>(
        supabase,
        row,
        'SELECT Id, Name, Email, Phone, Title FROM Contact LIMIT 500',
      )
      const r = { imported: 0, total: contacts.length, errors: [] as string[] }
      if (!preview) {
        for (const c of contacts) {
          const name = c.Name || c.Email || 'Unnamed'
          const { error } = await supabase.from('contacts').insert({
            workspace_id: ws.id,
            name,
            email: c.Email || null,
            phone: c.Phone || null,
            job_title: c.Title || null,
            type: 'person',
            tags: ['salesforce-import'],
            owner_id: user.id,
          })
          if (error) r.errors.push(`${name}: ${error.message}`)
          else r.imported++
        }
      }
      result.contacts = r
    }

    if (entities.includes('companies')) {
      const accounts = await sfQuery<SFAccount>(
        supabase,
        row,
        'SELECT Id, Name, Phone, Website, Industry FROM Account LIMIT 500',
      )
      const r = { imported: 0, total: accounts.length, errors: [] as string[] }
      if (!preview) {
        for (const a of accounts) {
          if (!a.Name) continue
          const { error } = await supabase.from('contacts').insert({
            workspace_id: ws.id,
            name: a.Name,
            phone: a.Phone || null,
            website: a.Website || null,
            type: 'company',
            tags: ['salesforce-import'],
            owner_id: user.id,
          })
          if (error) r.errors.push(`${a.Name}: ${error.message}`)
          else r.imported++
        }
      }
      result.companies = r
    }

    if (entities.includes('deals')) {
      const opps = await sfQuery<SFOpportunity>(
        supabase,
        row,
        'SELECT Id, Name, Amount, StageName, CloseDate FROM Opportunity LIMIT 500',
      )
      const r = { imported: 0, total: opps.length, errors: [] as string[] }
      if (!preview) {
        const { data: firstStage } = await supabase
          .from('pipeline_stages').select('id, pipeline_id').limit(1).single()
        for (const o of opps) {
          if (!o.Name) continue
          const { error } = await supabase.from('deals').insert({
            workspace_id: ws.id,
            title: o.Name,
            value: typeof o.Amount === 'number' ? o.Amount : 0,
            stage_id: firstStage?.id || null,
            pipeline_id: firstStage?.pipeline_id || null,
            close_date: o.CloseDate || null,
            status: 'active',
            owner_id: user.id,
          })
          if (error) r.errors.push(`${o.Name}: ${error.message}`)
          else r.imported++
        }
      }
      result.deals = r
    }

    return NextResponse.json({ ok: true, result })
  } catch (e) {
    console.error('[migrate/salesforce] error', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
