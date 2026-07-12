import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LandingView } from '../views/LandingView'
import type { AppState } from '../lib/types'
import type { AppAction } from '../lib/state'
import { SEM_THRESH_DEFAULT, STRUCT_THRESH_DEFAULT } from '../lib/constants'

const baseState: AppState = {
  project: { name: '', defining_term: 'Community-Engaged Research' },
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

describe('LandingView', () => {
  it('renders the hero title and all three phase cards', () => {
    render(<LandingView state={baseState} dispatch={vi.fn()} onBegin={vi.fn()} />)
    expect(screen.getByText('Many hexagons, one hive.')).toBeInTheDocument()
    expect(screen.getByText('Forage')).toBeInTheDocument()
    expect(screen.getByText('Comb')).toBeInTheDocument()
    expect(screen.getByText('Harvest')).toBeInTheDocument()
  })

  it('has no resume-from-file affordance', () => {
    render(<LandingView state={baseState} dispatch={vi.fn()} onBegin={vi.fn()} />)
    expect(screen.queryByText(/resume/i)).not.toBeInTheDocument()
    expect(document.querySelector('input[type="file"]')).toBeNull()
  })

  it('dispatches SET_PROJECT and calls onBegin when Begin Foraging is clicked', () => {
    const dispatch = vi.fn()
    const onBegin = vi.fn()
    render(<LandingView state={baseState} dispatch={dispatch as React.Dispatch<AppAction>} onBegin={onBegin} />)

    fireEvent.change(screen.getByLabelText('Hive name'), { target: { value: 'Fall Cohort' } })
    fireEvent.click(screen.getByText('Begin Foraging'))

    expect(dispatch).toHaveBeenCalledWith({
      type: 'SET_PROJECT',
      name: 'Fall Cohort',
      defining_term: 'Community-Engaged Research',
    })
    expect(onBegin).toHaveBeenCalled()
  })

  it('defaults the defining-term select to Community-Engaged Research', () => {
    render(<LandingView state={baseState} dispatch={vi.fn()} onBegin={vi.fn()} />)
    const select = screen.getByLabelText('What are we working towards?') as HTMLSelectElement
    expect(select.value).toBe('Community-Engaged Research')
  })

  it('reveals a free-text field and uses its value when Other is selected', () => {
    const dispatch = vi.fn()
    render(<LandingView state={baseState} dispatch={dispatch as React.Dispatch<AppAction>} onBegin={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('What are we working towards?'), { target: { value: 'Other' } })
    fireEvent.change(screen.getByLabelText('Custom defining term'), { target: { value: 'Civic Design' } })
    fireEvent.click(screen.getByText('Begin Foraging'))

    expect(dispatch).toHaveBeenCalledWith({
      type: 'SET_PROJECT',
      name: '',
      defining_term: 'Civic Design',
    })
  })
})
