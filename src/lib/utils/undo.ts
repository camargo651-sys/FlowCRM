import { toast } from 'sonner'
import { SupabaseClient } from '@supabase/supabase-js'
import { pushUndoAction } from '@/lib/undo/stack'

/**
 * Soft-delete with undo — marks `deleted_at` and shows undo toast.
 * Tables must have a `deleted_at timestamptz` column.
 */
export async function deleteWithUndo(
  supabase: SupabaseClient,
  table: string,
  id: string,
  label: string,
  onDone: () => void,
) {
  const { error } = await supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) { toast.error('Delete failed'); return }

  onDone()

  pushUndoAction({
    label: `${label} deleted`,
    undo: async () => {
      await supabase.from(table).update({ deleted_at: null }).eq('id', id)
      onDone()
    },
  })
}

/**
 * Bulk soft-delete with undo
 */
export async function bulkDeleteWithUndo(
  supabase: SupabaseClient,
  table: string,
  ids: string[],
  label: string,
  onDone: () => void,
) {
  if (ids.length === 0) return
  const { error } = await supabase.from(table).update({ deleted_at: new Date().toISOString() }).in('id', ids)
  if (error) { toast.error('Delete failed'); return }

  onDone()

  pushUndoAction({
    label: `${ids.length} ${label} deleted`,
    undo: async () => {
      await supabase.from(table).update({ deleted_at: null }).in('id', ids)
      onDone()
    },
  })
}

/**
 * Confirm before destructive action
 */
export function confirmAction(message: string, action: () => void) {
  toast(message, {
    action: { label: 'Confirm', onClick: action },
    cancel: { label: 'Cancel', onClick: () => {} },
    duration: 10000,
  })
}
