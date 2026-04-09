import { SupabaseClient } from '@supabase/supabase-js'
import { matchPhoneNumber, normalizePhone, sendWhatsAppMessage, decryptToken } from './client'
import { emitSignal } from '@/lib/ai/signal-emitter'

interface WhatsAppBotConfig {
  enabled: boolean
  greeting: string
  questions: string[]
  qualify_keyword: string
  ai_enabled?: boolean
  ai_instructions?: string
  ai_threshold?: 'high' | 'medium' | 'all'
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

  // 2a. Auto-pause any active sequence enrollments for this contact
  if (contactId) {
    await supabase.from('sequence_enrollments')
      .update({ status: 'replied' })
      .eq('workspace_id', account.workspace_id)
      .eq('contact_id', contactId)
      .eq('status', 'active')
  }

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

  // 2c. AI Auto-Reply for ongoing conversations
  if (contactId && message.body) {
    // Load bot config if not already loaded (it's loaded in 2b only when contactId exists)
    const { data: wsAiConfig } = await supabase
      .from('workspaces')
      .select('whatsapp_bot_config, owner_id')
      .eq('id', account.workspace_id)
      .single()

    const aiBotConfig = wsAiConfig?.whatsapp_bot_config as WhatsAppBotConfig | null
    const workspaceOwnerId = wsAiConfig?.owner_id as string | undefined

    if (aiBotConfig?.ai_enabled) {
      // Check if contact has an active deal — if so, notify human instead
      const { data: activeDeals } = await supabase
        .from('deals')
        .select('id, title')
        .eq('contact_id', contactId)
        .eq('workspace_id', account.workspace_id)
        .eq('status', 'open')
        .limit(1)

      if (activeDeals && activeDeals.length > 0) {
        // Contact has active deal — notify human rep, don't auto-reply
        if (workspaceOwnerId) {
          const preview = message.body.slice(0, 100)
          await supabase.from('notifications').insert({
            workspace_id: account.workspace_id,
            user_id: workspaceOwnerId,
            type: 'whatsapp',
            title: `WhatsApp from ${contactName} (active deal)`,
            body: `${contactName} sent: "${preview}" — Has active deal "${activeDeals[0].title}". Please respond manually.`,
          })
        }
      } else {
        // No active deal — try rule-based reply first, fallback to AI
        const msgLower = (message.body || '').toLowerCase().trim()
        const accessTokenForReply = decryptToken(account.access_token ?? '')
        let ruleBasedReply: string | null = null
        let ruleBasedIntent: string = 'other'

        // Rule-based matching (handles ~70% of messages, 0 AI tokens)
        const greetings = ['hola', 'hello', 'hi', 'hey', 'buenos', 'buenas', 'buen dia', 'good morning', 'good afternoon']
        const yesWords = ['si', 'sí', 'yes', 'ok', 'dale', 'claro', 'por supuesto', 'sure', 'of course', 'perfecto']
        const noWords = ['no', 'no gracias', 'no thanks', 'not interested', 'no me interesa']
        const priceWords = ['precio', 'price', 'costo', 'cost', 'cuanto', 'cuánto', 'how much', 'tarifa', 'rate']
        const scheduleWords = ['cita', 'appointment', 'agendar', 'schedule', 'cuando', 'when', 'disponib', 'availab', 'horario', 'hours']

        if (greetings.some(g => msgLower.startsWith(g))) {
          ruleBasedReply = aiBotConfig.greeting || `¡Hola${contactName ? ' ' + contactName.split(' ')[0] : ''}! Gracias por escribirnos. ¿En qué podemos ayudarte?`
          ruleBasedIntent = 'greeting'
        } else if (noWords.some(n => msgLower === n || msgLower.startsWith(n + ' '))) {
          ruleBasedReply = 'Entendido, gracias por tu tiempo. Si cambias de opinión, aquí estamos. 🙂'
          ruleBasedIntent = 'not_interested'
        } else if (yesWords.some(y => msgLower === y || msgLower.startsWith(y + ' ') || msgLower.endsWith(' ' + y))) {
          ruleBasedReply = '¡Genial! ¿Te gustaría que agendemos una llamada para darte más detalles?'
          ruleBasedIntent = 'interested'
        } else if (priceWords.some(p => msgLower.includes(p))) {
          ruleBasedReply = aiBotConfig.ai_instructions?.includes('precio') || aiBotConfig.ai_instructions?.includes('price')
            ? null // Let AI handle if custom instructions mention pricing
            : 'Con gusto te damos información de precios. ¿Podrías contarme un poco más sobre lo que necesitas para darte una cotización personalizada?'
          ruleBasedIntent = 'question'
        } else if (scheduleWords.some(s => msgLower.includes(s))) {
          ruleBasedReply = '¡Claro! ¿Qué día y horario te funcionan mejor para una llamada o videollamada?'
          ruleBasedIntent = 'scheduling'
        }

        if (ruleBasedReply) {
          // Send rule-based reply (0 AI tokens)
          const { messageId: ruleMsgId } = await sendWhatsAppMessage(
            accessTokenForReply, account.phone_number_id, senderPhone, ruleBasedReply,
          )
          await supabase.from('whatsapp_messages').insert({
            workspace_id: account.workspace_id,
            whatsapp_account_id: account.id,
            wamid: ruleMsgId,
            from_number: account.display_phone || account.phone_number_id,
            to_number: message.from,
            direction: 'outbound',
            message_type: 'text',
            body: ruleBasedReply,
            status: 'sent',
            contact_id: contactId,
            received_at: new Date().toISOString(),
            metadata: { rule_based: true, intent: ruleBasedIntent },
          })
        } else {
        // No rule matched — fallback to AI auto-reply
        // Load last 10 messages for conversation context
        const { data: recentMessages } = await supabase
          .from('whatsapp_messages')
          .select('body, direction')
          .eq('workspace_id', account.workspace_id)
          .eq('contact_id', contactId)
          .not('body', 'is', null)
          .order('received_at', { ascending: false })
          .limit(10)

        const lastMessages = (recentMessages || [])
          .reverse()
          .map(m => ({ body: m.body as string, direction: m.direction as string }))

        if (lastMessages.length > 0) {
          try {
            // Call Anthropic API directly (inline, no internal fetch needed)
            const anthropicKey = process.env.ANTHROPIC_API_KEY
            if (anthropicKey) {
              // Load contact and deals info for context
              const { data: contactInfo } = await supabase
                .from('contacts')
                .select('name, email, phone, tags, score_label, notes, type')
                .eq('id', contactId)
                .single()

              const { data: linkedDeals } = await supabase
                .from('deals')
                .select('title, value, status, expected_close_date')
                .eq('contact_id', contactId)
                .eq('workspace_id', account.workspace_id)
                .order('created_at', { ascending: false })
                .limit(5)

              const { data: wsInfo } = await supabase
                .from('workspaces')
                .select('name, industry')
                .eq('id', account.workspace_id)
                .single()

              const contactContext = contactInfo
                ? `Contact: ${contactInfo.name}${contactInfo.email ? ` (${contactInfo.email})` : ''}\nTags: ${(contactInfo.tags as string[] | null)?.join(', ') || 'none'}\nScore: ${contactInfo.score_label || 'unscored'}\nNotes: ${contactInfo.notes || 'none'}`
                : ''

              const dealsContext = linkedDeals?.length
                ? `Linked deals:\n${linkedDeals.map(d => `- "${d.title}" | ${d.value ? '$' + d.value : 'no value'} | Status: ${d.status}`).join('\n')}`
                : 'No linked deals'

              const conversationHistory = lastMessages
                .map(m => `${m.direction === 'inbound' ? 'Contact' : 'You'}: ${m.body}`)
                .join('\n')

              const customInstructions = aiBotConfig.ai_instructions || ''
              const wsName = wsInfo?.name || 'our company'
              const wsIndustry = wsInfo?.industry || ''

              const systemPrompt = `You are a sales assistant for ${wsName}${wsIndustry ? ` (${wsIndustry} industry)` : ''}. Your job is to pre-qualify leads and schedule appointments via WhatsApp. WhatsApp is the primary communication channel — leads call and message here.${customInstructions ? '\n\nCustom instructions: ' + customInstructions : ''}\n\nBe conversational, friendly, and concise. Use the contact's language. If the contact seems ready, suggest scheduling a call/appointment. Never be pushy.`

              const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-api-key': anthropicKey,
                  'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                  model: 'claude-haiku-4-5-20251001',
                  max_tokens: 500,
                  system: systemPrompt,
                  messages: [{
                    role: 'user',
                    content: `Context:\n${contactContext}\n\n${dealsContext}\n\nConversation:\n${conversationHistory}\n\nRespond with JSON only (no markdown):\n{"reply":"your message","confidence":"high|medium|low","intent":"greeting|question|interested|scheduling|not_interested|other"}\n\nRules:\n- "high" for straightforward messages, "medium" for nuanced, "low" for ambiguous/sensitive\n- Keep reply short and natural — this is WhatsApp\n- Match the contact's language`,
                  }],
                }),
              })

              if (aiResponse.ok) {
                const aiData = await aiResponse.json()
                const text = aiData.content?.[0]?.text || ''
                let parsed: { reply: string; confidence: string; intent: string } | null = null

                try {
                  const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
                  parsed = JSON.parse(jsonStr)
                } catch {
                  // Failed to parse AI response — skip auto-reply
                }

                if (parsed?.reply) {
                  const threshold = aiBotConfig.ai_threshold || 'medium'
                  const shouldSend =
                    threshold === 'all' ||
                    (threshold === 'medium' && (parsed.confidence === 'high' || parsed.confidence === 'medium')) ||
                    (threshold === 'high' && parsed.confidence === 'high')

                  if (shouldSend) {
                    // Send the AI reply
                    const accessToken = decryptToken(account.access_token ?? '')
                    const { messageId: aiMsgId } = await sendWhatsAppMessage(
                      accessToken,
                      account.phone_number_id,
                      senderPhone,
                      parsed.reply,
                    )

                    // Store AI message
                    await supabase.from('whatsapp_messages').insert({
                      workspace_id: account.workspace_id,
                      whatsapp_account_id: account.id,
                      wamid: aiMsgId,
                      from_number: account.display_phone || account.phone_number_id,
                      to_number: message.from,
                      direction: 'outbound',
                      message_type: 'text',
                      body: parsed.reply,
                      status: 'sent',
                      contact_id: contactId,
                      received_at: new Date().toISOString(),
                      metadata: {
                        ai_generated: true,
                        intent: parsed.intent,
                        confidence: parsed.confidence,
                      },
                    })

                    // For medium confidence, also notify the human
                    if (parsed.confidence === 'medium' && workspaceOwnerId) {
                      const replyPreview = parsed.reply.slice(0, 80)
                      await supabase.from('notifications').insert({
                        workspace_id: account.workspace_id,
                        user_id: workspaceOwnerId,
                        type: 'whatsapp',
                        title: `AI replied to ${contactName}`,
                        body: `"${replyPreview}..." — Intent: ${parsed.intent}. Review the conversation.`,
                      })
                    }
                  } else {
                    // Confidence too low — notify human instead of sending
                    if (workspaceOwnerId) {
                      const msgPreview = message.body.slice(0, 100)
                      await supabase.from('notifications').insert({
                        workspace_id: account.workspace_id,
                        user_id: workspaceOwnerId,
                        type: 'whatsapp',
                        title: `New message from ${contactName} needs attention`,
                        body: `"${msgPreview}" — AI confidence too low to auto-reply. Please respond manually.`,
                      })
                    }
                  }
                }
              }
            }
          } catch {
            // AI auto-reply failed silently — don't block message processing
          }
        }
        } // close rule-based else
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
