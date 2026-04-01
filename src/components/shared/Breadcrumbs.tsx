'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'

const LABELS: Record<string, string> = {
  dashboard: 'Dashboard', pipeline: 'Pipeline', contacts: 'Contacts', quotes: 'Quotes',
  invoices: 'Invoices', inventory: 'Inventory', purchasing: 'Purchasing',
  manufacturing: 'Manufacturing', accounting: 'Accounting', expenses: 'Expenses',
  reports: 'Reports', hr: 'HR', tasks: 'Tasks', analytics: 'Analytics',
  pos: 'POS', 'store-orders': 'E-commerce', automations: 'Automations',
  integrations: 'Integrations', settings: 'Settings', company: 'Company',
  modules: 'Modules', roles: 'Roles', team: 'Team', 'api-docs': 'API Docs',
  'audit-log': 'Audit Log',
}

export default function Breadcrumbs() {
  const pathname = usePathname()
  const parts = pathname.split('/').filter(Boolean)

  if (parts.length <= 1) return null

  return (
    <nav className="flex items-center gap-1 text-xs text-surface-400 mb-4">
      <Link href="/dashboard" className="hover:text-surface-600 transition-colors">
        <Home className="w-3 h-3" />
      </Link>
      {parts.map((part, i) => {
        const href = '/' + parts.slice(0, i + 1).join('/')
        const isLast = i === parts.length - 1
        const label = LABELS[part] || part.charAt(0).toUpperCase() + part.slice(1)
        return (
          <span key={href} className="flex items-center gap-1">
            <ChevronRight className="w-3 h-3" />
            {isLast ? (
              <span className="text-surface-700 font-medium">{label}</span>
            ) : (
              <Link href={href} className="hover:text-surface-600 transition-colors">{label}</Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
