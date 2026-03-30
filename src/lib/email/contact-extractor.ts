import { SupabaseClient } from '@supabase/supabase-js'
import { emitSignal } from '@/lib/ai/signal-emitter'

interface EmailAddress {
  email: string
  name: string
}

interface SyncedMessage {
  provider_message_id: string
  thread_id: string
  subject: string
  snippet: string
  from_address: string
  from_name: string
  to_addresses: EmailAddress[]
  cc_addresses: EmailAddress[]
  received_at: string
  is_read: boolean
  labels: string[]
}

interface ExtractResult {
  messagesStored: number
  contactsCreated: number
  contactsUpdated: number
}

export async function extractContactsAndStore(
  supabase: SupabaseClient,
  messages: SyncedMessage[],
  accountId: string,
  accountEmail: string,
  workspaceId: string,
  userId: string,
  provider: 'gmail' | 'outlook',
): Promise<ExtractResult> {
  let contactsCreated = 0
  let contactsUpdated = 0
  let messagesStored = 0

  // Cache contacts by email to avoid repeated queries
  const contactCache = new Map<string, string>() // email -> contact_id

  for (const msg of messages) {
    // Determine direction
    const direction = msg.from_address.toLowerCase() === accountEmail.toLowerCase()
      ? 'outbound' : 'inbound'

    // Collect all external email addresses from this message
    const allAddresses: EmailAddress[] = []
    if (direction === 'inbound') {
      allAddresses.push({ email: msg.from_address, name: msg.from_name })
    }
    // Add to/cc addresses (excluding the user's own email)
    for (const addr of [...msg.to_addresses, ...msg.cc_addresses]) {
      if (addr.email.toLowerCase() !== accountEmail.toLowerCase()) {
        allAddresses.push(addr)
      }
    }

    // Primary contact = sender for inbound, first recipient for outbound
    const primaryAddress = direction === 'inbound'
      ? { email: msg.from_address, name: msg.from_name }
      : msg.to_addresses.find(a => a.email.toLowerCase() !== accountEmail.toLowerCase()) || null

    let primaryContactId: string | null = null

    // Resolve/create contacts for all addresses
    for (const addr of allAddresses) {
      const emailLower = addr.email.toLowerCase()
      if (!emailLower || emailLower === accountEmail.toLowerCase()) continue

      let contactId = contactCache.get(emailLower)

      if (!contactId) {
        // Check if contact exists
        const { data: existing } = await supabase
          .from('contacts')
          .select('id')
          .eq('workspace_id', workspaceId)
          .ilike('email', emailLower)
          .single()

        if (existing) {
          contactId = existing.id
          contactsUpdated++
        } else {
          // Auto-create contact
          const contactName = addr.name && addr.name !== addr.email.split('@')[0]
            ? addr.name
            : addr.email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

          const { data: newContact } = await supabase
            .from('contacts')
            .insert({
              workspace_id: workspaceId,
              type: 'person',
              name: contactName,
              email: addr.email,
              tags: ['auto-imported', 'email'],
              owner_id: userId,
            })
            .select('id')
            .single()

          if (newContact) {
            contactId = newContact.id
            contactsCreated++
          }
        }

        if (contactId) contactCache.set(emailLower, contactId)
      }

      if (primaryAddress && emailLower === primaryAddress.email.toLowerCase()) {
        primaryContactId = contactId || null
      }
    }

    // Store email message
    const { error: msgError } = await supabase.from('email_messages').upsert({
      workspace_id: workspaceId,
      email_account_id: accountId,
      provider_message_id: msg.provider_message_id,
      thread_id: msg.thread_id,
      subject: msg.subject,
      snippet: msg.snippet.slice(0, 500),
      from_address: msg.from_address,
      from_name: msg.from_name,
      to_addresses: msg.to_addresses,
      cc_addresses: msg.cc_addresses,
      direction,
      received_at: msg.received_at,
      is_read: msg.is_read,
      labels: msg.labels,
      contact_id: primaryContactId,
    }, { onConflict: 'email_account_id,provider_message_id' })

    if (!msgError) messagesStored++

    // Emit engagement signal
    if (primaryContactId) {
      await emitSignal(supabase, {
        workspaceId,
        contactId: primaryContactId,
        signalType: direction === 'inbound' ? 'email_received' : 'email_sent',
        source: provider,
      })
    }

    // Create activity for this email
    if (primaryContactId) {
      await supabase.from('activities').upsert({
        workspace_id: workspaceId,
        type: 'email',
        title: `${direction === 'inbound' ? 'Received' : 'Sent'}: ${(msg.subject || '(No subject)').slice(0, 100)}`,
        notes: msg.snippet.slice(0, 300),
        contact_id: primaryContactId,
        owner_id: userId,
        due_date: msg.received_at,
        done: true,
        metadata: {
          email_message_id: msg.provider_message_id,
          direction,
          provider,
          thread_id: msg.thread_id,
        },
      }, {
        onConflict: 'workspace_id,type,contact_id,due_date',
        ignoreDuplicates: true,
      })
    }
  }

  return { messagesStored, contactsCreated, contactsUpdated }
}
