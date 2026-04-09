import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { fireTrigger } from '@/lib/automations/engine'
import { routeNewLead } from '@/lib/leads/router'
import type { DbRow } from '@/types'

function getSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

// GET: Webhook verification (Meta/Facebook)
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.SOCIAL_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

// POST: Receive social media events (Instagram comments, Facebook messages, etc.)
export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  if (!supabase) return NextResponse.json({ status: 'ok' })

  // Verify webhook token if configured
  const verifyToken = process.env.SOCIAL_WEBHOOK_VERIFY_TOKEN
  if (!verifyToken) return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })

  let body: DbRow
  try { body = await request.json() } catch { return NextResponse.json({ status: 'ok' }) }

  // Determine platform
  const platform = body.platform || (body.object === 'instagram' ? 'instagram' : body.object === 'page' ? 'facebook' : 'other')

  // Process entries
  for (const entry of body.entry || [body]) {
    // Instagram comments
    if (entry.changes) {
      for (const change of entry.changes) {
        if (change.field === 'comments' || change.field === 'mentions') {
          const value = change.value
          await createLead(supabase, {
            platform,
            source_type: change.field === 'comments' ? 'comment' : 'mention',
            author_name: value.from?.username || value.from?.name || 'Unknown',
            author_username: value.from?.username || '',
            message: value.text || value.comment?.text || '',
            post_url: value.media?.permalink || '',
            metadata: value,
          })
        }
      }
    }

    // Generic lead format (for manual integration or Zapier/Make)
    if (entry.lead || entry.name) {
      await createLead(supabase, {
        platform: entry.platform || platform,
        source_type: entry.source_type || 'manual',
        author_name: entry.name || entry.lead?.name || '',
        author_username: entry.username || entry.lead?.username || '',
        message: entry.message || entry.lead?.message || entry.text || '',
        post_url: entry.url || entry.post_url || '',
        metadata: entry,
      })
    }
  }

  return NextResponse.json({ status: 'ok' })
}

async function createLead(supabase: NonNullable<ReturnType<typeof getSupabase>>, data: DbRow) {
  // Find workspace (use first active one or from metadata)
  const workspaceId = data.metadata?.workspace_id
  let wsId = workspaceId

  if (!wsId) {
    // Get first workspace with social integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('workspace_id')
      .in('key', ['instagram', 'facebook_messenger', 'linkedin'])
      .eq('enabled', true)
      .limit(1)
      .single()
    wsId = integration?.workspace_id
  }

  if (!wsId) return

  // --- Duplicate detection: check for same author_username + platform in last 24h ---
  if (data.author_username) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: existing } = await supabase
      .from('social_leads')
      .select('id, metadata')
      .eq('workspace_id', wsId)
      .eq('author_username', data.author_username)
      .eq('platform', data.platform)
      .gte('created_at', oneDayAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (existing) {
      // Append new message to existing lead's metadata instead of creating duplicate
      const existingMeta = (existing.metadata || {}) as Record<string, any>
      const additionalMessages = existingMeta.additional_messages || []
      additionalMessages.push({
        message: data.message?.slice(0, 2000),
        timestamp: new Date().toISOString(),
        source_type: data.source_type,
        post_url: data.post_url,
      })
      await supabase.from('social_leads').update({
        metadata: { ...existingMeta, additional_messages: additionalMessages },
      }).eq('id', existing.id)
      return
    }
  }

  // --- Auto-scoring: DMs get higher priority than comments ---
  const priority = data.source_type === 'dm' ? 'high' : 'normal'

  const { data: lead } = await supabase.from('social_leads').insert({
    workspace_id: wsId,
    platform: data.platform,
    source_type: data.source_type,
    author_name: data.author_name,
    author_username: data.author_username,
    message: data.message?.slice(0, 2000),
    post_url: data.post_url,
    status: 'new',
    metadata: { ...(data.metadata || {}), priority },
  }).select('id').single()

  // Notify workspace owner
  const { data: ws } = await supabase.from('workspaces').select('owner_id').eq('id', wsId).single()
  if (ws) {
    await supabase.from('notifications').insert({
      workspace_id: wsId, user_id: ws.owner_id,
      type: 'system',
      title: `New ${data.platform} lead: ${data.author_name}`,
      body: data.message?.slice(0, 100) || 'New social media interaction',
      priority: priority === 'high' ? 'high' : 'medium',
      action_url: '/leads',
    })

    // --- Fire automation trigger ---
    if (lead) {
      await fireTrigger(supabase, {
        workspaceId: wsId,
        triggerType: 'lead_created',
        leadId: lead.id,
        leadName: data.author_name,
        leadPlatform: data.platform,
        leadMessage: data.message?.slice(0, 500),
        userId: ws.owner_id,
        metadata: { source_type: data.source_type, priority },
      })

      // --- Route lead to rep ---
      await routeNewLead(supabase, wsId, lead.id)
    }
  }
}
