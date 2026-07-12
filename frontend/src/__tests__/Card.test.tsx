import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card } from '../components/ui/Card'

describe('Card', () => {
  it('renders surface variant by default', () => {
    render(<Card>content</Card>)
    expect(screen.getByText('content')).toHaveClass('bg-canon-paper-bright')
  })

  it('renders fieldset variant with a legend', () => {
    render(
      <Card variant="fieldset" legend="Configure">
        content
      </Card>,
    )
    expect(screen.getByText('Configure')).toBeInTheDocument()
    expect(screen.getByText('content')).toHaveClass('border-2')
  })

  it('applies compact density padding', () => {
    render(<Card density="compact">content</Card>)
    expect(screen.getByText('content')).toHaveClass('p-3.5')
  })
})
