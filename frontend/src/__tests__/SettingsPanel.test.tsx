import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsPanel } from '../views/SettingsPanel'
import type { AppState } from '../lib/types'
import type { AppAction } from '../lib/state'
import { SEM_THRESH_DEFAULT, STRUCT_THRESH_DEFAULT } from '../lib/constants'

const baseState: AppState = {
  project: { name: 'Test', defining_term: 'CEnR' },
  contributors: [],
  bundles: [],
  semThresh: SEM_THRESH_DEFAULT,
  structThresh: STRUCT_THRESH_DEFAULT,
  modelConfig: null,
  ownerToken: null,
  stage: 'gather',
  canonicalTerms: [],
  recodedEdges: [],
}

describe('SettingsPanel', () => {
  let dispatch: ReturnType<typeof vi.fn<(action: AppAction) => void>>
  let onClose: ReturnType<typeof vi.fn<() => void>>

  beforeEach(() => {
    dispatch = vi.fn()
    onClose = vi.fn()
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
      clear: () => { for (const k in store) delete store[k] },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders "Deployment access" title with only the owner token field', () => {
    render(<SettingsPanel state={baseState} dispatch={dispatch} onClose={onClose} />)
    expect(screen.getByText('Deployment access')).toBeInTheDocument()
    expect(screen.getByLabelText('Owner access code')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Endpoint URL/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Model name/)).not.toBeInTheDocument()
    expect(screen.queryByText('Test connection')).not.toBeInTheDocument()
  })

  it('dispatches SET_OWNER_TOKEN with the trimmed token on Save', () => {
    render(<SettingsPanel state={baseState} dispatch={dispatch} onClose={onClose} />)
    fireEvent.change(screen.getByLabelText('Owner access code'), { target: { value: '  secret123  ' } })
    fireEvent.click(screen.getByText('Save'))
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_OWNER_TOKEN', token: 'secret123' })
    expect(onClose).toHaveBeenCalled()
  })

  it('dispatches SET_OWNER_TOKEN with null when the field is cleared', () => {
    render(<SettingsPanel state={baseState} dispatch={dispatch} onClose={onClose} />)
    fireEvent.click(screen.getByText('Save'))
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_OWNER_TOKEN', token: null })
  })

  it('shows the "ignored" note only when BYOM is configured and a token is entered', () => {
    const state = {
      ...baseState,
      modelConfig: { endpoint: 'http://localhost:1234/v1', model: 'llama-3.3-70b', apiKey: '' },
    }
    render(<SettingsPanel state={state} dispatch={dispatch} onClose={onClose} />)
    expect(screen.queryByText(/will be ignored/)).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Owner access code'), { target: { value: 'secret' } })
    expect(screen.getByText(/will be ignored/)).toBeInTheDocument()
  })
})
