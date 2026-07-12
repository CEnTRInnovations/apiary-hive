# Spec: Relocate BYOM fields to Gather, owner token takes precedence

## Intent

Split the current single "AI Model Settings" gear modal into two surfaces:

1. **Gather (main section)** — a new "Bring your own AI" card holding `Endpoint URL`, `Model name`, `API key`. Optional, collapsed by default. Surfacing this at first contact with contributor data — before upload, not three screens later at Consolidate — makes the data-handling boundary visible at the point where community term data enters the system, rather than burying it behind a settings icon.
2. **Gear modal** — trimmed to just `Owner access code`, reframed as **Deployment access**. This is an operator/admin credential, not a per-session researcher choice, so it stays off the primary flow.

Owner token now **takes precedence over BYOM** when both are present — this is a behavior change from current code (today BYOM silently wins server-side). Precedence must be enforced in both the UI (so the state is legible, not just inferred from behavior) and the backend (source of truth).

---

## 1. State layer (`frontend/src/lib/state.ts`, `frontend/src/lib/types.ts`)

`ownerToken` currently lives only in `SettingsPanel` component state + `localStorage`, invisible to `GatherView`. Lift it into `AppState` so both surfaces read the same reactive value.

**`types.ts`**
```ts
export interface AppState {
  ...
  modelConfig: ModelConfig | null
  ownerToken: string | null   // NEW
  ...
}
```

**`state.ts`**
```ts
export type AppAction =
  | ...
  | { type: 'SET_MODEL_CONFIG'; config: ModelConfig | null }
  | { type: 'SET_OWNER_TOKEN'; token: string | null }   // NEW
  | ...

const initial: AppState = {
  ...
  modelConfig: null,
  ownerToken: null,   // NEW
  ...
}

// in reducer:
case 'SET_OWNER_TOKEN':
  return { ...state, ownerToken: action.token }
```

**`App.tsx`** — on mount, restore `ownerToken` from `localStorage` alongside `modelConfig` (same `useEffect` that already restores `modelConfig`):
```ts
const savedToken = localStorage.getItem(OWNER_TOKEN_KEY)
if (savedToken) dispatch({ type: 'SET_OWNER_TOKEN', token: savedToken })
```
(`OWNER_TOKEN_KEY = 'hive:ownerToken'`, matching the constant already used in `SettingsPanel.tsx` / `api.ts`.)

---

## 2. Gear modal (`frontend/src/views/SettingsPanel.tsx`)

Remove the `endpoint`, `model`, `apiKey` fields, the connection-test block, and their local state/handlers. Keep only the owner token field, and have it dispatch `SET_OWNER_TOKEN` (in addition to the existing `localStorage.setItem`) so `GatherView` sees the change without a reload.

**Copy changes:**
- Modal title: `AI Model Settings` → `Deployment access`
- Body copy (replaces the current "Configure any OpenAI-compatible endpoint..." paragraph):
  > If this deployment has a default model configured by its operator, enter the access code to use it instead of your own.
- Field label: `Owner access code` (unchanged) — drop the `(optional — leave blank unless you operate this deployment)` qualifier from the label since it's now the only field; that context lives in the body copy above instead.
- Placeholder: `unlocks this deployment's default model, if any` (unchanged)
- If BYOM fields are configured in Gather *and* an owner token is saved, add a one-line note under the field:
  > Your own model settings on the Gather page will be ignored while this is set.

**Buttons:** `Save` / `Cancel` unchanged.

---

## 3. Gather main section (`frontend/src/views/GatherView.tsx`)

Add a new collapsible card. Suggested placement: directly below the mode toggle, above the "Contributors" block — secondary to the primary upload task, not blocking it.

**Collapsed state (default):**
- Label row, same treatment as other section labels (`font-mono text-[0.65rem] font-bold tracking-[0.14em] uppercase text-canon-muted`), with a chevron icon:
  - No config, no owner token: `Bring your own AI` / muted subtext `Not configured`
  - Config present: `Bring your own AI` / `Using {model} via {endpoint}`
  - Owner token present (overrides BYOM): `Bring your own AI` / `Using this deployment's default model`

**Expanded state — header copy:**
> **Bring your own AI**
> Apiary Hive can use an AI model to help identify near-duplicate terms during Consolidate. Point it at any OpenAI-compatible endpoint — local (LM Studio, Ollama) or hosted (OpenAI, Groq, etc.). This is optional; Consolidate works without it, using structural matching alone.

**Fields** (move as-is from `SettingsPanel`, same `inputClass`/`labelClass` styling, same underlying `ModelConfig` shape):
- `Endpoint URL` — placeholder `http://localhost:1234/v1`
- `Model name` — placeholder `llama-3.3-70b`
- `API key` — `type="password"`, label qualifier `(leave blank for local models)`, placeholder `sk-...`

**Connection test** (move as-is):
- Button: `Test connection`
- Success: `Connected` with check icon
- Failure: `Couldn't connect — {testError}` (reworded from current bare `{testError}` next to an icon, so it reads as one sentence)

**Save behavior:** no explicit Save button needed in this context (unlike the modal, this isn't a drawer you close) — commit on blur or via the existing `dispatch({ type: 'SET_MODEL_CONFIG', config })` pattern, debounced or on-change, mirroring how other Gather fields behave. Persist to `localStorage` under the existing `hive:modelConfig` key so nothing else downstream (`ConsolidateView`) has to change.

**Precedence gating — when `state.ownerToken` is truthy:**
- Disable all three fields (`disabled` attribute, reduced opacity per your existing disabled-state conventions)
- Replace the "Test connection" button with static text
- Show inline note directly under the header copy:
  > A deployment access code is active — clear it in Settings to use your own model.
- Do **not** clear the field values — a user who later removes the owner token in Settings should see their prior BYOM entries still there, not lose them.

---

## 4. Trigger icon for Deployment access (`frontend/src/App.tsx`)

Swap the header trigger from the gear icon to the Material Symbols **`passkey`** ligature — now that the modal holds only the owner access code, `passkey` communicates "enter a credential to unlock something" more precisely than a generic settings gear, and doesn't imply there's a broader settings surface behind it.

```tsx
<button
  type="button"
  aria-label="Deployment access"   // was "AI Settings"
  onClick={() => setShowSettings(true)}
  className="flex h-7 w-7 items-center justify-center rounded-full border border-canon-border text-canon-ink hover:bg-canon-sand transition-colors"
>
  <Icon name="passkey" size={18} />   {/* was name="settings" */}
</button>
```

`Icon` (`frontend/src/components/ui/Icon.tsx`) is a thin wrapper that renders `name` as literal text inside a Material Symbols–styled span, so this is a value swap only — no new asset or import, as long as the Material Symbols font already loaded in the app is a build that includes the `passkey` glyph (same font family as `settings`/`close`/`check`, so it should resolve the same way — worth a visual check after the swap since not every Material Symbols subset ships every glyph).

Also update the `aria-label` from `AI Settings` to `Deployment access`, matching the modal's new title (§2), so screen reader users get an accurate description of what the icon opens.

---

## 5. Header status badge (`frontend/src/App.tsx`)

Current: `AI: {state.modelConfig.model}` shown only when `modelConfig` is set.

New logic:
```ts
{state.ownerToken ? (
  <span className="...">
    <span className="dot" /> AI: deployment default
  </span>
) : state.modelConfig ? (
  <span className="...">
    <span className="dot" /> AI: {state.modelConfig.model}
  </span>
) : null}
```
Keep it clickable, but change the target: it should no longer open the (now BYOM-less) gear modal by default. Clicking it should scroll/navigate to the Gather BYOM card if `stage !== 'gather'` isn't practical mid-flow — simplest correct behavior: keep it a static status indicator (non-interactive) except the gear icon still opens `SettingsPanel` for the owner token specifically. Don't overload one affordance with two destinations.

---

## 6. Backend precedence swap (`backend/routers/bundles.py`)

This is the part that actually enforces "owner token wins" — today it's the reverse. Two call sites:

**`/bundles/review` (lines ~76–104)** — currently:
```python
mc = body.llm_config
if mc and mc.endpoint.strip():
    provider = OpenAICompatProvider(...)   # BYOM wins today
elif is_owner:
    provider = get_default_llm_provider(settings)
```
Flip to owner-first:
```python
mc = body.llm_config
if is_owner:
    provider = get_default_llm_provider(settings)
    if provider is None:
        raise HTTPException(400, detail=(
            "No deployment default configured. Ask the operator to set "
            "DO_INFERENCE_CHAT_MODEL or STUDIO_LM_CHAT_MODEL, or clear the "
            "access code to use your own model."
        ))
elif mc and mc.endpoint.strip():
    provider = OpenAICompatProvider(
        base_url=mc.endpoint, model=mc.model,
        api_key=mc.api_key or None,
        timeout_seconds=settings.llm_timeout_seconds,
    )
else:
    # existing "no LLM configured" branch, unchanged
    ...
```

**`/bundles/compute` (lines ~48–56)** — this route currently uses `body.llm_config.endpoint` directly for embeddings with **no `is_owner` check at all** (the dependency isn't even wired in). Add `is_owner_request` as a dependency here too, and apply the same precedence: if `is_owner`, resolve embeddings via `get_default_llm_provider(settings)` instead of `body.llm_config`. Otherwise this route stays BYOM-only even when an owner token is present, contradicting the review route right next to it.

**`config.py` / `lm_factory.py`** — no changes needed; `get_default_llm_provider` already encapsulates "what the deployment default is."

---

## 7. Test coverage to add/update

- `backend/tests/test_bundles_route.py` — existing test at line ~47 posts `llm_config` without an owner token; add a companion test that posts both a valid `X-Owner-Token` header *and* an `llm_config`, and asserts the default provider was used, not the supplied config.
- Frontend: add a case to `GatherView` tests (or new `SettingsPanel`/`GatherView` integration test) covering: BYOM fields disabled when `ownerToken` is set; re-enabled and retaining prior values when token is cleared.

---

## Summary of file touches

| File | Change |
|---|---|
| `frontend/src/lib/types.ts` | add `ownerToken: string \| null` to `AppState` |
| `frontend/src/lib/state.ts` | add `SET_OWNER_TOKEN` action + reducer case + initial value |
| `frontend/src/App.tsx` | restore `ownerToken` from localStorage on mount; swap trigger icon `settings` → `passkey`, relabel `aria-label`; update header status badge logic |
| `frontend/src/views/SettingsPanel.tsx` | strip to owner-token-only; retitle "Deployment access"; dispatch `SET_OWNER_TOKEN` |
| `frontend/src/views/GatherView.tsx` | add collapsible "Bring your own AI" card with endpoint/model/key fields + test connection; gate on `state.ownerToken` |
| `backend/routers/bundles.py` | flip precedence in `/bundles/review`; add `is_owner_request` dependency + same precedence to `/bundles/compute` |
| `backend/tests/test_bundles_route.py` | add owner-token-precedence test case |
