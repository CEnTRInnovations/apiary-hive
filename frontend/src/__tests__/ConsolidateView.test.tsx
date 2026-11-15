import { describe, it, expect } from 'vitest'
import { useEffect } from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { ConsolidateView } from '../views/ConsolidateView'
import { useAppState } from '../lib/state'
import type { Bundle } from '../lib/types'

const bundle = (id: string, members: string[]): Bundle => ({
  bundle_id: id,
  anchor: members[0],
  label: null,
  members,
  decision: null,
  sim_score: 0.9,
  struct: 0,
  semantic: 0,
  ai_review_json: null,
  weak_pairs: [],
})

function Harness() {
  const [state, dispatch] = useAppState()
  useEffect(() => {
    dispatch({
      type: 'SET_BUNDLES',
      bundles: [
        bundle('b_001', ['flight attendant', 'flight attendants']),
        bundle('b_002', ['pilot']),
        bundle('b_003', ['captain']),
        bundle('b_004', ['gate']),
      ],
    })
  }, [dispatch])
  return <ConsolidateView state={state} dispatch={dispatch} />
}

describe('ConsolidateView', () => {
  it('puts duplicates in an accordion, leaves unbundled terms open, and bundles ticked terms', () => {
    render(<Harness />)

    expect(screen.getByText('Suggested Duplicates (1)')).toBeInTheDocument()
    expect(screen.getByText('Unbundled Terms (3)')).toBeInTheDocument()
    // Unbundled terms aren't inside a collapsible <details>
    expect(screen.getByText('pilot').closest('details')).toBeNull()

    const bundleBtn = () => screen.queryByRole('button', { name: 'Bundle together' })
    expect(bundleBtn()).toBeNull()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select pilot' }))
    expect(bundleBtn()).toBeDisabled() // needs at least 2

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select captain' }))
    fireEvent.click(bundleBtn()!)

    // pilot + captain are now a real bundle in the accordion; only gate remains unbundled
    expect(screen.getByText('Suggested Duplicates (2)')).toBeInTheDocument()
    expect(screen.getByText('Unbundled Terms (1)')).toBeInTheDocument()
    expect(bundleBtn()).toBeNull()
  })

  it('adds a workshop term as an unbundled row and rejects duplicates', () => {
    render(<Harness />)
    const input = screen.getByRole('textbox', { name: 'Add a term' })
    fireEvent.change(input, { target: { value: 'belonging' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add term' }))

    expect(screen.getByText('belonging')).toBeInTheDocument()
    expect(screen.getByText('Unbundled Terms (4)')).toBeInTheDocument()
    expect(input).toHaveValue('')

    // Typing a term that exists (any case) is blocked with a message
    fireEvent.change(input, { target: { value: 'Belonging' } })
    expect(screen.getByRole('button', { name: 'Add term' })).toBeDisabled()
    expect(screen.getByText(/already in the list/)).toBeInTheDocument()
  })

  it('lets unbundled terms be accepted, and keeps both sections open once a bundle exists', () => {
    render(<Harness />)
    expect(screen.getByText('Suggested Duplicates (1)').closest('details')).toBeNull()
    expect(screen.getByText('0 of 4 decided')).toBeInTheDocument()

    const gate = screen.getByText('gate').closest('[data-singleton]') as HTMLElement
    fireEvent.click(within(gate).getByRole('button', { name: 'Accept' }))

    expect(within(gate).getByRole('button', { name: 'Accept' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('1 of 4 decided')).toBeInTheDocument()
  })
})
