import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { sendTransactionalEmail, invoiceEmail } from '@/lib/email/transactional'

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

export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const { invoice_id } = await request.json()
  if (!invoice_id) return NextResponse.json({ error: 'Missing invoice_id' }, { status: 400 })

  // Fetch invoice with contact
  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, invoice_number, total, balance_due, due_date, status, client_name, contact_id, contacts(name, email)')
    .eq('id', invoice_id)
    .eq('workspace_id', ws.id)
    .single()

  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const contact = invoice.contacts as { name?: string; email?: string } | null
  const recipientEmail = contact?.email
  const clientName = invoice.client_name || contact?.name || 'Customer'

  if (!recipientEmail) {
    return NextResponse.json({ error: 'Contact has no email address' }, { status: 400 })
  }

  // Generate payment URL if Stripe is configured
  let paymentUrl: string | undefined
  if (process.env.STRIPE_SECRET_KEY) {
    paymentUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/payments/stripe?invoice_id=${invoice_id}`
  }

  // Send email
  const total = `$${(invoice.balance_due || invoice.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  const dueDate = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'On receipt'
  const { subject, html } = invoiceEmail(clientName, invoice.invoice_number, total, dueDate, paymentUrl)

  const result = await sendTransactionalEmail({ to: recipientEmail, subject, html })

  if (result.success) {
    // Update invoice status to sent
    if (invoice.status === 'draft') {
      await supabase.from('invoices').update({ status: 'sent' }).eq('id', invoice_id)
    }

    // Log activity
    await supabase.from('activities').insert({
      workspace_id: ws.id,
      owner_id: user.id,
      contact_id: invoice.contact_id,
      title: `Invoice ${invoice.invoice_number} sent to ${recipientEmail}`,
      type: 'email',
      done: true,
    })

    return NextResponse.json({ success: true, status: 'sent' })
  }

  return NextResponse.json({
    error: result.reason === 'not_configured'
      ? 'Email sending not configured. Add RESEND_API_KEY to enable.'
      : 'Failed to send email',
  }, { status: result.reason === 'not_configured' ? 503 : 500 })
}
