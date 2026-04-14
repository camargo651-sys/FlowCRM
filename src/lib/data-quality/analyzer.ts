import { SupabaseClient } from '@supabase/supabase-js'

export type Severity = 'low' | 'medium' | 'high'

export interface QualityIssue {
  id: string
  type: string
  count: number
  severity: Severity
  label: string
  action_url: string
}

export interface WorkspaceHealthReport {
  healthScore: number
  totals: {
    contacts: number
    deals: number
    invoices: number
  }
  issues: QualityIssue[]
}

interface ContactRow {
  id: string
  email: string | null
  phone: string | null
  tags: string[] | null
}

interface DealRow {
  id: string
  owner_id: string | null
  expected_close_date: string | null
}

interface InvoiceRow {
  id: string
  status: string | null
  due_date: string | null
}

const STALE_DAYS = 90

/**
 * Analyze data quality for a workspace. Returns a 0-100 health score plus a
 * structured list of issues (each with a deep-link action URL).
 */
export async function analyzeWorkspace(
  workspaceId: string,
  supabase: SupabaseClient,
): Promise<WorkspaceHealthReport> {
  const [
    { data: contacts },
    { data: deals },
    { data: invoices },
    { data: activities },
  ] = await Promise.all([
    supabase.from('contacts').select('id, email, phone, tags').eq('workspace_id', workspaceId),
    supabase.from('deals').select('id, owner_id, expected_close_date').eq('workspace_id', workspaceId),
    supabase.from('invoices').select('id, status, due_date').eq('workspace_id', workspaceId),
    supabase
      .from('activities')
      .select('contact_id, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false }),
  ])

  const contactList = (contacts || []) as ContactRow[]
  const dealList = (deals || []) as DealRow[]
  const invoiceList = (invoices || []) as InvoiceRow[]

  const lastActivity = new Map<string, string>()
  for (const row of (activities || []) as { contact_id: string | null; created_at: string }[]) {
    if (row.contact_id && !lastActivity.has(row.contact_id)) {
      lastActivity.set(row.contact_id, row.created_at)
    }
  }

  const now = Date.now()
  const staleCutoff = now - STALE_DAYS * 24 * 60 * 60 * 1000

  const noEmail = contactList.filter(c => !c.email).length
  const noPhone = contactList.filter(c => !c.phone).length
  const noTags = contactList.filter(c => !c.tags || c.tags.length === 0).length
  const staleContacts = contactList.filter(c => {
    const la = lastActivity.get(c.id)
    if (!la) return true
    return new Date(la).getTime() < staleCutoff
  }).length

  const dealsNoOwner = dealList.filter(d => !d.owner_id).length
  const dealsNoCloseDate = dealList.filter(d => !d.expected_close_date).length

  const overdueNoFollowUp = invoiceList.filter(i => {
    if (!i.due_date) return false
    if (i.status === 'paid' || i.status === 'cancelled') return false
    return new Date(i.due_date).getTime() < now
  }).length

  const totalContacts = contactList.length || 1
  const totalDeals = dealList.length || 1
  const totalInvoices = invoiceList.length || 1

  const issues: QualityIssue[] = [
    {
      id: 'contacts_no_email',
      type: 'contact',
      count: noEmail,
      severity: pctSeverity(noEmail / totalContacts),
      label: 'Contacts missing email',
      action_url: '/contacts?filter=no_email',
    },
    {
      id: 'contacts_no_phone',
      type: 'contact',
      count: noPhone,
      severity: pctSeverity(noPhone / totalContacts),
      label: 'Contacts missing phone',
      action_url: '/contacts?filter=no_phone',
    },
    {
      id: 'contacts_no_tags',
      type: 'contact',
      count: noTags,
      severity: pctSeverity(noTags / totalContacts, 0.5, 0.8),
      label: 'Contacts without tags',
      action_url: '/contacts?filter=no_tags',
    },
    {
      id: 'contacts_stale',
      type: 'contact',
      count: staleContacts,
      severity: pctSeverity(staleContacts / totalContacts, 0.3, 0.6),
      label: `Stale contacts (${STALE_DAYS}+ days no activity)`,
      action_url: '/contacts?filter=stale',
    },
    {
      id: 'deals_no_owner',
      type: 'deal',
      count: dealsNoOwner,
      severity: pctSeverity(dealsNoOwner / totalDeals, 0.05, 0.2),
      label: 'Deals without owner',
      action_url: '/pipeline?filter=no_owner',
    },
    {
      id: 'deals_no_close_date',
      type: 'deal',
      count: dealsNoCloseDate,
      severity: pctSeverity(dealsNoCloseDate / totalDeals, 0.2, 0.5),
      label: 'Deals without close date',
      action_url: '/pipeline?filter=no_close_date',
    },
    {
      id: 'invoices_overdue_no_followup',
      type: 'invoice',
      count: overdueNoFollowUp,
      severity: pctSeverity(overdueNoFollowUp / totalInvoices, 0.05, 0.2),
      label: 'Overdue invoices without follow-up',
      action_url: '/invoices?filter=overdue',
    },
  ]

  const totalIssueCount = issues.reduce((sum, i) => sum + i.count, 0)
  const totalRecords = contactList.length + dealList.length + invoiceList.length
  const ratio = totalRecords === 0 ? 0 : Math.min(1, totalIssueCount / (totalRecords * 3))
  const healthScore = Math.max(0, Math.min(100, Math.round(100 - ratio * 100)))

  return {
    healthScore,
    totals: {
      contacts: contactList.length,
      deals: dealList.length,
      invoices: invoiceList.length,
    },
    issues,
  }
}

function pctSeverity(ratio: number, mid = 0.25, high = 0.5): Severity {
  if (ratio >= high) return 'high'
  if (ratio >= mid) return 'medium'
  return 'low'
}
