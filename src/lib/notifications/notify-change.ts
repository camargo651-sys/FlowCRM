// Helper to notify a record owner that another user updated "their" record.
// Silently no-ops if the editor is the owner, or on network errors.

export interface NotifyRecordChangeArgs {
  entity: string
  entityId: string
  entityTitle: string
  ownerId?: string | null
  editorId?: string | null
  editorName?: string | null
  actionUrl?: string
  workspaceId: string
}

export async function notifyRecordChange(args: NotifyRecordChangeArgs): Promise<void> {
  const {
    entity,
    entityTitle,
    ownerId,
    editorId,
    editorName,
    actionUrl,
    workspaceId,
  } = args

  if (!ownerId || !workspaceId) return
  if (editorId && editorId === ownerId) return

  const name = editorName || 'Alguien'
  const title = `${name} actualizó ${entity}`

  try {
    await fetch('/api/notifications/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: workspaceId,
        user_id: ownerId,
        type: 'record_updated',
        title,
        body: entityTitle,
        priority: 'medium',
        action_url: actionUrl,
      }),
    })
  } catch {
    // swallow — notifications are best-effort
  }
}

export interface NotifyMentionArgs {
  mentionedUserIds: string[]
  entity: string
  entityTitle: string
  authorId?: string | null
  authorName?: string | null
  excerpt: string
  actionUrl?: string
  workspaceId: string
}

export async function notifyMentions(args: NotifyMentionArgs): Promise<void> {
  const {
    mentionedUserIds,
    entity,
    authorId,
    authorName,
    excerpt,
    actionUrl,
    workspaceId,
  } = args

  if (!workspaceId || !mentionedUserIds.length) return
  const name = authorName || 'Alguien'
  const title = `${name} te mencionó en ${entity}`

  await Promise.all(
    mentionedUserIds
      .filter(uid => uid && uid !== authorId)
      .map(uid =>
        fetch('/api/notifications/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_id: workspaceId,
            user_id: uid,
            type: 'mention',
            title,
            body: excerpt,
            priority: 'medium',
            action_url: actionUrl,
          }),
        }).catch(() => {}),
      ),
  )
}
