import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

/**
 * Server-side auth + permission guard for app pages.
 * Returns user, workspace, and role. Redirects to login if not authenticated.
 */
export async function requireAuth() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: ws } = await supabase.from('workspaces').select('id, enabled_modules').eq('owner_id', user.id).single()
  const { data: profile } = await supabase.from('profiles').select('role, custom_role_id').eq('id', user.id).single()

  let permissions: Record<string, string[]> | null = null
  if (profile?.custom_role_id) {
    const { data: customRole } = await supabase.from('custom_roles').select('permissions').eq('id', profile.custom_role_id).single()
    if (customRole?.permissions) permissions = customRole.permissions as any
  }

  return {
    user,
    supabase,
    workspaceId: ws?.id || '',
    role: profile?.role || 'admin',
    permissions,
    enabledModules: ws?.enabled_modules as Record<string, boolean> | null,
  }
}

/**
 * Check if a module is accessible (enabled + user has permission)
 */
export function canAccessModule(
  module: string,
  enabledModules: Record<string, boolean> | null,
  permissions: Record<string, string[]> | null,
): boolean {
  // Check if module is enabled for workspace
  if (enabledModules && enabledModules[module] === false) return false
  // Check user permissions (null = admin)
  if (permissions && !permissions[module]?.includes('view')) return false
  return true
}
