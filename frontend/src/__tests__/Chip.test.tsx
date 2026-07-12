import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Chip } from '../components/ui/Chip'

describe('Chip', () => {
  it('renders neutral by default', () => {
    render(<Chip>funding and resources</Chip>)
    expect(screen.getByText('funding and resources')).toHaveClass('bg-canon-paper-bright')
  })

  it('applies accent tint classes', () => {
    render(<Chip accent="forest">shared foundation</Chip>)
    expect(screen.getByText('shared foundation')).toHaveClass('text-canon-forest')
  })

  it('forwards native span attributes like title', () => {
    render(<Chip title="Not bundled">lonely term</Chip>)
    expect(screen.getByText('lonely term')).toHaveAttribute('title', 'Not bundled')
  })
})
