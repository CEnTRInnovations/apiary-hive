import { useState } from 'react'
import type { AppState } from '../lib/types'
import type { AppAction } from '../lib/state'
import { Button } from '../components/ui/Button'

interface LandingViewProps {
  state: AppState
  dispatch: React.Dispatch<AppAction>
  onBegin: () => void
}

interface PhaseCardCopy {
  eyebrow: string
  title: string
  tagline: string
  description: string
  produces: string
}

const PRESET_TERMS = [
  'Community-Engaged Scholarship',
  'Community-Engaged Research',
  'Community-Engaged Teaching',
  'Community Engagement',
]

function initialChoice(term: string): string {
  if (!term) return PRESET_TERMS[1]
  return PRESET_TERMS.includes(term) ? term : 'Other'
}

const PHASES: PhaseCardCopy[] = [
  {
    eyebrow: 'Phase I',
    title: 'Forage',
    tagline: 'Bring back what each hive found.',
    description:
      'Each of the hive\'s smaller groups uploads its own Apiary .bee export — the causal term map it built by working through hexagonal thinking together. Apiary Hive validates and stages the raw vocabulary, one foraging run per group, before anything is combined.',
    produces: 'Validated term & edge sets, one per contributor group',
  },
  {
    eyebrow: 'Phase II',
    title: 'Comb',
    tagline: 'Give the raw material structure.',
    description:
      'Across every foraged map, Apiary Hive proposes Word Bundles — terms that different Hives named differently but meant the same thing. The group works the comb: accepting, splitting, merging, and renaming until the cells hold a settled, canonical vocabulary.',
    produces: 'Word Bundles — canonical terms and the decisions behind them',
  },
  {
    eyebrow: 'Phase III',
    title: 'Harvest',
    tagline: "Draw off what's ready to carry forward.",
    description:
      "With the comb finalized, Apiary Hive renders canonical terms and recoded edges into a portable .hive provenance file — ready to carry into CEnTR*CANON, or to keep as a complete record of how the group got there.",
    produces: 'A .hive provenance file, plus canonical-terms and recoded-edges CSVs',
  },
]

export function LandingView({ state, dispatch, onBegin }: LandingViewProps) {
  const [name, setName] = useState(state.project.name)
  const [definingTermChoice, setDefiningTermChoice] = useState(initialChoice(state.project.defining_term))
  const [customTerm, setCustomTerm] = useState(
    definingTermChoice === 'Other' ? state.project.defining_term : '',
  )

  const resolvedDefiningTerm = definingTermChoice === 'Other' ? customTerm.trim() : definingTermChoice

  function handleBegin() {
    dispatch({ type: 'SET_PROJECT', name: name.trim(), defining_term: resolvedDefiningTerm })
    onBegin()
  }

  const slug = (name.trim() || 'apiary-hive').toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="max-w-3xl space-y-8">
      {/* Hero */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/apiary_hive-logo.png"
              alt="Apiary Hive"
              className="h-12 w-12 shrink-0 object-contain"
            />
            <h1 className="font-serif text-display font-medium text-canon-foreground">Many hexagons, one hive.</h1>
          </div>
          <span className="pt-2 whitespace-nowrap font-mono text-[0.68rem] text-canon-muted">
            v0.1 &middot; CEnTRInnovations Open Tool
          </span>
        </div>
        <p className="max-w-xl font-serif text-lede italic text-canon-ink">
          A structured process for consolidating Apiary term maps into one shared vocabulary — ready to carry into
          CEnTR*CANON.
        </p>
      </div>

      <p className="max-w-2xl text-sm leading-relaxed text-canon-foreground">
        Apiary Hive treats scattered hexagonal thinking as raw forage, not competing claims to be settled by decree.
        Three passes — each borrowed from the discipline of the hive — carry a set of Apiary term maps from many
        hands to one shared vocabulary:{' '}
        <em className="font-serif not-italic text-canon-clay italic">
          forage the maps, build the comb, harvest what's ready to carry forward.
        </em>
      </p>

      {/* Setup */}
      <div className="space-y-4 rounded-card border border-canon-border border-l-4 border-l-canon-denim bg-canon-paper-canvas px-5 py-5">
        <div className="space-y-1">
          <p className="font-mono text-[0.65rem] font-bold tracking-[0.14em] uppercase text-canon-muted">
            Before you forage &middot; setup
          </p>
          <p className="font-serif text-h3 font-medium text-canon-foreground">Start building the hive.</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label
              htmlFor="hive-name"
              className="block font-mono text-[0.62rem] font-bold tracking-[0.1em] uppercase text-canon-ink"
            >
              Hive name
            </label>
            <input
              id="hive-name"
              className="w-full rounded-control border border-canon-border bg-canon-paper-bright px-3 py-2 text-sm text-canon-foreground placeholder:text-canon-muted focus:outline-none focus:ring-2 focus:ring-canon-denim/30"
              placeholder="e.g. Fall 2026 Cohort"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-xs text-canon-muted">
              The cohort you're convening — made up of the smaller groups who each worked through Apiary on their
              own.
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="defining-term"
              className="block font-mono text-[0.62rem] font-bold tracking-[0.1em] uppercase text-canon-ink"
            >
              What are we working towards?
            </label>
            <select
              id="defining-term"
              className="w-full rounded-control border border-canon-border bg-canon-paper-bright px-3 py-2 text-sm text-canon-foreground focus:outline-none focus:ring-2 focus:ring-canon-denim/30"
              value={definingTermChoice}
              onChange={(e) => setDefiningTermChoice(e.target.value)}
            >
              {PRESET_TERMS.map((term) => (
                <option key={term} value={term}>
                  {term}
                </option>
              ))}
              <option value="Other">Other&hellip;</option>
            </select>
            {definingTermChoice === 'Other' && (
              <input
                className="w-full rounded-control border border-canon-border bg-canon-paper-bright px-3 py-2 text-sm text-canon-foreground placeholder:text-canon-muted focus:outline-none focus:ring-2 focus:ring-canon-denim/30"
                placeholder="Name your own term"
                value={customTerm}
                onChange={(e) => setCustomTerm(e.target.value)}
                aria-label="Custom defining term"
              />
            )}
            <p className="text-xs text-canon-muted">
              The defining term the hive's groups are building a shared vocabulary around. Pick the closest fit, or
              set your own.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-canon-border pt-4">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.06em] text-canon-muted">
            One hive runs at a time.
          </p>
          <Button variant="primary" onClick={handleBegin} className="shrink-0">
            Begin Foraging
          </Button>
        </div>
      </div>

      {/* Process */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-canon-border pb-2">
          <p className="font-mono text-[0.65rem] font-bold tracking-[0.14em] uppercase text-canon-muted">
            The process &middot; three passes
          </p>
          <p className="font-mono text-[0.65rem] text-canon-muted">collect &rarr; structure &rarr; carry</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {PHASES.map((p) => (
            <div key={p.title} className="flex flex-col rounded-card border border-canon-border bg-canon-sand p-[18px]">
              <p className="font-mono text-[0.65rem] font-bold tracking-[0.14em] uppercase text-canon-clay">
                {p.eyebrow}
              </p>
              <p className="mt-1 font-serif text-h3 font-medium text-canon-foreground">{p.title}</p>
              <p className="mt-2 font-serif text-sm italic text-canon-clay">{p.tagline}</p>
              <p className="mt-2 flex-1 text-xs leading-relaxed text-canon-ink">{p.description}</p>
              <div className="mt-3 border-t border-canon-border pt-2">
                <p className="font-mono text-[0.6rem] font-bold tracking-[0.12em] uppercase text-canon-muted">
                  Produces
                </p>
                <p className="mt-1 text-xs font-medium text-canon-forest">{p.produces}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Export teaser */}
      <div className="flex flex-col gap-3 rounded-card border border-dashed border-canon-border bg-canon-paper-bright px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="font-mono text-[0.65rem] font-bold tracking-[0.14em] uppercase text-canon-muted">
            When you're ready &middot; export
          </p>
          <p className="font-serif text-h3 font-medium text-canon-foreground">Carry it out.</p>
          <p className="max-w-md text-sm text-canon-ink">
            Package the canonical vocabulary, the decisions behind it, and every original upload into a portable
            file — ready for CEnTR*CANON.
          </p>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-control border border-canon-border bg-canon-paper-canvas px-3 py-1.5 font-mono text-[0.68rem] text-canon-ink">
          {slug}-provenance.hive
        </span>
      </div>
    </div>
  )
}
