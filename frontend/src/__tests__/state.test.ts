import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAppState } from '../lib/state'
import type { Bundle } from '../lib/types'

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

  const mkBundle = (id: string, members: string[], over: Partial<Bundle> = {}): Bundle => ({
    bundle_id: id, anchor: members[0], label: null, members, decision: null,
    sim_score: 0, struct: 0, semantic: 0, ai_review_json: null, weak_pairs: [], ...over,
  })
  const upload = (terms: [string, number][], edges: [string, string][] = []) => ({
    terms: terms.map(([term, frequency]) => ({ term, frequency })),
    edges: edges.map(([from_term, to_term]) => ({ from_term, to_term, weight: 1, effect: 1 as const, composite_id: '' })),
    n_terms: terms.length, n_edges: edges.length, n_positive: edges.length, n_negative: 0,
  })

  it('FINALIZE exports a renamed bundle under its new name, in terms and edges', () => {
    const { result } = renderHook(() => useAppState())
    const d = result.current[1]
    act(() => d({ type: 'ADD_CONTRIBUTORS_BULK', entries: [{ label: 'G1', data: upload([['housing', 3], ['shelter', 1], ['trust', 1]], [['housing', 'trust']]) }] }))
    act(() => d({ type: 'SET_BUNDLES', bundles: [mkBundle('b_001', ['housing', 'shelter'], { label: 'belonging' }), mkBundle('b_002', ['trust'])] }))
    act(() => d({ type: 'FINALIZE' }))
    const { canonicalTerms, recodedEdges } = result.current[0]
    expect(canonicalTerms).toEqual(expect.arrayContaining([{ term: 'belonging', frequency: 3 }, { term: 'trust', frequency: 1 }]))
    expect(canonicalTerms.map((t) => t.term)).not.toContain('housing')
    expect(recodedEdges.map((e) => [e.from_term, e.to_term])).toEqual([['belonging', 'trust']])
  })

  it('ADD_WORKSHOP_TERM records the term under Workshop, adds an unbundled row, and ignores duplicates', () => {
    const { result } = renderHook(() => useAppState())
    const d = result.current[1]
    act(() => d({ type: 'ADD_CONTRIBUTORS_BULK', entries: [{ label: 'G1', data: upload([['housing', 3]]) }] }))
    act(() => d({ type: 'SET_BUNDLES', bundles: [mkBundle('b_001', ['housing'])] }))
    act(() => d({ type: 'ADD_WORKSHOP_TERM', term: '  belonging ' }))
    act(() => d({ type: 'ADD_WORKSHOP_TERM', term: 'Housing' })) // already in G1, case-insensitive
    const s = result.current[0]
    expect(s.contributors.find((c) => c.id === 'workshop')?.data?.terms).toEqual([{ term: 'belonging', frequency: 1 }])
    expect(s.bundles.map((b) => b.members)).toEqual([['housing'], ['belonging']])
  })

  it('a workshop term becomes the anchor when merged in, even against a more frequent term', () => {
    const { result } = renderHook(() => useAppState())
    const d = result.current[1]
    act(() => d({ type: 'ADD_CONTRIBUTORS_BULK', entries: [{ label: 'G1', data: upload([['housing', 5], ['shelter', 2]]) }] }))
    act(() => d({ type: 'SET_BUNDLES', bundles: [mkBundle('b_001', ['housing', 'shelter']) ] }))
    act(() => d({ type: 'ADD_WORKSHOP_TERM', term: 'belonging' }))
    act(() => d({ type: 'MERGE_BUNDLE', sourceBundleId: 'b_002', targetBundleId: 'b_001' }))
    act(() => d({ type: 'FINALIZE' }))
    expect(result.current[0].bundles[0].anchor).toBe('belonging')
    expect(result.current[0].canonicalTerms.map((t) => t.term)).toEqual(['belonging'])
  })

  it('MERGE_BUNDLE clears an earlier decision, so a bundle of accepted terms is not pre-accepted', () => {
    const { result } = renderHook(() => useAppState())
    const d = result.current[1]
    act(() => d({ type: 'SET_BUNDLES', bundles: [mkBundle('b_001', ['pilot'], { decision: 'accept' }), mkBundle('b_002', ['captain'], { decision: 'accept' })] }))
    act(() => d({ type: 'MERGE_BUNDLE', sourceBundleId: 'b_002', targetBundleId: 'b_001' }))
    expect(result.current[0].bundles).toHaveLength(1)
    expect(result.current[0].bundles[0].decision).toBeNull()
  })
})
