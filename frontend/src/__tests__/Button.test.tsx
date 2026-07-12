import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '../components/ui/Button'

describe('Button', () => {
  it('renders children and calls onClick', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Save</Button>)
    fireEvent.click(screen.getByText('Save'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('applies primary variant classes by default', () => {
    render(<Button>Save</Button>)
    expect(screen.getByText('Save')).toHaveClass('bg-canon-denim')
  })

  it('applies danger variant classes', () => {
    render(<Button variant="danger">Delete</Button>)
    expect(screen.getByText('Delete')).toHaveClass('bg-canon-signal')
  })

  it('applies ghost variant classes', () => {
    render(<Button variant="ghost">Cancel</Button>)
    expect(screen.getByText('Cancel')).toHaveClass('border-canon-border')
  })

  it('does not call onClick when disabled', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick} disabled>Save</Button>)
    fireEvent.click(screen.getByText('Save'))
    expect(onClick).not.toHaveBeenCalled()
  })
})
