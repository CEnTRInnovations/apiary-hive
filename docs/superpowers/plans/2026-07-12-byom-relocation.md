# BYOM Relocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move BYOM (endpoint/model/API key) fields from the gear modal to a new collapsible card on the Gather screen, shrink the gear modal to just the owner access code ("Deployment access"), and flip precedence so the owner token wins over BYOM in both UI and backend.

**Architecture:** Lift `ownerToken` into `AppState` (currently trapped in `SettingsPanel` component state) so `GatherView` and `App` can react to it. Move the BYOM form/state/test-connection logic wholesale from `SettingsPanel` into `GatherView`, gated on `state.ownerToken`. On the backend, swap the `if mc / elif is_owner` branch order in `/bundles/review` to `if is_owner / elif mc`, and wire the same `is_owner_request` dependency into `/bundles/compute` (which currently has no owner check at all).

**Tech Stack:** React 19 + TypeScript (Vite, Vitest, Testing Library) frontend; FastAPI + Pydantic backend (pytest + pytest-asyncio, httpx `AsyncClient`).

## Global Constraints

- `hive:modelConfig` localStorage key is unchanged — nothing downstream (`ConsolidateView`, `api.ts`) needs to change.
- `hive:ownerToken` localStorage key is unchanged (already used by `SettingsPanel.tsx` and `api.ts`).
- Owner token takes precedence over BYOM everywhere precedence is decided: UI status text, UI field gating, and both backend routes.
- Don't clear BYOM field values when an owner token is set — only disable the inputs.
- Modal title: `Deployment access`. `aria-label` on the trigger button: `Deployment access` (was `AI Settings`). Trigger icon: Material Symbols `passkey` (was `settings`).

---

## Task 1: Lift `ownerToken` into `AppState`

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/state.ts`
- Test: `frontend/src/__tests__/state.test.ts` (new)

**Interfaces:**
- Produces: `AppState.ownerToken: string | null`, action `{ type: 'SET_OWNER_TOKEN'; token: string | null }`. Later tasks (SettingsPanel dispatches it, GatherView/App read `state.ownerToken`) depend on these exact names.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/__tests__/state.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAppState } from '../lib/state'

describe('useAppState', () => {
  it('initializes ownerToken as null', () => {
    const { result } = renderHook(() => useAppState())
    const [state] = result.current
    expect(state.ownerToken).toBeNull()
  })

  it('SET_OWNER_TOKEN updates ownerToken', () => {
    const { result } = renderHook(() => useAppState())
    act(() => {
      result.current[1]({ type: 'SET_OWNER_TOKEN', token: 'abc123' })
    })
    expect(result.current[0].ownerToken).toBe('abc123')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/__tests__/state.test.ts`
Expected: FAIL (TypeScript error / `ownerToken` undefined, or action type not assignable) because `AppState` has no `ownerToken` field and `SET_OWNER_TOKEN` isn't a valid action yet.

- [ ] **Step 3: Add `ownerToken` to `AppState`**

In `frontend/src/lib/types.ts`, add the field after `modelConfig`:

```ts
export interface AppState {
  project: { name: string; defining_term: string }
  contributors: Contributor[]
  bundles: Bundle[]
  semThresh: number
  structThresh: number
  modelConfig: ModelConfig | null
  ownerToken: string | null
  stage: 'gather' | 'consolidate' | 'export'
  canonicalTerms: TermRow[]
  recodedEdges: EdgeRow[]
}
```

- [ ] **Step 4: Add the action, initial value, and reducer case**

In `frontend/src/lib/state.ts`, add to the `AppAction` union (after `SET_MODEL_CONFIG`):

```ts
  | { type: 'SET_MODEL_CONFIG'; config: ModelConfig | null }
  | { type: 'SET_OWNER_TOKEN'; token: string | null }
  | { type: 'SET_STAGE'; stage: AppState['stage'] }
```

Add to `initial` (after `modelConfig: null,`):

```ts
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
```

Add the reducer case (after `case 'SET_MODEL_CONFIG':`):

```ts
    case 'SET_MODEL_CONFIG':
      return { ...state, modelConfig: action.config }

    case 'SET_OWNER_TOKEN':
      return { ...state, ownerToken: action.token }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/__tests__/state.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Fix other `AppState` literals broken by the new required field**

`ownerToken` is now a required field on `AppState`, so any test file that builds an `AppState` object literal directly (not via `useAppState()`) needs it too, or `tsc`/vitest's type-check will fail. Two existing files do this:

In `frontend/src/__tests__/export.test.ts`, add `ownerToken: null,` next to `modelConfig: null,` (line 36):

```ts
  semThresh: 0.65,
  structThresh: 0.48,
  modelConfig: null,
  ownerToken: null,
  stage: 'export',
```

In `frontend/src/__tests__/LandingView.test.tsx`, add `ownerToken: null,` next to `modelConfig: null,` (line 14) in the same way.

- [ ] **Step 7: Run the full frontend suite to confirm nothing else broke**

Run: `cd frontend && npx vitest run`
Expected: PASS — all existing suites (`export.test.ts`, `LandingView.test.tsx`, `GatherView.test.tsx`, etc.) still compile and pass with the new required field.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/state.ts frontend/src/__tests__/state.test.ts frontend/src/__tests__/export.test.ts frontend/src/__tests__/LandingView.test.tsx
git commit -m "feat: lift ownerToken into AppState"
```

---

## Task 2: Restore `ownerToken` on mount, swap trigger icon, update header badge (`App.tsx`)

No existing `App.test.tsx` exists in this codebase (App pulls in the full view tree including `LandingView`), so this task is verified manually via the dev server rather than a new test harness — see Step 4.

**Files:**
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `AppState.ownerToken`, action `{ type: 'SET_OWNER_TOKEN'; token: string | null }` (Task 1).

- [ ] **Step 1: Add the `OWNER_TOKEN_KEY` constant and restore on mount**

In `frontend/src/App.tsx`, add the constant next to `STORAGE_KEY`:

```ts
const STORAGE_KEY = 'hive:modelConfig'
const OWNER_TOKEN_KEY = 'hive:ownerToken'
const STAGES = ['gather', 'consolidate', 'export'] as const
```

Update the mount effect (currently lines 20-30) to also restore the owner token:

```tsx
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const cfg: ModelConfig = JSON.parse(saved)
        if (cfg.endpoint && cfg.model) dispatch({ type: 'SET_MODEL_CONFIG', config: cfg })
      } catch {
        // ignore malformed storage
      }
    }
    const savedToken = localStorage.getItem(OWNER_TOKEN_KEY)
    if (savedToken) dispatch({ type: 'SET_OWNER_TOKEN', token: savedToken })
  }, []) // ponytail: empty deps intentional — restore once on mount
```

- [ ] **Step 2: Update the header status badge to prefer the owner token**

Replace the existing badge block (currently lines 58-63):

```tsx
        {state.modelConfig && (
          <span className="flex items-center gap-1.5 font-mono text-[0.68rem] text-canon-forest">
            <span className="h-1.5 w-1.5 rounded-full bg-canon-forest" />
            AI: {state.modelConfig.model}
          </span>
        )}
```

with:

```tsx
        {state.ownerToken ? (
          <span className="flex items-center gap-1.5 font-mono text-[0.68rem] text-canon-forest">
            <span className="h-1.5 w-1.5 rounded-full bg-canon-forest" />
            AI: deployment default
          </span>
        ) : state.modelConfig ? (
          <span className="flex items-center gap-1.5 font-mono text-[0.68rem] text-canon-forest">
            <span className="h-1.5 w-1.5 rounded-full bg-canon-forest" />
            AI: {state.modelConfig.model}
          </span>
        ) : null}
```

The badge stays a non-interactive `<span>` (it already has no `onClick`) — only the gear/passkey icon opens `SettingsPanel`, so there's no dual-affordance to resolve.

- [ ] **Step 3: Swap the trigger icon and aria-label**

Replace the trigger button (currently lines 64-71):

```tsx
        <button
          type="button"
          aria-label="AI Settings"
          onClick={() => setShowSettings(true)}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-canon-border text-canon-ink hover:bg-canon-sand transition-colors"
        >
          <Icon name="settings" size={18} />
        </button>
```

with:

```tsx
        <button
          type="button"
          aria-label="Deployment access"
          onClick={() => setShowSettings(true)}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-canon-border text-canon-ink hover:bg-canon-sand transition-colors"
        >
          <Icon name="passkey" size={18} />
        </button>
```

- [ ] **Step 4: Manually verify in the dev server**

Run: `cd frontend && npm run dev`

In the browser: open the app, click past the landing view, confirm the header trigger icon renders as a key/passkey glyph (not a blank box — Material Symbols subsets don't always ship every glyph) and its tooltip/aria-label reads "Deployment access". Open the modal via that icon to confirm it still opens `SettingsPanel`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: restore ownerToken on mount, retitle deployment-access trigger"
```

---

## Task 3: Strip `SettingsPanel` to owner-token-only, dispatch `SET_OWNER_TOKEN`

**Files:**
- Modify: `frontend/src/views/SettingsPanel.tsx`
- Test: `frontend/src/__tests__/SettingsPanel.test.tsx` (new)

**Interfaces:**
- Consumes: `AppState.modelConfig`, `AppState.ownerToken`; action `{ type: 'SET_OWNER_TOKEN'; token: string | null }`.
- Produces: no new interface — this task only removes BYOM fields/handlers (`endpoint`, `model`, `apiKey`, `handleTest`, `testStatus`, `testError`) from this component. GatherView (Task 4) re-adds them there.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/__tests__/SettingsPanel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsPanel } from '../views/SettingsPanel'
import type { AppState } from '../lib/types'
import type { AppAction } from '../lib/state'
import { SEM_THRESH_DEFAULT, STRUCT_THRESH_DEFAULT } from '../lib/constants'

const baseState: AppState = {
  project: { name: 'Test', defining_term: 'CEnR' },
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

describe('SettingsPanel', () => {
  let dispatch: ReturnType<typeof vi.fn>
  let onClose: ReturnType<typeof vi.fn>

  beforeEach(() => {
    dispatch = vi.fn()
    onClose = vi.fn()
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
      clear: () => { for (const k in store) delete store[k] },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders "Deployment access" title with only the owner token field', () => {
    render(<SettingsPanel state={baseState} dispatch={dispatch as React.Dispatch<AppAction>} onClose={onClose} />)
    expect(screen.getByText('Deployment access')).toBeInTheDocument()
    expect(screen.getByLabelText('Owner access code')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Endpoint URL/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Model name/)).not.toBeInTheDocument()
    expect(screen.queryByText('Test connection')).not.toBeInTheDocument()
  })

  it('dispatches SET_OWNER_TOKEN with the trimmed token on Save', () => {
    render(<SettingsPanel state={baseState} dispatch={dispatch as React.Dispatch<AppAction>} onClose={onClose} />)
    fireEvent.change(screen.getByLabelText('Owner access code'), { target: { value: '  secret123  ' } })
    fireEvent.click(screen.getByText('Save'))
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_OWNER_TOKEN', token: 'secret123' })
    expect(onClose).toHaveBeenCalled()
  })

  it('dispatches SET_OWNER_TOKEN with null when the field is cleared', () => {
    render(<SettingsPanel state={baseState} dispatch={dispatch as React.Dispatch<AppAction>} onClose={onClose} />)
    fireEvent.click(screen.getByText('Save'))
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_OWNER_TOKEN', token: null })
  })

  it('shows the "ignored" note only when BYOM is configured and a token is entered', () => {
    const state = {
      ...baseState,
      modelConfig: { endpoint: 'http://localhost:1234/v1', model: 'llama-3.3-70b', apiKey: '' },
    }
    render(<SettingsPanel state={state} dispatch={dispatch as React.Dispatch<AppAction>} onClose={onClose} />)
    expect(screen.queryByText(/will be ignored/)).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Owner access code'), { target: { value: 'secret' } })
    expect(screen.getByText(/will be ignored/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/__tests__/SettingsPanel.test.tsx`
Expected: FAIL — current component still shows "AI Model Settings", the BYOM fields, and doesn't dispatch `SET_OWNER_TOKEN`.

- [ ] **Step 3: Rewrite `SettingsPanel.tsx`**

Replace the full contents of `frontend/src/views/SettingsPanel.tsx`:

```tsx
import { useState, useEffect } from 'react'
import type { AppState } from '../lib/types'
import type { AppAction } from '../lib/state'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'

interface SettingsPanelProps {
  state: AppState
  dispatch: React.Dispatch<AppAction>
  onClose: () => void
}

const OWNER_TOKEN_KEY = 'hive:ownerToken'

export function SettingsPanel({ state, dispatch, onClose }: SettingsPanelProps) {
  const [ownerToken, setOwnerToken] = useState('')

  useEffect(() => {
    setOwnerToken(localStorage.getItem(OWNER_TOKEN_KEY) ?? '')
  }, [])

  function save() {
    const trimmedToken = ownerToken.trim()
    dispatch({ type: 'SET_OWNER_TOKEN', token: trimmedToken || null })
    if (trimmedToken) {
      localStorage.setItem(OWNER_TOKEN_KEY, trimmedToken)
    } else {
      localStorage.removeItem(OWNER_TOKEN_KEY)
    }
    onClose()
  }

  const inputClass = 'w-full rounded-control border border-canon-border px-3 py-1.5 text-sm text-canon-foreground placeholder:text-canon-muted/60 focus:outline-none focus:ring-1 focus:ring-canon-denim'
  const labelClass = 'block font-mono text-[0.64rem] tracking-[0.09em] uppercase text-canon-muted'

  const showIgnoredNote = Boolean(state.modelConfig) && Boolean(ownerToken.trim())

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative z-10 h-full w-full max-w-sm bg-canon-paper-bright shadow-field p-6 space-y-5 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-canon-foreground">Deployment access</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-canon-muted hover:text-canon-foreground">
            <Icon name="close" size={18} />
          </button>
        </div>

        <p className="text-xs text-canon-muted">
          If this deployment has a default model configured by its operator, enter the access code to use it instead of your own.
        </p>

        <div className="space-y-1.5">
          <label htmlFor="settings-owner-token" className={labelClass}>Owner access code</label>
          <input
            id="settings-owner-token"
            type="password"
            className={inputClass}
            value={ownerToken}
            onChange={(e) => setOwnerToken(e.target.value)}
            placeholder="unlocks this deployment's default model, if any"
          />
          {showIgnoredNote && (
            <p className="text-xs text-canon-muted">
              Your own model settings on the Gather page will be ignored while this is set.
            </p>
          )}
        </div>

        <div className="flex gap-2 pt-2 border-t border-canon-border">
          <Button variant="primary" size="sm" onClick={save}>Save</Button>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/__tests__/SettingsPanel.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/SettingsPanel.tsx frontend/src/__tests__/SettingsPanel.test.tsx
git commit -m "feat: strip SettingsPanel to owner-token-only Deployment access"
```

---

## Task 4: Add the "Bring your own AI" card to `GatherView`

**Files:**
- Modify: `frontend/src/views/GatherView.tsx`
- Modify: `frontend/src/__tests__/GatherView.test.tsx` (existing `baseState` needs `ownerToken: null`; new test cases)

**Interfaces:**
- Consumes: `AppState.ownerToken`, `AppState.modelConfig`; actions `SET_MODEL_CONFIG`, `SET_OWNER_TOKEN` are dispatched (`SET_OWNER_TOKEN` is read, not dispatched, here); `testModel(config): Promise<{ ok: boolean; error?: string }>` from `../lib/api` (unchanged signature, moved caller).
- Produces: nothing new consumed elsewhere.

- [ ] **Step 1: Update the existing test file's `baseState` and add failing test cases**

In `frontend/src/__tests__/GatherView.test.tsx`, add `ownerToken: null` to `baseState` (required now that `AppState` has the field):

```ts
const baseState: AppState = {
  project: { name: 'Test', defining_term: 'CEnR' },
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
```

Then add these test cases inside the existing `describe('GatherView', ...)` block, after the last existing test:

```tsx
  it('BYOM card shows "Not configured" when collapsed with no config or token', () => {
    render(<GatherView state={baseState} dispatch={dispatch as React.Dispatch<AppAction>} />)
    expect(screen.getByText('Bring your own AI')).toBeInTheDocument()
    expect(screen.getByText('Not configured')).toBeInTheDocument()
  })

  it('BYOM card shows the deployment-default subtext when ownerToken is set', () => {
    const state = { ...baseState, ownerToken: 'secret' }
    render(<GatherView state={state} dispatch={dispatch as React.Dispatch<AppAction>} />)
    expect(screen.getByText("Using this deployment's default model")).toBeInTheDocument()
  })

  it('BYOM fields are disabled and show the active-token note when ownerToken is set', () => {
    const state = {
      ...baseState,
      ownerToken: 'secret',
      modelConfig: { endpoint: 'http://localhost:1234/v1', model: 'llama-3.3-70b', apiKey: '' },
    }
    render(<GatherView state={state} dispatch={dispatch as React.Dispatch<AppAction>} />)
    fireEvent.click(screen.getByText('Bring your own AI'))
    expect(screen.getByLabelText('Endpoint URL')).toBeDisabled()
    expect(screen.getByLabelText('Model name')).toBeDisabled()
    expect(screen.getByLabelText(/API key/)).toBeDisabled()
    expect(screen.getByText(/deployment access code is active/)).toBeInTheDocument()
  })

  it('BYOM fields re-enable and retain prior values once ownerToken is cleared', () => {
    const withToken = {
      ...baseState,
      ownerToken: 'secret',
      modelConfig: { endpoint: 'http://localhost:1234/v1', model: 'llama-3.3-70b', apiKey: '' },
    }
    const { rerender } = render(<GatherView state={withToken} dispatch={dispatch as React.Dispatch<AppAction>} />)
    fireEvent.click(screen.getByText('Bring your own AI'))
    expect(screen.getByLabelText('Endpoint URL')).toBeDisabled()

    const withoutToken = { ...withToken, ownerToken: null }
    rerender(<GatherView state={withoutToken} dispatch={dispatch as React.Dispatch<AppAction>} />)
    const endpointInput = screen.getByLabelText('Endpoint URL') as HTMLInputElement
    expect(endpointInput).not.toBeDisabled()
    expect(endpointInput.value).toBe('http://localhost:1234/v1')
  })

  it('committing endpoint+model on blur dispatches SET_MODEL_CONFIG', () => {
    render(<GatherView state={baseState} dispatch={dispatch as React.Dispatch<AppAction>} />)
    fireEvent.click(screen.getByText('Bring your own AI'))
    fireEvent.change(screen.getByLabelText('Endpoint URL'), { target: { value: 'http://localhost:1234/v1' } })
    fireEvent.blur(screen.getByLabelText('Endpoint URL'))
    fireEvent.change(screen.getByLabelText('Model name'), { target: { value: 'llama-3.3-70b' } })
    fireEvent.blur(screen.getByLabelText('Model name'))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'SET_MODEL_CONFIG',
      config: { endpoint: 'http://localhost:1234/v1', model: 'llama-3.3-70b', apiKey: '' },
    })
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/__tests__/GatherView.test.tsx`
Expected: FAIL — no "Bring your own AI" card exists yet.

- [ ] **Step 3: Add imports, constants, and local state to `GatherView.tsx`**

Update the import block at the top of `frontend/src/views/GatherView.tsx`:

```tsx
import { useRef, useState } from 'react'
import type { AppState, ModelConfig } from '../lib/types'
import type { AppAction } from '../lib/state'
import { validateFile, testModel } from '../lib/api'
import { PhaseHeader } from '../components/hive/PhaseHeader'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'

type SlotState = 'idle' | 'uploading' | 'done' | 'error'
type BulkFileStatus = 'uploading' | 'done' | 'error'
type GatherMode = 'single' | 'bulk'

const BYOM_STORAGE_KEY = 'hive:modelConfig'
```

Add local state inside the `GatherView` function, after the existing `useState`/`useRef` declarations (after `const fileRefs = useRef...`):

```tsx
  const [byomOpen, setByomOpen] = useState(false)
  const [endpoint, setEndpoint] = useState(state.modelConfig?.endpoint ?? '')
  const [model, setModel] = useState(state.modelConfig?.model ?? '')
  const [apiKey, setApiKey] = useState(state.modelConfig?.apiKey ?? '')
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [testError, setTestError] = useState('')
```

- [ ] **Step 4: Add the commit and test-connection handlers**

Add these functions inside `GatherView`, after `addContributor` (or anywhere before the `return`):

```tsx
  function commitModelConfig(overrides: Partial<ModelConfig> = {}) {
    const config: ModelConfig = {
      endpoint: (overrides.endpoint ?? endpoint).trim(),
      model: (overrides.model ?? model).trim(),
      apiKey: overrides.apiKey ?? apiKey,
    }
    if (config.endpoint && config.model) {
      dispatch({ type: 'SET_MODEL_CONFIG', config })
      localStorage.setItem(BYOM_STORAGE_KEY, JSON.stringify(config))
    } else {
      dispatch({ type: 'SET_MODEL_CONFIG', config: null })
      localStorage.removeItem(BYOM_STORAGE_KEY)
    }
  }

  async function handleTestConnection() {
    if (!endpoint || !model) return
    setTestStatus('testing')
    setTestError('')
    try {
      const result = await testModel({ endpoint, model, apiKey })
      setTestStatus(result.ok ? 'ok' : 'fail')
      if (!result.ok) setTestError(result.error ?? 'No response')
    } catch (err) {
      setTestStatus('fail')
      setTestError(err instanceof Error ? err.message : 'Failed')
    }
  }
```

- [ ] **Step 5: Insert the BYOM card JSX**

In the `return`, insert the card directly after the mode-toggle `</div>` (currently line 147) and before `{mode === 'single' && (` (currently line 149):

```tsx
      {/* Bring your own AI */}
      <div className="rounded-card border border-canon-border bg-canon-paper-bright">
        <button
          type="button"
          onClick={() => setByomOpen((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-3 text-left"
        >
          <span className="space-y-0.5">
            <span className="block font-mono text-[0.65rem] font-bold tracking-[0.14em] uppercase text-canon-muted">
              Bring your own AI
            </span>
            <span className="block text-xs text-canon-muted">
              {state.ownerToken
                ? "Using this deployment's default model"
                : state.modelConfig
                  ? `Using ${state.modelConfig.model} via ${state.modelConfig.endpoint}`
                  : 'Not configured'}
            </span>
          </span>
          <Icon name={byomOpen ? 'expand_less' : 'expand_more'} size={18} className="text-canon-muted" />
        </button>

        {byomOpen && (
          <div className="space-y-4 border-t border-canon-border px-5 py-4">
            <p className="text-xs text-canon-muted">
              Apiary Hive can use an AI model to help identify near-duplicate terms during Consolidate.
              Point it at any OpenAI-compatible endpoint — local (LM Studio, Ollama) or hosted (OpenAI, Groq, etc.).
              This is optional; Consolidate works without it, using structural matching alone.
            </p>

            {state.ownerToken && (
              <p className="text-xs text-canon-ink">
                A deployment access code is active — clear it in Settings to use your own model.
              </p>
            )}

            <div className="space-y-1.5">
              <label htmlFor="byom-endpoint" className={byomLabelClass}>Endpoint URL</label>
              <input
                id="byom-endpoint"
                className={byomInputClass}
                value={endpoint}
                disabled={Boolean(state.ownerToken)}
                onChange={(e) => setEndpoint(e.target.value)}
                onBlur={() => commitModelConfig()}
                placeholder="http://localhost:1234/v1"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="byom-model" className={byomLabelClass}>Model name</label>
              <input
                id="byom-model"
                className={byomInputClass}
                value={model}
                disabled={Boolean(state.ownerToken)}
                onChange={(e) => setModel(e.target.value)}
                onBlur={() => commitModelConfig()}
                placeholder="llama-3.3-70b"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="byom-apikey" className={byomLabelClass}>
                API key <span className="normal-case font-sans text-canon-muted">(leave blank for local models)</span>
              </label>
              <input
                id="byom-apikey"
                type="password"
                className={byomInputClass}
                value={apiKey}
                disabled={Boolean(state.ownerToken)}
                onChange={(e) => setApiKey(e.target.value)}
                onBlur={() => commitModelConfig()}
                placeholder="sk-..."
              />
            </div>

            <div className="flex gap-2 items-center flex-wrap">
              {state.ownerToken ? (
                <span className="text-xs text-canon-muted">
                  Test connection unavailable while deployment access is active.
                </span>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={!endpoint || !model || testStatus === 'testing'}
                >
                  {testStatus === 'testing' ? 'Testing…' : 'Test connection'}
                </Button>
              )}
              {testStatus === 'ok' && (
                <span className="flex items-center gap-1 text-xs text-canon-forest">
                  <Icon name="check" size={14} /> Connected
                </span>
              )}
              {testStatus === 'fail' && (
                <span className="flex items-center gap-1 text-xs text-canon-signal">
                  <Icon name="close" size={14} /> Couldn't connect — {testError}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

```

Add the two shared class constants near the top of the `return`'s JSX-adjacent code — i.e. as local consts inside `GatherView`, alongside `hasData` (`const byomInputClass = ...`, `const byomLabelClass = ...`):

```tsx
  const byomInputClass = 'w-full rounded-control border border-canon-border px-3 py-1.5 text-sm text-canon-foreground placeholder:text-canon-muted/60 focus:outline-none focus:ring-1 focus:ring-canon-denim disabled:opacity-40'
  const byomLabelClass = 'block font-mono text-[0.64rem] tracking-[0.09em] uppercase text-canon-muted'
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/__tests__/GatherView.test.tsx`
Expected: PASS (all existing tests + 5 new ones)

- [ ] **Step 7: Run the full frontend test suite**

Run: `cd frontend && npx vitest run`
Expected: PASS — confirms `SettingsPanel.test.tsx` and `state.test.ts` from earlier tasks still pass alongside `GatherView.test.tsx`.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/views/GatherView.tsx frontend/src/__tests__/GatherView.test.tsx
git commit -m "feat: add Bring your own AI card to GatherView, gated on ownerToken"
```

---

## Task 5: Flip backend precedence — owner token wins over BYOM

**Files:**
- Modify: `backend/routers/bundles.py`
- Test: `backend/tests/test_bundles_route.py`

**Interfaces:**
- Consumes: `is_owner_request` (dependency, `backend/hive/auth.py`), `get_default_llm_provider(settings)` (`backend/hive/lm_factory.py`), `OpenAICompatProvider` (`backend/hive/lm.py`), `settings.do_inference_base_url/do_inference_chat_model/do_inference_api_key/studio_lm_base_url/studio_lm_chat_model` (`backend/config.py`).
- Produces: local helper `_default_llm_config(cfg) -> tuple[str, str, str | None] | None` in `bundles.py`, used only by `compute_bundles_route`.

- [ ] **Step 1: Write the failing tests**

Add to `backend/tests/test_bundles_route.py` (after the existing tests, keep the existing `EDGES`/`TERMS` module-level fixtures):

```python
@pytest.mark.asyncio
async def test_review_bundle_owner_token_takes_precedence_over_byom(monkeypatch):
    from config import settings
    import routers.bundles as bundles_route

    monkeypatch.setattr(settings, "owner_access_token", "secret-token")

    class StubProvider:
        async def complete(self, prompt, **kwargs):
            return (
                '{"recommendation": "ACCEPT", "confidence": "HIGH", "rationale": "r", '
                '"preserved_if_consolidated": "p", "flattened_if_consolidated": "f", '
                '"suggested_splits": [], "discussion_questions": []}'
            )

    monkeypatch.setattr(bundles_route, "get_default_llm_provider", lambda cfg: StubProvider())

    def _fail_if_byom_used(*args, **kwargs):
        raise AssertionError("BYOM provider must not be constructed when owner token is valid")

    monkeypatch.setattr(bundles_route, "OpenAICompatProvider", _fail_if_byom_used)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/bundles/review",
            headers={"X-Owner-Token": "secret-token"},
            json={
                "bundle_id": "b_001",
                "anchor": "community",
                "members": ["community", "trust"],
                "llm_config": {"endpoint": "http://localhost:9999/v1", "model": "x", "api_key": ""},
            },
        )
    assert resp.status_code == 200
    assert resp.json()["ai_review"]["recommendation"] == "ACCEPT"


@pytest.mark.asyncio
async def test_compute_bundles_owner_token_uses_default_llm_config(monkeypatch):
    from config import settings
    import hive.nlp as nlp_module

    monkeypatch.setattr(settings, "owner_access_token", "secret-token")
    monkeypatch.setattr(settings, "do_inference_chat_model", "default-embed-model")
    monkeypatch.setattr(settings, "do_inference_base_url", "http://default-endpoint/v1")
    monkeypatch.setattr(settings, "do_inference_api_key", "")

    seen_kwargs = {}

    async def fake_get_embeddings(terms, endpoint, model, api_key):
        seen_kwargs.update(endpoint=endpoint, model=model, api_key=api_key)
        return {t: [0.1, 0.2] for t in terms}

    monkeypatch.setattr(nlp_module, "get_embeddings", fake_get_embeddings)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/bundles/compute",
            headers={"X-Owner-Token": "secret-token"},
            json={
                "edges": EDGES,
                "terms": TERMS,
                "sem_thresh": 0.65,
                "struct_thresh": 0.48,
                "llm_config": {
                    "endpoint": "http://should-not-be-used/v1",
                    "model": "wrong-model",
                    "api_key": "wrong-key",
                },
            },
        )
    assert resp.status_code == 200
    assert seen_kwargs == {
        "endpoint": "http://default-endpoint/v1",
        "model": "default-embed-model",
        "api_key": None,
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && pytest tests/test_bundles_route.py -v`
Expected: `test_review_bundle_owner_token_takes_precedence_over_byom` FAILs (the `AssertionError` from `_fail_if_byom_used` propagates because today's code constructs `OpenAICompatProvider` first). `test_compute_bundles_owner_token_uses_default_llm_config` FAILs (`seen_kwargs` never populated / populated with the wrong values, because `/bundles/compute` doesn't call `get_embeddings` with default config and has no `is_owner` dependency at all).

- [ ] **Step 3: Flip precedence in `/bundles/review`**

In `backend/routers/bundles.py`, replace the body of `review_bundle_route` (currently lines 81-108):

```python
    mc = body.llm_config
    if is_owner:
        # A valid X-Owner-Token always wins over any per-request llm_config — see
        # docs/specs/byom-relocation-spec.md. Falls back to this deployment's configured
        # default (DO_INFERENCE_CHAT_MODEL / STUDIO_LM_CHAT_MODEL; see hive/lm_factory.py).
        provider = get_default_llm_provider(settings)
        if provider is None:
            raise HTTPException(
                status_code=400,
                detail=(
                    "No deployment default configured. Ask the operator to set "
                    "DO_INFERENCE_CHAT_MODEL or STUDIO_LM_CHAT_MODEL, or clear the "
                    "access code to use your own model."
                ),
            )
    elif mc and mc.endpoint.strip():
        provider = OpenAICompatProvider(
            base_url=mc.endpoint,
            model=mc.model,
            api_key=mc.api_key or None,
            timeout_seconds=settings.llm_timeout_seconds,
        )
    else:
        raise HTTPException(
            status_code=400,
            detail="No LLM configured. Enter an endpoint and model in Settings.",
        )
```

- [ ] **Step 4: Add the same precedence to `/bundles/compute`**

Add a module-level helper in `backend/routers/bundles.py`, near `_to_read` (top of file):

```python
def _default_llm_config(cfg) -> tuple[str, str, str | None] | None:
    """Endpoint/model/api_key for this deployment's default provider, mirroring
    get_default_llm_provider's DO-then-LM-Studio priority (hive/lm_factory.py) — as plain
    strings, since hive.nlp.get_embeddings takes an OpenAI-compat endpoint directly rather
    than an LLMProvider instance.
    """
    if cfg.do_inference_chat_model:
        return cfg.do_inference_base_url, cfg.do_inference_chat_model, cfg.do_inference_api_key or None
    if cfg.studio_lm_chat_model:
        return cfg.studio_lm_base_url, cfg.studio_lm_chat_model, None
    return None
```

Replace `compute_bundles_route` (currently lines 34-73):

```python
@router.post("/bundles/compute", response_model=list[BundleRead])
async def compute_bundles_route(
    body: ComputeRequest,
    is_owner: bool = Depends(is_owner_request),
) -> list[BundleRead]:
    if not body.edges:
        raise HTTPException(status_code=400, detail="No edges provided.")

    edges_df = pd.DataFrame([
        {"from": e.from_term, "to": e.to_term, "weight": e.weight, "composite_id": e.composite_id}
        for e in body.edges
    ])
    terms_df = pd.DataFrame([
        {"term": t.term, "frequency": t.frequency}
        for t in body.terms
    ])

    embedding_endpoint: str | None = None
    embedding_model: str | None = None
    embedding_api_key: str | None = None
    if is_owner:
        default_config = _default_llm_config(settings)
        if default_config is not None:
            embedding_endpoint, embedding_model, embedding_api_key = default_config
    elif body.llm_config and body.llm_config.endpoint:
        embedding_endpoint = body.llm_config.endpoint
        embedding_model = body.llm_config.model
        embedding_api_key = body.llm_config.api_key or None

    embedding_sim = None
    if embedding_endpoint and embedding_model:
        from hive.nlp import cosine_sim_matrix, get_embeddings
        term_list = terms_df["term"].tolist()
        raw = await get_embeddings(
            term_list,
            endpoint=embedding_endpoint,
            model=embedding_model,
            api_key=embedding_api_key,
        )
        if raw is not None:
            matrix = cosine_sim_matrix(raw)
            keys = list(raw.keys())
            embedding_sim = {
                (min(keys[i], keys[j]), max(keys[i], keys[j])): float(matrix[i, j])
                for i in range(len(keys))
                for j in range(i + 1, len(keys))
            }

    bundles = compute_bundles(
        edges_df, terms_df,
        sem_thresh=body.sem_thresh,
        struct_thresh=body.struct_thresh,
        embedding_sim=embedding_sim,
    )
    return [_to_read(b) for b in bundles]
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && pytest tests/test_bundles_route.py -v`
Expected: PASS (all tests, including the 2 new ones)

- [ ] **Step 6: Run the full backend test suite**

Run: `cd backend && pytest -v`
Expected: PASS — confirms no regression in `test_bundles_compute.py`, `test_ingest.py`, `test_lm.py`, `test_validate_route.py`.

- [ ] **Step 7: Commit**

```bash
git add backend/routers/bundles.py backend/tests/test_bundles_route.py
git commit -m "fix: owner token takes precedence over BYOM in both bundle routes"
```

---

## Final verification

- [ ] Run `cd frontend && npx vitest run` — full frontend suite passes.
- [ ] Run `cd backend && pytest -v` — full backend suite passes.
- [ ] Run `cd frontend && npx tsc --noEmit` — no type errors (catches any stale `AppState` literal missing `ownerToken` across the app, e.g. in other view files or tests not touched by this plan).
