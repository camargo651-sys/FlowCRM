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
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )
}

interface PipedrivePerson {
  id: number
  name?: string
  email?: { value: string }[]
  phone?: { value: string }[]
  org_name?: string
}

interface PipedriveOrg {
  id: number
  name?: string
  address?: string
}

interface PipedriveDeal {
  id: number
  title?: string
  value?: number
  status?: string
  expected_close_date?: string
}

async function fetchAllPipedrive<T>(endpoint: string, apiToken: string): Promise<T[]> {
  const results: T[] = []
  let start = 0
  const MAX_PAGES = 20
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(`https://api.pipedrive.com/v1/${endpoint}`)
    url.searchParams.set('api_token', apiToken)
    url.searchParams.set('limit', '100')
    url.searchParams.set('start', String(start))
    const res = await fetch(url.toString())
    if (!res.ok) {
      throw new Error(`Pipedrive ${endpoint} failed: ${res.status}`)
    }
    const json = await res.json() as {
      data: T[] | null
      additional_data?: { pagination?: { more_items_in_collection?: boolean; next_start?: number } }
    }
    if (Array.isArray(json.data)) results.push(...json.data)
    const pg = json.additional_data?.pagination
    if (!pg?.more_items_in_collection) break
    start = pg.next_start ?? start + 100
  }
  return results
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const body = await request.json().catch(() => ({})) as { api_key?: string; entities?: string[]; preview?: boolean }
  const apiKey = body.api_key
  const entities = body.entities || ['contacts', 'companies', 'deals']
  const preview = Boolean(body.preview)
  if (!apiKey) return NextResponse.json({ error: 'Missing api_key' }, { status: 400 })

  const result: Record<string, { imported: number; total: number; errors: string[] }> = {}

  try {
    if (entities.includes('contacts')) {
      const persons = await fetchAllPipedrive<PipedrivePerson>('persons', apiKey)
      const r = { imported: 0, total: persons.length, errors: [] as string[] }
      if (!preview) {
        for (const p of persons) {
          if (!p.name) continue
          const { error } = await supabase.from('contacts').insert({
            workspace_id: ws.id,
            name: p.name,
            email: p.email?.[0]?.value || null,
            phone: p.phone?.[0]?.value || null,
            company_name: p.org_name || null,
            type: 'person',
            tags: ['pipedrive-import'],
            owner_id: user.id,
          })
          if (error) r.errors.push(`${p.name}: ${error.message}`)
          else r.imported++
        }
      }
      result.contacts = r
    }

    if (entities.includes('companies')) {
      const orgs = await fetchAllPipedrive<PipedriveOrg>('organizations', apiKey)
      const r = { imported: 0, total: orgs.length, errors: [] as string[] }
      if (!preview) {
        for (const o of orgs) {
          if (!o.name) continue
          const { error } = await supabase.from('contacts').insert({
            workspace_id: ws.id,
            name: o.name,
            address: o.address || null,
            type: 'company',
            tags: ['pipedrive-import'],
            owner_id: user.id,
          })
          if (error) r.errors.push(`${o.name}: ${error.message}`)
          else r.imported++
        }
      }
      result.companies = r
    }

    if (entities.includes('deals')) {
      const deals = await fetchAllPipedrive<PipedriveDeal>('deals', apiKey)
      const r = { imported: 0, total: deals.length, errors: [] as string[] }
      if (!preview) {
        const { data: firstStage } = await supabase
          .from('pipeline_stages').select('id, pipeline_id').limit(1).single()
        for (const d of deals) {
          if (!d.title) continue
          const { error } = await supabase.from('deals').insert({
            workspace_id: ws.id,
            title: d.title,
            value: d.value || 0,
            stage_id: firstStage?.id || null,
            pipeline_id: firstStage?.pipeline_id || null,
            close_date: d.expected_close_date || null,
            status: 'active',
            owner_id: user.id,
          })
          if (error) r.errors.push(`${d.title}: ${error.message}`)
          else r.imported++
        }
      }
      result.deals = r
    }

    return NextResponse.json({ ok: true, result })
  } catch (e) {
    console.error('[migrate/pipedrive] error', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
