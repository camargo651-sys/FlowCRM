// ============================================================
// RBAC — Role-Based Access Control (configurable by admin)
// ============================================================

export type Module = 'crm' | 'inventory' | 'invoicing' | 'purchasing' | 'accounting' | 'hr' | 'reports' | 'automations' | 'settings' | 'team' | 'manufacturing' | 'ecommerce' | 'pos' | 'expenses'
export type Action = 'view' | 'create' | 'edit' | 'delete' | 'export' | 'approve'

export const ALL_MODULES: { key: Module; label: string; icon: string }[] = [
  { key: 'crm', label: 'CRM / Sales', icon: '🔀' },
  { key: 'invoicing', label: 'Invoicing', icon: '🧾' },
  { key: 'inventory', label: 'Inventory', icon: '📦' },
  { key: 'manufacturing', label: 'Manufacturing', icon: '🏭' },
  { key: 'purchasing', label: 'Purchasing', icon: '🚛' },
  { key: 'accounting', label: 'Accounting', icon: '📒' },
  { key: 'hr', label: 'HR & Payroll', icon: '👔' },
  { key: 'expenses', label: 'Expenses', icon: '💰' },
  { key: 'ecommerce', label: 'E-commerce', icon: '🛒' },
  { key: 'pos', label: 'POS', icon: '💳' },
  { key: 'reports', label: 'Reports', icon: '📈' },
  { key: 'automations', label: 'Automations', icon: '⚡' },
  { key: 'settings', label: 'Settings', icon: '⚙️' },
  { key: 'team', label: 'Team', icon: '👥' },
]

export const ALL_ACTIONS: { key: Action; label: string }[] = [
  { key: 'view', label: 'View' },
  { key: 'create', label: 'Create' },
  { key: 'edit', label: 'Edit' },
  { key: 'delete', label: 'Delete' },
  { key: 'export', label: 'Export' },
  { key: 'approve', label: 'Approve' },
]

export const ROLE_TEMPLATES: Record<string, { label: string; description: string; permissions: Record<string, string[]> }> = {
  admin: {
    label: 'Administrator', description: 'Full access to all modules',
    permissions: Object.fromEntries(ALL_MODULES.map(m => [m.key, ALL_ACTIONS.map(a => a.key)])),
  },
  manager: {
    label: 'Manager', description: 'Manage sales, inventory, invoicing, and purchasing',
    permissions: { crm: ['view','create','edit','delete','export'], inventory: ['view','create','edit','export'], invoicing: ['view','create','edit','export','approve'], purchasing: ['view','create','edit','approve'], accounting: ['view','export'], hr: ['view','approve'], reports: ['view','export'], automations: ['view','create','edit'], manufacturing: ['view','create','edit'], ecommerce: ['view','edit'], pos: ['view','create'], expenses: ['view','approve'] },
  },
  sales: {
    label: 'Sales', description: 'CRM, quotes, and invoices',
    permissions: { crm: ['view','create','edit','export'], invoicing: ['view','create'], inventory: ['view'], pos: ['view','create'], reports: ['view'] },
  },
  accountant: {
    label: 'Accountant', description: 'Invoicing, accounting, and reports',
    permissions: { invoicing: ['view','create','edit','export','approve'], accounting: ['view','create','edit','export','approve'], purchasing: ['view','approve'], reports: ['view','export'], hr: ['view'], expenses: ['view','approve','export'] },
  },
  warehouse: {
    label: 'Warehouse', description: 'Inventory and purchasing',
    permissions: { inventory: ['view','create','edit','export'], purchasing: ['view','edit'], manufacturing: ['view','create','edit'] },
  },
  hr_manager: {
    label: 'HR Manager', description: 'Employee management and payroll',
    permissions: { hr: ['view','create','edit','delete','approve','export'], expenses: ['view','approve'], reports: ['view'] },
  },
  viewer: {
    label: 'Viewer', description: 'Read-only access',
    permissions: { crm: ['view'], inventory: ['view'], invoicing: ['view'], reports: ['view'] },
  },
}

export function hasPermission(role: string, module: Module, action: Action, customPermissions?: Record<string, string[]>): boolean {
  if (customPermissions) {
    return customPermissions[module]?.includes(action) || false
  }
  return ROLE_TEMPLATES[role]?.permissions[module]?.includes(action) || false
}

export function getAccessibleModules(permissions: Record<string, string[]>): Module[] {
  return Object.keys(permissions).filter(m => permissions[m]?.includes('view')) as Module[]
}

export function getAllRoles(): { key: string; label: string; description: string }[] {
  return Object.entries(ROLE_TEMPLATES).map(([key, val]) => ({ key, label: val.label, description: val.description }))
}
