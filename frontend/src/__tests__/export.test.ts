import { describe, it, expect } from 'vitest'
import { buildProvenanceJson, buildTermsCsv, buildEdgesCsv } from '../lib/export'
import type { AppState } from '../lib/types'

const mockState: AppState = {
  project: { name: 'Test', defining_term: 'CEnR' },
  contributors: [
    {
      id: 'C01',
      label: 'Group A',
      data: {
        terms: [{ term: 'community', frequency: 2 }],
        edges: [{ from_term: 'community', to_term: 'trust', weight: 1, effect: 1, composite_id: 'C01' }],
        n_terms: 1,
        n_edges: 1,
        n_positive: 1,
        n_negative: 0,
      },
    },
  ],
  bundles: [
    {
      bundle_id: 'b_001',
      anchor: 'community',
      label: null,
      members: ['community', 'trust'],
      decision: 'accept',
      sim_score: 0.8,
      struct: 0.5,
      semantic: 0.7,
      ai_review_json: null,
    },
  ],
  semThresh: 0.65,
  structThresh: 0.48,
  modelConfig: null,
  stage: 'export',
  canonicalTerms: [{ term: 'community', frequency: 2 }],
  recodedEdges: [{ from_term: 'community', to_term: 'trust', weight: 1, effect: 1, composite_id: 'C01' }],
}

describe('buildProvenanceJson', () => {
  it('produces valid JSON with required keys', () => {
    const json = buildProvenanceJson(mockState)
    const doc = JSON.parse(json)
    expect(doc.format).toBe('apiary-hive-provenance')
    expect(doc.canonical_terms).toContain('community')
    expect(doc.bundles[0].bundle_id).toBe('b_001')
    expect(doc.raw_edges.length).toBe(1)
  })

  it('includes contributor summary', () => {
    const doc = JSON.parse(buildProvenanceJson(mockState))
    expect(doc.contributors[0].id).toBe('C01')
    expect(doc.contributors[0].n_edges).toBe(1)
  })
})

describe('buildTermsCsv', () => {
  it('has header and one data row', () => {
    const csv = buildTermsCsv(mockState)
    expect(csv).toContain('term,frequency')
    expect(csv).toContain('"community",2')
  })
})

describe('buildEdgesCsv', () => {
  it('has header and one data row', () => {
    const csv = buildEdgesCsv(mockState)
    expect(csv).toContain('from,to,weight,effect,contributor_id')
    expect(csv).toContain('"community","trust",1,1,"C01"')
  })
})
