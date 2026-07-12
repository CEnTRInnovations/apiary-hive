import { useState, useTransition, useRef, useEffect } from 'react'
import type { AppState } from '../lib/types'
import type { AppAction } from '../lib/state'
import { computeBundles, reviewBundle } from '../lib/api'
import { BundleCard } from '../components/hive/BundleCard'
import { BundleContributionMap, type ChordRow } from '../components/hive/BundleContributionMap'
import { BundlingSensitivityPanel } from '../components/hive/BundlingSensitivityPanel'
import { PhaseHeader } from '../components/hive/PhaseHeader'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Chip } from '../components/ui/Chip'

interface ConsolidateViewProps {
  state: AppState
  dispatch: React.Dispatch<AppAction>
}

export function ConsolidateView({ state, dispatch }: ConsolidateViewProps) {
  const [isPending, startTransition] = useTransition()
  const [computeError, setComputeError] = useState<string | null>(null)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [finalized, setFinalized] = useState(false)
  const [reviewingBundleId, setReviewingBundleId] = useState<string | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (finalized) mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [finalized])

  const allEdges = state.contributors.flatMap((c) =>
    (c.data?.edges ?? []).map((e) => ({ ...e, composite_id: c.id })),
  )
  const freqMap: Record<string, number> = {}
  for (const c of state.contributors) {
    for (const t of c.data?.terms ?? []) {
      freqMap[t.term] = (freqMap[t.term] ?? 0) + t.frequency
    }
  }
  const allTerms = Object.entries(freqMap).map(([term, frequency]) => ({ term, frequency }))

  const decidedCount = state.bundles.filter((b) => !!b.decision).length
  const pendingDiscussion = state.bundles.filter((b) => b.decision === 'needs_discussion').length

  function handleCompute() {
    setComputeError(null)
    startTransition(async () => {
      try {
        const bundles = await computeBundles(allEdges, allTerms, state.semThresh, state.structThresh, state.modelConfig)
        dispatch({ type: 'SET_BUNDLES', bundles })
      } catch (err) {
        setComputeError(err instanceof Error ? err.message : 'Compute failed')
      }
    })
  }

  function handleMarkAllAccept() {
    for (const b of state.bundles) {
      dispatch({ type: 'SET_BUNDLE_DECISION', bundleId: b.bundle_id, decision: 'accept' })
    }
  }

  function handleFinalize() {
    dispatch({ type: 'FINALIZE' })
    setFinalized(true)
  }

  async function handleAiReview(bundleId: string) {
    // No `if (!state.modelConfig) return` guard here — a null modelConfig is valid now.
    // The backend falls back to this deployment's default provider when the request omits
    // llm_config; if neither the user nor the deployment has one configured, the request
    // fails with a clear 400 that surfaces via the catch block below.
    const bundle = state.bundles.find((b) => b.bundle_id === bundleId)
    if (!bundle) return
    setReviewingBundleId(bundleId)
    setReviewError(null)
    try {
      const result = await reviewBundle(bundleId, bundle.anchor, bundle.members, state.modelConfig)
      dispatch({ type: 'SET_BUNDLE_AI_REVIEW', bundleId, aiReview: result.ai_review })
    } catch (err) {
      setReviewError(`AI review failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setReviewingBundleId(null)
    }
  }

  const bundleLabelMap: Record<string, string> = {}
  for (const b of state.bundles) {
    if (b.decision !== 'reject') {
      for (const m of b.members) bundleLabelMap[m] = b.label || b.anchor
    }
  }
  const chordRows: ChordRow[] = state.contributors.flatMap((c) => {
    const seen = new Set<string>()
    const rows: ChordRow[] = []
    for (const e of c.data?.edges ?? []) {
      for (const term of [e.from_term, e.to_term]) {
        if (!seen.has(term)) {
          seen.add(term)
          rows.push({ group: c.label, term, bundle: bundleLabelMap[term] ?? null })
        }
      }
    }
    return rows
  })

  return (
    <div className="max-w-2xl space-y-4">
      <PhaseHeader
        phase="Step 2"
        title="Consolidate"
        description="Review and decide on suggested term bundles."
      />

      <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'SET_STAGE', stage: 'gather' })}>
        ← Back to Gather
      </Button>

      {/* All-terms summary */}
      {allTerms.length > 0 && (
        <details className="rounded-card border border-canon-border bg-canon-paper-bright overflow-hidden">
          <summary className="px-4 py-3 cursor-pointer font-mono text-[0.65rem] font-bold tracking-[0.14em] uppercase text-canon-muted select-none hover:bg-canon-sand">
            All Terms ({allTerms.length})
          </summary>
          <div className="px-4 pb-4 pt-2 flex flex-wrap gap-1.5">
            {allTerms.map((t) => {
              const inBundle = state.bundles.find((b) => b.members.includes(t.term))
              return (
                <Chip
                  key={t.term}
                  accent={inBundle ? undefined : 'signal'}
                  className={inBundle ? 'bg-canon-sand' : undefined}
                  title={inBundle ? `In bundle: ${inBundle.label ?? inBundle.anchor}` : 'Not bundled'}
                >
                  {t.term}
                  {t.frequency > 1 && <span className="ml-1 opacity-60">×{t.frequency}</span>}
                </Chip>
              )
            })}
          </div>
        </details>
      )}

      <BundlingSensitivityPanel
        semThresh={state.semThresh}
        structThresh={state.structThresh}
        termCount={allTerms.length}
        isPending={isPending}
        onSemThreshChange={(v) => dispatch({ type: 'SET_SEM_THRESH', value: v })}
        onStructThreshChange={(v) => dispatch({ type: 'SET_STRUCT_THRESH', value: v })}
        onCompute={handleCompute}
        computeError={computeError}
      />

      {/* Bundle list header */}
      {state.bundles.length === 0 ? (
        <EmptyState
          heading="Nothing bundled yet"
          description="Compute bundles above once you've uploaded contributor data."
        />
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-sm text-canon-muted">
            {decidedCount} of {state.bundles.length} decided
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleMarkAllAccept} disabled={isPending}>
              Mark All Accept
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleFinalize}
              disabled={isPending || pendingDiscussion > 0}
              title={pendingDiscussion > 0 ? `${pendingDiscussion} bundle(s) need discussion` : undefined}
            >
              Finalize
            </Button>
          </div>
        </div>
      )}

      {reviewError && <p className="text-canon-signal text-sm mt-2">{reviewError}</p>}

      {/* Bundle cards */}
      <div className="space-y-3">
        {state.bundles.map((b) => (
          <BundleCard
            key={b.bundle_id}
            bundle={b}
            allBundles={state.bundles}
            onDecision={(bundleId, decision) => dispatch({ type: 'SET_BUNDLE_DECISION', bundleId, decision })}
            onRename={(bundleId, label) => dispatch({ type: 'RENAME_BUNDLE', bundleId, label: label || null })}
            onSplit={(bundleId, groups) => dispatch({ type: 'SPLIT_BUNDLE', bundleId, groups, freqMap })}
            onMerge={(sourceBundleId, targetBundleId) => dispatch({ type: 'MERGE_BUNDLE', sourceBundleId, targetBundleId })}
            onAiReview={() => handleAiReview(b.bundle_id)}
            isReviewing={reviewingBundleId === b.bundle_id}
          />
        ))}
      </div>

      {/* Contribution map (shown after finalize) */}
      {finalized && (
        <div ref={mapRef} className="mt-8 space-y-4">
          <p className="font-mono text-[0.65rem] font-bold tracking-[0.14em] uppercase text-canon-muted">
            Bundle Contribution Map
          </p>
          <BundleContributionMap
            rows={chordRows}
            bundles={state.bundles}
            onProceed={() => dispatch({ type: 'SET_STAGE', stage: 'export' })}
          />
        </div>
      )}
    </div>
  )
}
