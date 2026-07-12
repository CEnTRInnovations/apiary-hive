import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AiInsightStrip } from '../components/ui/AiInsightStrip'

describe('AiInsightStrip', () => {
  it('renders the AI insight badge and children by default (open)', () => {
    render(<AiInsightStrip>Rationale text</AiInsightStrip>)
    expect(screen.getByText('AI insight')).toBeInTheDocument()
    expect(screen.getByText('Rationale text')).toBeInTheDocument()
  })

  it('renders category and confidence when provided', () => {
    render(
      <AiInsightStrip category="SPLIT" categoryAccent="clay" confidence="medium">
        body
      </AiInsightStrip>,
    )
    expect(screen.getByText('SPLIT')).toBeInTheDocument()
    expect(screen.getByText('Confidence: medium')).toBeInTheDocument()
  })

  it('hides children when Hide Details is clicked', () => {
    render(<AiInsightStrip>Rationale text</AiInsightStrip>)
    fireEvent.click(screen.getByText('Hide Details'))
    expect(screen.queryByText('Rationale text')).not.toBeInTheDocument()
  })

  it('renders the actions slot', () => {
    render(<AiInsightStrip actions={<button>Accept Recommendations</button>}>body</AiInsightStrip>)
    expect(screen.getByText('Accept Recommendations')).toBeInTheDocument()
  })
})
