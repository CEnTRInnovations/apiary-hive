import type { AppState } from './types'

export function buildProvenanceJson(state: AppState): string {
  const doc = {
    format: 'apiary-hive-provenance',
    version: '1.0',
    exported_at: new Date().toISOString(),
    project: state.project,
    contributors: state.contributors.map((c) => ({
      id: c.id,
      label: c.label,
      n_terms: c.data?.n_terms ?? 0,
      n_edges: c.data?.n_edges ?? 0,
      n_positive: c.data?.n_positive ?? 0,
      n_negative: c.data?.n_negative ?? 0,
    })),
    bundle_run: {
      sem_thresh: state.semThresh,
      struct_thresh: state.structThresh,
      run_at: new Date().toISOString(),
    },
    bundles: state.bundles.map((b) => ({
      bundle_id: b.bundle_id,
      anchor: b.anchor,
      label: b.label,
      members: b.members,
      decision: b.decision,
      ai_review: b.ai_review_json ?? null,
    })),
    canonical_terms: state.canonicalTerms.map((t) => t.term),
    recoded_edges: state.recodedEdges.map((e) => ({
      from: e.from_term,
      to: e.to_term,
      weight: e.weight,
      effect: e.effect,
      contributor_id: e.composite_id,
    })),
    raw_edges: state.contributors.flatMap((c) =>
      (c.data?.edges ?? []).map((e) => ({
        from: e.from_term,
        to: e.to_term,
        weight: e.weight,
        effect: e.effect,
        contributor_id: c.id,
      })),
    ),
  }
  return JSON.stringify(doc, null, 2)
}

const csvQuote = (s: string) => `"${s.replace(/"/g, '""')}"`

export function buildTermsCsv(state: AppState): string {
  const termContributors = new Map<string, string[]>()
  for (const c of state.contributors) {
    for (const t of c.data?.terms ?? []) {
      const labels = termContributors.get(t.term) ?? []
      labels.push(c.label)
      termContributors.set(t.term, labels)
    }
  }
  const lines = ['term,frequency,contributors']
  for (const t of state.canonicalTerms) {
    const labels = (termContributors.get(t.term) ?? []).join('; ')
    lines.push(`${csvQuote(t.term)},${t.frequency},${csvQuote(labels)}`)
  }
  return lines.join('\n')
}

export function buildEdgesCsv(state: AppState): string {
  const contribById = new Map(state.contributors.map((c) => [c.id, c.label]))
  const lines = ['from,to,weight,effect,contributor_id,contributor_label']
  for (const e of state.recodedEdges) {
    const label = contribById.get(e.composite_id ?? '') ?? ''
    lines.push(`${csvQuote(e.from_term)},${csvQuote(e.to_term)},${e.weight},${e.effect},${csvQuote(e.composite_id ?? '')},${csvQuote(label)}`)
  }
  return lines.join('\n')
}

export function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
