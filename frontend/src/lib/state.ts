import { useReducer } from 'react'
import type { AppState, Bundle, Contributor, ModelConfig, ParsedUpload, TermRow, EdgeRow } from './types'
import { SEM_THRESH_DEFAULT, STRUCT_THRESH_DEFAULT } from './constants'

export type AppAction =
  | { type: 'SET_PROJECT'; name: string; defining_term: string }
  | { type: 'ADD_CONTRIBUTOR'; label: string }
  | { type: 'ADD_CONTRIBUTORS_BULK'; entries: { id?: string; label: string; data: ParsedUpload }[] }
  | { type: 'REMOVE_CONTRIBUTOR'; id: string }
  | { type: 'SET_CONTRIBUTOR_DATA'; id: string; data: ParsedUpload }
  | { type: 'SET_BUNDLES'; bundles: Bundle[] }
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

    case 'SET_BUNDLES':
      return { ...state, bundles: action.bundles }

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
        newBundles.push({ bundle_id: nextId(), anchor, label: null, members, decision: null, sim_score: 0, struct: 0, semantic: 0, ai_review_json: null })
      }
      for (const term of groups['Singleton'] || []) {
        newBundles.push({ bundle_id: nextId(), anchor: term, label: null, members: [term], decision: null, sim_score: 0, struct: 0, semantic: 0, ai_review_json: null })
      }
      const remaining = state.bundles.filter((b) => b.bundle_id !== action.bundleId)
      return { ...state, bundles: [...remaining, ...newBundles].sort((a, b) => a.bundle_id.localeCompare(b.bundle_id)) }
    }

    case 'MERGE_BUNDLE': {
      const source = state.bundles.find((b) => b.bundle_id === action.sourceBundleId)
      const target = state.bundles.find((b) => b.bundle_id === action.targetBundleId)
      if (!source || !target) return state
      const merged = { ...target, members: Array.from(new Set([...target.members, ...source.members])) }
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
      // Build remap: accepted + null bundles remap members → anchor
      const remap: Record<string, string> = {}
      for (const b of state.bundles) {
        if (!b.decision || b.decision === 'accept') {
          for (const m of b.members) remap[m] = b.anchor
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
      for (const b of state.bundles) {
        if (b.decision !== 'reject') termSet.add(b.anchor)
      }
      for (const t of Object.keys(freqMap)) {
        if (!remapKeys.has(t) && !rejectedTerms.has(t)) termSet.add(t)
      }
      const canonicalTerms: TermRow[] = Array.from(termSet).map((term) => ({
        term,
        frequency: freqMap[term] ?? 0,
      }))
      const recodedEdges = allEdges
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
