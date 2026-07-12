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
