import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, apiSuccess, apiError, apiList, parsePagination, type ApiContext } from './auth'
import { checkRateLimit, rateLimitHeaders } from './rate-limit'
import { hasPermission, type Module, type Action } from '@/lib/rbac/permissions'
import { z } from 'zod'
import type { DbRow } from '@/types'

interface CrudConfig {
  table: string
  module?: string // for RBAC
  schema?: z.ZodObject<z.ZodRawShape> // validation for create/update
  searchFields?: string[]
  selectFields?: string
  allowedFilters?: string[]
  defaultSort?: string
  beforeCreate?: (data: DbRow, ctx: ApiContext) => Promise<DbRow>
  afterCreate?: (record: DbRow, ctx: ApiContext) => Promise<void>
  beforeUpdate?: (data: DbRow, ctx: ApiContext) => Promise<DbRow>
  afterUpdate?: (record: DbRow, ctx: ApiContext) => Promise<void>
  afterDelete?: (id: string, ctx: ApiContext) => Promise<void>
}

function checkPermission(role: string, module: string | undefined, action: string): NextResponse | null {
  if (!module) return null // no module = no RBAC check
  if (!hasPermission(role, module as Module, action as Action)) {
    return NextResponse.json(
      { error: `Permission denied: ${role} cannot ${action} in ${module}` },
      { status: 403 }
    )
  }
  return null
}

export function createCrudHandlers(config: CrudConfig) {
  const {
    table, searchFields = ['name'], selectFields = '*',
    allowedFilters = [], defaultSort = 'created_at',
  } = config

  // GET: List with pagination, search, filters
  async function GET(request: NextRequest) {
    const auth = await authenticateRequest(request)
    if (auth instanceof Response) return auth
    const { supabase, workspaceId, userId, role } = auth

    // Rate limit
    const rl = checkRateLimit(userId, 'api')
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: rateLimitHeaders(rl) })
    }

    // RBAC
    const denied = checkPermission(role, config.module, 'view')
    if (denied) return denied

    const { page, perPage, search, sortBy, sortOrder, offset } = parsePagination(request)
    const url = new URL(request.url)

    // Count
    let countQuery = supabase.from(table).select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId)
    let dataQuery = supabase.from(table).select(selectFields).eq('workspace_id', workspaceId)

    // Search
    if (search && searchFields.length) {
      const escaped = search.replace(/[%_\\]/g, '\\$&')
      const searchFilter = searchFields.map(f => `${f}.ilike.%${escaped}%`).join(',')
      countQuery = countQuery.or(searchFilter)
      dataQuery = dataQuery.or(searchFilter)
    }

    // Dynamic filters
    for (const filterKey of allowedFilters) {
      const filterValue = url.searchParams.get(filterKey)
      if (filterValue) {
        countQuery = countQuery.eq(filterKey, filterValue)
        dataQuery = dataQuery.eq(filterKey, filterValue)
      }
    }

    const { count } = await countQuery
    const { data, error } = await dataQuery
      .order(sortBy || defaultSort, { ascending: sortOrder })
      .range(offset, offset + perPage - 1)

    if (error) return apiError(error.message, 500)
    return apiList(data || [], count || 0, page, perPage)
  }

  // POST: Create
  async function POST(request: NextRequest) {
    const auth = await authenticateRequest(request)
    if (auth instanceof Response) return auth
    const { supabase, workspaceId, userId, role } = auth

    // RBAC
    const denied = checkPermission(role, config.module, 'create')
    if (denied) return denied

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return apiError('Invalid JSON body', 400)
    }

    // Zod validation
    if (config.schema) {
      const result = config.schema.safeParse(body)
      if (!result.success) {
        const errors = result.error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ')
        return apiError(`Validation failed: ${errors}`, 400)
      }
      body = result.data
    }

    body.workspace_id = workspaceId

    if (config.beforeCreate) {
      body = await config.beforeCreate(body, auth)
    }

    const { data, error } = await supabase.from(table).insert(body).select().single()
    if (error) return apiError(error.message, 400)

    if (config.afterCreate) {
      await config.afterCreate(data, auth)
    }

    return apiSuccess(data)
  }

  // PUT: Update by id
  async function PUT(request: NextRequest) {
    const auth = await authenticateRequest(request)
    if (auth instanceof Response) return auth
    const { supabase, workspaceId, role } = auth

    // RBAC
    const denied = checkPermission(role, config.module, 'edit')
    if (denied) return denied

    const url = new URL(request.url)
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return apiError('Invalid JSON body', 400)
    }

    const id = url.searchParams.get('id') || body.id
    if (!id) return apiError('Missing id', 400)

    delete body.id
    delete body.workspace_id

    // Zod validation (partial for updates)
    if (config.schema) {
      const result = config.schema.partial().safeParse(body)
      if (!result.success) {
        const errors = result.error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ')
        return apiError(`Validation failed: ${errors}`, 400)
      }
      body = result.data
    }

    if (config.beforeUpdate) {
      body = await config.beforeUpdate(body, auth)
    }

    const { data, error } = await supabase.from(table).update(body).eq('id', id).eq('workspace_id', workspaceId).select().single()
    if (error) return apiError(error.message, 400)
    if (!data) return apiError('Not found', 404)

    if (config.afterUpdate) {
      await config.afterUpdate(data, auth)
    }

    return apiSuccess(data)
  }

  // DELETE: Delete by id
  async function DELETE(request: NextRequest) {
    const auth = await authenticateRequest(request)
    if (auth instanceof Response) return auth
    const { supabase, workspaceId, role } = auth

    // RBAC
    const denied = checkPermission(role, config.module, 'delete')
    if (denied) return denied

    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    if (!id) return apiError('Missing id', 400)

    const { error } = await supabase.from(table).delete().eq('id', id).eq('workspace_id', workspaceId)
    if (error) return apiError(error.message, 400)

    if (config.afterDelete) {
      await config.afterDelete(id, auth)
    }

    return apiSuccess({ deleted: true })
  }

  return { GET, POST, PUT, DELETE }
}
