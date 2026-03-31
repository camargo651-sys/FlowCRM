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

function generateInvoiceHTML(invoice: any, items: any[], contact: any, workspace: any) {
  const rows = items.map((item: any) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9">${item.description}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:right">${item.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:right">$${Number(item.unit_price).toLocaleString()}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600">$${Number(item.total).toLocaleString()}</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;margin:0;padding:40px}
    .header{display:flex;justify-content:space-between;margin-bottom:40px}
    .company{font-size:24px;font-weight:800;color:#6172f3}
    .doc-title{font-size:32px;font-weight:800;color:#1e293b;margin-bottom:4px}
    .doc-number{font-size:14px;color:#64748b}
    .meta{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:32px}
    .meta-box{padding:16px;background:#f8fafc;border-radius:8px}
    .meta-label{font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;font-weight:600;margin-bottom:4px}
    .meta-value{font-size:14px;font-weight:600}
    table{width:100%;border-collapse:collapse;margin-bottom:24px}
    th{text-align:left;padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;font-weight:600;border-bottom:2px solid #e2e8f0}
    .totals{margin-left:auto;width:280px}
    .total-row{display:flex;justify-content:space-between;padding:6px 0;font-size:14px}
    .total-final{font-size:20px;font-weight:800;color:#6172f3;border-top:2px solid #e2e8f0;padding-top:12px;margin-top:8px}
    .status{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;text-transform:uppercase}
    .status-paid{background:#d1fae5;color:#059669}
    .status-sent{background:#dbeafe;color:#2563eb}
    .status-draft{background:#f1f5f9;color:#64748b}
    .status-overdue{background:#fee2e2;color:#dc2626}
    .notes{padding:16px;background:#fefce8;border-radius:8px;font-size:13px;color:#854d0e;margin-top:24px}
    .footer{text-align:center;margin-top:40px;color:#94a3b8;font-size:11px}
    @media print{body{padding:20px}@page{margin:1cm}}
  </style></head><body>
    <div class="header">
      <div>
        <div class="company">${workspace?.name || 'Tracktio'}</div>
      </div>
      <div style="text-align:right">
        <div class="doc-title">${invoice.type === 'credit_note' ? 'CREDIT NOTE' : 'INVOICE'}</div>
        <div class="doc-number">${invoice.invoice_number}</div>
        <span class="status status-${invoice.status}">${invoice.status}</span>
      </div>
    </div>
    <div class="meta">
      <div class="meta-box">
        <div class="meta-label">Bill To</div>
        <div class="meta-value">${contact?.name || 'Client'}</div>
        ${contact?.email ? `<div style="font-size:12px;color:#64748b">${contact.email}</div>` : ''}
      </div>
      <div class="meta-box">
        <div class="meta-label">Details</div>
        <div style="font-size:13px"><strong>Issue Date:</strong> ${invoice.issue_date || '—'}</div>
        <div style="font-size:13px"><strong>Due Date:</strong> ${invoice.due_date || '—'}</div>
        <div style="font-size:13px"><strong>Currency:</strong> ${invoice.currency}</div>
      </div>
    </div>
    <table>
      <thead><tr><th>Description</th><th style="text-align:right">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <div class="total-row"><span>Subtotal</span><span>$${Number(invoice.subtotal).toLocaleString()}</span></div>
      ${Number(invoice.discount_value) > 0 ? `<div class="total-row"><span>Discount</span><span style="color:#ef4444">-$${Number(invoice.discount_value).toLocaleString()}</span></div>` : ''}
      ${Number(invoice.tax_amount) > 0 ? `<div class="total-row"><span>Tax</span><span>$${Number(invoice.tax_amount).toLocaleString()}</span></div>` : ''}
      <div class="total-row total-final"><span>Total</span><span>$${Number(invoice.total).toLocaleString()} ${invoice.currency}</span></div>
      ${invoice.amount_paid > 0 ? `<div class="total-row"><span>Paid</span><span style="color:#059669">$${Number(invoice.amount_paid).toLocaleString()}</span></div>` : ''}
      ${invoice.balance_due > 0 ? `<div class="total-row"><span style="font-weight:700">Balance Due</span><span style="font-weight:700;color:#ef4444">$${Number(invoice.balance_due).toLocaleString()}</span></div>` : ''}
    </div>
    ${invoice.notes ? `<div class="notes"><strong>Notes:</strong> ${invoice.notes}</div>` : ''}
    ${invoice.terms ? `<div style="margin-top:16px;font-size:11px;color:#94a3b8"><strong>Terms:</strong> ${invoice.terms}</div>` : ''}
    <div class="footer">Generated by Tracktio</div>
    <script>window.onload=function(){window.print()}</script>
  </body></html>`
}

export async function GET(request: NextRequest) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const type = url.searchParams.get('type') // 'invoice' or 'quote'
  const id = url.searchParams.get('id')
  if (!type || !id) return NextResponse.json({ error: 'Missing type or id' }, { status: 400 })

  const { data: ws } = await supabase.from('workspaces').select('id, name').eq('owner_id', user.id).single()
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  if (type === 'invoice') {
    const { data: invoice } = await supabase.from('invoices').select('*').eq('id', id).eq('workspace_id', ws.id).single()
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

    const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', id).order('order_index')
    let contact = null
    if (invoice.contact_id) {
      const { data: c } = await supabase.from('contacts').select('name, email, phone, company_name').eq('id', invoice.contact_id).single()
      contact = c
    }

    const html = generateInvoiceHTML(invoice, items || [], contact, ws)
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } })
  }

  if (type === 'quote') {
    const { data: quote } = await supabase.from('quotes').select('*').eq('id', id).eq('workspace_id', ws.id).single()
    if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

    const { data: items } = await supabase.from('quote_items').select('*').eq('quote_id', id).order('order_index')
    let contact = null
    if (quote.contact_id) {
      const { data: c } = await supabase.from('contacts').select('name, email, phone, company_name').eq('id', quote.contact_id).single()
      contact = c
    }

    // Reuse invoice HTML template with quote data
    const quoteAsInvoice = {
      ...quote,
      invoice_number: quote.quote_number,
      type: 'quote',
      issue_date: quote.created_at?.split('T')[0],
      due_date: quote.valid_until,
      amount_paid: 0,
      balance_due: 0,
    }
    const html = generateInvoiceHTML(quoteAsInvoice, items || [], contact, ws)
      .replace('INVOICE', 'PROPOSAL')
      .replace('Bill To', 'Prepared For')
      .replace('Issue Date', 'Date')
      .replace('Due Date', 'Valid Until')
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } })
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}
