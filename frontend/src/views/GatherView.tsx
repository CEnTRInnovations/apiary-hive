import { useRef, useState } from 'react'
import type { AppState } from '../lib/types'
import type { AppAction } from '../lib/state'
import { validateFile } from '../lib/api'
import { PhaseHeader } from '../components/hive/PhaseHeader'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'

type SlotState = 'idle' | 'uploading' | 'done' | 'error'
type BulkFileStatus = 'uploading' | 'done' | 'error'
type GatherMode = 'single' | 'bulk'

interface BulkFileState {
  name: string
  status: BulkFileStatus
  error: string
}

interface GatherViewProps {
  state: AppState
  dispatch: React.Dispatch<AppAction>
}

export function GatherView({ state, dispatch }: GatherViewProps) {
  const [mode, setMode] = useState<GatherMode>('single')
  const [slotStates, setSlotStates] = useState<Record<string, SlotState>>({})
  const [slotErrors, setSlotErrors] = useState<Record<string, string>>({})
  const [newLabel, setNewLabel] = useState('')
  const [bulkFiles, setBulkFiles] = useState<BulkFileState[]>([])
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const hasData = state.contributors.some((c) => c.data !== null)

  async function handleFileChange(contributorId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSlotStates((prev) => ({ ...prev, [contributorId]: 'uploading' }))
    setSlotErrors((prev) => ({ ...prev, [contributorId]: '' }))
    try {
      const result = await validateFile(file, state.contributors.find((c) => c.id === contributorId)?.label ?? '')
      dispatch({
        type: 'SET_CONTRIBUTOR_DATA',
        id: contributorId,
        data: {
          terms: result.terms,
          edges: result.edges,
          n_terms: result.n_terms,
          n_edges: result.n_edges,
          n_positive: result.n_positive,
          n_negative: result.n_negative,
        },
      })
      setSlotStates((prev) => ({ ...prev, [contributorId]: 'done' }))
    } catch (err) {
      setSlotStates((prev) => ({ ...prev, [contributorId]: 'error' }))
      setSlotErrors((prev) => ({
        ...prev,
        [contributorId]: err instanceof Error ? err.message : 'Upload failed',
      }))
    }
  }

  function addContributor() {
    if (!newLabel.trim()) return
    dispatch({ type: 'ADD_CONTRIBUTOR', label: newLabel.trim() })
    setNewLabel('')
  }

  async function handleBulkFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    setBulkFiles(files.map((f) => ({ name: f.name, status: 'uploading', error: '' })))

    const outcomes = await Promise.all(
      files.map(async (file) => {
        try {
          const result = await validateFile(file, '', '')
          return { file, result, error: null as string | null }
        } catch (err) {
          return { file, result: null, error: err instanceof Error ? err.message : 'Upload failed' }
        }
      }),
    )

    setBulkFiles(
      outcomes.map(({ file, error }) => ({
        name: file.name,
        status: error ? 'error' : 'done',
        error: error ?? '',
      })),
    )

    const entries = outcomes
      .filter((o): o is typeof o & { result: NonNullable<(typeof o)['result']> } => o.result !== null)
      .map(({ file, result }) => ({
        id: result.contributor_id || undefined,
        label: result.contributor_label || file.name.replace(/\.bee$/i, ''),
        data: {
          terms: result.terms,
          edges: result.edges,
          n_terms: result.n_terms,
          n_edges: result.n_edges,
          n_positive: result.n_positive,
          n_negative: result.n_negative,
        },
      }))

    if (entries.length > 0) {
      dispatch({ type: 'ADD_CONTRIBUTORS_BULK', entries })
    }
    e.target.value = ''
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PhaseHeader
        phase="Step 1"
        title="Gather"
        description="Upload term association files for each contributor."
      />

      {/* Mode toggle */}
      <div className="flex gap-1 rounded-control border border-canon-border bg-canon-paper-bright p-1 w-fit">
        <button
          type="button"
          onClick={() => setMode('single')}
          className={
            mode === 'single'
              ? 'rounded-[2px] bg-canon-denim px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.06em] text-white'
              : 'rounded-[2px] px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.06em] text-canon-muted hover:bg-canon-sand'
          }
        >
          One at a time
        </button>
        <button
          type="button"
          onClick={() => setMode('bulk')}
          className={
            mode === 'bulk'
              ? 'rounded-[2px] bg-canon-denim px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.06em] text-white'
              : 'rounded-[2px] px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.06em] text-canon-muted hover:bg-canon-sand'
          }
        >
          Bulk upload (.bee)
        </button>
      </div>

      {mode === 'single' && (
        <>
          {/* Add contributor */}
          <div className="space-y-2">
            <span className="font-mono text-[0.65rem] font-bold tracking-[0.14em] uppercase text-canon-muted">
              Contributors
            </span>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-control border border-canon-border bg-canon-paper-bright px-3 py-2 text-sm text-canon-foreground placeholder:text-canon-muted focus:outline-none focus:ring-2 focus:ring-canon-denim/30"
                placeholder="Contributor label (e.g. Group A)"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addContributor()}
              />
              <Button variant="primary" size="sm" onClick={addContributor} disabled={!newLabel.trim()}>
                Add
              </Button>
            </div>
          </div>

          {/* Upload slots */}
          {state.contributors.length > 0 && (
            <div className="rounded-card border border-canon-border bg-canon-paper-bright px-5 py-4 space-y-4">
              {state.contributors.map((c) => {
                const slotState = slotStates[c.id] ?? 'idle'
                const error = slotErrors[c.id]
                return (
                  <div key={c.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor={`file-${c.id}`}
                        className="font-mono text-[0.7rem] tracking-[1.2px] uppercase text-canon-muted"
                      >
                        {c.label} <span className="opacity-50">({c.id})</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => dispatch({ type: 'REMOVE_CONTRIBUTOR', id: c.id })}
                        className="text-canon-muted hover:text-canon-signal"
                        aria-label={`Remove ${c.label}`}
                      >
                        <Icon name="close" size={15} />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        ref={(el) => { fileRefs.current[c.id] = el }}
                        id={`file-${c.id}`}
                        type="file"
                        accept=".csv,.bee"
                        disabled={slotState === 'uploading'}
                        onChange={(e) => handleFileChange(c.id, e)}
                        className="text-sm text-canon-foreground"
                      />
                      {slotState === 'uploading' && (
                        <span className="text-xs text-canon-muted">Uploading…</span>
                      )}
                      {slotState === 'done' && (
                        <span className="flex items-center gap-1 text-xs text-canon-forest font-medium">
                          <Icon name="check" size={14} /> Uploaded
                        </span>
                      )}
                    </div>
                    {error && <p className="text-xs text-canon-signal">{error}</p>}
                  </div>
                )
              })}
              <p className="text-xs text-canon-muted pt-1">
                Accepted: <code>.bee</code> (JSON edgelist) or <code>.csv</code>/<code>.tsv</code>/<code>.xlsx</code> with <code>from</code>, <code>to</code> columns.
              </p>
            </div>
          )}
        </>
      )}

      {mode === 'bulk' && (
        <div className="rounded-card border border-canon-border bg-canon-paper-bright px-5 py-4 space-y-3">
          <span className="font-mono text-[0.65rem] font-bold tracking-[0.14em] uppercase text-canon-muted">
            Bulk upload
          </span>
          <p className="text-xs text-canon-ink">
            Upload every Hive's <code>.bee</code> file at once. Each file must carry its own{' '}
            <code>contributor.label</code> and <code>contributor.id</code> — no need to add contributors first.
          </p>
          <input
            type="file"
            accept=".bee"
            multiple
            onChange={handleBulkFiles}
            className="text-sm text-canon-foreground"
            aria-label="Upload multiple .bee files"
          />

          {bulkFiles.length > 0 && (
            <ul className="space-y-1 pt-2">
              {bulkFiles.map((f) => (
                <li key={f.name} className="flex items-center justify-between text-xs">
                  <span className="text-canon-foreground">{f.name}</span>
                  {f.status === 'uploading' && <span className="text-canon-muted">Uploading…</span>}
                  {f.status === 'done' && (
                    <span className="flex items-center gap-1 text-canon-forest font-medium">
                      <Icon name="check" size={13} /> Added
                    </span>
                  )}
                  {f.status === 'error' && <span className="text-canon-signal">{f.error}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Upload manifest */}
      {state.contributors.some((c) => c.data) && (
        <div className="space-y-2">
          <span className="font-mono text-[0.65rem] font-bold tracking-[0.14em] uppercase text-canon-muted">
            Upload Manifest
          </span>
          <div className="rounded-card border border-canon-border overflow-hidden">
            <table className="w-full text-xs table-fixed">
              <thead className="bg-canon-sand border-b border-canon-border">
                <tr>
                  {['ID', 'Label', 'Terms', 'Edges', 'Effect'].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left font-mono text-[0.65rem] tracking-[0.1em] uppercase text-canon-muted"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-canon-border bg-canon-paper-bright">
                {state.contributors.filter((c) => c.data).map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2 font-mono">{c.id}</td>
                    <td className="px-3 py-2">{c.label}</td>
                    <td className="px-3 py-2 tabular-nums">{c.data!.n_terms}</td>
                    <td className="px-3 py-2 tabular-nums">{c.data!.n_edges}</td>
                    <td className="px-3 py-2 text-canon-muted tabular-nums">
                      {c.data!.n_positive}+ / {c.data!.n_negative}−
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button
          variant="primary"
          disabled={!hasData}
          onClick={() => dispatch({ type: 'SET_STAGE', stage: 'consolidate' })}
        >
          Continue to Consolidate →
        </Button>
      </div>
    </div>
  )
}
