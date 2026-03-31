import { NextRequest } from 'next/server'
import { authenticateRequest, apiSuccess, apiError, apiList, parsePagination } from './auth'

interface CrudConfig {
  table: string
  searchFields?: string[]
  selectFields?: string
  allowedFilters?: string[]
  defaultSort?: string
  beforeCreate?: (data: any, ctx: any) => Promise<any>
  afterCreate?: (record: any, ctx: any) => Promise<void>
  beforeUpdate?: (data: any, ctx: any) => Promise<any>
  afterUpdate?: (record: any, ctx: any) => Promise<void>
  afterDelete?: (id: string, ctx: any) => Promise<void>
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
    const { supabase, workspaceId } = auth

    const { page, perPage, search, sortBy, sortOrder, offset } = parsePagination(request)
    const url = new URL(request.url)

    // Count
    let countQuery = supabase.from(table).select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId)
    let dataQuery = supabase.from(table).select(selectFields).eq('workspace_id', workspaceId)

    // Search
    if (search && searchFields.length) {
      const searchFilter = searchFields.map(f => `${f}.ilike.%${search}%`).join(',')
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
    const { supabase, workspaceId, userId } = auth

    let body = await request.json()
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

  // PUT: Update by id (passed as query param or in body)
  async function PUT(request: NextRequest) {
    const auth = await authenticateRequest(request)
    if (auth instanceof Response) return auth
    const { supabase, workspaceId } = auth

    const url = new URL(request.url)
    let body = await request.json()
    const id = url.searchParams.get('id') || body.id
    if (!id) return apiError('Missing id', 400)

    delete body.id
    delete body.workspace_id

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
    const { supabase, workspaceId } = auth

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
