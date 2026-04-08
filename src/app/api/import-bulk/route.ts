import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import path from 'path'

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

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"(.*)"$/, '$1'))
  return lines.slice(1).map(line => {
    const values: string[] = []
    let current = ''
    let inQuotes = false
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue }
      if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue }
      current += char
    }
    values.push(current.trim())
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = values[i] || '' })
    return row
  }).filter(row => Object.values(row).some(v => v))
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const results: Record<string, { total?: number; imported?: number; error?: string }> = {}

  // Import contacts
  try {
    const csv = readFileSync(path.join(process.cwd(), 'data/mars_contacts.csv'), 'utf-8')
    const rows = parseCSV(csv)
    let imported = 0
    for (const row of rows) {
      const name = row['Full Name'] || ''
      if (!name) continue
      const { error } = await supabase.from('contacts').upsert({
        workspace_id: ws.id, name,
        email: row['Email'] || null,
        phone: row['Phone'] || null,
        job_title: row['Role / Title'] || null,
        type: 'person', tags: ['imported', 'mars-crm'],
        owner_id: user.id,
      }, { onConflict: 'workspace_id,email' })
      if (!error) imported++
    }
    results.contacts = { total: rows.length, imported }
  } catch (e: unknown) { results.contacts = { error: e instanceof Error ? e.message : 'Unknown error' } }

  // Import companies
  try {
    const csv = readFileSync(path.join(process.cwd(), 'data/mars_companies.csv'), 'utf-8')
    const rows = parseCSV(csv)
    let imported = 0
    for (const row of rows) {
      const name = row['Company Name'] || ''
      if (!name) continue
      const { error } = await supabase.from('contacts').insert({
        workspace_id: ws.id, name,
        email: row['Email'] || null,
        phone: row['Phone'] || null,
        website: row['Client Website (if any)'] || null,
        company_name: name,
        type: 'company',
        tags: ['imported', 'mars-crm'],
        notes: [row['Brief Introduction of Client'], row['Country'], row['City']].filter(Boolean).join(' · ') || null,
        owner_id: user.id,
      })
      if (!error) imported++
    }
    results.companies = { total: rows.length, imported }
  } catch (e: unknown) { results.companies = { error: e instanceof Error ? e.message : 'Unknown error' } }

  // Import products
  try {
    const csv = readFileSync(path.join(process.cwd(), 'data/mars_products.csv'), 'utf-8')
    const rows = parseCSV(csv)
    let imported = 0
    for (const row of rows) {
      const name = row['Name'] || ''
      if (!name) continue
      const { error } = await supabase.from('products').insert({
        workspace_id: ws.id, name,
        unit_price: parseFloat(row['List Price'] || '0') || 0,
        cost_price: 0,
        stock_quantity: 100,
        min_stock: 5,
        status: 'active',
        tags: ['imported', 'mars-crm'],
      })
      if (!error) imported++
    }
    results.products = { total: rows.length, imported }
  } catch (e: unknown) { results.products = { error: e instanceof Error ? e.message : 'Unknown error' } }

  return NextResponse.json({ success: true, results })
}
