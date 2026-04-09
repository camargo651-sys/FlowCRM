import { NextRequest } from 'next/server'
import { authenticateRequest, apiSuccess, apiError } from '@/lib/api/auth'
import { addToMailchimpList } from '@/lib/integrations/mailchimp'

/**
 * POST /api/integrations/mailchimp/sync
 * Syncs contacts with email to Mailchimp audience list.
 * Only syncs contacts not already synced (tracked via metadata.mailchimp_synced).
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth instanceof Response) return auth

  // Load Mailchimp integration config
  const { data: integration } = await auth.supabase
    .from('integrations')
    .select('config')
    .eq('workspace_id', auth.workspaceId)
    .eq('key', 'mailchimp')
    .eq('enabled', true)
    .single()

  if (!integration) return apiError('Mailchimp integration not configured or not enabled', 400)

  const config = integration.config as Record<string, string>
  const apiKey = config.api_key
  const listId = config.audience_id || config.list_id

  if (!apiKey || !listId) {
    return apiError('Mailchimp api_key and audience_id are required', 400)
  }

  // Fetch contacts with email that haven't been synced to Mailchimp yet
  const { data: contacts, error } = await auth.supabase
    .from('contacts')
    .select('id, name, email, metadata')
    .eq('workspace_id', auth.workspaceId)
    .not('email', 'is', null)
    .neq('email', '')
    .limit(500)

  if (error) return apiError(`Failed to load contacts: ${error.message}`, 500)
  if (!contacts || contacts.length === 0) {
    return apiSuccess({ synced: 0, skipped: 0, message: 'No contacts with email to sync' })
  }

  // Filter out already-synced contacts
  const unsyncedContacts = contacts.filter(c => {
    const meta = (c.metadata || {}) as Record<string, unknown>
    return !meta.mailchimp_synced
  })

  if (unsyncedContacts.length === 0) {
    return apiSuccess({ synced: 0, skipped: contacts.length, message: 'All contacts already synced' })
  }

  let synced = 0
  let failed = 0
  const errors: string[] = []

  for (const contact of unsyncedContacts) {
    const result = await addToMailchimpList(apiKey, listId, contact.email, contact.name || '')

    if (result.success) {
      // Mark contact as synced
      const existingMeta = (contact.metadata || {}) as Record<string, unknown>
      await auth.supabase
        .from('contacts')
        .update({
          metadata: { ...existingMeta, mailchimp_synced: true, mailchimp_synced_at: new Date().toISOString() },
        })
        .eq('id', contact.id)
      synced++
    } else {
      failed++
      if (errors.length < 5) errors.push(`${contact.email}: ${result.error}`)
    }
  }

  return apiSuccess({
    synced,
    failed,
    skipped: contacts.length - unsyncedContacts.length,
    errors: errors.length > 0 ? errors : undefined,
  })
}
