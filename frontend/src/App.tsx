import { useState, useEffect } from 'react'
import { useAppState } from './lib/state'
import type { ModelConfig } from './lib/types'
import { LandingView } from './views/LandingView'
import { GatherView } from './views/GatherView'
import { ConsolidateView } from './views/ConsolidateView'
import { ExportView } from './views/ExportView'
import { SettingsPanel } from './views/SettingsPanel'
import { Icon } from './components/ui/Icon'

const STORAGE_KEY = 'hive:modelConfig'
const OWNER_TOKEN_KEY = 'hive:ownerToken'
const STAGES = ['gather', 'consolidate', 'export'] as const

export function App() {
  const [state, dispatch] = useAppState()
  const [showSettings, setShowSettings] = useState(false)
  const [showLanding, setShowLanding] = useState(true)

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

  if (showLanding) {
    return (
      <div className="min-h-screen bg-canon-paper">
        <main className="px-6 py-10">
          <LandingView state={state} dispatch={dispatch} onBegin={() => setShowLanding(false)} />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canon-paper">
      {/* Wayfinding bar */}
      <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-canon-border bg-canon-paper-bright px-6 h-[52px]">
        <img src="/apiary_hive-logo.png" alt="" className="h-7 w-7 object-contain" />
        <button
          type="button"
          onClick={() => setShowLanding(true)}
          className="font-serif text-lg font-medium text-canon-foreground hover:text-canon-denim transition-colors"
        >
          Apiary Hive
        </button>
        <span className="font-mono text-[0.66rem] uppercase tracking-[0.1em] text-canon-muted">
          by CEnTRInnovations
        </span>
        <div className="flex-1" />
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
        <button
          type="button"
          aria-label="Deployment access"
          onClick={() => setShowSettings(true)}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-canon-border text-canon-ink hover:bg-canon-sand transition-colors"
        >
          <Icon name="passkey" size={18} />
        </button>
      </header>

      {/* Stage progress */}
      <div className="flex items-center gap-2 border-b border-canon-border bg-canon-paper-bright px-6 h-[38px]">
        {STAGES.map((s) => (
          <span
            key={s}
            className={
              state.stage === s
                ? 'px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.04em] text-canon-foreground font-bold border-b-2 border-canon-foreground'
                : 'px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.04em] text-canon-muted'
            }
          >
            {s}
          </span>
        ))}
      </div>

      {/* Main content */}
      <main className="px-6 py-8">
        {state.stage === 'gather' && <GatherView state={state} dispatch={dispatch} />}
        {state.stage === 'consolidate' && <ConsolidateView state={state} dispatch={dispatch} />}
        {state.stage === 'export' && <ExportView state={state} dispatch={dispatch} />}
      </main>

      {showSettings && (
        <SettingsPanel state={state} dispatch={dispatch} onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}

export default App
