import { describe, it, expect } from 'vitest'
import { hasPermission, getRolePermissions, getAccessibleModules, getAllRoles } from '@/lib/rbac/permissions'

describe('RBAC Permissions', () => {
  describe('admin role', () => {
    it('has access to all modules', () => {
      expect(hasPermission('admin', 'crm', 'view')).toBe(true)
      expect(hasPermission('admin', 'crm', 'create')).toBe(true)
      expect(hasPermission('admin', 'crm', 'delete')).toBe(true)
      expect(hasPermission('admin', 'accounting', 'approve')).toBe(true)
      expect(hasPermission('admin', 'hr', 'edit')).toBe(true)
      expect(hasPermission('admin', 'settings', 'edit')).toBe(true)
    })
  })

  describe('sales role', () => {
    it('can view and create in CRM', () => {
      expect(hasPermission('sales', 'crm', 'view')).toBe(true)
      expect(hasPermission('sales', 'crm', 'create')).toBe(true)
      expect(hasPermission('sales', 'crm', 'edit')).toBe(true)
    })

    it('cannot delete in CRM', () => {
      expect(hasPermission('sales', 'crm', 'delete')).toBe(false)
    })

    it('cannot access HR', () => {
      expect(hasPermission('sales', 'hr', 'view')).toBe(false)
    })

    it('cannot access accounting', () => {
      expect(hasPermission('sales', 'accounting', 'view')).toBe(false)
    })

    it('can view inventory but not edit', () => {
      expect(hasPermission('sales', 'inventory', 'view')).toBe(true)
      expect(hasPermission('sales', 'inventory', 'edit')).toBe(false)
    })
  })

  describe('accountant role', () => {
    it('has full access to invoicing and accounting', () => {
      expect(hasPermission('accountant', 'invoicing', 'create')).toBe(true)
      expect(hasPermission('accountant', 'invoicing', 'approve')).toBe(true)
      expect(hasPermission('accountant', 'accounting', 'create')).toBe(true)
      expect(hasPermission('accountant', 'accounting', 'export')).toBe(true)
    })

    it('cannot access CRM', () => {
      expect(hasPermission('accountant', 'crm', 'view')).toBe(false)
    })

    it('can view HR but not edit', () => {
      expect(hasPermission('accountant', 'hr', 'view')).toBe(true)
      expect(hasPermission('accountant', 'hr', 'edit')).toBe(false)
    })
  })

  describe('warehouse role', () => {
    it('can manage inventory', () => {
      expect(hasPermission('warehouse', 'inventory', 'view')).toBe(true)
      expect(hasPermission('warehouse', 'inventory', 'create')).toBe(true)
      expect(hasPermission('warehouse', 'inventory', 'edit')).toBe(true)
    })

    it('cannot access CRM or accounting', () => {
      expect(hasPermission('warehouse', 'crm', 'view')).toBe(false)
      expect(hasPermission('warehouse', 'accounting', 'view')).toBe(false)
    })
  })

  describe('viewer role', () => {
    it('can only view, never create/edit/delete', () => {
      expect(hasPermission('viewer', 'crm', 'view')).toBe(true)
      expect(hasPermission('viewer', 'crm', 'create')).toBe(false)
      expect(hasPermission('viewer', 'crm', 'edit')).toBe(false)
      expect(hasPermission('viewer', 'crm', 'delete')).toBe(false)
    })
  })

  describe('invalid role', () => {
    it('has no permissions', () => {
      expect(hasPermission('nonexistent', 'crm', 'view')).toBe(false)
    })
  })

  describe('getAllRoles', () => {
    it('returns 8 roles', () => {
      expect(getAllRoles()).toHaveLength(8)
    })
  })

  describe('getAccessibleModules', () => {
    it('admin has access to all modules', () => {
      const modules = getAccessibleModules('admin')
      expect(modules).toContain('crm')
      expect(modules).toContain('accounting')
      expect(modules).toContain('hr')
      expect(modules).toContain('settings')
    })

    it('warehouse only has inventory and purchasing', () => {
      const modules = getAccessibleModules('warehouse')
      expect(modules).toContain('inventory')
      expect(modules).toContain('purchasing')
      expect(modules).not.toContain('crm')
      expect(modules).not.toContain('hr')
    })
  })
})
