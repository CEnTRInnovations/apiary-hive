export interface ParseResult {
  status: 'ok' | 'error'
  message: string
  contributorLabel: string
  contributorId: string
  edges: { from: string; to: string; weight: number; effect: 1 | -1 }[]
}

export function normalizeEffect(value: unknown): 1 | -1 {
  if (value === null || value === undefined || value === '') return 1
  const s = String(value).trim()
  if (s === '-' || s === '-1') return -1
  return 1
}

export function parseBeeFile(data: unknown): ParseResult {
  if (typeof data !== 'object' || data === null) {
    return {
      status: 'error',
      message: 'Invalid .bee file: not a JSON object',
      contributorLabel: '',
      contributorId: '',
      edges: [],
    }
  }
  const obj = data as Record<string, unknown>
  const contributor = obj.contributor as Record<string, unknown> | undefined
  const contributorLabel = typeof contributor?.label === 'string' ? contributor.label : ''
  const contributorId =
    contributor?.id === undefined || contributor?.id === null ? '' : String(contributor.id)

  const rawEdges = Array.isArray(obj.edges) ? obj.edges : []
  if (rawEdges.length === 0) {
    return { status: 'error', message: 'No edges found in .bee file', contributorLabel, contributorId, edges: [] }
  }

  const edges = rawEdges
    .filter(
      (e): e is Record<string, unknown> =>
        typeof e === 'object' && e !== null && e['from'] && e['to'],
    )
    .map((e) => ({
      from: String(e['from']).trim(),
      to: String(e['to']).trim(),
      weight: typeof e['weight'] === 'number' ? e['weight'] : 1,
      effect: normalizeEffect(e['effect']),
    }))

  if (edges.length === 0) {
    return { status: 'error', message: 'All edges had empty from/to', contributorLabel, contributorId, edges: [] }
  }

  return { status: 'ok', message: 'Parsed successfully', contributorLabel, contributorId, edges }
}
