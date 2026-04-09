import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Service role supabase — this endpoint is called from webhook context (no user session)
function getServiceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

interface WhatsAppReplyRequest {
  contactId: string
  workspaceId: string
  lastMessages: { body: string; direction: string }[]
}

interface WhatsAppReplyResponse {
  reply: string
  confidence: 'high' | 'medium' | 'low'
  intent: 'greeting' | 'question' | 'interested' | 'scheduling' | 'not_interested' | 'other'
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 501 })
  }

  const supabase = getServiceSupabase()
  if (!supabase) {
    return NextResponse.json({ error: 'Service not configured' }, { status: 503 })
  }

  const body: WhatsAppReplyRequest = await request.json()
  const { contactId, workspaceId, lastMessages } = body

  if (!contactId || !workspaceId || !lastMessages?.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Load workspace config
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name, industry, whatsapp_bot_config')
    .eq('id', workspaceId)
    .single()

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }

  const botConfig = workspace.whatsapp_bot_config as {
    ai_enabled?: boolean
    ai_instructions?: string
    ai_threshold?: string
  } | null

  // Load contact info
  const { data: contact } = await supabase
    .from('contacts')
    .select('name, email, phone, tags, score_label, notes, type')
    .eq('id', contactId)
    .single()

  // Load linked deals for this contact
  const { data: deals } = await supabase
    .from('deals')
    .select('title, value, status, expected_close_date')
    .eq('contact_id', contactId)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(5)

  // Build contact context
  const contactContext = contact
    ? `Contact: ${contact.name}${contact.email ? ` (${contact.email})` : ''}
Tags: ${(contact.tags as string[] | null)?.join(', ') || 'none'}
Score: ${contact.score_label || 'unscored'}
Notes: ${contact.notes || 'none'}
Type: ${contact.type || 'unknown'}`
    : 'Contact info not available'

  const dealsContext = deals?.length
    ? `Linked deals:\n${deals.map(d => `- "${d.title}" | ${d.value ? '$' + d.value : 'no value'} | Status: ${d.status}${d.expected_close_date ? ' | Close: ' + d.expected_close_date : ''}`).join('\n')}`
    : 'No linked deals'

  const customInstructions = botConfig?.ai_instructions || ''

  // Build conversation history for the AI
  const conversationHistory = lastMessages
    .map(m => `${m.direction === 'inbound' ? 'Contact' : 'You'}: ${m.body}`)
    .join('\n')

  const systemPrompt = `You are a sales assistant for ${workspace.name}${workspace.industry ? ` (${workspace.industry} industry)` : ''}. Your job is to pre-qualify leads and schedule appointments via WhatsApp. WhatsApp is the primary communication channel — leads call and message here.${customInstructions ? '\n\nCustom instructions: ' + customInstructions : ''}\n\nBe conversational, friendly, and concise. Use the contact's language. If the contact seems ready, suggest scheduling a call/appointment. Never be pushy.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Here is the context about this contact and their conversation history. Generate a reply.

${contactContext}

${dealsContext}

Conversation:
${conversationHistory}

Respond with JSON only (no markdown wrapping):
{
  "reply": "Your WhatsApp reply message here",
  "confidence": "high|medium|low",
  "intent": "greeting|question|interested|scheduling|not_interested|other"
}

Rules:
- "confidence" should be "high" if the conversation is straightforward (greetings, simple questions, clear interest)
- "confidence" should be "medium" if you're reasonably sure but the topic is nuanced
- "confidence" should be "low" if the message is ambiguous, complex, or potentially sensitive
- Keep the reply short and natural — this is WhatsApp, not email
- Match the language the contact is using`
        }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return NextResponse.json({ error: `AI API error: ${response.status} - ${err}` }, { status: 500 })
    }

    const aiResponse = await response.json()
    const text = aiResponse.content?.[0]?.text || '{}'

    let parsed: WhatsAppReplyResponse
    try {
      const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      parsed = JSON.parse(jsonStr)
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    return NextResponse.json(parsed)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
