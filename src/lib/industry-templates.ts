export interface IndustryTemplate {
  key: string
  name: string
  description: string
  icon: string
  // What "deals" are called in this industry
  dealLabel: { singular: string; plural: string }
  // What "contacts" are called
  contactLabel: { singular: string; plural: string }
  // Pipeline stages specific to this industry
  stages: { name: string; color: string; win?: boolean; lost?: boolean }[]
  // Custom fields that matter for this industry
  customFields: {
    entity: 'deal' | 'contact'
    label: string
    key: string
    type: 'text' | 'number' | 'currency' | 'date' | 'select' | 'boolean' | 'url'
    options?: string[]
  }[]
  // Which modules are relevant
  modules: string[]
  // Dashboard KPIs specific to this industry
  kpis: string[]
  // Suggested automations
  automations: { name: string; trigger: string; action: string }[]
}

const templates: Record<string, IndustryTemplate> = {
  real_estate: {
    key: 'real_estate',
    name: 'Real Estate',
    description: 'Properties, listings, viewings, and closings',
    icon: '🏠',
    dealLabel: { singular: 'Property', plural: 'Properties' },
    contactLabel: { singular: 'Client', plural: 'Clients' },
    stages: [
      { name: 'New Listing', color: '#0891B2' },
      { name: 'Viewing Scheduled', color: '#8b5cf6' },
      { name: 'Viewing Done', color: '#06b6d4' },
      { name: 'Offer Made', color: '#f59e0b' },
      { name: 'Negotiation', color: '#f97316' },
      { name: 'Under Contract', color: '#10b981' },
      { name: 'Closed', color: '#059669', win: true },
      { name: 'Lost / Withdrawn', color: '#ef4444', lost: true },
    ],
    customFields: [
      { entity: 'deal', label: 'Property Type', key: 'property_type', type: 'select', options: ['House', 'Apartment', 'Condo', 'Land', 'Commercial', 'Industrial'] },
      { entity: 'deal', label: 'Address', key: 'address', type: 'text' },
      { entity: 'deal', label: 'Bedrooms', key: 'bedrooms', type: 'number' },
      { entity: 'deal', label: 'Bathrooms', key: 'bathrooms', type: 'number' },
      { entity: 'deal', label: 'Area (sqft/m²)', key: 'area', type: 'number' },
      { entity: 'deal', label: 'Listing URL', key: 'listing_url', type: 'url' },
      { entity: 'contact', label: 'Budget Range', key: 'budget', type: 'currency' },
      { entity: 'contact', label: 'Preferred Zone', key: 'preferred_zone', type: 'text' },
      { entity: 'contact', label: 'Buyer / Seller', key: 'client_type', type: 'select', options: ['Buyer', 'Seller', 'Both', 'Investor'] },
    ],
    modules: ['pipeline', 'contacts', 'tasks', 'analytics', 'integrations'],
    kpis: ['active_listings', 'viewings_this_week', 'offers_pending', 'closed_this_month'],
    automations: [
      { name: 'Viewing reminder', trigger: 'Viewing scheduled', action: 'Send WhatsApp reminder 24h before' },
      { name: 'Follow-up after viewing', trigger: 'Viewing completed', action: 'Create follow-up task for 2 days later' },
      { name: 'New listing notification', trigger: 'New property added', action: 'Notify matching buyers via email' },
    ],
  },

  project_management: {
    key: 'project_management',
    name: 'Project Management',
    description: 'Projects, milestones, deliverables, and timelines',
    icon: '📋',
    dealLabel: { singular: 'Project', plural: 'Projects' },
    contactLabel: { singular: 'Client', plural: 'Clients' },
    stages: [
      { name: 'Proposal', color: '#0891B2' },
      { name: 'Approved', color: '#8b5cf6' },
      { name: 'In Progress', color: '#f59e0b' },
      { name: 'Review', color: '#06b6d4' },
      { name: 'Delivered', color: '#10b981', win: true },
      { name: 'Cancelled', color: '#ef4444', lost: true },
    ],
    customFields: [
      { entity: 'deal', label: 'Project Type', key: 'project_type', type: 'select', options: ['Development', 'Design', 'Consulting', 'Marketing', 'Construction', 'Other'] },
      { entity: 'deal', label: 'Start Date', key: 'start_date', type: 'date' },
      { entity: 'deal', label: 'Deadline', key: 'deadline', type: 'date' },
      { entity: 'deal', label: 'Progress (%)', key: 'progress', type: 'number' },
      { entity: 'deal', label: 'Project Manager', key: 'project_manager', type: 'text' },
      { entity: 'contact', label: 'Industry', key: 'industry', type: 'text' },
      { entity: 'contact', label: 'Contract Type', key: 'contract_type', type: 'select', options: ['Fixed Price', 'Hourly', 'Retainer', 'Milestone-based'] },
    ],
    modules: ['pipeline', 'contacts', 'tasks', 'analytics', 'integrations'],
    kpis: ['active_projects', 'on_time_delivery_rate', 'revenue_this_month', 'overdue_milestones'],
    automations: [
      { name: 'Milestone reminder', trigger: 'Milestone due in 3 days', action: 'Notify project manager' },
      { name: 'Project kickoff', trigger: 'Project approved', action: 'Create default task list' },
      { name: 'Delivery notification', trigger: 'Project marked delivered', action: 'Send satisfaction survey to client' },
    ],
  },

  distribution: {
    key: 'distribution',
    name: 'Distribution / Wholesale',
    description: 'Recurring orders, routes, inventory, and delivery',
    icon: '🚛',
    dealLabel: { singular: 'Order', plural: 'Orders' },
    contactLabel: { singular: 'Customer', plural: 'Customers' },
    stages: [
      { name: 'Quote Requested', color: '#0891B2' },
      { name: 'Quote Sent', color: '#8b5cf6' },
      { name: 'Confirmed', color: '#f59e0b' },
      { name: 'In Preparation', color: '#06b6d4' },
      { name: 'Shipped', color: '#10b981' },
      { name: 'Delivered', color: '#059669', win: true },
      { name: 'Cancelled', color: '#ef4444', lost: true },
    ],
    customFields: [
      { entity: 'deal', label: 'Order Number', key: 'order_number', type: 'text' },
      { entity: 'deal', label: 'Delivery Date', key: 'delivery_date', type: 'date' },
      { entity: 'deal', label: 'Delivery Address', key: 'delivery_address', type: 'text' },
      { entity: 'deal', label: 'Recurring', key: 'is_recurring', type: 'boolean' },
      { entity: 'deal', label: 'Frequency', key: 'frequency', type: 'select', options: ['Weekly', 'Biweekly', 'Monthly', 'Quarterly'] },
      { entity: 'contact', label: 'Route / Zone', key: 'route', type: 'text' },
      { entity: 'contact', label: 'Credit Limit', key: 'credit_limit', type: 'currency' },
      { entity: 'contact', label: 'Payment Terms', key: 'payment_terms', type: 'select', options: ['Cash', 'Net 15', 'Net 30', 'Net 60'] },
      { entity: 'contact', label: 'Average Order Value', key: 'avg_order', type: 'currency' },
    ],
    modules: ['pipeline', 'contacts', 'tasks', 'analytics', 'integrations'],
    kpis: ['orders_this_week', 'recurring_revenue', 'pending_deliveries', 'top_customers'],
    automations: [
      { name: 'Recurring order reminder', trigger: 'Recurring order due', action: 'Create new order and notify customer' },
      { name: 'Delivery confirmation', trigger: 'Order delivered', action: 'Send delivery confirmation via WhatsApp' },
      { name: 'Payment reminder', trigger: 'Invoice overdue 7 days', action: 'Send payment reminder email' },
    ],
  },

  b2b_sales: {
    key: 'b2b_sales',
    name: 'B2B Sales',
    description: 'Enterprise sales with long cycles and multiple stakeholders',
    icon: '🏢',
    dealLabel: { singular: 'Deal', plural: 'Deals' },
    contactLabel: { singular: 'Contact', plural: 'Contacts' },
    stages: [
      { name: 'Prospecting', color: '#64748b' },
      { name: 'Discovery', color: '#0891B2' },
      { name: 'Demo / Meeting', color: '#8b5cf6' },
      { name: 'Proposal Sent', color: '#f59e0b' },
      { name: 'Negotiation', color: '#f97316' },
      { name: 'Contract Review', color: '#06b6d4' },
      { name: 'Closed Won', color: '#10b981', win: true },
      { name: 'Closed Lost', color: '#ef4444', lost: true },
    ],
    customFields: [
      { entity: 'deal', label: 'Decision Maker', key: 'decision_maker', type: 'text' },
      { entity: 'deal', label: 'Competitors', key: 'competitors', type: 'text' },
      { entity: 'deal', label: 'Lead Source', key: 'lead_source', type: 'select', options: ['Website', 'Referral', 'LinkedIn', 'Cold Call', 'Event', 'Partner', 'Other'] },
      { entity: 'deal', label: 'Contract Length', key: 'contract_length', type: 'select', options: ['Monthly', 'Quarterly', 'Annual', '2 Years', '3+ Years'] },
      { entity: 'deal', label: 'MRR / ARR', key: 'mrr', type: 'currency' },
      { entity: 'contact', label: 'Company Size', key: 'company_size', type: 'select', options: ['1-10', '11-50', '51-200', '201-1000', '1000+'] },
      { entity: 'contact', label: 'Decision Role', key: 'decision_role', type: 'select', options: ['Decision Maker', 'Influencer', 'Champion', 'Gatekeeper', 'User'] },
      { entity: 'contact', label: 'LinkedIn', key: 'linkedin', type: 'url' },
    ],
    modules: ['pipeline', 'contacts', 'tasks', 'analytics', 'integrations'],
    kpis: ['pipeline_value', 'avg_deal_size', 'win_rate', 'avg_sales_cycle'],
    automations: [
      { name: 'Follow-up after demo', trigger: 'Demo completed', action: 'Create follow-up task for 2 days later' },
      { name: 'Proposal reminder', trigger: 'Proposal sent, no response in 5 days', action: 'Send follow-up email' },
      { name: 'Won deal handoff', trigger: 'Deal marked won', action: 'Notify onboarding team via Slack' },
    ],
  },

  b2c_social: {
    key: 'b2c_social',
    name: 'B2C / Social Media',
    description: 'High volume leads from social media, fast conversion',
    icon: '📱',
    dealLabel: { singular: 'Lead', plural: 'Leads' },
    contactLabel: { singular: 'Customer', plural: 'Customers' },
    stages: [
      { name: 'New Lead', color: '#0891B2' },
      { name: 'Contacted', color: '#8b5cf6' },
      { name: 'Interested', color: '#f59e0b' },
      { name: 'Quote Sent', color: '#06b6d4' },
      { name: 'Converted', color: '#10b981', win: true },
      { name: 'Not Interested', color: '#ef4444', lost: true },
    ],
    customFields: [
      { entity: 'deal', label: 'Source', key: 'source', type: 'select', options: ['Instagram', 'Facebook', 'TikTok', 'WhatsApp', 'Website', 'Google Ads', 'Referral', 'Other'] },
      { entity: 'deal', label: 'Product/Service', key: 'product', type: 'text' },
      { entity: 'deal', label: 'Urgency', key: 'urgency', type: 'select', options: ['Low', 'Medium', 'High', 'Immediate'] },
      { entity: 'contact', label: 'Instagram', key: 'instagram', type: 'text' },
      { entity: 'contact', label: 'Source Channel', key: 'source_channel', type: 'select', options: ['Instagram', 'Facebook', 'TikTok', 'WhatsApp', 'Website', 'Google Ads'] },
      { entity: 'contact', label: 'First Interaction', key: 'first_interaction', type: 'date' },
    ],
    modules: ['pipeline', 'contacts', 'tasks', 'analytics', 'integrations'],
    kpis: ['new_leads_today', 'response_time_avg', 'conversion_rate', 'leads_by_source'],
    automations: [
      { name: 'Instant response', trigger: 'New lead from social media', action: 'Send automatic WhatsApp greeting' },
      { name: 'No response follow-up', trigger: 'Lead not responded in 24h', action: 'Send follow-up message' },
      { name: 'Hot lead alert', trigger: 'Lead marked as High urgency', action: 'Notify sales team immediately' },
    ],
  },

  agency: {
    key: 'agency',
    name: 'Agency / Multi-client',
    description: 'Manage multiple clients, each with their own pipeline and contacts',
    icon: '🏗️',
    dealLabel: { singular: 'Project', plural: 'Projects' },
    contactLabel: { singular: 'Client', plural: 'Clients' },
    stages: [
      { name: 'Lead', color: '#0891B2' },
      { name: 'Proposal', color: '#8b5cf6' },
      { name: 'Onboarding', color: '#f59e0b' },
      { name: 'Active', color: '#10b981' },
      { name: 'Retainer', color: '#059669', win: true },
      { name: 'Churned', color: '#ef4444', lost: true },
    ],
    customFields: [
      { entity: 'deal', label: 'Service Type', key: 'service_type', type: 'select', options: ['Marketing', 'Development', 'Design', 'SEO', 'Social Media', 'PPC', 'Full Service'] },
      { entity: 'deal', label: 'Monthly Retainer', key: 'monthly_retainer', type: 'currency' },
      { entity: 'deal', label: 'Contract Start', key: 'contract_start', type: 'date' },
      { entity: 'deal', label: 'Contract End', key: 'contract_end', type: 'date' },
      { entity: 'deal', label: 'Account Manager', key: 'account_manager', type: 'text' },
      { entity: 'contact', label: 'Industry', key: 'client_industry', type: 'text' },
      { entity: 'contact', label: 'Website', key: 'client_website', type: 'url' },
      { entity: 'contact', label: 'Monthly Budget', key: 'monthly_budget', type: 'currency' },
    ],
    modules: ['pipeline', 'contacts', 'tasks', 'analytics', 'integrations'],
    kpis: ['active_clients', 'mrr', 'churn_rate', 'avg_client_value'],
    automations: [
      { name: 'Onboarding checklist', trigger: 'Client approved', action: 'Create onboarding task list' },
      { name: 'Monthly report reminder', trigger: 'End of month', action: 'Create report task for each active client' },
      { name: 'Contract renewal alert', trigger: 'Contract ending in 30 days', action: 'Notify account manager' },
    ],
  },

  healthcare: {
    key: 'healthcare',
    name: 'Healthcare / Clinic',
    description: 'Patients, appointments, follow-ups, and treatments',
    icon: '🏥',
    dealLabel: { singular: 'Treatment', plural: 'Treatments' },
    contactLabel: { singular: 'Patient', plural: 'Patients' },
    stages: [
      { name: 'Inquiry', color: '#0891B2' },
      { name: 'Appointment Scheduled', color: '#8b5cf6' },
      { name: 'Consultation Done', color: '#06b6d4' },
      { name: 'Treatment Plan', color: '#f59e0b' },
      { name: 'In Treatment', color: '#f97316' },
      { name: 'Completed', color: '#10b981', win: true },
      { name: 'Cancelled', color: '#ef4444', lost: true },
    ],
    customFields: [
      { entity: 'deal', label: 'Treatment Type', key: 'treatment_type', type: 'text' },
      { entity: 'deal', label: 'Doctor / Specialist', key: 'doctor', type: 'text' },
      { entity: 'deal', label: 'Insurance', key: 'insurance', type: 'text' },
      { entity: 'deal', label: 'Next Appointment', key: 'next_appointment', type: 'date' },
      { entity: 'contact', label: 'Date of Birth', key: 'dob', type: 'date' },
      { entity: 'contact', label: 'Insurance Provider', key: 'insurance_provider', type: 'text' },
      { entity: 'contact', label: 'Allergies', key: 'allergies', type: 'text' },
      { entity: 'contact', label: 'Emergency Contact', key: 'emergency_contact', type: 'text' },
    ],
    modules: ['pipeline', 'contacts', 'tasks', 'analytics', 'integrations'],
    kpis: ['appointments_today', 'patients_in_treatment', 'completed_treatments', 'follow_ups_due'],
    automations: [
      { name: 'Appointment reminder', trigger: 'Appointment in 24h', action: 'Send WhatsApp reminder to patient' },
      { name: 'Follow-up scheduling', trigger: 'Treatment completed', action: 'Create follow-up task for 1 week later' },
      { name: 'Birthday greeting', trigger: 'Patient birthday', action: 'Send birthday greeting via WhatsApp' },
    ],
  },

  education: {
    key: 'education',
    name: 'Education / Training',
    description: 'Students, enrollments, courses, and certifications',
    icon: '🎓',
    dealLabel: { singular: 'Enrollment', plural: 'Enrollments' },
    contactLabel: { singular: 'Student', plural: 'Students' },
    stages: [
      { name: 'Interested', color: '#0891B2' },
      { name: 'Info Sent', color: '#8b5cf6' },
      { name: 'Trial / Demo', color: '#06b6d4' },
      { name: 'Application', color: '#f59e0b' },
      { name: 'Enrolled', color: '#10b981', win: true },
      { name: 'Not Enrolled', color: '#ef4444', lost: true },
    ],
    customFields: [
      { entity: 'deal', label: 'Course / Program', key: 'course', type: 'text' },
      { entity: 'deal', label: 'Start Date', key: 'start_date', type: 'date' },
      { entity: 'deal', label: 'Tuition', key: 'tuition', type: 'currency' },
      { entity: 'deal', label: 'Payment Plan', key: 'payment_plan', type: 'select', options: ['Full Payment', 'Monthly', 'Quarterly', 'Scholarship'] },
      { entity: 'contact', label: 'Age', key: 'age', type: 'number' },
      { entity: 'contact', label: 'Education Level', key: 'education_level', type: 'select', options: ['High School', 'Bachelor', 'Master', 'PhD', 'Other'] },
      { entity: 'contact', label: 'Parent/Guardian', key: 'guardian', type: 'text' },
    ],
    modules: ['pipeline', 'contacts', 'tasks', 'analytics', 'integrations'],
    kpis: ['new_inquiries', 'enrollment_rate', 'active_students', 'revenue_this_month'],
    automations: [
      { name: 'Info packet', trigger: 'New inquiry', action: 'Send course information via email' },
      { name: 'Trial follow-up', trigger: 'Trial class completed', action: 'Send enrollment offer after 2 days' },
      { name: 'Welcome kit', trigger: 'Student enrolled', action: 'Send welcome email with course details' },
    ],
  },

  generic: {
    key: 'generic',
    name: 'General / Other',
    description: 'Standard CRM for any business type',
    icon: '💼',
    dealLabel: { singular: 'Deal', plural: 'Deals' },
    contactLabel: { singular: 'Contact', plural: 'Contacts' },
    stages: [
      { name: 'Lead', color: '#0891B2' },
      { name: 'Qualified', color: '#8b5cf6' },
      { name: 'Proposal', color: '#f59e0b' },
      { name: 'Negotiation', color: '#f97316' },
      { name: 'Closed Won', color: '#10b981', win: true },
      { name: 'Closed Lost', color: '#ef4444', lost: true },
    ],
    customFields: [
      { entity: 'deal', label: 'Lead Source', key: 'lead_source', type: 'select', options: ['Website', 'Referral', 'Social Media', 'Cold Call', 'Event', 'Other'] },
      { entity: 'contact', label: 'LinkedIn', key: 'linkedin', type: 'url' },
    ],
    modules: ['pipeline', 'contacts', 'tasks', 'analytics', 'integrations'],
    kpis: ['open_deals', 'won_revenue', 'conversion_rate', 'overdue_tasks'],
    automations: [
      { name: 'Follow-up reminder', trigger: 'Deal idle for 7 days', action: 'Create follow-up task' },
      { name: 'Won notification', trigger: 'Deal marked won', action: 'Send congratulations to team' },
    ],
  },
}

export const INDUSTRY_LIST = Object.values(templates)

export function getTemplate(key: string): IndustryTemplate {
  return templates[key] || templates.generic
}

export default templates
