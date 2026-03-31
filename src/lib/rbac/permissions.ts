// ============================================================
// RBAC — Role-Based Access Control for ERP modules
// ============================================================

export type Module = 'crm' | 'inventory' | 'invoicing' | 'purchasing' | 'accounting' | 'hr' | 'reports' | 'automations' | 'settings' | 'team'
export type Action = 'view' | 'create' | 'edit' | 'delete' | 'export' | 'approve'
export type Role = 'admin' | 'manager' | 'member' | 'viewer' | 'accountant' | 'sales' | 'warehouse' | 'hr_manager'

interface Permission {
  module: Module
  actions: Action[]
}

// Role → Permission mappings
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    { module: 'crm', actions: ['view', 'create', 'edit', 'delete', 'export', 'approve'] },
    { module: 'inventory', actions: ['view', 'create', 'edit', 'delete', 'export', 'approve'] },
    { module: 'invoicing', actions: ['view', 'create', 'edit', 'delete', 'export', 'approve'] },
    { module: 'purchasing', actions: ['view', 'create', 'edit', 'delete', 'export', 'approve'] },
    { module: 'accounting', actions: ['view', 'create', 'edit', 'delete', 'export', 'approve'] },
    { module: 'hr', actions: ['view', 'create', 'edit', 'delete', 'export', 'approve'] },
    { module: 'reports', actions: ['view', 'export'] },
    { module: 'automations', actions: ['view', 'create', 'edit', 'delete'] },
    { module: 'settings', actions: ['view', 'edit'] },
    { module: 'team', actions: ['view', 'create', 'edit', 'delete'] },
  ],
  manager: [
    { module: 'crm', actions: ['view', 'create', 'edit', 'delete', 'export'] },
    { module: 'inventory', actions: ['view', 'create', 'edit', 'export'] },
    { module: 'invoicing', actions: ['view', 'create', 'edit', 'export', 'approve'] },
    { module: 'purchasing', actions: ['view', 'create', 'edit', 'approve'] },
    { module: 'accounting', actions: ['view', 'export'] },
    { module: 'hr', actions: ['view', 'approve'] },
    { module: 'reports', actions: ['view', 'export'] },
    { module: 'automations', actions: ['view', 'create', 'edit'] },
    { module: 'settings', actions: ['view'] },
    { module: 'team', actions: ['view'] },
  ],
  sales: [
    { module: 'crm', actions: ['view', 'create', 'edit', 'export'] },
    { module: 'inventory', actions: ['view'] },
    { module: 'invoicing', actions: ['view', 'create'] },
    { module: 'reports', actions: ['view'] },
  ],
  accountant: [
    { module: 'invoicing', actions: ['view', 'create', 'edit', 'export', 'approve'] },
    { module: 'accounting', actions: ['view', 'create', 'edit', 'export', 'approve'] },
    { module: 'purchasing', actions: ['view', 'approve'] },
    { module: 'reports', actions: ['view', 'export'] },
    { module: 'hr', actions: ['view'] },
  ],
  warehouse: [
    { module: 'inventory', actions: ['view', 'create', 'edit', 'export'] },
    { module: 'purchasing', actions: ['view', 'edit'] },
  ],
  hr_manager: [
    { module: 'hr', actions: ['view', 'create', 'edit', 'delete', 'approve', 'export'] },
    { module: 'reports', actions: ['view'] },
  ],
  member: [
    { module: 'crm', actions: ['view', 'create', 'edit'] },
    { module: 'inventory', actions: ['view'] },
    { module: 'invoicing', actions: ['view'] },
    { module: 'reports', actions: ['view'] },
  ],
  viewer: [
    { module: 'crm', actions: ['view'] },
    { module: 'inventory', actions: ['view'] },
    { module: 'invoicing', actions: ['view'] },
    { module: 'reports', actions: ['view'] },
  ],
}

/**
 * Check if a role has permission for a specific module+action
 */
export function hasPermission(role: string, module: Module, action: Action): boolean {
  const perms = ROLE_PERMISSIONS[role as Role]
  if (!perms) return false
  const modulePerm = perms.find(p => p.module === module)
  if (!modulePerm) return false
  return modulePerm.actions.includes(action)
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: string): Permission[] {
  return ROLE_PERMISSIONS[role as Role] || []
}

/**
 * Get all modules a role can access
 */
export function getAccessibleModules(role: string): Module[] {
  return getRolePermissions(role).map(p => p.module)
}

/**
 * Get all available roles
 */
export function getAllRoles(): { key: Role; label: string; description: string }[] {
  return [
    { key: 'admin', label: 'Administrator', description: 'Full access to all modules' },
    { key: 'manager', label: 'Manager', description: 'Manage CRM, inventory, invoicing, and purchasing' },
    { key: 'sales', label: 'Sales', description: 'CRM, quotes, and invoices' },
    { key: 'accountant', label: 'Accountant', description: 'Invoicing, accounting, and reports' },
    { key: 'warehouse', label: 'Warehouse', description: 'Inventory and purchasing' },
    { key: 'hr_manager', label: 'HR Manager', description: 'Employee management and payroll' },
    { key: 'member', label: 'Team Member', description: 'Basic CRM and view access' },
    { key: 'viewer', label: 'Viewer', description: 'Read-only access' },
  ]
}

/**
 * Middleware-style permission check for API routes
 */
export function requirePermission(role: string, module: Module, action: Action): { allowed: boolean; error?: string } {
  if (hasPermission(role, module, action)) {
    return { allowed: true }
  }
  return { allowed: false, error: `Permission denied: ${role} cannot ${action} in ${module}` }
}
