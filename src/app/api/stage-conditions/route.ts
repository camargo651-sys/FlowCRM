import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

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

async function getWorkspace(supabase: ReturnType<typeof getSupabase>, userId: string) {
  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', userId).single()
  return ws
}

function rowToCondition(r: {
  from_stage: string
  to_stage: string
  required_fields: unknown
  require_approval: boolean | null
  min_value: number | null
}) {
  return {
    fromStage: r.from_stage,
    toStage: r.to_stage,
    requiredFields: Array.isArray(r.required_fields) ? (r.required_fields as string[]) : [],
    requireApproval: !!r.require_approval,
    minValue: r.min_value ?? undefined,
  }
}

export async function GET() {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ws = await getWorkspace(supabase, user.id)
  if (!ws) return NextResponse.json({ conditions: [] })

  const { data, error } = await supabase
    .from('stage_conditions')
    .select('*')
    .eq('workspace_id', ws.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ conditions: [] })
  return NextResponse.json({ conditions: (data || []).map(rowToCondition) })
}

// POST: replace all conditions for the workspace with the given list
export async function POST(request: NextRequest) {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ws = await getWorkspace(supabase, user.id)
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const body = await request.json()
  const conditions = Array.isArray(body?.conditions) ? body.conditions : []

  // Replace strategy: delete then re-insert (simpler than diffing)
  await supabase.from('stage_conditions').delete().eq('workspace_id', ws.id)

  if (conditions.length > 0) {
    const rows = conditions
      .filter((c: { toStage?: string }) => c.toStage && c.toStage.trim().length > 0)
      .map((c: {
        fromStage?: string
        toStage: string
        requiredFields?: string[]
        requireApproval?: boolean
        minValue?: number
      }) => ({
        workspace_id: ws.id,
        from_stage: c.fromStage || '*',
        to_stage: c.toStage,
        required_fields: c.requiredFields || [],
        require_approval: !!c.requireApproval,
        min_value: c.minValue ?? null,
      }))
    if (rows.length > 0) {
      const { error } = await supabase.from('stage_conditions').insert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, count: conditions.length })
}

export async function DELETE() {
  const supabase = getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ws = await getWorkspace(supabase, user.id)
  if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

  const { error } = await supabase.from('stage_conditions').delete().eq('workspace_id', ws.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
