import { SupabaseClient } from '@supabase/supabase-js'
import { matchPhoneNumber, normalizePhone, sendWhatsAppMessage, decryptToken } from './client'
import { emitSignal } from '@/lib/ai/signal-emitter'

interface WhatsAppBotConfig {
  enabled: boolean
  greeting: string
  questions: string[]
  qualify_keyword: string
}

interface InboundMessage {
  wamid: string
  from: string
  timestamp: string
  type: string
  body?: string
  profileName?: string
  conversationId?: string
}

export async function processInboundWhatsAppMessage(
  supabase: SupabaseClient,
  message: InboundMessage,
  account: {
    id: string
    workspace_id: string
    user_id: string
    phone_number_id: string
    display_phone?: string
    access_token?: string
  },
) {
  const senderPhone = normalizePhone(message.from)

  // 1. Resolve contact by phone number
  let contactId: string | null = null
  let contactName = message.profileName || senderPhone

  // Check WhatsApp contacts cache first
  const { data: waContact } = await supabase
    .from('whatsapp_contacts')
    .select('contact_id')
    .eq('workspace_id', account.workspace_id)
    .eq('wa_id', senderPhone)
    .single()

  if (waContact?.contact_id) {
    contactId = waContact.contact_id
  } else {
    // Search CRM contacts by phone (fuzzy match)
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, phone, name')
      .eq('workspace_id', account.workspace_id)
      .not('phone', 'is', null)

    const matched = (contacts || []).find(c => c.phone && matchPhoneNumber(c.phone, message.from))

    if (matched) {
      contactId = matched.id
      contactName = matched.name
    } else {
      // Auto-create contact
      const name = message.profileName || `+${senderPhone}`
      const { data: newContact } = await supabase
        .from('contacts')
        .insert({
          workspace_id: account.workspace_id,
          type: 'person',
          name,
          phone: `+${senderPhone}`,
          tags: ['auto-imported', 'whatsapp'],
          owner_id: account.user_id,
        })
        .select('id')
        .single()

      if (newContact) {
        contactId = newContact.id
        contactName = name
      }
    }

    // Cache the mapping
    if (contactId) {
      await supabase.from('whatsapp_contacts').upsert({
        workspace_id: account.workspace_id,
        wa_id: senderPhone,
        profile_name: message.profileName || null,
        contact_id: contactId,
      }, { onConflict: 'workspace_id,wa_id' })
    }
  }

  // 2. Store message
  await supabase.from('whatsapp_messages').upsert({
    workspace_id: account.workspace_id,
    whatsapp_account_id: account.id,
    wamid: message.wamid,
    conversation_id: message.conversationId || null,
    from_number: message.from,
    to_number: account.display_phone || account.phone_number_id,
    direction: 'inbound',
    message_type: message.type,
    body: message.body || null,
    status: 'delivered',
    contact_id: contactId,
    received_at: new Date(parseInt(message.timestamp) * 1000).toISOString(),
  }, { onConflict: 'whatsapp_account_id,wamid' })

  // 2b. WhatsApp Bot Auto-Reply for first-time contacts
  if (contactId) {
    const { data: wsConfig } = await supabase
      .from('workspaces')
      .select('whatsapp_bot_config')
      .eq('id', account.workspace_id)
      .single()

    const botConfig = wsConfig?.whatsapp_bot_config as WhatsAppBotConfig | null

    if (botConfig?.enabled) {
      // Check if this is the contact's first inbound message
      const { count } = await supabase
        .from('whatsapp_messages')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', account.workspace_id)
        .eq('contact_id', contactId)
        .eq('direction', 'inbound')

      if (count === 1) {
        // This is the first message - send bot auto-reply
        const accessToken = decryptToken(account.access_token ?? '')
        const greetingText = botConfig.greeting || 'Hi! Thanks for contacting us.'

        // Send greeting
        const { messageId: greetingMsgId } = await sendWhatsAppMessage(
          accessToken,
          account.phone_number_id,
          senderPhone,
          greetingText,
        )

        // Store greeting in whatsapp_messages
        await supabase.from('whatsapp_messages').insert({
          workspace_id: account.workspace_id,
          whatsapp_account_id: account.id,
          wamid: greetingMsgId,
          from_number: account.display_phone || account.phone_number_id,
          to_number: message.from,
          direction: 'outbound',
          message_type: 'text',
          body: greetingText,
          status: 'sent',
          contact_id: contactId,
          received_at: new Date().toISOString(),
        })

        // Send qualification questions if configured
        if (botConfig.questions && botConfig.questions.length > 0) {
          const questionsText = botConfig.questions
            .map((q, i) => `${i + 1}. ${q}`)
            .join('\n')

          const { messageId: questionsMsgId } = await sendWhatsAppMessage(
            accessToken,
            account.phone_number_id,
            senderPhone,
            questionsText,
          )

          await supabase.from('whatsapp_messages').insert({
            workspace_id: account.workspace_id,
            whatsapp_account_id: account.id,
            wamid: questionsMsgId,
            from_number: account.display_phone || account.phone_number_id,
            to_number: message.from,
            direction: 'outbound',
            message_type: 'text',
            body: questionsText,
            status: 'sent',
            contact_id: contactId,
            received_at: new Date().toISOString(),
          })
        }
      }
    }
  }

  // 3. Log activity
  if (contactId) {
    const preview = (message.body || `[${message.type}]`).slice(0, 80)
    await supabase.from('activities').insert({
      workspace_id: account.workspace_id,
      type: 'whatsapp',
      title: `WhatsApp from ${contactName}: ${preview}`,
      notes: message.body?.slice(0, 500) || null,
      contact_id: contactId,
      owner_id: account.user_id,
      due_date: new Date(parseInt(message.timestamp) * 1000).toISOString(),
      done: true,
      metadata: {
        wamid: message.wamid,
        direction: 'inbound',
        from_number: message.from,
        message_type: message.type,
      },
    })
  }

  // 4. Emit engagement signal
  if (contactId) {
    await emitSignal(supabase, {
      workspaceId: account.workspace_id,
      contactId,
      signalType: 'whatsapp_received',
      source: 'whatsapp',
    })
  }

  // 5. Update last_webhook_at
  await supabase.from('whatsapp_accounts').update({
    last_webhook_at: new Date().toISOString(),
  }).eq('id', account.id)
}
