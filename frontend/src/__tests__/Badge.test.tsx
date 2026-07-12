import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from '../components/ui/Badge'

describe('Badge', () => {
  it('renders neutral tint by default', () => {
    render(<Badge>Topo map</Badge>)
    expect(screen.getByText('Topo map')).toHaveClass('bg-canon-sand')
  })

  it('renders solid accent background when solid', () => {
    render(
      <Badge accent="clay" solid>
        Split
      </Badge>,
    )
    expect(screen.getByText('Split')).toHaveClass('bg-canon-clay')
  })

  it('renders tinted accent background when not solid', () => {
    render(<Badge accent="forest">Leverage</Badge>)
    expect(screen.getByText('Leverage')).toHaveClass('text-canon-forest')
  })
})
