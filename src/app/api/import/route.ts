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

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"(.*)"$/, '$1').toLowerCase().replace(/\s+/g, '_'))
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

  const formData = await request.formData()
  const file = formData.get('file') as File
  const type = formData.get('type') as string // 'contacts' | 'products'

  if (!file || !type) return NextResponse.json({ error: 'Missing file or type' }, { status: 400 })

  const text = await file.text()
  const rows = parseCSV(text)
  if (!rows.length) return NextResponse.json({ error: 'No valid rows found' }, { status: 400 })

  let imported = 0
  let skipped = 0
  const errors: string[] = []

  if (type === 'contacts') {
    for (const row of rows) {
      const name = row.name || row.nombre || row.full_name || row.contact_name || ''
      if (!name) { skipped++; continue }

      const email = row.email || row.correo || row.e_mail || ''
      // Skip duplicates by email
      if (email) {
        const { data: existing } = await supabase.from('contacts').select('id').eq('workspace_id', ws.id).ilike('email', email).single()
        if (existing) { skipped++; continue }
      }

      const { error } = await supabase.from('contacts').insert({
        workspace_id: ws.id,
        name,
        email: email || null,
        phone: row.phone || row.telefono || row.tel || row.mobile || null,
        company_name: row.company || row.empresa || row.company_name || row.organization || null,
        job_title: row.job_title || row.title || row.cargo || row.position || null,
        website: row.website || row.web || row.url || null,
        type: (row.type || 'person').toLowerCase() === 'company' ? 'company' : 'person',
        tags: row.tags ? row.tags.split(';').map((t: string) => t.trim()) : ['imported'],
        notes: row.notes || row.notas || null,
        owner_id: user.id,
      })

      if (error) { errors.push(`Row "${name}": ${error.message}`); skipped++ }
      else imported++
    }
  } else if (type === 'products') {
    for (const row of rows) {
      const name = row.name || row.nombre || row.product_name || row.product || ''
      if (!name) { skipped++; continue }

      const { error } = await supabase.from('products').insert({
        workspace_id: ws.id,
        name,
        sku: row.sku || row.codigo || row.code || null,
        description: row.description || row.descripcion || null,
        unit_price: parseFloat(row.price || row.unit_price || row.precio || '0') || 0,
        cost_price: parseFloat(row.cost || row.cost_price || row.costo || '0') || 0,
        stock_quantity: parseInt(row.stock || row.quantity || row.stock_quantity || row.cantidad || '0') || 0,
        min_stock: parseInt(row.min_stock || row.stock_minimo || '0') || 0,
        brand: row.brand || row.marca || null,
        model: row.model || row.modelo || null,
        barcode: row.barcode || row.ean || row.upc || null,
        tags: row.tags ? row.tags.split(';').map((t: string) => t.trim()) : ['imported'],
        status: 'active',
      })

      if (error) { errors.push(`Row "${name}": ${error.message}`); skipped++ }
      else imported++
    }
  } else {
    return NextResponse.json({ error: 'Invalid type. Use contacts or products' }, { status: 400 })
  }

  return NextResponse.json({ imported, skipped, errors: errors.slice(0, 10), total: rows.length })
}
