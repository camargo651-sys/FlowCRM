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

interface HubSpotContact {
  id: string
  properties: {
    firstname?: string
    lastname?: string
    email?: string
    phone?: string
    company?: string
    jobtitle?: string
    website?: string
  }
}

interface HubSpotCompany {
  id: string
  properties: {
    name?: string
    domain?: string
    phone?: string
    industry?: string
  }
}

interface HubSpotDeal {
  id: string
  properties: {
    dealname?: string
    amount?: string
    dealstage?: string
    closedate?: string
  }
}

async function fetchAllHubSpot<T>(endpoint: string, apiKey: string, properties: string[]): Promise<T[]> {
  const results: T[] = []
  let after: string | undefined
  const MAX_PAGES = 20 // cap safety
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(`https://api.hubapi.com/crm/v3/objects/${endpoint}`)
    url.searchParams.set('limit', '100')
    url.searchParams.set('properties', properties.join(','))
    if (after) url.searchParams.set('after', after)
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`HubSpot ${endpoint} failed: ${res.status} ${text.slice(0, 200)}`)
    }
    const json = await res.json() as { results: T[]; paging?: { next?: { after?: string } } }
    results.push(...(json.results || []))
    after = json.paging?.next?.after
    if (!after) break
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
      const contacts = await fetchAllHubSpot<HubSpotContact>(
        'contacts', apiKey,
        ['firstname', 'lastname', 'email', 'phone', 'company', 'jobtitle', 'website']
      )
      const r = { imported: 0, total: contacts.length, errors: [] as string[] }
      if (!preview) {
        for (const c of contacts) {
          const p = c.properties
          const name = [p.firstname, p.lastname].filter(Boolean).join(' ').trim() || p.email || 'Unnamed'
          const { error } = await supabase.from('contacts').insert({
            workspace_id: ws.id,
            name,
            email: p.email || null,
            phone: p.phone || null,
            company_name: p.company || null,
            job_title: p.jobtitle || null,
            website: p.website || null,
            type: 'person',
            tags: ['hubspot-import'],
            owner_id: user.id,
          })
          if (error) { r.errors.push(`${name}: ${error.message}`); }
          else r.imported++
        }
      }
      result.contacts = r
    }

    if (entities.includes('companies')) {
      const companies = await fetchAllHubSpot<HubSpotCompany>(
        'companies', apiKey,
        ['name', 'domain', 'phone', 'industry']
      )
      const r = { imported: 0, total: companies.length, errors: [] as string[] }
      if (!preview) {
        for (const co of companies) {
          const p = co.properties
          if (!p.name) continue
          const { error } = await supabase.from('contacts').insert({
            workspace_id: ws.id,
            name: p.name,
            phone: p.phone || null,
            website: p.domain ? `https://${p.domain}` : null,
            type: 'company',
            tags: ['hubspot-import'],
            owner_id: user.id,
          })
          if (error) r.errors.push(`${p.name}: ${error.message}`)
          else r.imported++
        }
      }
      result.companies = r
    }

    if (entities.includes('deals')) {
      const deals = await fetchAllHubSpot<HubSpotDeal>(
        'deals', apiKey,
        ['dealname', 'amount', 'dealstage', 'closedate']
      )
      const r = { imported: 0, total: deals.length, errors: [] as string[] }
      // TODO: map to actual pipeline stage. For now, fetch first stage of default pipeline.
      if (!preview) {
        const { data: firstStage } = await supabase
          .from('pipeline_stages').select('id, pipeline_id').limit(1).single()
        for (const d of deals) {
          const p = d.properties
          if (!p.dealname) continue
          const { error } = await supabase.from('deals').insert({
            workspace_id: ws.id,
            title: p.dealname,
            value: p.amount ? parseFloat(p.amount) : 0,
            stage_id: firstStage?.id || null,
            pipeline_id: firstStage?.pipeline_id || null,
            close_date: p.closedate || null,
            status: 'active',
            owner_id: user.id,
          })
          if (error) r.errors.push(`${p.dealname}: ${error.message}`)
          else r.imported++
        }
      }
      result.deals = r
    }

    return NextResponse.json({ ok: true, result })
  } catch (e) {
    console.error('[migrate/hubspot] error', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
