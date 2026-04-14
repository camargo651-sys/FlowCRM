import { NextRequest } from 'next/server'
import { authenticateRequest, apiSuccess, apiError } from '@/lib/api/auth'
import { transformRow, type ColumnMapping } from '@/lib/data-quality/csv-mapper'

interface Body {
  entity: 'contacts' | 'companies' | 'deals'
  rows: string[][]
  mapping: ColumnMapping
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth instanceof Response) return auth
  const { supabase, workspaceId, userId } = auth

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return apiError('Invalid JSON body', 400)
  }

  const { entity, rows, mapping } = body
  if (!entity || !Array.isArray(rows) || !mapping) {
    return apiError('Missing entity, rows or mapping', 400)
  }
  if (rows.length > 10000) return apiError('Too many rows (max 10,000)', 400)

  const errors: { row: number; error: string }[] = []
  let inserted = 0

  for (let i = 0; i < rows.length; i++) {
    const normalized = transformRow(rows[i], mapping)
    try {
      if (entity === 'contacts') {
        const name =
          (normalized.name as string) ||
          (normalized.email as string) ||
          (normalized.phone as string)
        if (!name) {
          errors.push({ row: i + 1, error: 'Missing name/email/phone' })
          continue
        }
        const { error } = await supabase.from('contacts').insert({
          workspace_id: workspaceId,
          owner_id: userId,
          name,
          email: (normalized.email as string) || null,
          phone: (normalized.phone as string) || null,
          company_name: (normalized.company as string) || null,
          job_title: (normalized.job_title as string) || null,
          website: (normalized.website as string) || null,
          notes: (normalized.notes as string) || null,
          tags: (normalized.tags as string[]) || ['imported'],
          type: 'person',
        })
        if (error) errors.push({ row: i + 1, error: error.message })
        else inserted++
      } else if (entity === 'companies') {
        const name = (normalized.company as string) || (normalized.name as string)
        if (!name) {
          errors.push({ row: i + 1, error: 'Missing company name' })
          continue
        }
        // Companies are modeled as contacts with type='company' in Tracktio
        const { error } = await supabase.from('contacts').insert({
          workspace_id: workspaceId,
          owner_id: userId,
          name,
          email: (normalized.email as string) || null,
          phone: (normalized.phone as string) || null,
          website: (normalized.website as string) || null,
          notes: (normalized.notes as string) || null,
          tags: (normalized.tags as string[]) || ['imported'],
          type: 'company',
        })
        if (error) errors.push({ row: i + 1, error: error.message })
        else inserted++
      } else if (entity === 'deals') {
        const title = (normalized.name as string) || (normalized.company as string)
        if (!title) {
          errors.push({ row: i + 1, error: 'Missing deal title/name' })
          continue
        }
        const { error } = await supabase.from('deals').insert({
          workspace_id: workspaceId,
          owner_id: userId,
          title,
          value: (normalized.value as number) || 0,
          stage: (normalized.stage as string) || 'new',
          close_date: (normalized.close_date as string) || null,
          company_name: (normalized.company as string) || null,
          notes: (normalized.notes as string) || null,
        })
        if (error) errors.push({ row: i + 1, error: error.message })
        else inserted++
      } else {
        return apiError(`Unsupported entity: ${entity}`, 400)
      }
    } catch (err) {
      errors.push({ row: i + 1, error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  return apiSuccess({ inserted, errors: errors.slice(0, 100), total: rows.length })
}
