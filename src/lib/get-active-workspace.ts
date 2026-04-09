import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Get the active workspace for the current user.
 * Client-side: checks localStorage for saved workspace ID.
 * Falls back to first owned workspace.
 * Uses .limit(1) instead of .single() to avoid 406 errors.
 */
export async function getActiveWorkspace(
  supabase: SupabaseClient,
  userId: string,
  select: string = 'id',
): Promise<any> {
  const activeWsId = typeof window !== 'undefined'
    ? localStorage.getItem('tracktio_active_workspace')
    : null

  if (activeWsId) {
    const { data } = await supabase
      .from('workspaces')
      .select(select)
      .eq('id', activeWsId)
      .eq('owner_id', userId)
      .limit(1)
    if (data?.[0]) return data[0]
  }

  // Fallback: first owned workspace
  const { data } = await supabase
    .from('workspaces')
    .select(select)
    .eq('owner_id', userId)
    .order('created_at')
    .limit(1)

  const ws = data?.[0] || null

  if (ws && typeof window !== 'undefined') {
    const wsId = (ws as unknown as { id: string }).id
    localStorage.setItem('tracktio_active_workspace', wsId)
    document.cookie = `tracktio_ws=${wsId};path=/;max-age=${60*60*24*365};samesite=lax`
  }

  return ws
}
