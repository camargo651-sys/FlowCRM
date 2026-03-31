import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export interface ApiContext {
  supabase: any
  userId: string
  workspaceId: string
  role: string
}

/**
 * Authenticate API request via API key (Bearer token) or session cookie.
 * Returns workspace context or error response.
 */
export async function authenticateRequest(request: NextRequest): Promise<ApiContext | NextResponse> {
  const authHeader = request.headers.get('authorization')

  // API Key auth (Bearer token)
  if (authHeader?.startsWith('Bearer ')) {
    const apiKey = authHeader.slice(7)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data: keyRecord } = await supabase
      .from('api_keys')
      .select('workspace_id, user_id, scopes, active')
      .eq('key_hash', hashApiKey(apiKey))
      .eq('active', true)
      .single()

    if (!keyRecord) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    // Update last_used
    await supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('key_hash', hashApiKey(apiKey))

    // Get user role
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', keyRecord.user_id).single()

    return {
      supabase,
      userId: keyRecord.user_id,
      workspaceId: keyRecord.workspace_id,
      role: profile?.role || 'member',
    }
  }

  // Session cookie auth (for frontend calls)
  const cookieStore = cookies()
  const supabase = createServerClient(
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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
  if (!ws) {
    return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
  }

  // Get user role
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  return { supabase, userId: user.id, workspaceId: ws.id, role: profile?.role || 'admin' }
}

function hashApiKey(key: string): string {
  const crypto = require('crypto')
  return crypto.createHash('sha256').update(key).digest('hex')
}

/**
 * Standard API response helpers
 */
export function apiSuccess(data: any, meta?: any) {
  return NextResponse.json({ data, meta, error: null })
}

export function apiError(message: string, status: number = 400) {
  return NextResponse.json({ data: null, error: { message } }, { status })
}

export function apiList(data: any[], total: number, page: number, perPage: number) {
  return NextResponse.json({
    data,
    meta: { total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) },
    error: null,
  })
}

/**
 * Parse pagination params from request
 */
export function parsePagination(request: NextRequest) {
  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per_page') || '25')))
  const search = url.searchParams.get('search') || ''
  const sortBy = url.searchParams.get('sort_by') || 'created_at'
  const sortOrder = url.searchParams.get('sort_order') === 'asc' ? true : false
  const offset = (page - 1) * perPage

  return { page, perPage, search, sortBy, sortOrder, offset }
}
