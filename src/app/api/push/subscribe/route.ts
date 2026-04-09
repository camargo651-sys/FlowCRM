import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { subscription } = await request.json()
    if (!subscription?.endpoint || !subscription?.keys) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
    }

    // Get user's workspace
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!workspace) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        workspace_id: workspace.id,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      { onConflict: 'user_id,endpoint' }
    )

    if (error) {
      console.error('Push subscribe error:', error)
      return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Push subscribe error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
