import { SupabaseClient } from '@supabase/supabase-js'
import { sendWhatsAppMessage, decryptToken } from '@/lib/whatsapp/client'
import { sendSMS } from '@/lib/integrations/twilio'

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

interface AutomationStep {
  id: string
  automation_id: string
  step_order: number
  action_type: string
  action_config: Record<string, any>
  delay_minutes: number
  condition_field: string | null
  condition_operator: string | null
  condition_value: string | null
}

interface AutomationExecution {
  id: string
  automation_id: string
  workspace_id: string
  trigger_context: TriggerContext
  current_step: number
  status: 'running' | 'completed' | 'failed' | 'paused'
  next_run_at: string | null
  started_at: string
  completed_at: string | null
  log: Array<{ step: number; action: string; status: string; timestamp: string; message?: string }>
}

export interface TriggerContext {
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
  leadId?: string
  leadName?: string
  leadPlatform?: string
  leadMessage?: string
  userId?: string
  metadata?: Record<string, any>
}

/**
 * Fire a trigger and execute matching automations.
 * Backward compatible — delegates to fireMultiStepTrigger internally.
 */
export async function fireTrigger(
  supabase: SupabaseClient,
  context: TriggerContext,
) {
  return fireMultiStepTrigger(supabase, context)
}

/**
 * Fire a trigger with multi-step workflow support.
 * If automation has steps → creates execution and runs step-by-step.
 * If no steps → executes single action (legacy behavior).
 */
export async function fireMultiStepTrigger(
  supabase: SupabaseClient,
  context: TriggerContext,
) {
  const { data: automations } = await supabase
    .from('automations')
    .select('*')
    .eq('workspace_id', context.workspaceId)
    .eq('trigger_type', context.triggerType)
    .eq('enabled', true)

  if (!automations?.length) return

  for (const automation of automations) {
    if (!matchesTriggerConfig(automation, context)) continue

    try {
      // Check if automation has multi-step workflow
      const { data: steps } = await supabase
        .from('automation_steps')
        .select('*')
        .eq('automation_id', automation.id)
        .order('step_order', { ascending: true })

      if (steps && steps.length > 0) {
        // Multi-step workflow
        await startMultiStepExecution(supabase, automation, steps, context)
      } else {
        // Legacy single-action execution
        await executeAction(supabase, automation, context)
      }

      await supabase.from('automations').update({
        last_triggered: new Date().toISOString(),
        trigger_count: (automation.trigger_count || 0) + 1,
      }).eq('id', automation.id)
    } catch (err: unknown) {
      // Silently fail for individual automations
    }
  }
}

/**
 * Start a multi-step execution: create execution record, run first step.
 */
async function startMultiStepExecution(
  supabase: SupabaseClient,
  automation: Automation,
  steps: AutomationStep[],
  context: TriggerContext,
) {
  const { data: execution } = await supabase.from('automation_executions').insert({
    automation_id: automation.id,
    workspace_id: context.workspaceId,
    trigger_context: context,
    current_step: 0,
    status: 'running',
    log: [],
  }).select().single()

  if (!execution) return

  await runStep(supabase, automation, steps, execution as AutomationExecution, 0)
}

/**
 * Run a specific step in the workflow.
 */
async function runStep(
  supabase: SupabaseClient,
  automation: Automation,
  steps: AutomationStep[],
  execution: AutomationExecution,
  stepIndex: number,
) {
  if (stepIndex >= steps.length) {
    // All steps done
    await supabase.from('automation_executions').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      current_step: stepIndex,
    }).eq('id', execution.id)
    return
  }

  const step = steps[stepIndex]
  const context = execution.trigger_context
  const log = Array.isArray(execution.log) ? [...execution.log] : []

  // If step has a delay, schedule it for later
  if (step.delay_minutes > 0 && stepIndex === execution.current_step) {
    const nextRun = new Date(Date.now() + step.delay_minutes * 60 * 1000)
    await supabase.from('automation_executions').update({
      current_step: stepIndex,
      next_run_at: nextRun.toISOString(),
    }).eq('id', execution.id)
    return // Will be picked up by cron/processScheduledSteps
  }

  // Evaluate condition if present
  if (step.condition_field && step.condition_operator) {
    const conditionMet = evaluateCondition(step, context)
    if (!conditionMet) {
      log.push({
        step: stepIndex,
        action: step.action_type,
        status: 'skipped',
        timestamp: new Date().toISOString(),
        message: `Condition not met: ${step.condition_field} ${step.condition_operator} ${step.condition_value || ''}`,
      })
      await supabase.from('automation_executions').update({
        current_step: stepIndex + 1,
        log,
      }).eq('id', execution.id)
      // Advance to next step
      execution.log = log
      execution.current_step = stepIndex + 1
      await runStep(supabase, automation, steps, execution, stepIndex + 1)
      return
    }
  }

  // Execute the step action using a temporary automation-like object
  try {
    const stepAutomation: Automation = {
      ...automation,
      action_type: step.action_type,
      action_config: step.action_config || {},
    }
    await executeAction(supabase, stepAutomation, context)

    log.push({
      step: stepIndex,
      action: step.action_type,
      status: 'success',
      timestamp: new Date().toISOString(),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    log.push({
      step: stepIndex,
      action: step.action_type,
      status: 'failed',
      timestamp: new Date().toISOString(),
      message,
    })
    await supabase.from('automation_executions').update({
      status: 'failed',
      log,
      current_step: stepIndex,
    }).eq('id', execution.id)
    return
  }

  // Advance to next step
  const nextIndex = stepIndex + 1
  await supabase.from('automation_executions').update({
    current_step: nextIndex,
    log,
  }).eq('id', execution.id)

  execution.log = log
  execution.current_step = nextIndex

  // Check if next step has a delay
  if (nextIndex < steps.length && steps[nextIndex].delay_minutes > 0) {
    const nextRun = new Date(Date.now() + steps[nextIndex].delay_minutes * 60 * 1000)
    await supabase.from('automation_executions').update({
      next_run_at: nextRun.toISOString(),
    }).eq('id', execution.id)
    return
  }

  // Continue immediately to next step
  await runStep(supabase, automation, steps, execution, nextIndex)
}

/**
 * Evaluate a step condition against the trigger context.
 */
export function evaluateCondition(
  step: AutomationStep,
  context: TriggerContext,
): boolean {
  if (!step.condition_field || !step.condition_operator) return true

  // Resolve the field value from the context
  const fieldMap: Record<string, unknown> = {
    deal_value: context.dealValue,
    deal_title: context.dealTitle,
    deal_id: context.dealId,
    contact_name: context.contactName,
    contact_email: context.contactEmail,
    contact_phone: context.contactPhone,
    stage_name: context.stageName,
    previous_stage_name: context.previousStageName,
    lead_name: context.leadName,
    lead_platform: context.leadPlatform,
    quote_title: context.quoteTitle,
    trigger_type: context.triggerType,
  }

  // Also check metadata keys
  const fieldValue = fieldMap[step.condition_field] ?? context.metadata?.[step.condition_field]
  const conditionValue = step.condition_value ?? ''

  switch (step.condition_operator) {
    case 'equals':
      return String(fieldValue ?? '') === conditionValue
    case 'not_equals':
      return String(fieldValue ?? '') !== conditionValue
    case 'contains':
      return String(fieldValue ?? '').toLowerCase().includes(conditionValue.toLowerCase())
    case 'greater_than':
      return Number(fieldValue ?? 0) > Number(conditionValue)
    case 'less_than':
      return Number(fieldValue ?? 0) < Number(conditionValue)
    case 'is_empty':
      return fieldValue === null || fieldValue === undefined || fieldValue === ''
    case 'is_not_empty':
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== ''
    default:
      return true
  }
}

/**
 * Process scheduled automation steps (called by cron).
 * Picks up executions where next_run_at <= now and resumes them.
 */
export async function processScheduledSteps(
  supabase: SupabaseClient,
): Promise<number> {
  const { data: executions } = await supabase
    .from('automation_executions')
    .select('*')
    .eq('status', 'running')
    .lte('next_run_at', new Date().toISOString())
    .not('next_run_at', 'is', null)

  if (!executions?.length) return 0

  let processed = 0

  for (const execution of executions as AutomationExecution[]) {
    try {
      // Load the automation
      const { data: automation } = await supabase
        .from('automations')
        .select('*')
        .eq('id', execution.automation_id)
        .single()

      if (!automation || !automation.enabled) {
        await supabase.from('automation_executions').update({
          status: 'paused',
          next_run_at: null,
        }).eq('id', execution.id)
        continue
      }

      // Load steps
      const { data: steps } = await supabase
        .from('automation_steps')
        .select('*')
        .eq('automation_id', execution.automation_id)
        .order('step_order', { ascending: true })

      if (!steps?.length) {
        await supabase.from('automation_executions').update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          next_run_at: null,
        }).eq('id', execution.id)
        continue
      }

      // Clear next_run_at so we don't pick it up again
      await supabase.from('automation_executions').update({
        next_run_at: null,
      }).eq('id', execution.id)

      // Resume from current step
      await runStep(supabase, automation as Automation, steps as AutomationStep[], execution, execution.current_step)
      processed++
    } catch {
      await supabase.from('automation_executions').update({
        status: 'failed',
      }).eq('id', execution.id)
    }
  }

  return processed
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

    case 'send_sms': {
      if (!context.contactPhone) break
      const smsMessage = interpolateTemplate(config.message || 'Hi {{contact_name}}!', context)

      // Load Twilio config from integrations table
      const { data: twilioInt } = await supabase
        .from('integrations')
        .select('config')
        .eq('workspace_id', context.workspaceId)
        .eq('key', 'twilio')
        .eq('enabled', true)
        .single()

      if (twilioInt?.config) {
        const smsConfig = twilioInt.config as { accountSid?: string; authToken?: string; fromNumber?: string }
        if (smsConfig.accountSid && smsConfig.authToken && smsConfig.fromNumber) {
          const result = await sendSMS(context.contactPhone, smsMessage, {
            accountSid: smsConfig.accountSid,
            authToken: smsConfig.authToken,
            fromNumber: smsConfig.fromNumber,
          })

          // Log activity
          await supabase.from('activities').insert({
            workspace_id: context.workspaceId,
            type: 'sms',
            title: `SMS to ${context.contactName || context.contactPhone}`,
            notes: smsMessage,
            contact_id: context.contactId || null,
            owner_id: context.userId || null,
            done: true,
            metadata: {
              automation_id: automation.id,
              sms_sid: result.sid || null,
              sms_success: result.success,
              to_number: context.contactPhone,
            },
          })
        }
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
    .replace(/\{\{lead_name\}\}/g, context.leadName || '')
    .replace(/\{\{lead_platform\}\}/g, context.leadPlatform || '')
    .replace(/\{\{lead_message\}\}/g, context.leadMessage || '')
}
