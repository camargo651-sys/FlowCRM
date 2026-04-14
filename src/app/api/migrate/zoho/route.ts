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

// Zoho CRM uses OAuth2 access tokens. User must paste one from:
// https://api-console.zoho.com/ (Self Client → generate token with ZohoCRM.modules.ALL scope)
// TODO: proper OAuth2 flow with refresh tokens.

interface ZohoContact {
  id: string
  First_Name?: string
  Last_Name?: string
  Full_Name?: string
  Email?: string
  Phone?: string
  Mobile?: string
  Account_Name?: { name: string } | null
  Title?: string
}

interface ZohoAccount {
  id: string
  Account_Name?: string
  Phone?: string
  Website?: string
}

interface ZohoDeal {
  id: string
  Deal_Name?: string
  Amount?: number
  Stage?: string
  Closing_Date?: string
}

async function fetchAllZoho<T>(module: string, accessToken: string): Promise<T[]> {
  const results: T[] = []
  let page = 1
  const MAX_PAGES = 20
  for (let i = 0; i < MAX_PAGES; i++) {
    const url = new URL(`https://www.zohoapis.com/crm/v2/${module}`)
    url.searchParams.set('page', String(page))
    url.searchParams.set('per_page', '200')
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    })
    if (res.status === 204) break
    if (!res.ok) {
      throw new Error(`Zoho ${module} failed: ${res.status}`)
    }
    const json = await res.json() as { data?: T[]; info?: { more_records?: boolean } }
    if (Array.isArray(json.data)) results.push(...json.data)
    if (!json.info?.more_records) break
    page++
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
  if (!apiKey) return NextResponse.json({ error: 'Missing api_key (Zoho OAuth access token)' }, { status: 400 })

  const result: Record<string, { imported: number; total: number; errors: string[] }> = {}

  try {
    if (entities.includes('contacts')) {
      const contacts = await fetchAllZoho<ZohoContact>('Contacts', apiKey)
      const r = { imported: 0, total: contacts.length, errors: [] as string[] }
      if (!preview) {
        for (const c of contacts) {
          const name = c.Full_Name || [c.First_Name, c.Last_Name].filter(Boolean).join(' ')
          if (!name) continue
          const { error } = await supabase.from('contacts').insert({
            workspace_id: ws.id,
            name,
            email: c.Email || null,
            phone: c.Phone || c.Mobile || null,
            company_name: c.Account_Name?.name || null,
            job_title: c.Title || null,
            type: 'person',
            tags: ['zoho-import'],
            owner_id: user.id,
          })
          if (error) r.errors.push(`${name}: ${error.message}`)
          else r.imported++
        }
      }
      result.contacts = r
    }

    if (entities.includes('companies')) {
      const accounts = await fetchAllZoho<ZohoAccount>('Accounts', apiKey)
      const r = { imported: 0, total: accounts.length, errors: [] as string[] }
      if (!preview) {
        for (const a of accounts) {
          if (!a.Account_Name) continue
          const { error } = await supabase.from('contacts').insert({
            workspace_id: ws.id,
            name: a.Account_Name,
            phone: a.Phone || null,
            website: a.Website || null,
            type: 'company',
            tags: ['zoho-import'],
            owner_id: user.id,
          })
          if (error) r.errors.push(`${a.Account_Name}: ${error.message}`)
          else r.imported++
        }
      }
      result.companies = r
    }

    if (entities.includes('deals')) {
      const deals = await fetchAllZoho<ZohoDeal>('Deals', apiKey)
      const r = { imported: 0, total: deals.length, errors: [] as string[] }
      if (!preview) {
        const { data: firstStage } = await supabase
          .from('pipeline_stages').select('id, pipeline_id').limit(1).single()
        for (const d of deals) {
          if (!d.Deal_Name) continue
          const { error } = await supabase.from('deals').insert({
            workspace_id: ws.id,
            title: d.Deal_Name,
            value: d.Amount || 0,
            stage_id: firstStage?.id || null,
            pipeline_id: firstStage?.pipeline_id || null,
            close_date: d.Closing_Date || null,
            status: 'active',
            owner_id: user.id,
          })
          if (error) r.errors.push(`${d.Deal_Name}: ${error.message}`)
          else r.imported++
        }
      }
      result.deals = r
    }

    return NextResponse.json({ ok: true, result })
  } catch (e) {
    console.error('[migrate/zoho] error', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
