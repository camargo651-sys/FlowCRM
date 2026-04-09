import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { fireTrigger } from '@/lib/automations/engine'

function getSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )
}

export async function POST(request: Request) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { leadId, status } = await request.json()
  if (!leadId || !status) {
    return NextResponse.json({ error: 'Missing leadId or status' }, { status: 400 })
  }

  const validStatuses = ['new', 'contacted', 'qualified', 'converted', 'discarded']
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  // Get workspace
  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  // Update lead status
  const { data: lead, error } = await supabase
    .from('social_leads')
    .update({ status })
    .eq('id', leadId)
    .eq('workspace_id', ws.id)
    .select('*')
    .single()

  if (error || !lead) {
    return NextResponse.json({ error: error?.message || 'Lead not found' }, { status: 404 })
  }

  // Fire automation triggers for qualified/converted statuses
  if (status === 'qualified' || status === 'converted') {
    const triggerType = status === 'qualified' ? 'lead_qualified' : 'lead_converted'
    await fireTrigger(supabase, {
      workspaceId: ws.id,
      triggerType,
      leadId: lead.id,
      leadName: lead.author_name,
      leadPlatform: lead.platform,
      leadMessage: lead.message?.slice(0, 500),
      contactId: lead.contact_id || undefined,
      userId: user.id,
      metadata: { source_type: lead.source_type, previous_status: lead.status },
    })
  }

  return NextResponse.json({ success: true, lead })
}
