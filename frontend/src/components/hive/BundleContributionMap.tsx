import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { Bundle } from '../../lib/types'
import { Button } from '../ui/Button'

export interface ChordRow {
  group: string
  term: string
  bundle: string | null
}

const ACCENTS = [
  '#3F5E78', '#3B6B35', '#4E342E', '#B8754A',
  '#8E2A2A', '#6F7A5A', '#7A4A62',
]

interface BundleContributionMapProps {
  rows: ChordRow[]
  bundles: Bundle[]
  onProceed: () => void
}

export function BundleContributionMap({ rows, bundles, onProceed }: BundleContributionMapProps) {
  const [expanded, setExpanded] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const acceptedCount = bundles.filter((b) => b.decision === 'accept' || !b.decision).length

  useEffect(() => {
    if (!expanded || !svgRef.current || rows.length === 0) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = svgRef.current.getBoundingClientRect().width || 800
    const nodeHeight = 20, nodePad = 6
    const colX = [60, width / 2, width - 60]

    const groups = Array.from(new Set(rows.map((r) => r.group)))
    const uniqueTerms = Array.from(new Set(rows.map((r) => r.term)))
    const bundleNames = [
      ...Array.from(new Set(rows.map((r) => r.bundle).filter(Boolean) as string[])),
      ...(rows.some((r) => r.bundle === null) ? ['(rejected)'] : []),
    ]

    const groupColor = new Map(groups.map((g, i) => [g, ACCENTS[i % ACCENTS.length]]))
    const totalHeight = Math.max(
      groups.length, uniqueTerms.length, bundleNames.length
    ) * (nodeHeight + nodePad) + nodePad
    svg.attr('height', totalHeight)

    function nodeY(_items: string[], idx: number) { return idx * (nodeHeight + nodePad) }

    function drawNodes(col: number, items: string[], colorFn?: (n: string) => string) {
      items.forEach((name, i) => {
        const y = nodeY(items, i)
        svg.append('rect').attr('x', colX[col] - 40).attr('y', y)
          .attr('width', 80).attr('height', nodeHeight)
          .attr('fill', colorFn ? colorFn(name) : name === '(rejected)' ? '#D8CDB2' : '#3F5E78')
          .attr('rx', 3)
        svg.append('text').attr('x', colX[col]).attr('y', y + nodeHeight / 2)
          .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
          .attr('font-size', 10).attr('fill', '#fff').attr('font-family', 'Alegreya Sans, sans-serif')
          .text(name.length > 12 ? name.slice(0, 11) + '…' : name)
      })
    }

    drawNodes(0, groups, (g) => groupColor.get(g) ?? '#3F5E78')
    drawNodes(1, uniqueTerms)
    drawNodes(2, bundleNames)

    rows.forEach((row) => {
      const gi = groups.indexOf(row.group), ti = uniqueTerms.indexOf(row.term)
      if (gi < 0 || ti < 0) return
      const x1 = colX[0] + 40, y1 = nodeY(groups, gi) + nodeHeight / 2
      const x2 = colX[1] - 40, y2 = nodeY(uniqueTerms, ti) + nodeHeight / 2
      const mx = (x1 + x2) / 2
      svg.append('path').attr('d', `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`)
        .attr('fill', 'none').attr('stroke', groupColor.get(row.group) ?? '#3F5E78')
        .attr('stroke-opacity', 0.35).attr('stroke-width', 2)
    })

    const seen = new Set<string>()
    rows.forEach((row) => {
      const key = `${row.term}\0${row.bundle ?? '(rejected)'}`
      if (seen.has(key)) return
      seen.add(key)
      const ti = uniqueTerms.indexOf(row.term), bi = bundleNames.indexOf(row.bundle ?? '(rejected)')
      if (ti < 0 || bi < 0) return
      const x3 = colX[1] + 40, y3 = nodeY(uniqueTerms, ti) + nodeHeight / 2
      const x4 = colX[2] - 40, y4 = nodeY(bundleNames, bi) + nodeHeight / 2
      const mx2 = (x3 + x4) / 2
      svg.append('path').attr('d', `M${x3},${y3} C${mx2},${y3} ${mx2},${y4} ${x4},${y4}`)
        .attr('fill', 'none').attr('stroke', '#3F5E78')
        .attr('stroke-opacity', 0.35).attr('stroke-width', 2)
    })
  }, [expanded, rows])

  return (
    <div className="space-y-4">
      <div className="flex gap-6 text-sm text-canon-muted">
        <span>Total terms: <strong className="text-canon-foreground">{rows.length}</strong></span>
        <span>Accepted bundles: <strong className="text-canon-foreground">{acceptedCount}</strong></span>
      </div>
      <button type="button" onClick={() => setExpanded((e) => !e)}
        className="text-sm underline text-canon-muted hover:text-canon-foreground">
        {expanded ? 'Hide map' : 'Show contribution map'}
      </button>
      {expanded && rows.length > 0 && (
        <div className="overflow-x-auto border border-canon-border rounded-card p-3 bg-canon-paper-bright">
          <svg ref={svgRef} width="100%" className="block" />
        </div>
      )}
      <div className="pt-4 border-t border-canon-border">
        <Button variant="primary" onClick={onProceed}>
          Proceed to Export →
        </Button>
      </div>
    </div>
  )
}
