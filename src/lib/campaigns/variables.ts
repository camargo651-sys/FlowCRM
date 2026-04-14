// Variable catalog used by the visual message editor + send-time interpolation.
// Variables are stored internally as `{{group.field}}` and rendered as friendly
// pills in the editor. At send time the backend interpolates them with real data.

export interface Variable {
  key: string
  label: string
  group: 'contact' | 'company' | 'deal' | 'workspace' | 'date'
}

export const VARIABLES: Variable[] = [
  // Contact
  { key: 'contact.name', label: 'Full name', group: 'contact' },
  { key: 'contact.first_name', label: 'First name', group: 'contact' },
  { key: 'contact.email', label: 'Email', group: 'contact' },
  { key: 'contact.phone', label: 'Phone', group: 'contact' },
  { key: 'contact.tags', label: 'Tags', group: 'contact' },
  // Company
  { key: 'company.name', label: 'Company name', group: 'company' },
  { key: 'company.industry', label: 'Industry', group: 'company' },
  { key: 'company.website', label: 'Website', group: 'company' },
  // Deal
  { key: 'deal.title', label: 'Deal title', group: 'deal' },
  { key: 'deal.value', label: 'Deal value', group: 'deal' },
  { key: 'deal.stage', label: 'Pipeline stage', group: 'deal' },
  { key: 'deal.close_date', label: 'Close date', group: 'deal' },
  // Workspace
  { key: 'workspace.name', label: 'Your company', group: 'workspace' },
  { key: 'workspace.sender_name', label: 'Your name', group: 'workspace' },
  // Date
  { key: 'date.today', label: 'Today', group: 'date' },
  { key: 'date.tomorrow', label: 'Tomorrow', group: 'date' },
]

export const GROUP_META: Record<Variable['group'], { label: string; icon: string; color: string }> = {
  contact:   { label: 'Contact',   icon: '📇', color: 'bg-blue-50 text-blue-700' },
  company:   { label: 'Company',   icon: '🏢', color: 'bg-violet-50 text-violet-700' },
  deal:      { label: 'Deal',      icon: '💼', color: 'bg-emerald-50 text-emerald-700' },
  workspace: { label: 'Your data', icon: '🏠', color: 'bg-amber-50 text-amber-700' },
  date:      { label: 'Date',      icon: '📅', color: 'bg-rose-50 text-rose-700' },
}

export function findVariable(key: string): Variable | null {
  return VARIABLES.find(v => v.key === key) || null
}
