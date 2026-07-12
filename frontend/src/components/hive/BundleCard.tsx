import { useState, useEffect } from 'react'
import { cn } from '../../lib/cn'
import { Icon } from '../ui/Icon'
import { Button } from '../ui/Button'
import { AiInsightStrip } from '../ui/AiInsightStrip'
import type { Bundle } from '../../lib/types'

type Decision = 'accept' | 'split' | 'reject'

interface BundleCardProps {
  bundle: Bundle
  allBundles: Bundle[]
  onDecision: (bundleId: string, decision: Decision) => void
  onRename: (bundleId: string, label: string) => void
  onSplit: (bundleId: string, groups: Record<string, 'A' | 'B' | 'Singleton'>) => void
  onMerge: (sourceBundleId: string, targetBundleId: string) => void
  onAiReview?: () => void
  isReviewing?: boolean
}

const DECISIONS: {
  value: Decision
  label: string
  icon: string
  activeClass: string
}[] = [
  {
    value: 'accept',
    label: 'Accept',
    icon: 'check_circle',
    activeClass: 'bg-canon-forest text-white border-canon-forest',
  },
  {
    value: 'split',
    label: 'Split',
    icon: 'content_cut',
    activeClass: 'bg-canon-clay text-white border-canon-clay',
  },
  {
    value: 'reject',
    label: 'Reject',
    icon: 'cancel',
    activeClass: 'bg-canon-signal text-white border-canon-signal',
  },
]

const REC_ACCENTS: Record<string, 'forest' | 'clay' | 'signal'> = {
  ACCEPT: 'forest',
  SPLIT: 'clay',
  REJECT: 'signal',
}

function AiReviewSkeleton() {
  return (
    <div
      data-testid="ai-review-skeleton"
      className="pt-2 mt-2 border-t border-canon-border space-y-2"
    >
      <div className="h-2.5 animate-pulse bg-canon-border rounded w-1/3" />
      <div className="h-5   animate-pulse bg-canon-border rounded w-1/4" />
      <div className="h-2.5 animate-pulse bg-canon-border rounded w-3/4" />
      <div className="h-2.5 animate-pulse bg-canon-border rounded w-1/2" />
    </div>
  )
}

type SuggestedSplit = { label: string; members: string[] }

function AiReviewContent({
  json,
  onAcceptRecommendation,
}: {
  json: Record<string, unknown>
  onAcceptRecommendation?: (decision: Decision, suggestedSplits: SuggestedSplit[]) => void
}) {
  const recommendation = typeof json.recommendation === 'string' ? json.recommendation : null
  const confidence     = typeof json.confidence     === 'string' ? json.confidence     : null
  const rationale      = typeof json.rationale      === 'string' ? json.rationale      : null
  const preserved      = typeof json.preserved_if_consolidated === 'string' ? json.preserved_if_consolidated : null
  const flattened      = typeof json.flattened_if_consolidated === 'string' ? json.flattened_if_consolidated : null
  const raw            = typeof json.raw            === 'string' ? json.raw            : null

  const suggestedSplits: SuggestedSplit[] = Array.isArray(json.suggested_splits)
    ? (json.suggested_splits as unknown[]).filter(
        (s): s is SuggestedSplit =>
          typeof s === 'object' &&
          s !== null &&
          typeof (s as Record<string, unknown>).label === 'string' &&
          Array.isArray((s as Record<string, unknown>).members),
      )
    : []

  const discussionQuestions: string[] = Array.isArray(json.discussion_questions)
    ? (json.discussion_questions as unknown[]).filter((q): q is string => typeof q === 'string')
    : []

  if (!recommendation && !rationale && !raw) return null

  const canAcceptRecommendation =
    !!onAcceptRecommendation &&
    !!recommendation &&
    (recommendation === 'ACCEPT' || recommendation === 'SPLIT' || recommendation === 'REJECT')

  return (
    <div data-testid="ai-review-content" className="mt-2">
      <AiInsightStrip
        category={recommendation ?? undefined}
        categoryAccent={recommendation ? REC_ACCENTS[recommendation] : undefined}
        confidence={confidence}
        actions={
          canAcceptRecommendation ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAcceptRecommendation!(recommendation!.toLowerCase() as Decision, suggestedSplits)}
            >
              <Icon name="auto_awesome" size={14} />
              Accept Recommendations
            </Button>
          ) : undefined
        }
      >
        {rationale && (
          <div>
            <p className="text-xs font-semibold text-canon-foreground mb-1">Rationale</p>
            <p className="text-sm text-canon-foreground leading-relaxed">{rationale}</p>
          </div>
        )}

        {(preserved || flattened) && (
          <div className="grid grid-cols-2 gap-2">
            {preserved && (
              <div className="rounded border border-canon-forest/25 bg-canon-forest/[0.06] p-2">
                <p className="text-xs font-semibold text-canon-forest mb-1">
                  Would be preserved if consolidated
                </p>
                <p className="text-xs text-canon-foreground leading-relaxed">{preserved}</p>
              </div>
            )}
            {flattened && (
              <div className="rounded border border-canon-clay/30 bg-canon-clay/[0.08] p-2">
                <p className="text-xs font-semibold text-canon-clay mb-1">
                  Could be flattened if consolidated
                </p>
                <p className="text-xs text-canon-foreground leading-relaxed">{flattened}</p>
              </div>
            )}
          </div>
        )}

        {suggestedSplits.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-canon-foreground mb-2">Suggested splits</p>
            <div className="flex flex-wrap gap-2">
              {suggestedSplits.map((split, i) => (
                <div
                  key={i}
                  className="rounded border border-canon-border bg-canon-paper-bright p-2 min-w-[100px]"
                >
                  <p className="text-xs font-semibold text-canon-foreground mb-1">{split.label}</p>
                  <div className="flex flex-wrap gap-1">
                    {split.members.map((m) => (
                      <span
                        key={m}
                        className="text-[0.6rem] bg-canon-sand border border-canon-border px-1.5 py-0.5 rounded-full"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {discussionQuestions.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-canon-foreground mb-1">Questions for discussion</p>
            <ul className="list-disc list-inside space-y-1">
              {discussionQuestions.map((q, i) => (
                <li key={i} className="text-xs text-canon-foreground leading-relaxed">
                  {q}
                </li>
              ))}
            </ul>
          </div>
        )}

        {raw && (
          <p className="text-xs text-canon-muted italic leading-relaxed">{raw}</p>
        )}
      </AiInsightStrip>
    </div>
  )
}

export function BundleCard({
  bundle,
  allBundles,
  onDecision,
  onRename,
  onSplit,
  onMerge,
  onAiReview,
  isReviewing,
}: BundleCardProps) {
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(bundle.label ?? '')
  const [splitAssignment, setSplitAssignment] = useState<Record<string, 'A' | 'B' | 'Singleton'>>(
    () => Object.fromEntries(bundle.members.map((m) => [m, 'A' as const])),
  )
  const [mergeMode, setMergeMode] = useState<'add' | 'combine' | null>(null)
  const [mergeTarget, setMergeTarget] = useState('')
  const [splitDismissed, setSplitDismissed] = useState(false)

  useEffect(() => {
    setSplitAssignment(
      Object.fromEntries(bundle.members.map((m) => [m, 'A' as const])),
    )
  }, [bundle.bundle_id, bundle.members])

  useEffect(() => {
    if (!renaming) setRenameValue(bundle.label ?? '')
  }, [bundle.label, renaming])

  useEffect(() => {
    setSplitDismissed(false)
  }, [bundle.decision])

  const isSingleton = bundle.members.length === 1
  const showSplitPanel = bundle.decision === 'split' && !isSingleton && !splitDismissed
  const otherBundles = allBundles.filter((b) => b.bundle_id !== bundle.bundle_id)
  const bundlesForAdd = otherBundles.filter((b) => b.members.length > 1)
  const termsForCombine = otherBundles.filter((b) => b.members.length === 1)

  function handleRenameBlur() {
    setRenaming(false)
    onRename(bundle.bundle_id, renameValue)
  }

  function handleRenameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      setRenaming(false)
      onRename(bundle.bundle_id, renameValue)
    } else if (e.key === 'Escape') {
      setRenaming(false)
      setRenameValue(bundle.label ?? '')
    }
  }

  function handleConfirmSplit() {
    onSplit(bundle.bundle_id, splitAssignment)
  }

  function handleConfirmMerge() {
    if (!mergeTarget) return
    onMerge(bundle.bundle_id, mergeTarget)
    setMergeMode(null)
    setMergeTarget('')
  }

  function handleAcceptAiRecommendation(decision: Decision, suggestedSplits: SuggestedSplit[]) {
    if (decision === 'split' && suggestedSplits.length > 0) {
      const newAssignment: Record<string, 'A' | 'B' | 'Singleton'> = {}
      let multiIdx = 0
      for (const split of suggestedSplits) {
        const groupLabel: 'A' | 'B' | 'Singleton' =
          split.members.length === 1
            ? 'Singleton'
            : (['A', 'B'] as const)[multiIdx++ % 2]
        for (const m of split.members) {
          newAssignment[m] = groupLabel
        }
      }
      setSplitAssignment((prev) => ({ ...prev, ...newAssignment }))
    }
    onDecision(bundle.bundle_id, decision)
  }

  const decisionButtonClass = cn(
    'flex items-center gap-1.5 px-3 py-1 text-xs rounded border transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canon-denim',
    'border-canon-border text-canon-foreground hover:border-canon-denim hover:bg-canon-sand',
  )

  return (
    <div data-bundle-card="" className="rounded-card border border-canon-border bg-canon-paper-bright p-4 space-y-3">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-xs font-mono text-canon-muted">{bundle.bundle_id}</span>
          {renaming ? (
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameBlur}
              onKeyDown={handleRenameKeyDown}
              className="block w-full text-lg font-semibold text-canon-foreground border-b border-canon-border bg-transparent outline-none mt-0.5"
              aria-label="Rename bundle"
              autoFocus
            />
          ) : (
            <h3 className="text-lg font-semibold text-canon-foreground">
              {bundle.label || bundle.anchor}
            </h3>
          )}
          <p className="text-sm text-canon-muted">{bundle.members.length} terms</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            aria-label="Rename"
            onClick={() => {
              setRenaming(true)
              setRenameValue(bundle.label ?? '')
            }}
            className="p-1 rounded text-canon-muted hover:text-canon-foreground hover:bg-canon-sand transition-colors"
          >
            <Icon name="edit" size={15} />
          </button>
        </div>
      </div>

      {/* ── Member chips ── */}
      <div className="flex flex-wrap gap-1.5">
        {bundle.members.map((m) => (
          <span
            key={m}
            className="text-xs bg-canon-sand border border-canon-border px-2 py-0.5 rounded-full"
          >
            {m}
          </span>
        ))}
      </div>

      {/* ── Decision buttons + singleton merge triggers + AI Review (all inline) ── */}
      <div className="flex flex-wrap gap-2 pt-1">
        {DECISIONS.map(({ value, label, icon, activeClass }) => {
          const isActive = bundle.decision === value
          return (
            <button
              key={value}
              type="button"
              aria-pressed={isActive}
              onClick={() => onDecision(bundle.bundle_id, value)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 text-xs rounded border transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canon-denim',
                isActive
                  ? activeClass
                  : 'border-canon-border text-canon-foreground hover:border-canon-denim hover:bg-canon-sand',
              )}
            >
              <Icon name={icon} size={14} />
              {label}
            </button>
          )
        })}

        {isSingleton && mergeMode === null && bundlesForAdd.length > 0 && (
          <button type="button" onClick={() => setMergeMode('add')} className={decisionButtonClass}>
            Add to Bundle
          </button>
        )}

        {isSingleton && mergeMode === null && termsForCombine.length > 0 && (
          <button type="button" onClick={() => setMergeMode('combine')} className={decisionButtonClass}>
            Combine With…
          </button>
        )}

        {onAiReview && !isSingleton && (
          <button
            type="button"
            onClick={onAiReview}
            disabled={isReviewing}
            className={cn(decisionButtonClass, 'disabled:opacity-50 disabled:cursor-not-allowed')}
          >
            <Icon name="auto_awesome" size={14} />
            {isReviewing ? 'Reviewing…' : bundle.ai_review_json ? 'Re-run AI Review' : 'AI Review'}
          </button>
        )}
      </div>

      {/* ── Singleton merge panel ── */}
      {isSingleton && mergeMode !== null && (
        <div className="pt-1 space-y-2">
          <p className="text-xs text-canon-muted">
            {mergeMode === 'add' ? 'Add to existing bundle:' : 'Combine with:'}
          </p>
          <select
            value={mergeTarget}
            onChange={(e) => setMergeTarget(e.target.value)}
            aria-label={mergeMode === 'add' ? 'Select target bundle' : 'Select target term'}
            className="text-sm border border-canon-border rounded-control px-2 py-1 bg-canon-paper-bright text-canon-foreground w-full"
          >
            <option value="">{mergeMode === 'add' ? 'Select bundle…' : 'Select term…'}</option>
            {mergeMode === 'add'
              ? bundlesForAdd.map((b) => (
                  <option key={b.bundle_id} value={b.bundle_id}>
                    {b.label || b.anchor} ({b.members.length} terms)
                  </option>
                ))
              : termsForCombine.map((b) => (
                  <option key={b.bundle_id} value={b.bundle_id}>
                    {b.members[0]}
                  </option>
                ))}
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!mergeTarget}
              onClick={handleConfirmMerge}
              className={cn(
                'px-3 py-1 text-xs rounded border',
                mergeTarget
                  ? 'bg-canon-denim text-white border-canon-denim'
                  : 'opacity-50 cursor-not-allowed border-canon-border text-canon-muted',
              )}
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => {
                setMergeMode(null)
                setMergeTarget('')
              }}
              className="px-3 py-1 text-xs rounded border border-canon-border text-canon-foreground hover:bg-canon-sand"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Interactive split panel ── */}
      {showSplitPanel && (
        <div className="pt-2 space-y-2 border-t border-canon-border">
          <p className="text-xs font-medium text-canon-foreground">Assign each term to a group:</p>
          {bundle.members.map((member) => (
            <div key={member} className="flex items-center gap-2">
              <span className="text-xs flex-1 truncate text-canon-foreground">{member}</span>
              {(['A', 'B', 'Singleton'] as const).map((group) => (
                <button
                  key={group}
                  type="button"
                  onClick={() =>
                    setSplitAssignment((prev) => ({ ...prev, [member]: group }))
                  }
                  className={cn(
                    'px-2 py-0.5 text-xs rounded border transition-colors',
                    splitAssignment[member] === group
                      ? 'bg-canon-denim text-white border-canon-denim'
                      : 'border-canon-border text-canon-foreground hover:bg-canon-sand',
                  )}
                >
                  {group}
                </button>
              ))}
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleConfirmSplit}
              className="px-3 py-1 text-xs rounded bg-canon-denim text-white border border-canon-denim"
            >
              Confirm Split
            </button>
            <button
              type="button"
              onClick={() => setSplitDismissed(true)}
              className="px-3 py-1 text-xs rounded border border-canon-border text-canon-foreground hover:bg-canon-sand"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── AI Review: skeleton while in-flight, content when done ── */}
      {isReviewing && !bundle.ai_review_json && <AiReviewSkeleton />}
      {bundle.ai_review_json && (
        <AiReviewContent
          json={bundle.ai_review_json}
          onAcceptRecommendation={handleAcceptAiRecommendation}
        />
      )}
    </div>
  )
}
