import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Icon } from '../components/ui/Icon'

describe('Icon', () => {
  it('renders the icon name as text inside a fn-icon span', () => {
    render(<Icon name="check" />)
    expect(screen.getByText('check')).toHaveClass('fn-icon')
  })

  it('applies the fn-icon-filled class when filled', () => {
    render(<Icon name="settings" filled />)
    expect(screen.getByText('settings')).toHaveClass('fn-icon-filled')
  })

  it('sets font-size in pixels from the size prop', () => {
    render(<Icon name="close" size={24} />)
    expect(screen.getByText('close')).toHaveStyle({ fontSize: '24px' })
  })
})
