import { toast } from 'sonner'
import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Delete with undo — shows toast with undo button.
 * If user clicks undo within 5 seconds, restores the record.
 */
export async function deleteWithUndo(
  supabase: SupabaseClient,
  table: string,
  id: string,
  label: string,
  onDone: () => void,
) {
  // Soft delete: get the record first
  const { data: record } = await supabase.from(table).select('*').eq('id', id).single()
  if (!record) { toast.error('Record not found'); return }

  // Delete it
  await supabase.from(table).delete().eq('id', id)

  let undone = false

  toast(`${label} deleted`, {
    action: {
      label: 'Undo',
      onClick: async () => {
        undone = true
        const { id: _, created_at, updated_at, ...rest } = record
        await supabase.from(table).insert({ id, ...rest })
        toast.success(`${label} restored`)
        onDone()
      },
    },
    duration: 5000,
    onAutoClose: () => { if (!undone) onDone() },
    onDismiss: () => { if (!undone) onDone() },
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
