import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import type { DbRow } from '@/types'

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

function sanitizeCSVField(val: unknown): string {
  if (val == null) return ''
  const str = Array.isArray(val) ? val.join('; ') : String(val)
  // Prevent CSV formula injection: prefix dangerous chars with single quote
  const sanitized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str
  return sanitized.includes(',') || sanitized.includes('"') || sanitized.includes('\n')
    ? `"${sanitized.replace(/"/g, '""')}"` : sanitized
}

function toCSV(data: DbRow[]): string {
  if (!data.length) return ''
  const headers = Object.keys(data[0])
  const rows = data.map(row =>
    headers.map(h => sanitizeCSVField(row[h])).join(',')
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
      .select('title, value, currency, status, probability, expected_close_date, created_at')
      .eq('workspace_id', ws.id).order('created_at', { ascending: false })

    const csv = toCSV((data || []).map(d => ({
      title: d.title, value: d.value, currency: d.currency, status: d.status,
      probability: d.probability, expected_close_date: d.expected_close_date,
      created_at: d.created_at,
    })))
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="deals_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  }

  if (type === 'invoices') {
    const { data } = await supabase.from('invoices')
      .select('invoice_number, status, subtotal, total, balance_due, issue_date, due_date, currency, contact_id, contacts(name)')
      .eq('workspace_id', ws.id).order('issue_date', { ascending: false })

    const csv = toCSV((data || []).map((inv: DbRow) => ({
      invoice_number: inv.invoice_number,
      client_name: (inv.contacts as DbRow)?.name || '',
      status: inv.status,
      subtotal: inv.subtotal,
      total: inv.total,
      balance_due: inv.balance_due,
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      currency: inv.currency,
    })))
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="invoices_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  }

  if (type === 'activities') {
    const { data } = await supabase.from('activities')
      .select('title, type, done, due_date, notes, created_at, contact_id, contacts(name)')
      .eq('workspace_id', ws.id).order('created_at', { ascending: false })

    const csv = toCSV((data || []).map((act: DbRow) => ({
      title: act.title,
      type: act.type,
      done: act.done,
      due_date: act.due_date,
      notes: act.notes,
      contact_name: (act.contacts as DbRow)?.name || '',
      created_at: act.created_at,
    })))
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="activities_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  }

  if (type === 'leads') {
    const { data } = await supabase.from('social_leads')
      .select('author_name, author_username, platform, source_type, message, status, created_at')
      .eq('workspace_id', ws.id).order('created_at', { ascending: false })

    const csv = toCSV((data || []).map((lead: DbRow) => ({
      author_name: lead.author_name,
      author_username: lead.author_username,
      platform: lead.platform,
      source_type: lead.source_type,
      message: lead.message,
      status: lead.status,
      created_at: lead.created_at,
    })))
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="leads_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  }

  if (type === 'quotes') {
    const { data } = await supabase.from('quotes')
      .select('quote_number, title, total, status, valid_until, created_at')
      .eq('workspace_id', ws.id).order('created_at', { ascending: false })

    const csv = toCSV((data || []).map((q: DbRow) => ({
      quote_number: q.quote_number,
      title: q.title,
      total: q.total,
      status: q.status,
      valid_until: q.valid_until,
      created_at: q.created_at,
    })))
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="quotes_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  }

  if (type === 'employees') {
    const { data } = await supabase.from('employees')
      .select('employee_number, first_name, last_name, email, department_id, employment_type, salary, status, departments(name)')
      .eq('workspace_id', ws.id).order('last_name')

    const csv = toCSV((data || []).map((emp: DbRow) => ({
      employee_number: emp.employee_number,
      name: `${emp.first_name} ${emp.last_name}`,
      email: emp.email,
      department: (emp.departments as DbRow)?.name || '',
      employment_type: emp.employment_type,
      salary: emp.salary,
      status: emp.status,
    })))
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="employees_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  }

  return NextResponse.json({ error: 'Invalid type. Use contacts, products, deals, invoices, activities, leads, quotes, or employees' }, { status: 400 })
}
