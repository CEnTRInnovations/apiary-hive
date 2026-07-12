export interface Bundle {
  bundle_id: string
  anchor: string
  label: string | null
  members: string[]
  decision: 'accept' | 'split' | 'reject' | 'needs_discussion' | null
  sim_score: number
  struct: number
  semantic: number
  ai_review_json: Record<string, unknown> | null
}

export interface EdgeRow {
  from_term: string
  to_term: string
  weight: number
  effect: 1 | -1
  composite_id: string
}

export interface TermRow {
  term: string
  frequency: number
}

export interface ParsedUpload {
  terms: TermRow[]
  edges: EdgeRow[]
  n_terms: number
  n_edges: number
  n_positive: number
  n_negative: number
}

export interface Contributor {
  id: string        // "C01", "C02", ...
  label: string
  data: ParsedUpload | null
}

export interface ModelConfig {
  endpoint: string
  model: string
  apiKey: string
}

export interface AppState {
  project: { name: string; defining_term: string }
  contributors: Contributor[]
  bundles: Bundle[]
  semThresh: number
  structThresh: number
  modelConfig: ModelConfig | null
  stage: 'gather' | 'consolidate' | 'export'
  canonicalTerms: TermRow[]
  recodedEdges: EdgeRow[]
}
