import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BundleCard } from '../components/hive/BundleCard'
import type { Bundle } from '../lib/types'

const baseBundle: Bundle = {
  bundle_id: 'b_001',
  anchor: 'trust',
  label: null,
  members: ['trust', 'accountability'],
  decision: null,
  sim_score: 0.9,
  struct: 0.0,
  semantic: 0.9,
  ai_review_json: null,
  weak_pairs: [],
}

function noop() {}

describe('BundleCard', () => {
  it('shows the AI-suggested title and applies it via onRename when clicked', () => {
    const onRename = vi.fn()
    const bundle: Bundle = {
      ...baseBundle,
      ai_review_json: {
        recommendation: 'ACCEPT',
        confidence: 'HIGH',
        rationale: 'These terms share one underlying concept.',
        suggested_label: 'Institutional trust',
      },
    }

    render(
      <BundleCard
        bundle={bundle}
        allBundles={[bundle]}
        onDecision={noop}
        onRename={onRename}
        onSplit={noop}
        onMerge={noop}
      />,
    )

    expect(screen.getByText('Institutional trust')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Use'))
    expect(onRename).toHaveBeenCalledWith('b_001', 'Institutional trust')
  })

  it('renders no suggested-title row when the review has none', () => {
    const bundle: Bundle = {
      ...baseBundle,
      ai_review_json: { recommendation: 'ACCEPT', confidence: 'HIGH', rationale: 'r' },
    }

    render(
      <BundleCard
        bundle={bundle}
        allBundles={[bundle]}
        onDecision={noop}
        onRename={noop}
        onSplit={noop}
        onMerge={noop}
      />,
    )

    expect(screen.queryByText('Suggested title:')).not.toBeInTheDocument()
  })
})
