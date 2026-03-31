import { createCrudHandlers } from '@/lib/api/crud'
import { authenticateRequest, apiSuccess, apiError } from '@/lib/api/auth'
import { NextRequest } from 'next/server'

const crud = createCrudHandlers({
  table: 'journal_entries',
  searchFields: ['entry_number', 'description', 'reference'],
  selectFields: '*, journal_lines(*, chart_of_accounts(code, name, type))',
  allowedFilters: ['status', 'source'],
  defaultSort: 'date',
  beforeCreate: async (data, ctx) => {
    // Validate debits = credits
    const lines = data.lines || []
    const totalDebit = lines.reduce((s: number, l: any) => s + (l.debit || 0), 0)
    const totalCredit = lines.reduce((s: number, l: any) => s + (l.credit || 0), 0)
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`Debits ($${totalDebit}) must equal credits ($${totalCredit})`)
    }
    data.total_debit = totalDebit
    data.total_credit = totalCredit
    return data
  },
  afterCreate: async (record, ctx) => {
    // Insert journal lines
    const lines = record._lines || []
    if (lines.length) {
      await ctx.supabase.from('journal_lines').insert(
        lines.map((l: any, i: number) => ({
          journal_entry_id: record.id,
          account_id: l.account_id,
          description: l.description || null,
          debit: l.debit || 0,
          credit: l.credit || 0,
          order_index: i,
        }))
      )
    }

    // Update account balances if posted
    if (record.status === 'posted') {
      for (const line of lines) {
        const delta = (line.debit || 0) - (line.credit || 0)
        const { data: account } = await ctx.supabase
          .from('chart_of_accounts').select('balance, type').eq('id', line.account_id).single()
        if (account) {
          // Assets/Expenses increase with debit, Liabilities/Equity/Revenue increase with credit
          const newBalance = ['asset', 'expense'].includes(account.type)
            ? account.balance + delta
            : account.balance - delta
          await ctx.supabase.from('chart_of_accounts').update({ balance: newBalance }).eq('id', line.account_id)
        }
      }
    }
  },
})

export const { GET, PUT, DELETE } = crud

// Custom POST to handle lines
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth instanceof Response) return auth

  const body = await request.json()
  const lines = body.lines || []
  delete body.lines

  // Validate
  const totalDebit = lines.reduce((s: number, l: any) => s + (l.debit || 0), 0)
  const totalCredit = lines.reduce((s: number, l: any) => s + (l.credit || 0), 0)
  if (lines.length && Math.abs(totalDebit - totalCredit) > 0.01) {
    return apiError(`Debits ($${totalDebit}) must equal credits ($${totalCredit})`)
  }

  body.workspace_id = auth.workspaceId
  body.created_by = auth.userId
  body.total_debit = totalDebit
  body.total_credit = totalCredit

  const { data, error } = await auth.supabase.from('journal_entries').insert(body).select().single()
  if (error) return apiError(error.message, 400)

  // Insert lines
  if (lines.length) {
    await auth.supabase.from('journal_lines').insert(
      lines.map((l: any, i: number) => ({
        journal_entry_id: data.id,
        account_id: l.account_id,
        description: l.description || null,
        debit: l.debit || 0,
        credit: l.credit || 0,
        order_index: i,
      }))
    )

    // Update balances if posted
    if (data.status === 'posted') {
      for (const line of lines) {
        const delta = (line.debit || 0) - (line.credit || 0)
        const { data: account } = await auth.supabase
          .from('chart_of_accounts').select('balance, type').eq('id', line.account_id).single()
        if (account) {
          const newBalance = ['asset', 'expense'].includes(account.type)
            ? account.balance + delta
            : account.balance - delta
          await auth.supabase.from('chart_of_accounts').update({ balance: newBalance }).eq('id', line.account_id)
        }
      }
    }
  }

  return apiSuccess(data)
}
