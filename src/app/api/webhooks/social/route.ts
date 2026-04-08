import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
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

  await supabase.from('social_leads').insert({
    workspace_id: wsId,
    platform: data.platform,
    source_type: data.source_type,
    author_name: data.author_name,
    author_username: data.author_username,
    message: data.message?.slice(0, 2000),
    post_url: data.post_url,
    metadata: data.metadata || {},
  })

  // Notify workspace owner
  const { data: ws } = await supabase.from('workspaces').select('owner_id').eq('id', wsId).single()
  if (ws) {
    await supabase.from('notifications').insert({
      workspace_id: wsId, user_id: ws.owner_id,
      type: 'system',
      title: `New ${data.platform} lead: ${data.author_name}`,
      body: data.message?.slice(0, 100) || 'New social media interaction',
      priority: 'medium',
      action_url: '/leads',
    })
  }
}
