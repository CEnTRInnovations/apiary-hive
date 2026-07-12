import type { AppState } from '../lib/types'
import type { AppAction } from '../lib/state'
import { buildProvenanceJson, buildTermsCsv, buildEdgesCsv, downloadBlob } from '../lib/export'
import { PhaseHeader } from '../components/hive/PhaseHeader'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'

interface ExportViewProps {
  state: AppState
  dispatch: React.Dispatch<AppAction>
}

export function ExportView({ state, dispatch }: ExportViewProps) {
  const projectName = state.project.name || 'apiary-hive'
  const slug = projectName.toLowerCase().replace(/\s+/g, '-')

  const decidedBundles = state.bundles.filter((b) => b.decision !== null)
  const acceptedBundles = state.bundles.filter((b) => !b.decision || b.decision === 'accept')

  return (
    <div className="max-w-2xl space-y-6">
      <PhaseHeader
        phase="Step 3"
        title="Export"
        description="Download your provenance file and optional CSVs."
      />

      {/* Session summary */}
      <Card>
        <p className="font-mono text-[0.68rem] uppercase tracking-wide text-canon-muted mb-3">Session Summary</p>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <dt className="text-canon-muted">Contributors</dt>
          <dd className="font-semibold text-canon-foreground">{state.contributors.length}</dd>
          <dt className="text-canon-muted">Unique terms</dt>
          <dd className="font-semibold text-canon-foreground">{state.canonicalTerms.length}</dd>
          <dt className="text-canon-muted">Total edges</dt>
          <dd className="font-semibold text-canon-foreground">{state.recodedEdges.length}</dd>
          <dt className="text-canon-muted">Bundles (decided / accepted)</dt>
          <dd className="font-semibold text-canon-foreground">{decidedBundles.length} / {acceptedBundles.length}</dd>
        </dl>
      </Card>

      {/* Downloads */}
      <Card className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-canon-foreground">Provenance JSON</p>
          <p className="text-xs text-canon-muted">
            Full record: original uploads → bundle decisions → canonical output.
          </p>
          <Button
            variant="primary"
            onClick={() =>
              downloadBlob(buildProvenanceJson(state), `${slug}-provenance.hive`, 'application/json')
            }
          >
            Download {slug}-provenance.hive
          </Button>
        </div>

        <div className="border-t border-canon-border pt-4 space-y-3">
          <p className="font-mono text-[0.68rem] uppercase tracking-wide text-canon-muted">Optional CSV Exports</p>
          <div className="flex gap-3 flex-wrap">
            <Button
              variant="ghost"
              onClick={() => downloadBlob(buildTermsCsv(state), `${slug}-canonical-terms.csv`, 'text/csv')}
            >
              canonical_terms.csv
            </Button>
            <Button
              variant="ghost"
              onClick={() => downloadBlob(buildEdgesCsv(state), `${slug}-recoded-edges.csv`, 'text/csv')}
            >
              recoded_edges.csv
            </Button>
          </div>
        </div>
      </Card>

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        <Button variant="ghost" onClick={() => dispatch({ type: 'SET_STAGE', stage: 'consolidate' })}>
          ← Back to Consolidate
        </Button>
        <Button variant="ghost" onClick={() => dispatch({ type: 'RESET' })}>
          Start Over
        </Button>
      </div>
    </div>
  )
}
