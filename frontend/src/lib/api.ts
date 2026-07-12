import type { Bundle, ModelConfig, ParsedUpload } from './types'

const BASE = '/api'
const OWNER_TOKEN_KEY = 'hive:ownerToken'

async function post<T>(path: string, body: unknown): Promise<T> {
  const ownerToken = localStorage.getItem(OWNER_TOKEN_KEY)
  const resp = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Only meaningful on a deployment where OWNER_ACCESS_TOKEN is set server-side
      // (see backend/hive/auth.py) — unlocks the shared DO/LM Studio default provider
      // for the deployment operator. Everyone else's requests simply omit or mismatch
      // this header and fall through to BYOM as normal.
      ...(ownerToken ? { 'X-Owner-Token': ownerToken } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error(detail.detail ?? resp.statusText)
  }
  return resp.json()
}

export async function validateFile(
  file: File,
  contributorLabel: string,
  contributorId: string = '',
): Promise<ParsedUpload & { status: string; message: string; contributor_label: string; contributor_id: string }> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('contributor_label', contributorLabel)
  fd.append('contributor_id', contributorId)
  const resp = await fetch(`${BASE}/validate`, { method: 'POST', body: fd })
  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw new Error(detail.detail ?? resp.statusText)
  }
  const data = await resp.json()
  // Remap snake_case edge fields from backend
  return {
    ...data,
    edges: data.edges.map((e: { from_term: string; to_term: string; weight: number; effect: number; composite_id?: string }) => ({
      from_term: e.from_term,
      to_term: e.to_term,
      weight: e.weight,
      effect: e.effect as 1 | -1,
      composite_id: e.composite_id ?? '',
    })),
  }
}

export async function computeBundles(
  edges: ParsedUpload['edges'],
  terms: ParsedUpload['terms'],
  semThresh: number,
  structThresh: number,
  modelConfig?: ModelConfig | null,
): Promise<Bundle[]> {
  return post('/bundles/compute', {
    edges: edges.map((e) => ({
      from_term: e.from_term,
      to_term: e.to_term,
      weight: e.weight,
      effect: e.effect,
      composite_id: e.composite_id,
    })),
    terms,
    sem_thresh: semThresh,
    struct_thresh: structThresh,
    // ponytail: llm_config not model_config — backend uses llm_config (Pydantic v2 reserves model_config)
    llm_config: modelConfig
      ? { endpoint: modelConfig.endpoint, model: modelConfig.model, api_key: modelConfig.apiKey }
      : undefined,
  })
}

export async function reviewBundle(
  bundleId: string,
  anchor: string,
  members: string[],
  // Optional — null means "no per-user endpoint configured in Settings," in which case
  // the backend falls back to this deployment's default provider (DO/LM Studio), if one
  // is configured server-side. See backend/hive/lm_factory.py.
  modelConfig: ModelConfig | null,
): Promise<{ ai_review: Record<string, unknown> | null }> {
  return post('/bundles/review', {
    bundle_id: bundleId,
    anchor,
    members,
    llm_config: modelConfig
      ? { endpoint: modelConfig.endpoint, model: modelConfig.model, api_key: modelConfig.apiKey }
      : null,
  })
}

export async function testModel(modelConfig: ModelConfig): Promise<{ ok: boolean; error?: string }> {
  return post('/test-model', {
    llm_config: { endpoint: modelConfig.endpoint, model: modelConfig.model, api_key: modelConfig.apiKey },
  })
}
