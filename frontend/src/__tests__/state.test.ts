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
})
