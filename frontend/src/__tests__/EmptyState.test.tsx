import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyState } from '../components/ui/EmptyState'

describe('EmptyState', () => {
  it('renders heading and description', () => {
    render(<EmptyState heading="Nothing here yet" description="Compute bundles above." />)
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument()
    expect(screen.getByText('Compute bundles above.')).toBeInTheDocument()
  })

  it('renders the action node when provided', () => {
    render(<EmptyState heading="h" description="d" action={<button>Do it</button>} />)
    expect(screen.getByText('Do it')).toBeInTheDocument()
  })
})
