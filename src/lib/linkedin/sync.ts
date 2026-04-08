import { SupabaseClient } from '@supabase/supabase-js'
import { getValidToken } from '@/lib/email/token-manager'

interface LinkedInConnection {
  linkedin_id: string
  first_name: string
  last_name: string
  headline: string
  profile_url: string
  email?: string
  company?: string
  position?: string
}

interface SyncResult {
  connectionsProcessed: number
  contactsCreated: number
  contactsUpdated: number
}

export async function syncLinkedInProfile(
  supabase: SupabaseClient,
  account: { id: string; workspace_id: string; access_token: string; refresh_token?: string; expires_at?: string },
  onTokenRefreshed: (id: string, token: string, expires: Date) => Promise<void>,
): Promise<SyncResult> {
  const accessToken = await getValidToken(account, onTokenRefreshed)
  let contactsCreated = 0
  let contactsUpdated = 0

  // Fetch user's own profile with additional details
  const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!profileRes.ok) {
    throw new Error(`LinkedIn API error: ${profileRes.status}`)
  }

  const profile = await profileRes.json()

  // Note: LinkedIn's basic OAuth (openid profile email) does NOT provide access
  // to connections list. That requires the LinkedIn Marketing APIs or specific
  // partner-level access. For MVP, we sync the authenticated user's profile
  // and create/update their contact record. The real value comes from the
  // user manually importing connections or using LinkedIn's share/messaging webhooks.

  // Upsert the user's own LinkedIn profile as a connection record
  const connectionData = {
    workspace_id: account.workspace_id,
    linkedin_account_id: account.id,
    linkedin_id: profile.sub,
    first_name: profile.given_name || '',
    last_name: profile.family_name || '',
    headline: '',
    profile_url: `https://www.linkedin.com/in/${profile.sub}`,
    email: profile.email || null,
  }

  await supabase.from('linkedin_connections').upsert(connectionData, {
    onConflict: 'linkedin_account_id,linkedin_id',
  })

  // Update last_synced_at
  await supabase.from('linkedin_accounts').update({
    last_synced_at: new Date().toISOString(),
  }).eq('id', account.id)

  return { connectionsProcessed: 1, contactsCreated, contactsUpdated }
}

/**
 * Import a LinkedIn connection as a CRM contact.
 * Called from the UI when user clicks "Import" on a connection.
 */
export async function importLinkedInConnection(
  supabase: SupabaseClient,
  connection: {
    id: string
    workspace_id: string
    first_name: string
    last_name: string
    headline?: string
    email?: string
    company?: string
    position?: string
    profile_url?: string
  },
  userId: string,
): Promise<{ contactId: string }> {
  const name = `${connection.first_name} ${connection.last_name}`.trim()

  // Check if contact exists by email
  if (connection.email) {
    const { data: existing } = await supabase
      .from('contacts')
      .select('id')
      .eq('workspace_id', connection.workspace_id)
      .ilike('email', connection.email)
      .single()

    if (existing) {
      // Update existing contact with LinkedIn data
      await supabase.from('contacts').update({
        company_name: connection.company || undefined,
        job_title: connection.position || undefined,
        website: connection.profile_url || undefined,
      }).eq('id', existing.id)

      await supabase.from('linkedin_connections').update({
        contact_id: existing.id,
      }).eq('id', connection.id)

      return { contactId: existing.id }
    }
  }

  // Create new contact
  const { data: newContact } = await supabase.from('contacts').insert({
    workspace_id: connection.workspace_id,
    type: 'person',
    name,
    email: connection.email || null,
    company_name: connection.company || null,
    job_title: connection.position || null,
    website: connection.profile_url || null,
    tags: ['linkedin', 'auto-imported'],
    notes: connection.headline || null,
    owner_id: userId,
  }).select('id').single()

  if (newContact) {
    await supabase.from('linkedin_connections').update({
      contact_id: newContact.id,
    }).eq('id', connection.id)

    // Log activity
    await supabase.from('activities').insert({
      workspace_id: connection.workspace_id,
      type: 'note',
      title: `Imported from LinkedIn: ${name}`,
      notes: connection.headline || null,
      contact_id: newContact.id,
      owner_id: userId,
      done: true,
    })

    return { contactId: newContact.id }
  }

  throw new Error('Failed to create contact')
}
