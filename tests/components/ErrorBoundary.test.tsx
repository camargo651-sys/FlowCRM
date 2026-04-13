import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ErrorBoundary from '@/components/shared/ErrorBoundary'

// Suppress React error boundary console noise during tests
const originalError = console.error
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('ErrorBoundary')) return
    if (typeof args[0] === 'string' && args[0].includes('The above error')) return
    originalError(...args)
  }
})
afterAll(() => {
  console.error = originalError
})

function GoodChild() {
  return <div>Everything is fine</div>
}

function BadChild(): JSX.Element {
  throw new Error('Test explosion')
}

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <GoodChild />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Everything is fine')).toBeDefined()
  })

  it('shows default fallback when a child throws', () => {
    render(
      <ErrorBoundary>
        <BadChild />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Something went wrong')).toBeDefined()
    expect(screen.getByText('Try again')).toBeDefined()
  })

  it('shows custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom error message</div>}>
        <BadChild />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Custom error message')).toBeDefined()
  })

  it('resets error state when Try again is clicked', () => {
    // Use a component that throws only on first render
    let shouldThrow = true
    function MaybeThrow(): JSX.Element {
      if (shouldThrow) throw new Error('boom')
      return <div>Recovered</div>
    }

    render(
      <ErrorBoundary>
        <MaybeThrow />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Something went wrong')).toBeDefined()

    // Stop throwing before clicking retry
    shouldThrow = false
    fireEvent.click(screen.getByText('Try again'))

    expect(screen.getByText('Recovered')).toBeDefined()
  })
})
