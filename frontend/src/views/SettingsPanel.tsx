import { useState, useEffect } from 'react'
import type { AppState, ModelConfig } from '../lib/types'
import type { AppAction } from '../lib/state'
import { testModel } from '../lib/api'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'

interface SettingsPanelProps {
  state: AppState
  dispatch: React.Dispatch<AppAction>
  onClose: () => void
}

const STORAGE_KEY = 'hive:modelConfig'
const OWNER_TOKEN_KEY = 'hive:ownerToken'

export function SettingsPanel({ state, dispatch, onClose }: SettingsPanelProps) {
  const [endpoint, setEndpoint] = useState(state.modelConfig?.endpoint ?? '')
  const [model, setModel] = useState(state.modelConfig?.model ?? '')
  const [apiKey, setApiKey] = useState(state.modelConfig?.apiKey ?? '')
  const [ownerToken, setOwnerToken] = useState('')
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [testError, setTestError] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const cfg: ModelConfig = JSON.parse(saved)
        setEndpoint(cfg.endpoint)
        setModel(cfg.model)
        setApiKey(cfg.apiKey)
      } catch {
        // ignore malformed storage
      }
    }
    setOwnerToken(localStorage.getItem(OWNER_TOKEN_KEY) ?? '')
  }, [])

  function save() {
    const config: ModelConfig = { endpoint: endpoint.trim(), model: model.trim(), apiKey }
    if (config.endpoint && config.model) {
      dispatch({ type: 'SET_MODEL_CONFIG', config })
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    } else {
      dispatch({ type: 'SET_MODEL_CONFIG', config: null })
      localStorage.removeItem(STORAGE_KEY)
    }

    const trimmedToken = ownerToken.trim()
    if (trimmedToken) {
      localStorage.setItem(OWNER_TOKEN_KEY, trimmedToken)
    } else {
      localStorage.removeItem(OWNER_TOKEN_KEY)
    }

    onClose()
  }

  async function handleTest() {
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

  const inputClass = 'w-full rounded-control border border-canon-border px-3 py-1.5 text-sm text-canon-foreground placeholder:text-canon-muted/60 focus:outline-none focus:ring-1 focus:ring-canon-denim'
  const labelClass = 'block font-mono text-[0.64rem] tracking-[0.09em] uppercase text-canon-muted'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative z-10 h-full w-full max-w-sm bg-canon-paper-bright shadow-field p-6 space-y-5 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-canon-foreground">AI Model Settings</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-canon-muted hover:text-canon-foreground">
            <Icon name="close" size={18} />
          </button>
        </div>

        <p className="text-xs text-canon-muted">
          Configure any OpenAI-compatible endpoint — local (LM Studio, Ollama) or commercial (OpenAI, Groq, etc.).
          Your API key is stored only in your browser.
        </p>

        <div className="space-y-1.5">
          <label htmlFor="settings-endpoint" className={labelClass}>Endpoint URL</label>
          <input
            id="settings-endpoint"
            className={inputClass}
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="http://localhost:1234/v1"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="settings-model" className={labelClass}>Model name</label>
          <input
            id="settings-model"
            className={inputClass}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="llama-3.3-70b"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="settings-apikey" className={labelClass}>
            API key <span className="normal-case font-sans text-canon-muted">(leave blank for local models)</span>
          </label>
          <input
            id="settings-apikey"
            type="password"
            className={inputClass}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
          />
        </div>

        <div className="space-y-1.5 pt-2 border-t border-canon-border">
          <label htmlFor="settings-owner-token" className={labelClass}>
            Owner access code <span className="normal-case font-sans text-canon-muted">(optional — leave blank unless you operate this deployment)</span>
          </label>
          <input
            id="settings-owner-token"
            type="password"
            className={inputClass}
            value={ownerToken}
            onChange={(e) => setOwnerToken(e.target.value)}
            placeholder="unlocks this deployment's default model, if any"
          />
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          <Button variant="ghost" size="sm" onClick={handleTest} disabled={!endpoint || !model || testStatus === 'testing'}>
            {testStatus === 'testing' ? 'Testing…' : 'Test connection'}
          </Button>
          {testStatus === 'ok' && (
            <span className="flex items-center gap-1 text-xs text-canon-forest">
              <Icon name="check" size={14} /> Connected
            </span>
          )}
          {testStatus === 'fail' && (
            <span className="flex items-center gap-1 text-xs text-canon-signal">
              <Icon name="close" size={14} /> {testError}
            </span>
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
