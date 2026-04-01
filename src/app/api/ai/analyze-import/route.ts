import { createServerClient } from '@supabase/ssr'
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
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 503 })

  const { tables } = await request.json()

  // Build prompt with table schemas and sample data
  const tablesDescription = tables.map((t: any) => {
    const sampleRows = t.rows.slice(0, 3).map((r: any) => {
      const entries = Object.entries(r).slice(0, 10).map(([k, v]) => `${k}: ${String(v).slice(0, 80)}`)
      return entries.join(', ')
    }).join('\n    ')

    return `Table "${t.name}" (${t.rows.length} records, ${t.headers.length} fields):
  Fields: ${t.headers.join(', ')}
  Sample data:
    ${sampleRows}`
  }).join('\n\n')

  const prompt = `Analyze these database tables and determine the best way to import them into an ERP system (Tracktio).

${tablesDescription}

For each table, respond with a JSON array. Each item must have:
- "tableName": the original table name
- "mappedTo": one of "companies", "contacts", "products", "deals", "skip"
- "fieldMapping": object mapping Tracktio field names to source field names
- "notes": brief explanation of what this table contains and what data is useful

Tracktio entities and their fields:
- companies: name, email, phone, website, notes, tags (imported as contacts with type=company)
- contacts: name, email, phone, company_name, job_title, website, notes, tags
- products: name, sku, description, unit_price, cost_price, stock_quantity, brand, model
- deals: title, value, status, notes, expected_close_date (value = monetary amount)

Important rules:
- Map ALL tables that have useful data, don't skip unless it's truly config/system data
- For deals/projects: "value" should map to budget, total price, or similar monetary field
- Combine multiple source fields into "notes" when they contain useful context
- If a table has items/products WITHIN deals (like a BOM or quote items), mention it in notes
- Respond with ONLY valid JSON array, no markdown

JSON:`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'AI API error' }, { status: 500 })
    }

    const aiRes = await res.json()
    const text = aiRes.content?.[0]?.text || '[]'
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const analysis = JSON.parse(jsonStr)

    return NextResponse.json({ analysis })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
