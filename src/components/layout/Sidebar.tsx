'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Zap, LayoutDashboard, Users, Kanban, CheckSquare, BarChart2, Settings, LogOut, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cn, getInitials } from '@/lib/utils'
import { useState } from 'react'

const NAV = [
  { href: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/pipeline',   icon: Kanban,          label: 'Pipeline' },
  { href: '/contacts',   icon: Users,           label: 'Contacts' },
  { href: '/tasks',      icon: CheckSquare,     label: 'Tasks' },
  { href: '/analytics',  icon: BarChart2,       label: 'Analytics' },
]

interface SidebarProps {
  userEmail: string
  userName: string
  workspaceName: string
}

export default function Sidebar({ userEmail, userName, workspaceName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <aside className="w-60 h-screen bg-white border-r border-surface-100 flex flex-col flex-shrink-0 sticky top-0">
      {/* Logo */}
      <div className="p-4 border-b border-surface-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-brand-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-surface-900 text-sm truncate">{workspaceName || 'FlowCRM'}</p>
            <p className="text-[10px] text-surface-400 font-medium">Free plan</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href} className={cn(active ? 'nav-item-active' : 'nav-item')}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-surface-100 space-y-0.5">
        <Link href="/settings" className={cn(pathname.startsWith('/settings') ? 'nav-item-active' : 'nav-item')}>
          <Settings className="w-4 h-4 flex-shrink-0" />
          <span>Settings</span>
        </Link>

        {/* User menu */}
        <div className="relative">
          <button onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-surface-50 transition-colors">
            <div className="avatar-sm bg-brand-600 flex-shrink-0">
              {getInitials(userName || userEmail)}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-xs font-semibold text-surface-800 truncate">{userName || 'User'}</p>
              <p className="text-[10px] text-surface-400 truncate">{userEmail}</p>
            </div>
            <ChevronDown className={cn('w-3.5 h-3.5 text-surface-400 transition-transform flex-shrink-0', userMenuOpen && 'rotate-180')} />
          </button>

          {userMenuOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-surface-100 rounded-xl shadow-card-hover overflow-hidden animate-fade-in">
              <button onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
