import { toast } from 'sonner'

/**
 * Universal undo stack — in-memory (no persistence).
 *
 * Any destructive/reversible action can register an undo handler here
 * and receive a sonner toast with an "Undo" button. After `timeoutMs`,
 * the undo handler is discarded.
 */

export interface UndoAction {
  id: string
  label: string
  undo: () => Promise<void> | void
  timeoutMs?: number
  createdAt: number
}

const stack: Map<string, UndoAction> = new Map()

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function pushUndoAction(opts: {
  label: string
  undo: () => Promise<void> | void
  timeoutMs?: number
}): string {
  const id = uid()
  const action: UndoAction = {
    id,
    label: opts.label,
    undo: opts.undo,
    timeoutMs: opts.timeoutMs ?? 5000,
    createdAt: Date.now(),
  }
  stack.set(id, action)

  let undone = false
  const runUndo = async () => {
    const entry = stack.get(id)
    if (!entry || undone) return
    undone = true
    stack.delete(id)
    try {
      await entry.undo()
      toast.success('Restored')
    } catch {
      toast.error('Undo failed')
    }
  }

  toast(opts.label, {
    action: { label: 'Undo', onClick: runUndo },
    duration: action.timeoutMs,
    onAutoClose: () => { stack.delete(id) },
    onDismiss: () => { stack.delete(id) },
  })

  // Hard timeout safety net in case toast callbacks don't fire
  setTimeout(() => { stack.delete(id) }, (action.timeoutMs ?? 5000) + 500)

  return id
}

export function getPendingUndoCount(): number {
  return stack.size
}

export function clearUndoStack(): void {
  stack.clear()
}
