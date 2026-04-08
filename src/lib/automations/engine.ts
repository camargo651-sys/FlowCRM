import { SupabaseClient } from '@supabase/supabase-js'
import { sendWhatsAppMessage, decryptToken } from '@/lib/whatsapp/client'

interface Automation {
  id: string
  workspace_id: string
  name: string
  enabled: boolean
  trigger_type: string
  trigger_config: Record<string, string | number | boolean>
  action_type: string
  action_config: Record<string, string | number | boolean | string[]>
}

interface TriggerContext {
  workspaceId: string
  triggerType: string
  contactId?: string
  contactName?: string
  contactPhone?: string
  contactEmail?: string
  dealId?: string
  dealTitle?: string
  dealValue?: number
  stageName?: string
  previousStageName?: string
  quoteId?: string
  quoteTitle?: string
  userId?: string
  metadata?: Record<string, any>
}

/**
 * Fire a trigger and execute matching automations.
 */
export async function fireTrigger(
  supabase: SupabaseClient,
  context: TriggerContext,
) {
  // Find matching automations
  const { data: automations } = await supabase
    .from('automations')
    .select('*')
    .eq('workspace_id', context.workspaceId)
    .eq('trigger_type', context.triggerType)
    .eq('enabled', true)

  if (!automations?.length) return

  for (const automation of automations) {
    // Check trigger conditions
    if (!matchesTriggerConfig(automation, context)) continue

    try {
      await executeAction(supabase, automation, context)

      // Update trigger stats
      await supabase.from('automations').update({
        last_triggered: new Date().toISOString(),
        trigger_count: (automation.trigger_count || 0) + 1,
      }).eq('id', automation.id)
    } catch (err: unknown) {
      console.error(`Automation "${automation.name}" failed:`, err instanceof Error ? err.message : err)
    }
  }
}

function matchesTriggerConfig(automation: Automation, context: TriggerContext): boolean {
  const config = automation.trigger_config || {}

  // Stage-specific trigger: only fire if stage matches
  if (config.stage_name && context.stageName !== config.stage_name) return false

  // Idle days: check if enough days passed
  if (config.idle_days && context.metadata?.daysSinceUpdate < config.idle_days) return false

  return true
}

async function executeAction(
  supabase: SupabaseClient,
  automation: Automation,
  context: TriggerContext,
) {
  const config: Record<string, any> = automation.action_config || {}

  switch (automation.action_type) {
    case 'create_task': {
      const title = interpolateTemplate(config.title || 'Follow up: {{contact_name}}', context)
      const notes = interpolateTemplate(config.notes || '', context)
      const daysFromNow = config.due_in_days || 2

      await supabase.from('activities').insert({
        workspace_id: context.workspaceId,
        type: 'task',
        title,
        notes: notes || null,
        contact_id: context.contactId || null,
        deal_id: context.dealId || null,
        owner_id: context.userId || null,
        done: false,
        due_date: new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString(),
      })
      break
    }

    case 'send_whatsapp': {
      if (!context.contactPhone) break
      const message = interpolateTemplate(config.message || 'Hi {{contact_name}}!', context)

      // Get workspace WhatsApp account
      const { data: waAccount } = await supabase
        .from('whatsapp_accounts')
        .select('*')
        .eq('workspace_id', context.workspaceId)
        .eq('status', 'active')
        .single()

      if (waAccount) {
        const token = decryptToken(waAccount.access_token)
        await sendWhatsAppMessage(token, waAccount.phone_number_id, context.contactPhone, message)

        // Store outbound message
        const { messageId } = { messageId: `auto_${Date.now()}` }
        await supabase.from('whatsapp_messages').insert({
          workspace_id: context.workspaceId,
          whatsapp_account_id: waAccount.id,
          wamid: messageId,
          from_number: waAccount.display_phone || waAccount.phone_number_id,
          to_number: context.contactPhone,
          direction: 'outbound',
          message_type: 'text',
          body: message,
          status: 'sent',
          contact_id: context.contactId || null,
          received_at: new Date().toISOString(),
          metadata: { automation_id: automation.id, automation_name: automation.name },
        })
      }
      break
    }

    case 'send_email': {
      // Placeholder for email sending — requires SMTP or email API integration
      // For now, create a task to remind the user
      const subject = interpolateTemplate(config.subject || 'Follow up with {{contact_name}}', context)
      await supabase.from('activities').insert({
        workspace_id: context.workspaceId,
        type: 'email',
        title: `Send email: ${subject}`,
        notes: interpolateTemplate(config.body || '', context) || null,
        contact_id: context.contactId || null,
        owner_id: context.userId || null,
        done: false,
        due_date: new Date().toISOString(),
      })
      break
    }

    case 'notify_team': {
      // Create a high-priority task as notification
      const title = interpolateTemplate(config.message || 'Notification: {{deal_title}}', context)
      await supabase.from('activities').insert({
        workspace_id: context.workspaceId,
        type: 'task',
        title: `[Auto] ${title}`,
        contact_id: context.contactId || null,
        owner_id: context.userId || null,
        done: false,
        due_date: new Date().toISOString(),
        metadata: { automation_id: automation.id, type: 'notification' },
      })
      break
    }

    case 'update_deal': {
      if (!context.dealId) break
      const updates: Record<string, string> = {}
      if (config.status) updates.status = config.status
      if (config.stage_id) updates.stage_id = config.stage_id
      if (Object.keys(updates).length) {
        await supabase.from('deals').update(updates).eq('id', context.dealId)
      }
      break
    }

    case 'update_contact': {
      if (!context.contactId) break
      const updates: Record<string, string | string[]> = {}
      if (config.tags_add) {
        const { data: contact } = await supabase.from('contacts').select('tags').eq('id', context.contactId).single()
        const currentTags = (contact?.tags || []) as string[]
        updates.tags = Array.from(new Set([...currentTags, ...(config.tags_add as string[])]))
      }
      if (Object.keys(updates).length) {
        await supabase.from('contacts').update(updates).eq('id', context.contactId)
      }
      break
    }

    case 'webhook': {
      if (!config.url) break
      await fetch(config.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          automation: automation.name,
          trigger: context.triggerType,
          contact: { id: context.contactId, name: context.contactName },
          deal: { id: context.dealId, title: context.dealTitle, value: context.dealValue },
          timestamp: new Date().toISOString(),
          ...context.metadata,
        }),
      })
      break
    }
  }
}

function interpolateTemplate(template: string, context: TriggerContext): string {
  return template
    .replace(/\{\{contact_name\}\}/g, context.contactName || '')
    .replace(/\{\{contact_email\}\}/g, context.contactEmail || '')
    .replace(/\{\{deal_title\}\}/g, context.dealTitle || '')
    .replace(/\{\{deal_value\}\}/g, context.dealValue?.toString() || '')
    .replace(/\{\{stage_name\}\}/g, context.stageName || '')
    .replace(/\{\{quote_title\}\}/g, context.quoteTitle || '')
}
