import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendTransactionalEmail } from '@/lib/email/transactional'

function getSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

// POST: Generate and send weekly digest for all workspaces (or one)
// Can be triggered by cron: POST /api/digest?secret=CRON_SECRET
export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 })

  // Auth: require cron secret
  const cronSecret = request.nextUrl.searchParams.get('secret')
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const weekAgoISO = weekAgo.toISOString()

  // Get all workspaces with owners
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name, owner_id, profiles(email, full_name)')

  if (!workspaces) return NextResponse.json({ error: 'No workspaces' }, { status: 404 })

  let sent = 0

  for (const ws of workspaces) {
    const profile = ws.profiles as unknown as { email?: string; full_name?: string } | null
    const email = profile?.email
    if (!email) continue

    // Gather KPIs
    const [
      { count: newContacts },
      { count: newDeals },
      { data: wonDeals },
      { count: overdueTasks },
      { data: invoicesPaid },
      { count: activitiesDone },
    ] = await Promise.all([
      supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('workspace_id', ws.id).gte('created_at', weekAgoISO),
      supabase.from('deals').select('id', { count: 'exact', head: true }).eq('workspace_id', ws.id).gte('created_at', weekAgoISO),
      supabase.from('deals').select('id, value').eq('workspace_id', ws.id).eq('status', 'won').gte('updated_at', weekAgoISO),
      supabase.from('activities').select('id', { count: 'exact', head: true }).eq('workspace_id', ws.id).eq('done', false).lte('due_date', now.toISOString()),
      supabase.from('invoices').select('id, total').eq('workspace_id', ws.id).eq('status', 'paid').gte('updated_at', weekAgoISO),
      supabase.from('activities').select('id', { count: 'exact', head: true }).eq('workspace_id', ws.id).eq('done', true).gte('updated_at', weekAgoISO),
    ])

    const wonRevenue = (wonDeals || []).reduce((s, d) => s + (d.value || 0), 0)
    const collected = (invoicesPaid || []).reduce((s, i) => s + (i.total || 0), 0)
    const firstName = (profile?.full_name || '').split(' ')[0] || 'there'

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tracktio.app'

    const { subject, html } = digestEmail({
      firstName,
      workspaceName: ws.name,
      newContacts: newContacts || 0,
      newDeals: newDeals || 0,
      wonDeals: (wonDeals || []).length,
      wonRevenue,
      collected,
      overdueTasks: overdueTasks || 0,
      activitiesDone: activitiesDone || 0,
      appUrl,
    })

    const result = await sendTransactionalEmail({ to: email, subject, html })
    if (result.success) sent++
  }

  return NextResponse.json({ success: true, sent })
}

function digestEmail(data: {
  firstName: string; workspaceName: string;
  newContacts: number; newDeals: number; wonDeals: number; wonRevenue: number;
  collected: number; overdueTasks: number; activitiesDone: number; appUrl: string
}) {
  const { firstName, workspaceName, newContacts, newDeals, wonDeals, wonRevenue, collected, overdueTasks, activitiesDone, appUrl } = data

  const kpis = [
    { label: 'New Contacts', value: String(newContacts), color: '#6172f3' },
    { label: 'New Deals', value: String(newDeals), color: '#8b5cf6' },
    { label: 'Deals Won', value: String(wonDeals), color: '#10b981' },
    { label: 'Revenue Won', value: `$${wonRevenue.toLocaleString()}`, color: '#10b981' },
    { label: 'Collected', value: `$${collected.toLocaleString()}`, color: '#3b82f6' },
    { label: 'Tasks Done', value: String(activitiesDone), color: '#6b75a0' },
  ]

  return {
    subject: `${workspaceName} — Your weekly digest`,
    html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;">
  <div style="text-align:center;margin-bottom:32px;">
    <div style="display:inline-block;width:48px;height:48px;background:linear-gradient(135deg,#6172f3,#3b3fce);border-radius:14px;line-height:48px;color:white;font-size:20px;">⚡</div>
  </div>
  <div style="background:white;border-radius:16px;padding:40px 32px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
    <h1 style="margin:0 0 4px;font-size:22px;color:#151b3a;">Weekly Digest</h1>
    <p style="margin:0 0 24px;color:#6b75a0;font-size:14px;">Hi ${firstName}, here's your ${workspaceName} summary for the past 7 days.</p>

    <table style="width:100%;border-collapse:collapse;">
      ${kpis.map(k => `
      <tr style="border-bottom:1px solid #f0f2f8;">
        <td style="padding:14px 0;color:#6b75a0;font-size:14px;">${k.label}</td>
        <td style="padding:14px 0;text-align:right;font-weight:700;font-size:16px;color:${k.color};">${k.value}</td>
      </tr>`).join('')}
    </table>

    ${overdueTasks > 0 ? `
    <div style="margin-top:20px;padding:14px 16px;background:#fef2f2;border-radius:12px;border-left:4px solid #ef4444;">
      <p style="margin:0;font-size:13px;color:#991b1b;font-weight:600;">⚠️ ${overdueTasks} overdue task${overdueTasks > 1 ? 's' : ''} need your attention</p>
    </div>` : ''}

    <div style="text-align:center;margin-top:28px;">
      <a href="${appUrl}/dashboard" style="display:inline-block;padding:12px 32px;background:#6172f3;color:white;text-decoration:none;border-radius:12px;font-size:14px;font-weight:600;">Open Dashboard</a>
    </div>
  </div>
  <p style="text-align:center;margin-top:24px;color:#9ba3c0;font-size:11px;">
    Tracktio Weekly Digest · <a href="${appUrl}/settings" style="color:#9ba3c0;">Manage notifications</a>
  </p>
</div>
</body></html>`,
  }
}
