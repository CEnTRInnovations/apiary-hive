import { describe, it, expect, vi } from 'vitest'
import { useEffect } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ConsolidateView } from '../views/ConsolidateView'
import { useAppState, mergeAiSuggestions } from '../lib/state'
import type { Bundle } from '../lib/types'
import { computeBundles } from '../lib/api'

vi.mock('../lib/api', async (orig) => ({ ...(await orig<typeof import('../lib/api')>()), computeBundles: vi.fn() }))

const bundle = (id: string, members: string[], decision: Bundle['decision'] = null): Bundle => ({
  bundle_id: id,
  anchor: members[0],
  label: null,
  members,
  decision,
  sim_score: 0.9,
  struct: 0,
  semantic: 0,
  ai_review_json: null,
  weak_pairs: [],
})

const terms = ['pilot', 'captain', 'gate'].map((term) => ({ term, frequency: 1 }))

function Harness() {
  const [state, dispatch] = useAppState()
  useEffect(() => {
    dispatch({
      type: 'ADD_CONTRIBUTORS_BULK',
      entries: [{ label: 'G1', data: { terms, edges: [], n_terms: 3, n_edges: 0, n_positive: 0, n_negative: 0 } }],
    })
    dispatch({ type: 'SET_BUNDLES', bundles: terms.map((t, i) => bundle(`b_00${i + 1}`, [t.term])) })
  }, [dispatch])
  return <ConsolidateView state={state} dispatch={dispatch} />
}

describe('AI Suggestions', () => {
  it('asks the AI on click, adds labeled bundles, and says how many', async () => {
    vi.mocked(computeBundles).mockResolvedValue([bundle('b_001', ['pilot', 'captain']), bundle('b_002', ['gate'])])
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'AI Suggestions' }))

    await waitFor(() => expect(screen.getByText('Suggested Duplicates (1)')).toBeInTheDocument())
    expect(vi.mocked(computeBundles).mock.calls[0][5]).toBe(true) // ai flag
    expect(screen.getByText('AI suggested')).toBeInTheDocument()
    expect(screen.getByText('Unbundled Terms (1)')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Added 1 AI suggestion.')
  })

  it('shows the server error and leaves bundles alone', async () => {
    vi.mocked(computeBundles).mockRejectedValue(new Error('No AI configured.'))
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'AI Suggestions' }))

    await waitFor(() => expect(screen.getByText('No AI configured.')).toBeInTheDocument())
    expect(screen.getByText('Unbundled Terms (3)')).toBeInTheDocument()
  })
})

describe('mergeAiSuggestions', () => {
  it('skips suggestions that touch a bundle the user already changed', () => {
    const current = [
      bundle('b_001', ['pilot', 'captain']), // user already bundled these
      bundle('b_002', ['gate']),
      bundle('b_003', ['crew'], 'reject'), // user decided on this one
      bundle('b_004', ['bag']),
    ]
    const suggested = [bundle('b_001', ['pilot', 'gate']), bundle('b_002', ['crew', 'bag']), bundle('b_003', ['gate', 'bag'])]

    const { bundles, applied, skipped } = mergeAiSuggestions(current, suggested)

    expect(applied).toBe(1)
    expect(skipped).toBe(2)
    expect(bundles.map((b) => b.members)).toEqual([['pilot', 'captain'], ['crew'], ['gate', 'bag']])
    expect(bundles.at(-1)).toMatchObject({ ai_suggested: true })
    expect(new Set(bundles.map((b) => b.bundle_id)).size).toBe(bundles.length)
  })
})
