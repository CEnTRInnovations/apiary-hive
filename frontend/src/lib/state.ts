import { useReducer } from 'react'
import type { AppState, Bundle, Contributor, ModelConfig, ParsedUpload, TermRow, EdgeRow } from './types'
import { SEM_THRESH_DEFAULT, STRUCT_THRESH_DEFAULT, WORKSHOP_ID, WORKSHOP_LABEL } from './constants'

export type AppAction =
  | { type: 'SET_PROJECT'; name: string; defining_term: string }
  | { type: 'ADD_CONTRIBUTOR'; label: string }
  | { type: 'ADD_CONTRIBUTORS_BULK'; entries: { id?: string; label: string; data: ParsedUpload }[] }
  | { type: 'REMOVE_CONTRIBUTOR'; id: string }
  | { type: 'SET_CONTRIBUTOR_DATA'; id: string; data: ParsedUpload }
  | { type: 'ADD_WORKSHOP_TERM'; term: string }
  | { type: 'SET_BUNDLES'; bundles: Bundle[] }
  | { type: 'APPLY_AI_SUGGESTIONS'; suggested: Bundle[] }
  | { type: 'SET_BUNDLE_DECISION'; bundleId: string; decision: Bundle['decision'] }
  | { type: 'RENAME_BUNDLE'; bundleId: string; label: string | null }
  | { type: 'SPLIT_BUNDLE'; bundleId: string; groups: Record<string, 'A' | 'B' | 'Singleton'>; freqMap: Record<string, number> }
  | { type: 'MERGE_BUNDLE'; sourceBundleId: string; targetBundleId: string }
  | { type: 'SET_BUNDLE_AI_REVIEW'; bundleId: string; aiReview: Record<string, unknown> | null }
  | { type: 'SET_SEM_THRESH'; value: number }
  | { type: 'SET_STRUCT_THRESH'; value: number }
  | { type: 'SET_MODEL_CONFIG'; config: ModelConfig | null }
  | { type: 'SET_OWNER_TOKEN'; token: string | null }
  | { type: 'SET_STAGE'; stage: AppState['stage'] }
  | { type: 'FINALIZE' }
  | { type: 'RESET' }

const initial: AppState = {
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

let _nextContribId = 1

/**
 * Fold AI-suggested bundles into the current list without touching the user's work: a
 * suggestion is applied only if every member is still an undecided, unbundled term. Anything
 * overlapping a bundle the user already merged, split or decided is skipped.
 */
export function mergeAiSuggestions(current: Bundle[], suggested: Bundle[]) {
  const multi = suggested.filter((b) => b.members.length > 1).map((b) => ({ ...b, ai_suggested: true }))
  if (current.length === 0) {
    return { bundles: [...multi, ...suggested.filter((b) => b.members.length === 1)], applied: multi.length, skipped: 0 }
  }
  const open = new Map(current.filter((b) => b.members.length === 1 && !b.decision).map((b) => [b.members[0], b.bundle_id]))
  const usedIds = new Set(current.map((b) => b.bundle_id))
  let counter = 1
  const nextId = () => {
    while (usedIds.has(`b_${String(counter).padStart(3, '0')}`)) counter++
    const id = `b_${String(counter++).padStart(3, '0')}`
    usedIds.add(id)
    return id
  }
  const consumed = new Set<string>()
  const added: Bundle[] = []
  let skipped = 0
  for (const s of multi) {
    if (s.members.every((m) => open.has(m))) {
      s.members.forEach((m) => consumed.add(open.get(m)!))
      added.push({ ...s, bundle_id: nextId() })
    } else {
      skipped++
    }
  }
  return { bundles: [...current.filter((b) => !consumed.has(b.bundle_id)), ...added], applied: added.length, skipped }
}

function workshopTerms(contributors: Contributor[]): Set<string> {
  const w = contributors.find((c) => c.id === WORKSHOP_ID)
  return new Set((w?.data?.terms ?? []).map((t) => t.term))
}

// A term the room added is usually the name the group settled on, so it wins the anchor
// over a more frequent term from someone's map. (Backend picks anchors by frequency only.)
function preferWorkshopAnchor(bundles: Bundle[], ws: Set<string>): Bundle[] {
  if (ws.size === 0) return bundles
  return bundles.map((b) => {
    if (ws.has(b.anchor)) return b
    const w = b.members.find((m) => ws.has(m))
    return w ? { ...b, anchor: w } : b
  })
}

function nextContribId(): string {
  return `C${String(_nextContribId++).padStart(2, '0')}`
}

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_PROJECT':
      return { ...state, project: { name: action.name, defining_term: action.defining_term } }

    case 'ADD_CONTRIBUTOR': {
      const id = nextContribId()
      const contributor: Contributor = { id, label: action.label || id, data: null }
      return { ...state, contributors: [...state.contributors, contributor] }
    }

    case 'ADD_CONTRIBUTORS_BULK': {
      const usedIds = new Set(state.contributors.map((c) => c.id))
      const added: Contributor[] = []
      for (const entry of action.entries) {
        const wantsId = entry.id?.trim()
        const id = wantsId && !usedIds.has(wantsId) ? wantsId : nextContribId()
        usedIds.add(id)
        added.push({ id, label: entry.label.trim() || id, data: entry.data })
      }
      return { ...state, contributors: [...state.contributors, ...added] }
    }

    case 'REMOVE_CONTRIBUTOR':
      return { ...state, contributors: state.contributors.filter((c) => c.id !== action.id) }

    case 'SET_CONTRIBUTOR_DATA':
      return {
        ...state,
        contributors: state.contributors.map((c) =>
          c.id === action.id ? { ...c, data: action.data } : c,
        ),
      }

    case 'ADD_WORKSHOP_TERM': {
      const term = action.term.trim()
      const known = new Set(
        state.contributors.flatMap((c) => (c.data?.terms ?? []).map((t) => t.term.toLowerCase())),
      )
      if (!term || known.has(term.toLowerCase())) return state
      const existing = state.contributors.find((c) => c.id === WORKSHOP_ID)
      const terms = [...(existing?.data?.terms ?? []), { term, frequency: 1 }]
      const data: ParsedUpload = { terms, edges: [], n_terms: terms.length, n_edges: 0, n_positive: 0, n_negative: 0 }
      const contributors = existing
        ? state.contributors.map((c) => (c.id === WORKSHOP_ID ? { ...c, data } : c))
        : [...state.contributors, { id: WORKSHOP_ID, label: WORKSHOP_LABEL, data }]
      // Before the first Compute there are no bundles to add a row to; Compute will pick the term up.
      if (state.bundles.length === 0) return { ...state, contributors }
      const used = new Set(state.bundles.map((b) => b.bundle_id))
      let n = state.bundles.length + 1
      while (used.has(`b_${String(n).padStart(3, '0')}`)) n++
      const added: Bundle = { bundle_id: `b_${String(n).padStart(3, '0')}`, anchor: term, label: null, members: [term], decision: null, sim_score: 0, struct: 0, semantic: 0, ai_review_json: null, weak_pairs: [] }
      return { ...state, contributors, bundles: [...state.bundles, added] }
    }

    case 'SET_BUNDLES':
      return { ...state, bundles: preferWorkshopAnchor(action.bundles, workshopTerms(state.contributors)) }

    case 'APPLY_AI_SUGGESTIONS':
      return {
        ...state,
        bundles: preferWorkshopAnchor(
          mergeAiSuggestions(state.bundles, action.suggested).bundles,
          workshopTerms(state.contributors),
        ),
      }

    case 'SET_BUNDLE_DECISION':
      return {
        ...state,
        bundles: state.bundles.map((b) =>
          b.bundle_id === action.bundleId ? { ...b, decision: action.decision } : b,
        ),
      }

    case 'RENAME_BUNDLE':
      return {
        ...state,
        bundles: state.bundles.map((b) =>
          b.bundle_id === action.bundleId ? { ...b, label: action.label } : b,
        ),
      }

    case 'SPLIT_BUNDLE': {
      const bundle = state.bundles.find((b) => b.bundle_id === action.bundleId)
      if (!bundle) return state
      const groups: Record<string, string[]> = {}
      for (const member of bundle.members) {
        const g = action.groups[member] ?? 'Singleton'
        ;(groups[g] = groups[g] || []).push(member)
      }
      const usedIds = new Set(state.bundles.map((b) => b.bundle_id))
      let counter = 1
      function nextId() {
        while (usedIds.has(`b_${String(counter).padStart(3, '0')}`)) counter++
        const id = `b_${String(counter++).padStart(3, '0')}`
        usedIds.add(id)
        return id
      }
      const newBundles: Bundle[] = []
      for (const g of ['A', 'B'] as const) {
        const members = groups[g] || []
        if (!members.length) continue
        const anchor = members.reduce((best, t) =>
          (action.freqMap[t] ?? 0) > (action.freqMap[best] ?? 0) ? t : best,
        )
        newBundles.push({ bundle_id: nextId(), anchor, label: null, members, decision: null, sim_score: 0, struct: 0, semantic: 0, ai_review_json: null, weak_pairs: [] })
      }
      for (const term of groups['Singleton'] || []) {
        newBundles.push({ bundle_id: nextId(), anchor: term, label: null, members: [term], decision: null, sim_score: 0, struct: 0, semantic: 0, ai_review_json: null, weak_pairs: [] })
      }
      const remaining = state.bundles.filter((b) => b.bundle_id !== action.bundleId)
      return { ...state, bundles: [...remaining, ...newBundles].sort((a, b) => a.bundle_id.localeCompare(b.bundle_id)) }
    }

    case 'MERGE_BUNDLE': {
      const source = state.bundles.find((b) => b.bundle_id === action.sourceBundleId)
      const target = state.bundles.find((b) => b.bundle_id === action.targetBundleId)
      if (!source || !target) return state
      const ws = workshopTerms(state.contributors)
      const anchor = ws.has(source.anchor) && !ws.has(target.anchor) ? source.anchor : target.anchor
      // Merging changes what's being decided, so an earlier Accept/Reject on either side doesn't carry over.
      const merged = { ...target, anchor, decision: null, members: Array.from(new Set([...target.members, ...source.members])) }
      return {
        ...state,
        bundles: state.bundles
          .filter((b) => b.bundle_id !== action.sourceBundleId)
          .map((b) => (b.bundle_id === action.targetBundleId ? merged : b)),
      }
    }

    case 'SET_BUNDLE_AI_REVIEW':
      return {
        ...state,
        bundles: state.bundles.map((b) =>
          b.bundle_id === action.bundleId ? { ...b, ai_review_json: action.aiReview } : b,
        ),
      }

    case 'SET_SEM_THRESH':
      return { ...state, semThresh: action.value }

    case 'SET_STRUCT_THRESH':
      return { ...state, structThresh: action.value }

    case 'SET_MODEL_CONFIG':
      return { ...state, modelConfig: action.config }

    case 'SET_OWNER_TOKEN':
      return { ...state, ownerToken: action.token }

    case 'SET_STAGE':
      return { ...state, stage: action.stage }

    case 'FINALIZE': {
      // Build remap: accepted + null bundles remap members → the bundle's name. A rename
      // (label) is the name the group chose, so it wins over the anchor.
      const isRemapped = (b: Bundle) => !b.decision || b.decision === 'accept'
      const nameOf = (b: Bundle) => (isRemapped(b) ? b.label?.trim() || b.anchor : b.anchor)
      const remap: Record<string, string> = {}
      for (const b of state.bundles) {
        if (isRemapped(b)) {
          for (const m of b.members) remap[m] = nameOf(b)
        }
      }
      // Gather all raw edges across contributors
      const allEdges: EdgeRow[] = state.contributors.flatMap((c) =>
        (c.data?.edges ?? []).map((e) => ({ ...e, composite_id: c.id })),
      )
      // Aggregate term frequencies
      const freqMap: Record<string, number> = {}
      for (const c of state.contributors) {
        for (const t of c.data?.terms ?? []) {
          freqMap[t.term] = (freqMap[t.term] ?? 0) + t.frequency
        }
      }
      const remapKeys = new Set(Object.keys(remap))
      const rejectedTerms = new Set(
        state.bundles.filter((b) => b.decision === 'reject').flatMap((b) => b.members),
      )
      const termSet = new Set<string>()
      // A renamed bundle's new name has no frequency of its own; carry its anchor's.
      const freqOf = { ...freqMap }
      for (const b of state.bundles) {
        if (b.decision === 'reject') continue
        const name = nameOf(b)
        termSet.add(name)
        freqOf[name] ??= freqMap[b.anchor] ?? 0
      }
      for (const t of Object.keys(freqMap)) {
        if (!remapKeys.has(t) && !rejectedTerms.has(t)) termSet.add(t)
      }
      const canonicalTerms: TermRow[] = Array.from(termSet).map((term) => ({
        term,
        frequency: freqOf[term] ?? 0,
      }))
      const recodedEdges = allEdges
        // Rejected terms never go through `remap` (only accept/no-decision bundles do),
        // so without this filter their raw name would survive unchanged into
        // recodedEdges — "removed" from canonicalTerms but still wired into every
        // exported edge list (.bee, .hive provenance, CSV). Drop them before remapping.
        .filter((e) => !rejectedTerms.has(e.from_term) && !rejectedTerms.has(e.to_term))
        .map((e) => ({
          ...e,
          from_term: remap[e.from_term] ?? e.from_term,
          to_term: remap[e.to_term] ?? e.to_term,
        }))
        .filter((e) => e.from_term !== e.to_term)
      return { ...state, canonicalTerms, recodedEdges, stage: 'export' }
    }

    case 'RESET': {
      _nextContribId = 1
      return { ...initial }
    }

    default:
      return state
  }
}

export function useAppState() {
  return useReducer(reducer, initial)
}
