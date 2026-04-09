import { SupabaseClient } from '@supabase/supabase-js'
import { sendWhatsAppMessage, decryptToken } from '@/lib/whatsapp/client'
import { sendSMS } from '@/lib/integrations/twilio'
import { sendTransactionalEmail } from '@/lib/email/transactional'

interface SequenceStep {
  order: number
  channel: 'whatsapp' | 'sms' | 'email'
  message: string
  delay_hours: number
  condition?: 'no_reply' | null
}

interface Enrollment {
  id: string
  sequence_id: string
  workspace_id: string
  contact_id: string
  current_step: number
  status: string
  next_run_at: string
  started_at: string
  log: Array<{ step: number; channel: string; sent_at: string; status: string }>
}

function interpolateMessage(message: string, contact: { name?: string; first_name?: string }) {
  let result = message
  const firstName = contact.first_name || contact.name?.split(' ')[0] || ''
  result = result.replace(/\{\{name\}\}/g, contact.name || '')
  result = result.replace(/\{\{first_name\}\}/g, firstName)
  return result
}

/**
 * Check if contact has sent any inbound WhatsApp message since enrollment started.
 */
async function hasContactReplied(
  supabase: SupabaseClient,
  workspaceId: string,
  contactId: string,
  since: string,
): Promise<boolean> {
  const { count } = await supabase
    .from('whatsapp_messages')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('contact_id', contactId)
    .eq('direction', 'inbound')
    .gte('received_at', since)

  return (count || 0) > 0
}

/**
 * Process all active sequence enrollments that are due.
 */
export async function processSequenceSteps(supabase: SupabaseClient): Promise<number> {
  // Fetch due enrollments
  const { data: enrollments, error } = await supabase
    .from('sequence_enrollments')
    .select('*')
    .eq('status', 'active')
    .lte('next_run_at', new Date().toISOString())
    .limit(100)

  if (error || !enrollments || enrollments.length === 0) return 0

  let processed = 0

  for (const enrollment of enrollments as Enrollment[]) {
    try {
      // Load sequence
      const { data: sequence } = await supabase
        .from('sequences')
        .select('*')
        .eq('id', enrollment.sequence_id)
        .single()

      if (!sequence || !sequence.enabled) {
        await supabase.from('sequence_enrollments')
          .update({ status: 'paused' })
          .eq('id', enrollment.id)
        continue
      }

      const steps = (sequence.steps || []) as SequenceStep[]
      const currentStep = steps.find((s) => s.order === enrollment.current_step)

      if (!currentStep) {
        // No more steps — mark completed
        await supabase.from('sequence_enrollments')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', enrollment.id)
        await supabase.from('sequences')
          .update({ completed_count: (sequence.completed_count || 0) + 1 })
          .eq('id', enrollment.sequence_id)
        continue
      }

      // Check condition
      if (currentStep.condition === 'no_reply') {
        const replied = await hasContactReplied(
          supabase,
          enrollment.workspace_id,
          enrollment.contact_id,
          enrollment.started_at,
        )
        if (replied) {
          await supabase.from('sequence_enrollments')
            .update({ status: 'replied' })
            .eq('id', enrollment.id)
          continue
        }
      }

      // Load contact
      const { data: contact } = await supabase
        .from('contacts')
        .select('id, name, email, phone')
        .eq('id', enrollment.contact_id)
        .single()

      if (!contact) {
        await supabase.from('sequence_enrollments')
          .update({ status: 'paused' })
          .eq('id', enrollment.id)
        continue
      }

      const message = interpolateMessage(currentStep.message, {
        name: contact.name,
        first_name: contact.name?.split(' ')[0],
      })

      let stepStatus = 'sent'

      // Execute based on channel
      if (currentStep.channel === 'whatsapp') {
        // Load WA account for workspace
        const { data: waAccount } = await supabase
          .from('whatsapp_accounts')
          .select('id, phone_number_id, access_token, display_phone')
          .eq('workspace_id', enrollment.workspace_id)
          .eq('active', true)
          .limit(1)
          .single()

        if (waAccount && contact.phone) {
          try {
            const token = decryptToken(waAccount.access_token || '')
            const { messageId } = await sendWhatsAppMessage(
              token,
              waAccount.phone_number_id,
              contact.phone,
              message,
            )
            // Store outbound message
            await supabase.from('whatsapp_messages').insert({
              workspace_id: enrollment.workspace_id,
              whatsapp_account_id: waAccount.id,
              wamid: messageId,
              from_number: waAccount.display_phone || waAccount.phone_number_id,
              to_number: contact.phone,
              direction: 'outbound',
              message_type: 'text',
              body: message,
              status: 'sent',
              contact_id: contact.id,
              received_at: new Date().toISOString(),
            })
          } catch {
            stepStatus = 'failed'
          }
        } else {
          stepStatus = 'skipped_no_wa'
        }
      } else if (currentStep.channel === 'sms') {
        if (contact.phone) {
          // Load Twilio config from workspace providers
          const { data: ws } = await supabase
            .from('workspaces')
            .select('providers')
            .eq('id', enrollment.workspace_id)
            .single()

          const twilioProvider = (ws?.providers || []).find(
            (p: { type: string }) => p.type === 'twilio',
          )

          if (twilioProvider) {
            const result = await sendSMS(contact.phone, message, {
              accountSid: twilioProvider.account_sid,
              authToken: twilioProvider.auth_token,
              fromNumber: twilioProvider.from_number,
            })
            if (!result.success) stepStatus = 'failed'
          } else {
            stepStatus = 'skipped_no_sms'
          }
        } else {
          stepStatus = 'skipped_no_phone'
        }
      } else if (currentStep.channel === 'email') {
        if (contact.email) {
          const result = await sendTransactionalEmail({
            to: contact.email,
            subject: `Message from your team`,
            html: `<div style="font-family:sans-serif;padding:20px;">${message.replace(/\n/g, '<br>')}</div>`,
            workspaceId: enrollment.workspace_id,
            contactId: contact.id,
          })
          if (!result.success) stepStatus = 'failed'
        } else {
          stepStatus = 'skipped_no_email'
        }
      }

      // Log step execution
      const newLog = [
        ...(enrollment.log || []),
        {
          step: currentStep.order,
          channel: currentStep.channel,
          sent_at: new Date().toISOString(),
          status: stepStatus,
        },
      ]

      // Advance to next step or complete
      const nextStepIndex = currentStep.order + 1
      const nextStep = steps.find((s) => s.order === nextStepIndex)

      if (nextStep) {
        const nextRunAt = new Date(Date.now() + nextStep.delay_hours * 60 * 60 * 1000).toISOString()
        await supabase.from('sequence_enrollments')
          .update({
            current_step: nextStepIndex,
            next_run_at: nextRunAt,
            log: newLog,
          })
          .eq('id', enrollment.id)
      } else {
        // Sequence complete
        await supabase.from('sequence_enrollments')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            log: newLog,
          })
          .eq('id', enrollment.id)
        // Increment completed_count
        await supabase.from('sequences')
          .update({ completed_count: (sequence.completed_count || 0) + 1 })
          .eq('id', enrollment.sequence_id)
      }

      processed++
    } catch (err) {
      console.error(`[sequences] Error processing enrollment ${enrollment.id}:`, err)
    }
  }

  return processed
}

/**
 * Enroll a contact into a sequence.
 */
export async function enrollContact(
  supabase: SupabaseClient,
  params: { sequenceId: string; contactId: string; workspaceId: string },
): Promise<{ success: boolean; enrollmentId?: string; error?: string }> {
  const { sequenceId, contactId, workspaceId } = params

  // Check if already enrolled and active
  const { data: existing } = await supabase
    .from('sequence_enrollments')
    .select('id, status')
    .eq('sequence_id', sequenceId)
    .eq('contact_id', contactId)
    .in('status', ['active', 'paused'])
    .limit(1)

  if (existing && existing.length > 0) {
    return { success: false, error: 'Contact already enrolled in this sequence' }
  }

  // Load sequence to get first step delay
  const { data: sequence } = await supabase
    .from('sequences')
    .select('steps, enrolled_count')
    .eq('id', sequenceId)
    .single()

  if (!sequence) {
    return { success: false, error: 'Sequence not found' }
  }

  const steps = (sequence.steps || []) as SequenceStep[]
  const firstStep = steps.find((s) => s.order === 0)
  const delayHours = firstStep?.delay_hours || 0
  const nextRunAt = new Date(Date.now() + delayHours * 60 * 60 * 1000).toISOString()

  const { data: enrollment, error } = await supabase
    .from('sequence_enrollments')
    .insert({
      sequence_id: sequenceId,
      workspace_id: workspaceId,
      contact_id: contactId,
      current_step: 0,
      status: 'active',
      next_run_at: nextRunAt,
    })
    .select('id')
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Increment enrolled_count
  await supabase.from('sequences')
    .update({ enrolled_count: (sequence.enrolled_count || 0) + 1 })
    .eq('id', sequenceId)

  return { success: true, enrollmentId: enrollment?.id }
}
