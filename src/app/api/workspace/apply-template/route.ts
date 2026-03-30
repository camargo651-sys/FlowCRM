import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getTemplate } from '@/lib/industry-templates'

function getSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )
}

// Automation mappings for each trigger template
const AUTOMATION_MAPPINGS: Record<string, { trigger_type: string; trigger_config: any; action_type: string; action_config: any }> = {
  'Viewing reminder': {
    trigger_type: 'task_due_soon',
    trigger_config: { hours_before: 24, task_type: 'meeting' },
    action_type: 'send_whatsapp',
    action_config: { message: 'Hi {{contact_name}}, just a reminder about your viewing tomorrow. See you there!' },
  },
  'Follow-up after viewing': {
    trigger_type: 'deal_stage_changed',
    trigger_config: { stage_name: 'Viewing Done' },
    action_type: 'create_task',
    action_config: { title: 'Follow up with {{contact_name}} after viewing', due_in_days: 2 },
  },
  'Follow-up after demo': {
    trigger_type: 'deal_stage_changed',
    trigger_config: { stage_name: 'Demo / Meeting' },
    action_type: 'create_task',
    action_config: { title: 'Follow up with {{contact_name}} after demo', due_in_days: 2 },
  },
  'Proposal reminder': {
    trigger_type: 'deal_idle',
    trigger_config: { idle_days: 5, stage_name: 'Proposal Sent' },
    action_type: 'send_email',
    action_config: { subject: 'Following up on our proposal', body: 'Hi {{contact_name}}, just checking in on the proposal for {{deal_title}}. Let me know if you have any questions.' },
  },
  'Won deal handoff': {
    trigger_type: 'deal_won',
    trigger_config: {},
    action_type: 'notify_team',
    action_config: { message: 'Deal won: {{deal_title}} (${{deal_value}}) with {{contact_name}}' },
  },
  'Instant response': {
    trigger_type: 'whatsapp_received',
    trigger_config: {},
    action_type: 'create_task',
    action_config: { title: 'Respond to {{contact_name}} on WhatsApp', due_in_days: 0 },
  },
  'No response follow-up': {
    trigger_type: 'deal_idle',
    trigger_config: { idle_days: 1 },
    action_type: 'send_whatsapp',
    action_config: { message: 'Hi {{contact_name}}, we wanted to follow up on your inquiry. How can we help?' },
  },
  'Hot lead alert': {
    trigger_type: 'deal_created',
    trigger_config: {},
    action_type: 'notify_team',
    action_config: { message: 'New hot lead: {{contact_name}} — {{deal_title}}' },
  },
  'Appointment reminder': {
    trigger_type: 'task_due_soon',
    trigger_config: { hours_before: 24 },
    action_type: 'send_whatsapp',
    action_config: { message: 'Hi {{contact_name}}, this is a reminder about your appointment tomorrow. See you then!' },
  },
  'Follow-up scheduling': {
    trigger_type: 'deal_won',
    trigger_config: {},
    action_type: 'create_task',
    action_config: { title: 'Schedule follow-up for {{contact_name}}', due_in_days: 7 },
  },
  'Recurring order reminder': {
    trigger_type: 'schedule_monthly',
    trigger_config: {},
    action_type: 'create_task',
    action_config: { title: 'Check recurring orders due this week', due_in_days: 0 },
  },
  'Delivery confirmation': {
    trigger_type: 'deal_won',
    trigger_config: {},
    action_type: 'send_whatsapp',
    action_config: { message: 'Hi {{contact_name}}, your order has been delivered. Thank you for your business!' },
  },
  'Payment reminder': {
    trigger_type: 'deal_idle',
    trigger_config: { idle_days: 7 },
    action_type: 'send_email',
    action_config: { subject: 'Payment reminder', body: 'Hi {{contact_name}}, this is a friendly reminder about the pending payment for {{deal_title}}.' },
  },
  'Onboarding checklist': {
    trigger_type: 'deal_stage_changed',
    trigger_config: { stage_name: 'Onboarding' },
    action_type: 'create_task',
    action_config: { title: 'Complete onboarding for {{contact_name}}', due_in_days: 3 },
  },
  'Contract renewal alert': {
    trigger_type: 'deal_idle',
    trigger_config: { idle_days: 30 },
    action_type: 'notify_team',
    action_config: { message: 'Contract with {{contact_name}} may need renewal — last updated 30+ days ago' },
  },
  'Info packet': {
    trigger_type: 'deal_created',
    trigger_config: {},
    action_type: 'send_email',
    action_config: { subject: 'Welcome! Here is our course information', body: 'Hi {{contact_name}}, thank you for your interest. Attached is our course catalog.' },
  },
  'Welcome kit': {
    trigger_type: 'deal_won',
    trigger_config: {},
    action_type: 'send_email',
    action_config: { subject: 'Welcome! You are enrolled', body: 'Hi {{contact_name}}, congratulations on your enrollment in {{deal_title}}! Here are your next steps.' },
  },
  'Follow-up reminder': {
    trigger_type: 'deal_idle',
    trigger_config: { idle_days: 7 },
    action_type: 'create_task',
    action_config: { title: 'Follow up on {{deal_title}} with {{contact_name}}', due_in_days: 0 },
  },
}

export async function POST(request: Request) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { templateKey } = await request.json()
  if (!templateKey) return NextResponse.json({ error: 'Missing templateKey' }, { status: 400 })

  const template = getTemplate(templateKey)
  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  // 1. Update workspace terminology and industry
  await supabase.from('workspaces').update({
    industry: template.name,
    terminology: {
      deal: template.dealLabel,
      contact: template.contactLabel,
    },
  }).eq('id', ws.id)

  // 2. Create default pipeline with template stages
  const { data: existingPipeline } = await supabase
    .from('pipelines')
    .select('id')
    .eq('workspace_id', ws.id)
    .limit(1)
    .single()

  let pipelineId: string

  if (existingPipeline) {
    pipelineId = existingPipeline.id
    // Delete existing stages and recreate
    await supabase.from('pipeline_stages').delete().eq('pipeline_id', pipelineId)
  } else {
    const { data: newPipeline } = await supabase.from('pipelines').insert({
      workspace_id: ws.id,
      name: `${template.dealLabel.singular} Pipeline`,
      color: '#6172f3',
      order_index: 0,
    }).select('id').single()
    pipelineId = newPipeline!.id
  }

  // Create stages
  for (let i = 0; i < template.stages.length; i++) {
    const stage = template.stages[i]
    await supabase.from('pipeline_stages').insert({
      pipeline_id: pipelineId,
      workspace_id: ws.id,
      name: stage.name,
      color: stage.color,
      order_index: i,
      win_stage: stage.win || false,
      lost_stage: stage.lost || false,
    })
  }

  // 3. Create custom field definitions
  for (let i = 0; i < template.customFields.length; i++) {
    const field = template.customFields[i]
    await supabase.from('custom_field_defs').upsert({
      workspace_id: ws.id,
      entity: field.entity,
      label: field.label,
      key: field.key,
      type: field.type,
      options: field.options || null,
      order_index: i,
    }, { onConflict: 'workspace_id,entity,key' })
  }

  // 4. Create automations from template
  for (const auto of template.automations) {
    const mapping = AUTOMATION_MAPPINGS[auto.name]
    if (mapping) {
      await supabase.from('automations').upsert({
        workspace_id: ws.id,
        name: auto.name,
        enabled: true,
        trigger_type: mapping.trigger_type,
        trigger_config: mapping.trigger_config,
        action_type: mapping.action_type,
        action_config: mapping.action_config,
      }, { onConflict: 'workspace_id,name' } as any)
    }
  }

  // 5. Mark onboarding as completed
  await supabase.from('workspaces').update({
    onboarding_completed: true,
  }).eq('id', ws.id)

  return NextResponse.json({
    success: true,
    template: template.name,
    stages: template.stages.length,
    customFields: template.customFields.length,
    automations: template.automations.length,
  })
}
