import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, apiSuccess, apiError } from '@/lib/api/auth'
import { z } from 'zod'

const mergeSchema = z.object({
  primaryId: z.string().uuid(),
  duplicateIds: z.array(z.string().uuid()).min(1),
})

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth instanceof Response) return auth
  const { supabase, workspaceId } = auth

  let body: z.infer<typeof mergeSchema>
  try {
    body = mergeSchema.parse(await request.json())
  } catch (err) {
    return apiError('Invalid body: primaryId (uuid) and duplicateIds (uuid[]) required', 400)
  }

  const { primaryId, duplicateIds } = body

  // Verify primary contact belongs to workspace
  const { data: primary, error: pErr } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', primaryId)
    .eq('workspace_id', workspaceId)
    .single()

  if (pErr || !primary) {
    return apiError('Primary contact not found in this workspace', 404)
  }

  // Process each duplicate
  for (const dupId of duplicateIds) {
    if (dupId === primaryId) continue

    const { data: dup } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', dupId)
      .eq('workspace_id', workspaceId)
      .single()

    if (!dup) continue

    // Move activities
    await supabase
      .from('activities')
      .update({ contact_id: primaryId })
      .eq('contact_id', dupId)
      .eq('workspace_id', workspaceId)

    // Move deals
    await supabase
      .from('deals')
      .update({ contact_id: primaryId })
      .eq('contact_id', dupId)
      .eq('workspace_id', workspaceId)

    // Move whatsapp_messages
    await supabase
      .from('whatsapp_messages')
      .update({ contact_id: primaryId })
      .eq('contact_id', dupId)

    // Move invoices
    await supabase
      .from('invoices')
      .update({ contact_id: primaryId })
      .eq('contact_id', dupId)
      .eq('workspace_id', workspaceId)

    // Merge tags (union)
    const primaryTags: string[] = primary.tags || []
    const dupTags: string[] = dup.tags || []
    const mergedTags = Array.from(new Set([...primaryTags, ...dupTags]))

    // Fill missing email/phone from duplicate
    const updates: Record<string, unknown> = { tags: mergedTags }
    if (!primary.email && dup.email) {
      updates.email = dup.email
      primary.email = dup.email
    }
    if (!primary.phone && dup.phone) {
      updates.phone = dup.phone
      primary.phone = dup.phone
    }
    if (!primary.company_name && dup.company_name) {
      updates.company_name = dup.company_name
      primary.company_name = dup.company_name
    }
    if (!primary.job_title && dup.job_title) {
      updates.job_title = dup.job_title
      primary.job_title = dup.job_title
    }

    primary.tags = mergedTags

    await supabase.from('contacts').update(updates).eq('id', primaryId)

    // Delete the duplicate
    await supabase.from('contacts').delete().eq('id', dupId)
  }

  // Return updated primary
  const { data: merged } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', primaryId)
    .single()

  return apiSuccess(merged)
}
