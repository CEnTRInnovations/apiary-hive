import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAppState } from '../lib/state'

describe('useAppState', () => {
  it('initializes ownerToken as null', () => {
    const { result } = renderHook(() => useAppState())
    const [state] = result.current
    expect(state.ownerToken).toBeNull()
  })

  it('SET_OWNER_TOKEN updates ownerToken', () => {
    const { result } = renderHook(() => useAppState())
    act(() => {
      result.current[1]({ type: 'SET_OWNER_TOKEN', token: 'abc123' })
    })
    expect(result.current[0].ownerToken).toBe('abc123')
  })

  it('FINALIZE drops a rejected term from canonicalTerms AND any edge touching it', () => {
    const { result } = renderHook(() => useAppState())
    act(() => {
      result.current[1]({
        type: 'ADD_CONTRIBUTORS_BULK',
        entries: [
          {
            label: 'Group 1',
            data: {
              terms: [
                { term: 'ticket', frequency: 2 },
                { term: 'usher', frequency: 1 },
                { term: 'theater', frequency: 1 },
              ],
              edges: [
                { from_term: 'ticket', to_term: 'usher', weight: 1, effect: 1, composite_id: '' },
                { from_term: 'usher', to_term: 'theater', weight: 1, effect: 1, composite_id: '' },
              ],
              n_terms: 3,
              n_edges: 2,
              n_positive: 2,
              n_negative: 0,
            },
          },
        ],
      })
    })

    act(() => {
      result.current[1]({
        type: 'SET_BUNDLES',
        bundles: [
          {
            bundle_id: 'b_001',
            anchor: 'ticket',
            label: null,
            members: ['ticket'],
            decision: null,
            sim_score: 0,
            struct: 0,
            semantic: 0,
            ai_review_json: null,
            weak_pairs: [],
          },
          {
            bundle_id: 'b_002',
            anchor: 'usher',
            label: null,
            members: ['usher'],
            decision: 'reject',
            sim_score: 0,
            struct: 0,
            semantic: 0,
            ai_review_json: null,
            weak_pairs: [],
          },
          {
            bundle_id: 'b_003',
            anchor: 'theater',
            label: null,
            members: ['theater'],
            decision: null,
            sim_score: 0,
            struct: 0,
            semantic: 0,
            ai_review_json: null,
            weak_pairs: [],
          },
        ],
      })
    })

    act(() => {
      result.current[1]({ type: 'FINALIZE' })
    })

    const { canonicalTerms, recodedEdges } = result.current[0]
    expect(canonicalTerms.map((t) => t.term).sort()).toEqual(['theater', 'ticket'])
    expect(recodedEdges).toEqual([])
  })
})
