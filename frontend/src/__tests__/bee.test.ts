import { describe, it, expect } from 'vitest'
import { normalizeEffect, parseBeeFile } from '../lib/bee'

describe('normalizeEffect', () => {
  it('returns 1 for +, +1, 1, null, undefined, empty', () => {
    for (const v of ['+', '+1', '1', 1, null, undefined, '']) {
      expect(normalizeEffect(v)).toBe(1)
    }
  })
  it('returns -1 for -, -1', () => {
    for (const v of ['-', '-1', -1]) {
      expect(normalizeEffect(v)).toBe(-1)
    }
  })
  it('returns 1 for garbage', () => {
    expect(normalizeEffect('garbage')).toBe(1)
  })
})

describe('parseBeeFile', () => {
  it('parses valid .bee file', () => {
    const result = parseBeeFile({
      version: '1.0',
      contributor: { label: 'Group A' },
      edges: [{ from: 'community', to: 'trust', weight: 2, effect: 1 }],
    })
    expect(result.status).toBe('ok')
    expect(result.contributorLabel).toBe('Group A')
    expect(result.edges[0].effect).toBe(1)
  })
  it('defaults effect to 1 when absent', () => {
    const result = parseBeeFile({
      contributor: { label: 'X' },
      edges: [{ from: 'a', to: 'b' }],
    })
    expect(result.edges[0].effect).toBe(1)
  })
  it('returns error for empty edges', () => {
    const result = parseBeeFile({ contributor: { label: 'X' }, edges: [] })
    expect(result.status).toBe('error')
  })
  it('returns error for non-object', () => {
    expect(parseBeeFile('invalid').status).toBe('error')
  })
  it('parses contributor id when present', () => {
    const result = parseBeeFile({
      contributor: { label: 'Group A', id: 'C07' },
      edges: [{ from: 'a', to: 'b' }],
    })
    expect(result.contributorId).toBe('C07')
  })
  it('defaults contributor id to empty string when absent', () => {
    const result = parseBeeFile({
      contributor: { label: 'Group A' },
      edges: [{ from: 'a', to: 'b' }],
    })
    expect(result.contributorId).toBe('')
  })
})
