import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { enrollContact } from '@/lib/sequences/processor'

/**
 * CRON endpoint: auto-enrolls non-responding leads into follow-up sequences.
 *
 * Logic: Find leads that were contacted (outbound WA sent) but haven't replied
 * within the configured hours. Enroll them in the workspace's default follow-up sequence.
 *
 * Workspace config: workspaces.lead_routing_config.auto_sequence = {
 *   enabled: boolean,
 *   sequence_id: string,
 *   no_reply_hours: number (default 24)
 * }
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)

  // Find all workspaces with auto-sequence enabled
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, lead_routing_config')
    .not('lead_routing_config', 'is', null)

  let totalEnrolled = 0

  for (const ws of workspaces || []) {
    const config = ws.lead_routing_config as {
      auto_sequence?: { enabled: boolean; sequence_id: string; no_reply_hours: number }
    } | null

    const autoSeq = config?.auto_sequence
    if (!autoSeq?.enabled || !autoSeq.sequence_id) continue

    const noReplyHours = autoSeq.no_reply_hours || 24
    const cutoffTime = new Date(Date.now() - noReplyHours * 60 * 60 * 1000).toISOString()

    // Find leads that:
    // 1. Have status 'contacted' (WA was sent)
    // 2. Were contacted more than X hours ago
    // 3. Have a contact_id (were converted to contact)
    // 4. Contact hasn't replied via WA since lead was contacted
    const { data: stalledLeads } = await supabase
      .from('social_leads')
      .select('id, contact_id, updated_at')
      .eq('workspace_id', ws.id)
      .eq('status', 'contacted')
      .not('contact_id', 'is', null)
      .lte('updated_at', cutoffTime)
      .limit(50)

    if (!stalledLeads?.length) continue

    for (const lead of stalledLeads) {
      if (!lead.contact_id) continue

      // Check if contact has sent any inbound WA message since lead was updated
      const { count: replyCount } = await supabase
        .from('whatsapp_messages')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', ws.id)
        .eq('contact_id', lead.contact_id)
        .eq('direction', 'inbound')
        .gte('received_at', lead.updated_at)

      if ((replyCount || 0) > 0) continue // They replied, skip

      // Check not already enrolled in this sequence
      const { count: enrolledCount } = await supabase
        .from('sequence_enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('sequence_id', autoSeq.sequence_id)
        .eq('contact_id', lead.contact_id)
        .in('status', ['active', 'completed', 'replied'])

      if ((enrolledCount || 0) > 0) continue // Already enrolled, skip

      // Enroll in follow-up sequence
      const result = await enrollContact(supabase, {
        sequenceId: autoSeq.sequence_id,
        contactId: lead.contact_id,
        workspaceId: ws.id,
      })

      if (result.success) {
        totalEnrolled++
        // Update lead status to reflect it's in a sequence
        await supabase.from('social_leads')
          .update({ metadata: { ...(lead as { metadata?: Record<string, unknown> }).metadata, auto_sequence_enrolled: true } })
          .eq('id', lead.id)
      }
    }
  }

  return NextResponse.json({ ok: true, enrolled: totalEnrolled })
}
