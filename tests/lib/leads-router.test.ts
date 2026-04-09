import { describe, it, expect, vi, beforeEach } from 'vitest'
import { routeNewLead } from '@/lib/leads/router'

// ---------------------------------------------------------------------------
// Minimal Supabase mock builder
// ---------------------------------------------------------------------------
function createMockSupabase(overrides: {
  workspace?: Record<string, unknown> | null
  lead?: Record<string, unknown> | null
  openLeads?: { assigned_to: string }[]
}) {
  const calls: Record<string, unknown[]> = {}

  const chain = (tableName: string) => {
    const state: Record<string, unknown> = {}
    const builder: Record<string, Function> = {}

    const self = () => builder
    for (const method of ['select', 'eq', 'in', 'lte', 'gte', 'limit', 'update', 'insert']) {
      builder[method] = (...args: unknown[]) => {
        state[method] = args
        return builder
      }
    }

    builder.single = () => {
      if (tableName === 'workspaces') {
        return { data: overrides.workspace ?? null }
      }
      if (tableName === 'social_leads') {
        return { data: overrides.lead ?? null }
      }
      return { data: null }
    }

    // For queries that return arrays (e.g., in least_loaded counting)
    // When select is called without .single(), the chain resolves to array data
    // We override the eq/in chain to eventually return openLeads
    const originalSelect = builder.select
    builder.select = (...args: unknown[]) => {
      state.select = args
      // Return a proxy that eventually resolves to array data
      const arrayBuilder: Record<string, Function> = { ...builder }
      arrayBuilder.single = () => {
        if (tableName === 'workspaces') return { data: overrides.workspace ?? null }
        if (tableName === 'social_leads') return { data: overrides.lead ?? null }
        return { data: null }
      }
      // Override: if no .single() is called, "then" resolves the builder
      // We need the chain to resolve to { data: openLeads } for social_leads count queries
      for (const m of ['eq', 'in', 'lte', 'gte', 'limit']) {
        arrayBuilder[m] = (...a: unknown[]) => {
          state[m] = a
          return arrayBuilder
        }
      }
      // Make the builder act as a thenable/result for social_leads array queries
      Object.defineProperty(arrayBuilder, 'data', {
        get() {
          if (tableName === 'social_leads') return overrides.openLeads ?? []
          return null
        },
      })
      // Also make it work when destructured as { data }
      arrayBuilder.then = (resolve: Function) => {
        if (tableName === 'social_leads') {
          return resolve({ data: overrides.openLeads ?? [] })
        }
        return resolve({ data: null })
      }
      return arrayBuilder
    }

    return builder
  }

  return {
    from: (table: string) => chain(table),
  } as any
}

describe('Lead Router', () => {
  describe('round_robin mode', () => {
    it('cycles through reps starting after last_assigned_index', async () => {
      const supabase = createMockSupabase({
        workspace: {
          lead_routing_config: {
            enabled: true,
            mode: 'round_robin',
            reps: ['rep-a', 'rep-b', 'rep-c'],
            last_assigned_index: 0,
          },
        },
        lead: { author_name: 'Test Lead' },
      })

      const result = await routeNewLead(supabase, 'ws-1', 'lead-1')
      expect(result).toBe('rep-b')
    })

    it('wraps around to first rep after last', async () => {
      const supabase = createMockSupabase({
        workspace: {
          lead_routing_config: {
            enabled: true,
            mode: 'round_robin',
            reps: ['rep-a', 'rep-b'],
            last_assigned_index: 1,
          },
        },
        lead: { author_name: 'Test Lead' },
      })

      const result = await routeNewLead(supabase, 'ws-1', 'lead-1')
      expect(result).toBe('rep-a')
    })
  })

  describe('least_loaded mode', () => {
    it('picks the rep with fewest open leads', async () => {
      const supabase = createMockSupabase({
        workspace: {
          lead_routing_config: {
            enabled: true,
            mode: 'least_loaded',
            reps: ['rep-a', 'rep-b', 'rep-c'],
            last_assigned_index: 0,
          },
        },
        lead: { author_name: 'Test Lead' },
        openLeads: [
          { assigned_to: 'rep-a' },
          { assigned_to: 'rep-a' },
          { assigned_to: 'rep-b' },
          // rep-c has 0 leads — should be selected
        ],
      })

      const result = await routeNewLead(supabase, 'ws-1', 'lead-1')
      expect(result).toBe('rep-c')
    })
  })

  describe('disabled config', () => {
    it('returns null when routing is disabled', async () => {
      const supabase = createMockSupabase({
        workspace: {
          lead_routing_config: {
            enabled: false,
            mode: 'round_robin',
            reps: ['rep-a'],
            last_assigned_index: 0,
          },
        },
      })

      const result = await routeNewLead(supabase, 'ws-1', 'lead-1')
      expect(result).toBeNull()
    })

    it('returns null when config is null', async () => {
      const supabase = createMockSupabase({
        workspace: { lead_routing_config: null },
      })

      const result = await routeNewLead(supabase, 'ws-1', 'lead-1')
      expect(result).toBeNull()
    })
  })

  describe('empty reps', () => {
    it('returns null when reps array is empty', async () => {
      const supabase = createMockSupabase({
        workspace: {
          lead_routing_config: {
            enabled: true,
            mode: 'round_robin',
            reps: [],
            last_assigned_index: 0,
          },
        },
      })

      const result = await routeNewLead(supabase, 'ws-1', 'lead-1')
      expect(result).toBeNull()
    })
  })

  describe('no workspace found', () => {
    it('returns null when workspace does not exist', async () => {
      const supabase = createMockSupabase({ workspace: null })

      const result = await routeNewLead(supabase, 'ws-x', 'lead-1')
      expect(result).toBeNull()
    })
  })
})
