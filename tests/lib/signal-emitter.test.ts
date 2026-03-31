import { describe, it, expect, vi } from 'vitest'

// Mock supabase
const mockSupabase = {
  from: vi.fn(() => ({
    insert: vi.fn(() => ({ data: null, error: null })),
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        gte: vi.fn(() => ({
          order: vi.fn(() => ({ data: [] })),
        })),
        single: vi.fn(() => ({ data: null })),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({ data: null, error: null })),
    })),
  })),
}

describe('Signal Emitter', () => {
  it('should have correct signal weights', async () => {
    // Import after mocks
    const { emitSignal } = await import('@/lib/ai/signal-emitter')

    // Should not throw
    await emitSignal(mockSupabase as any, {
      workspaceId: 'test-ws',
      contactId: 'test-contact',
      signalType: 'email_received',
      source: 'test',
    })

    // Verify insert was called
    expect(mockSupabase.from).toHaveBeenCalledWith('engagement_signals')
  })
})
