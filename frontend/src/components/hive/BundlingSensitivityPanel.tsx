import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '../ui/Button'

// ── Slider fill gradient ─────────────────────────────────────────────────────
// Tailwind cannot compute dynamic percentages; inline style is required.
function fillGradient(value: number, min: number, max: number): string {
  const pct = ((value - min) / (max - min)) * 100
  return `linear-gradient(to right, #3F5E78 ${pct}%, #D8CDB2 ${pct}%)`
}

// ── Algorithm disclosure tooltip ─────────────────────────────────────────────
interface AlgorithmDisclosureProps {
  name: string
  explanation: string
  ariaLabel: string
}

function AlgorithmDisclosure({ name, explanation, ariaLabel }: AlgorithmDisclosureProps) {
  const [open, setOpen] = useState(false)
  const tooltipId = useId()
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function handleOutside(e: MouseEvent) {
      if (btnRef.current && !btnRef.current.parentElement?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open])

  return (
    <span className="relative inline-block">
      <button
        ref={btnRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-canon-muted font-sans italic hover:text-canon-foreground focus:outline-none focus-visible:underline"
      >
        {name}
      </button>
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className="
            absolute left-0 top-full mt-1 z-10
            w-60 max-w-[240px] rounded-control
            bg-canon-paper-bright border border-canon-border
            px-3 py-2 text-xs text-canon-foreground leading-relaxed shadow-field
            motion-safe:animate-[fadeSlideDown_120ms_ease-out]
          "
        >
          {explanation}
        </span>
      )}
    </span>
  )
}

// ── Individual slider control ────────────────────────────────────────────────
interface SliderControlProps {
  id: string
  label: string
  algorithmName: string
  algorithmExplanation: string
  algorithmAriaLabel: string
  description: string
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (v: number) => void
}

function SliderControl({
  id,
  label,
  algorithmName,
  algorithmExplanation,
  algorithmAriaLabel,
  description,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
}: SliderControlProps) {
  return (
    <div className="space-y-1.5">
      {/* Label row */}
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <label htmlFor={id} className="text-sm font-semibold text-canon-foreground font-sans">
          {label}
        </label>
        <AlgorithmDisclosure
          name={`(${algorithmName})`}
          explanation={algorithmExplanation}
          ariaLabel={algorithmAriaLabel}
        />
      </div>

      {/* Description */}
      <p className="text-xs text-canon-muted font-sans italic">{description}</p>

      {/* Slider + readout */}
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          role="slider"
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          className="
            flex-1 h-1 rounded-full appearance-none cursor-grab active:cursor-grabbing
            focus:outline-none focus-visible:ring-2 focus-visible:ring-canon-denim
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-canon-denim
            [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white
            [&::-webkit-slider-thumb]:shadow-[0_1px_4px_rgba(0,0,0,0.25)]
            [&::-webkit-slider-thumb]:hover:shadow-[0_2px_6px_rgba(0,0,0,0.3)]
            [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5
            [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2
            [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-canon-denim
          "
          style={{ background: fillGradient(value, min, max) }}
        />
        <span className="text-sm text-canon-muted font-sans min-w-[2.5rem] text-right tabular-nums">
          {value.toFixed(2)}
        </span>
      </div>

      {/* Pole labels */}
      <div className="flex justify-between mt-1" aria-hidden="true">
        <span className="text-[11px] text-canon-muted font-sans">Broad</span>
        <span className="text-[11px] text-canon-muted font-sans">Precise</span>
      </div>
    </div>
  )
}

// ── Bundle count heuristic ───────────────────────────────────────────────────
// Rough estimate only — avoids a backend round-trip on every slider move.
function estimateBundleCount(termCount: number, semThresh: number, structThresh: number): number {
  if (termCount === 0) return 0
  const avgThresh = (semThresh + structThresh) / 2
  const raw = Math.round(termCount * (0.3 + avgThresh * 0.5))
  return Math.max(1, Math.min(raw, termCount))
}

// ── Main panel ───────────────────────────────────────────────────────────────

export interface BundlingSensitivityPanelProps {
  semThresh: number
  structThresh: number
  termCount: number
  isPending: boolean
  onSemThreshChange: (v: number) => void
  onStructThreshChange: (v: number) => void
  onCompute: () => void
  computeError: string | null
}

export function BundlingSensitivityPanel({
  semThresh,
  structThresh,
  termCount,
  isPending,
  onSemThreshChange,
  onStructThreshChange,
  onCompute,
  computeError,
}: BundlingSensitivityPanelProps) {
  const [previewCount, setPreviewCount] = useState<number | 'loading'>(
    () => estimateBundleCount(termCount, semThresh, structThresh),
  )
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Recompute preview on threshold change (debounced 300 ms)
  useEffect(() => {
    setPreviewCount('loading')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPreviewCount(estimateBundleCount(termCount, semThresh, structThresh))
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [semThresh, structThresh, termCount])

  const bothHigh = semThresh >= 0.95 && structThresh >= 0.95
  const bothLow = semThresh <= 0.10 && structThresh <= 0.10
  const noTerms = termCount === 0

  return (
    <div className="bg-canon-sand border border-canon-border rounded-card p-6 shadow-field space-y-5">
      {/* Section label */}
      <p className="font-sans text-[11px] font-medium text-canon-muted uppercase tracking-[0.12em]">
        Bundling Sensitivity
      </p>

      {/* Two-column slider grid — stacks on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <SliderControl
          id="sem-thresh"
          label="Meaning Similarity"
          algorithmName="Jaro-Winkler"
          algorithmExplanation="Jaro-Winkler measures how similar two strings are character by character, with extra weight given to matching prefixes."
          algorithmAriaLabel="What is Jaro-Winkler similarity?"
          description="Do terms refer to the same concept, even if worded differently?"
          value={semThresh}
          onChange={onSemThreshChange}
        />
        <SliderControl
          id="struct-thresh"
          label="Word Overlap"
          algorithmName="Jaccard"
          algorithmExplanation="Jaccard similarity measures the proportion of shared words between two terms."
          algorithmAriaLabel="What is Jaccard similarity?"
          description="Do terms share the same words, even if arranged differently?"
          value={structThresh}
          onChange={onStructThreshChange}
        />
      </div>

      {/* Live preview */}
      <p
        aria-live="polite"
        className="text-[13px] text-canon-muted font-sans italic motion-safe:transition-opacity motion-safe:duration-150"
      >
        {termCount === 0
          ? null
          : previewCount === 'loading'
            ? 'estimating…'
            : `~ ${previewCount} bundle${previewCount === 1 ? '' : 's'} estimated`}
      </p>

      {/* Threshold warnings */}
      {bothHigh && (
        <p className="text-xs text-canon-clay font-sans">
          High thresholds may produce many small bundles.
        </p>
      )}
      {bothLow && (
        <p className="text-xs text-canon-clay font-sans">
          Low thresholds may group unrelated terms.
        </p>
      )}

      {/* Action row */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          variant="ghost"
          onClick={onCompute}
          disabled={isPending || noTerms}
          aria-busy={isPending || undefined}
          aria-label={isPending ? 'Finding bundles, please wait' : undefined}
          title={noTerms ? 'Load a term list first.' : undefined}
        >
          {isPending && (
            <svg
              className="w-4 h-4 motion-safe:animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          {isPending ? 'Finding bundles…' : 'Find Bundles'}
        </Button>

        {noTerms && !isPending && (
          <p className="text-xs text-canon-muted font-sans">
            No data yet —{' '}
            <a href="gather" className="underline text-canon-denim">
              upload CSV files in Gather
            </a>{' '}
            first.
          </p>
        )}

        {computeError && (
          <p className="text-xs text-canon-signal font-sans">{computeError}</p>
        )}
      </div>
    </div>
  )
}
