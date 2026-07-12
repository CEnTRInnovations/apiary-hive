import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { GatherView } from '../views/GatherView'
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
  stage: 'gather',
  canonicalTerms: [],
  recodedEdges: [],
}

describe('GatherView', () => {
  let dispatch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    dispatch = vi.fn()
    // ponytail: Node 26 exposes experimental global.localStorage (undefined without --localstorage-file),
    // shadowing jsdom's. Stub it so tests get a working in-memory store.
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

  it('renders phase header', () => {
    render(<GatherView state={baseState} dispatch={dispatch as React.Dispatch<AppAction>} />)
    expect(screen.getByText('Gather')).toBeInTheDocument()
  })

  it('dispatches ADD_CONTRIBUTOR on Add click', () => {
    render(<GatherView state={baseState} dispatch={dispatch as React.Dispatch<AppAction>} />)
    const input = screen.getByPlaceholderText(/Contributor label/i)
    fireEvent.change(input, { target: { value: 'Group A' } })
    fireEvent.click(screen.getByText('Add'))
    expect(dispatch).toHaveBeenCalledWith({ type: 'ADD_CONTRIBUTOR', label: 'Group A' })
  })

  it('dispatches ADD_CONTRIBUTOR on Enter key', () => {
    render(<GatherView state={baseState} dispatch={dispatch as React.Dispatch<AppAction>} />)
    const input = screen.getByPlaceholderText(/Contributor label/i)
    fireEvent.change(input, { target: { value: 'Group B' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(dispatch).toHaveBeenCalledWith({ type: 'ADD_CONTRIBUTOR', label: 'Group B' })
  })

  it('does not dispatch ADD_CONTRIBUTOR for blank label', () => {
    render(<GatherView state={baseState} dispatch={dispatch as React.Dispatch<AppAction>} />)
    fireEvent.click(screen.getByText('Add'))
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('shows contributor slots and REMOVE button', () => {
    const state = {
      ...baseState,
      contributors: [{ id: 'C01', label: 'Group A', data: null }],
    }
    render(<GatherView state={state} dispatch={dispatch as React.Dispatch<AppAction>} />)
    expect(screen.getByText(/Group A/)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Remove Group A'))
    expect(dispatch).toHaveBeenCalledWith({ type: 'REMOVE_CONTRIBUTOR', id: 'C01' })
  })

  it('Continue button is disabled with no contributor data', () => {
    const state = {
      ...baseState,
      contributors: [{ id: 'C01', label: 'Group A', data: null }],
    }
    render(<GatherView state={state} dispatch={dispatch as React.Dispatch<AppAction>} />)
    const btn = screen.getByText('Continue to Consolidate →')
    expect(btn).toBeDisabled()
  })

  it('Continue button dispatches SET_STAGE when data present', () => {
    const state = {
      ...baseState,
      contributors: [{
        id: 'C01', label: 'Group A',
        data: { terms: [], edges: [], n_terms: 3, n_edges: 2, n_positive: 2, n_negative: 0 },
      }],
    }
    render(<GatherView state={state} dispatch={dispatch as React.Dispatch<AppAction>} />)
    const btn = screen.getByText('Continue to Consolidate →')
    expect(btn).not.toBeDisabled()
    fireEvent.click(btn)
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_STAGE', stage: 'consolidate' })
  })

  it('shows manifest table when contributor has data', () => {
    const state = {
      ...baseState,
      contributors: [{
        id: 'C01', label: 'Group A',
        data: { terms: [], edges: [], n_terms: 5, n_edges: 4, n_positive: 3, n_negative: 1 },
      }],
    }
    render(<GatherView state={state} dispatch={dispatch as React.Dispatch<AppAction>} />)
    expect(screen.getByText('Upload Manifest')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('file input accepts only .csv and .bee', () => {
    const state = {
      ...baseState,
      contributors: [{ id: 'C01', label: 'Group A', data: null }],
    }
    render(<GatherView state={state} dispatch={dispatch as React.Dispatch<AppAction>} />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput.accept).toBe('.csv,.bee')
  })

  it('defaults to "One at a time" mode and switches to "Bulk upload" on click', () => {
    render(<GatherView state={baseState} dispatch={dispatch as React.Dispatch<AppAction>} />)
    expect(screen.getByText('Contributors')).toBeInTheDocument()
    expect(screen.queryByLabelText('Upload multiple .bee files')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Bulk upload (.bee)'))

    expect(screen.queryByText('Contributors')).not.toBeInTheDocument()
    const bulkInput = screen.getByLabelText('Upload multiple .bee files') as HTMLInputElement
    expect(bulkInput.accept).toBe('.bee')
    expect(bulkInput.multiple).toBe(true)
  })

  it('bulk upload parses each file and dispatches ADD_CONTRIBUTORS_BULK with embedded label/id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'VALID',
          message: 'File validated.',
          contributor_label: 'Hive B',
          contributor_id: 'C02',
          terms: [{ term: 'trust', frequency: 1 }],
          edges: [{ from_term: 'community', to_term: 'trust', weight: 1, effect: 1 }],
          n_terms: 1,
          n_edges: 1,
          n_positive: 1,
          n_negative: 0,
        }),
      }),
    )

    render(<GatherView state={baseState} dispatch={dispatch as React.Dispatch<AppAction>} />)
    fireEvent.click(screen.getByText('Bulk upload (.bee)'))

    const file = new File(['{}'], 'hive-b.bee', { type: 'application/json' })
    const input = screen.getByLabelText('Upload multiple .bee files')
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith({
        type: 'ADD_CONTRIBUTORS_BULK',
        entries: [
          {
            id: 'C02',
            label: 'Hive B',
            data: {
              terms: [{ term: 'trust', frequency: 1 }],
              edges: [{ from_term: 'community', to_term: 'trust', weight: 1, effect: 1, composite_id: '' }],
              n_terms: 1,
              n_edges: 1,
              n_positive: 1,
              n_negative: 0,
            },
          },
        ],
      }),
    )
    await screen.findByText('Added')
  })

  it('bulk upload falls back to the filename when a .bee file has no contributor label', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'VALID',
          message: 'File validated.',
          contributor_label: '',
          contributor_id: '',
          terms: [],
          edges: [],
          n_terms: 0,
          n_edges: 0,
          n_positive: 0,
          n_negative: 0,
        }),
      }),
    )

    render(<GatherView state={baseState} dispatch={dispatch as React.Dispatch<AppAction>} />)
    fireEvent.click(screen.getByText('Bulk upload (.bee)'))

    const file = new File(['{}'], 'unlabeled.bee', { type: 'application/json' })
    fireEvent.change(screen.getByLabelText('Upload multiple .bee files'), { target: { files: [file] } })

    await waitFor(() => expect(dispatch).toHaveBeenCalled())
    const call = dispatch.mock.calls.find((c) => c[0].type === 'ADD_CONTRIBUTORS_BULK')
    expect(call?.[0].entries[0]).toMatchObject({ id: undefined, label: 'unlabeled' })
  })
})
