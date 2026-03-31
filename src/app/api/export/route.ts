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

function toCSV(data: Record<string, any>[]): string {
  if (!data.length) return ''
  const headers = Object.keys(data[0])
  const rows = data.map(row =>
    headers.map(h => {
      const val = row[h]
      if (val == null) return ''
      const str = Array.isArray(val) ? val.join('; ') : String(val)
      return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str
    }).join(',')
  )
  return [headers.join(','), ...rows].join('\n')
}

export async function GET(request: NextRequest) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const type = request.nextUrl.searchParams.get('type')

  if (type === 'contacts') {
    const { data } = await supabase.from('contacts')
      .select('name, email, phone, type, company_name, job_title, website, notes, tags, engagement_score, score_label, created_at')
      .eq('workspace_id', ws.id).order('name')

    const csv = toCSV((data || []).map(c => ({ ...c, tags: c.tags?.join('; ') || '' })))
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="contacts_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  }

  if (type === 'products') {
    const { data } = await supabase.from('products')
      .select('name, sku, description, unit_price, cost_price, stock_quantity, min_stock, brand, model, barcode, status, tags, created_at')
      .eq('workspace_id', ws.id).order('name')

    const csv = toCSV((data || []).map(p => ({ ...p, tags: p.tags?.join('; ') || '' })))
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="products_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  }

  if (type === 'deals') {
    const { data } = await supabase.from('deals')
      .select('title, value, currency, status, probability, expected_close_date, ai_score, ai_risk, created_at, contacts(name)')
      .eq('workspace_id', ws.id).order('created_at', { ascending: false })

    const csv = toCSV((data || []).map(d => ({
      title: d.title, value: d.value, currency: d.currency, status: d.status,
      probability: d.probability, expected_close_date: d.expected_close_date,
      ai_score: d.ai_score, ai_risk: d.ai_risk,
      contact: (d as any).contacts?.name || '', created_at: d.created_at,
    })))
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="deals_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  }

  return NextResponse.json({ error: 'Invalid type. Use contacts, products, or deals' }, { status: 400 })
}
