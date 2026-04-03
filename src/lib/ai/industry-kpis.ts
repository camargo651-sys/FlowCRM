import { SupabaseClient } from '@supabase/supabase-js'

interface KPIResult {
  key: string
  label: string
  value: string | number
  change?: string
  trend?: 'up' | 'down' | 'neutral'
  icon?: string
}

export async function getIndustryKPIs(
  supabase: SupabaseClient,
  workspaceId: string,
  industry: string,
): Promise<KPIResult[]> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const startOfWeek = new Date(now.getTime() - now.getDay() * 24 * 60 * 60 * 1000).toISOString()
  const today = now.toISOString().split('T')[0]

  // Common data
  const [dealsRes, contactsRes, activitiesRes, quotesRes] = await Promise.all([
    supabase.from('deals').select('id, value, status, updated_at, expected_close_date').eq('workspace_id', workspaceId),
    supabase.from('contacts').select('id, engagement_score, score_label, created_at').eq('workspace_id', workspaceId),
    supabase.from('activities').select('id, done, due_date, type').eq('workspace_id', workspaceId),
    supabase.from('quotes').select('id, total, status, view_count').eq('workspace_id', workspaceId),
  ])

  const deals = dealsRes.data || []
  const contacts = contactsRes.data || []
  const activities = activitiesRes.data || []
  const quotes = quotesRes.data || []

  const openDeals = deals.filter(d => d.status === 'open')
  const wonDeals = deals.filter(d => d.status === 'won')
  const hotContacts = contacts.filter(c => c.score_label === 'hot')
  const warmContacts = contacts.filter(c => c.score_label === 'warm')
  const overdueTasks = activities.filter(a => !a.done && a.due_date && new Date(a.due_date) < now)

  // Base KPIs everyone gets
  const baseKPIs: KPIResult[] = [
    {
      key: 'hot_contacts',
      label: 'Hot Contacts',
      value: hotContacts.length,
      icon: '🔥',
      trend: hotContacts.length > 0 ? 'up' : 'neutral',
    },
    {
      key: 'pipeline_value',
      label: 'Pipeline Value',
      value: `$${openDeals.reduce((s, d) => s + (d.value || 0), 0).toLocaleString()}`,
      icon: '💰',
    },
  ]

  // Industry-specific KPIs
  switch (industry) {
    case 'real_estate':
      return [
        { key: 'active_listings', label: 'Active Listings', value: openDeals.length, icon: '🏠' },
        { key: 'viewings_week', label: 'Viewings This Week', value: activities.filter(a => a.type === 'meeting' && a.due_date && a.due_date >= startOfWeek).length, icon: '👁️' },
        { key: 'offers', label: 'Pending Offers', value: openDeals.filter(d => (d as any).pipeline_stages?.name?.includes('Offer')).length, icon: '📝' },
        { key: 'closed', label: 'Closed This Month', value: wonDeals.filter(d => d.updated_at >= startOfMonth).length, icon: '🎉' },
        ...baseKPIs,
      ]

    case 'b2b_sales':
      const avgDealSize = wonDeals.length ? Math.round(wonDeals.reduce((s, d) => s + (d.value || 0), 0) / wonDeals.length) : 0
      const winRate = deals.length ? Math.round(wonDeals.length / deals.length * 100) : 0
      return [
        ...baseKPIs,
        { key: 'avg_deal', label: 'Avg Deal Size', value: `$${avgDealSize.toLocaleString()}`, icon: '📊' },
        { key: 'win_rate', label: 'Win Rate', value: `${winRate}%`, icon: '🎯', trend: winRate > 30 ? 'up' : 'down' },
        { key: 'proposals', label: 'Active Proposals', value: quotes.filter(q => q.status === 'sent').length, icon: '📄' },
        { key: 'quote_views', label: 'Proposal Views', value: quotes.reduce((s, q) => s + (q.view_count || 0), 0), icon: '👁️' },
      ]

    case 'b2c_social':
      const newThisWeek = contacts.filter(c => c.created_at >= startOfWeek).length
      const conversionRate = contacts.length ? Math.round(wonDeals.length / contacts.length * 100) : 0
      return [
        { key: 'new_leads', label: 'New Leads (Week)', value: newThisWeek, icon: '✨', trend: newThisWeek > 5 ? 'up' : 'neutral' },
        { key: 'hot', label: 'Hot Leads', value: hotContacts.length, icon: '🔥' },
        { key: 'conversion', label: 'Conversion Rate', value: `${conversionRate}%`, icon: '📈' },
        ...baseKPIs,
        { key: 'overdue', label: 'Overdue Follow-ups', value: overdueTasks.length, icon: '⚠️', trend: overdueTasks.length > 0 ? 'down' : 'up' },
      ]

    case 'healthcare':
      const appointmentsToday = activities.filter(a => a.type === 'meeting' && a.due_date?.startsWith(today)).length
      return [
        { key: 'appointments', label: 'Appointments Today', value: appointmentsToday, icon: '🏥' },
        { key: 'in_treatment', label: 'In Treatment', value: openDeals.length, icon: '💊' },
        { key: 'completed', label: 'Completed', value: wonDeals.filter(d => d.updated_at >= startOfMonth).length, icon: '✅' },
        { key: 'follow_ups', label: 'Follow-ups Due', value: overdueTasks.length, icon: '📋' },
        ...baseKPIs,
      ]

    case 'distribution':
      const pendingDeliveries = openDeals.filter(d => (d as any).pipeline_stages?.name?.includes('Ship') || (d as any).pipeline_stages?.name?.includes('Preparation')).length
      return [
        { key: 'orders_week', label: 'Orders This Week', value: deals.filter(d => d.updated_at >= startOfWeek && d.status === 'open').length, icon: '📦' },
        { key: 'pending', label: 'Pending Deliveries', value: pendingDeliveries, icon: '🚛' },
        { key: 'delivered', label: 'Delivered This Month', value: wonDeals.filter(d => d.updated_at >= startOfMonth).length, icon: '✅' },
        ...baseKPIs,
      ]

    case 'education':
      const enrolledThisMonth = wonDeals.filter(d => d.updated_at >= startOfMonth).length
      const enrollmentRate = openDeals.length ? Math.round(enrolledThisMonth / (openDeals.length + enrolledThisMonth) * 100) : 0
      return [
        { key: 'inquiries', label: 'New Inquiries', value: contacts.filter(c => c.created_at >= startOfWeek).length, icon: '📩' },
        { key: 'enrolled', label: 'Enrolled (Month)', value: enrolledThisMonth, icon: '🎓' },
        { key: 'rate', label: 'Enrollment Rate', value: `${enrollmentRate}%`, icon: '📊' },
        { key: 'active', label: 'Active Students', value: openDeals.length, icon: '📚' },
        ...baseKPIs,
      ]

    case 'agency':
      const mrr = openDeals.reduce((s, d) => s + (d.value || 0), 0)
      return [
        { key: 'clients', label: 'Active Clients', value: openDeals.length, icon: '🏗️' },
        { key: 'mrr', label: 'Monthly Revenue', value: `$${mrr.toLocaleString()}`, icon: '💰' },
        { key: 'proposals', label: 'Open Proposals', value: quotes.filter(q => q.status === 'sent').length, icon: '📄' },
        ...baseKPIs,
      ]

    default:
      return [
        { key: 'open_deals', label: 'Open Deals', value: openDeals.length, icon: '📊' },
        ...baseKPIs,
        { key: 'won_month', label: 'Won This Month', value: wonDeals.filter(d => d.updated_at >= startOfMonth).length, icon: '🎉' },
        { key: 'overdue', label: 'Overdue Tasks', value: overdueTasks.length, icon: '⚠️' },
        { key: 'quotes', label: 'Pending Quotes', value: quotes.filter(q => q.status === 'sent').length, icon: '📄' },
      ]
  }
}
