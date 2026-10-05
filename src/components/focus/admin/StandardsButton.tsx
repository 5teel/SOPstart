'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import {
  createStandard,
  getSopStandardsPanel,
  listStandards,
  removeStandard,
  renameStandard,
  setStandardAttachment,
} from '@/actions/standards'
import type { StandardRow, StandardTarget, StandardsPanel } from '@/lib/validators/standards'

/**
 * Phase 56 (56-06, D-12, SOP-02) -- Tools-menu row + portaled modal to manage the
 * organisation's standards and put them on this SOP, a section or a step.
 * Standalone so Phase 61 can mount the same panel in the Workshop. Moved to the
 * focus editor in 58-12: the rail, a section menu and a step card each pass a
 * `target`.
 *
 * Portaled modal shell: Escape closes, backdrop click closes.
 */

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const KIND_WORD: Record<string, string> = { hazard: 'Hazard', ppe: 'PPE', step: 'Step', check: 'Check' }

export function StandardsButton({
  sopId,
  target,
  trigger,
  onChanged,
}: {
  sopId: string
  /**
   * What the popover attaches to. Omitted / `sop` = the whole panel (SOP, every
   * section, every step). `section` and `step` show only that one place's toggles.
   */
  target?: StandardTarget
  /** Replaces the default menu row. Receives the opener. */
  trigger?: (open: () => void) => ReactNode
  /** Called after an attach / detach / remove lands, so the editor re-reads its labels. */
  onChanged?: () => void
}) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [standards, setStandards] = useState<StandardRow[]>([])
  const [panel, setPanel] = useState<StandardsPanel | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [actionError, setActionError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

  // Reset into "loading" the moment the modal opens, during render (not in an
  // effect) -- react-hooks/set-state-in-effect.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setLoading(true)
      setLoadError(null)
      setActionError(null)
      setRenamingId(null)
      setConfirmRemoveId(null)
    }
  }

  useEffect(() => {
    if (!open) return
    void Promise.all([listStandards(), getSopStandardsPanel(sopId)]).then(([list, sop]) => {
      setLoading(false)
      if ('error' in list) return setLoadError(list.error)
      if ('error' in sop) return setLoadError(sop.error)
      setStandards(list.standards)
      setPanel(sop)
    })
  }, [open, sopId])

  // Named so each onClick is traceable to its action call (2026-06-05 -- wiring,
  // not just token presence).
  async function addStandard() {
    setActionError(null)
    const result = await createStandard({ name: newName })
    if ('error' in result) return setActionError(result.error)
    setStandards((prev) =>
      [...prev, { id: result.standard.id, name: result.standard.name, uses: 0 }].sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      )
    )
    setPanel((p) => (p ? { ...p, standards: [...p.standards, result.standard] } : p))
    setNewName('')
  }

  async function saveRename(standardId: string) {
    setActionError(null)
    const result = await renameStandard({ standardId, name: renameDraft })
    if ('error' in result) return setActionError(result.error)
    setStandards((prev) => prev.map((s) => (s.id === standardId ? { ...s, name: result.standard.name } : s)))
    setPanel((p) =>
      p ? { ...p, standards: p.standards.map((s) => (s.id === standardId ? result.standard : s)) } : p
    )
    setRenamingId(null)
  }

  async function confirmRemove(standardId: string) {
    setActionError(null)
    const result = await removeStandard({ standardId })
    if ('error' in result) return setActionError(result.error)
    const drop = (ids: string[]) => ids.filter((id) => id !== standardId)
    setStandards((prev) => prev.filter((s) => s.id !== standardId))
    setPanel((p) =>
      p
        ? {
            standards: p.standards.filter((s) => s.id !== standardId),
            sopAttached: drop(p.sopAttached),
            sections: p.sections.map((sec) => ({
              ...sec,
              attached: drop(sec.attached),
              steps: sec.steps.map((st) => ({ ...st, attached: drop(st.attached) })),
            })),
          }
        : p
    )
    setConfirmRemoveId(null)
    onChanged?.()
  }

  function patchAttached(target: StandardTarget, standardId: string, on: boolean) {
    const patch = (ids: string[]) => (on ? [...ids.filter((id) => id !== standardId), standardId] : ids.filter((id) => id !== standardId))
    setPanel((p) => {
      if (!p) return p
      if (target.kind === 'sop') return { ...p, sopAttached: patch(p.sopAttached) }
      return {
        ...p,
        sections: p.sections.map((sec) =>
          target.kind === 'section' && sec.id === target.id
            ? { ...sec, attached: patch(sec.attached) }
            : {
                ...sec,
                steps: sec.steps.map((st) =>
                  target.kind === 'step' && st.id === target.id ? { ...st, attached: patch(st.attached) } : st
                ),
              }
        ),
      }
    })
    setStandards((prev) => prev.map((s) => (s.id === standardId ? { ...s, uses: Math.max(0, s.uses + (on ? 1 : -1)) } : s)))
  }

  async function toggleStandard(standardId: string, target: StandardTarget, attached: boolean) {
    setActionError(null)
    setSaveState('saving')
    patchAttached(target, standardId, attached)
    const result = await setStandardAttachment({ standardId, target, attached })
    if ('error' in result) {
      patchAttached(target, standardId, !attached)
      setSaveState('error')
      setActionError(result.error)
      return
    }
    setSaveState('saved')
    onChanged?.()
  }

  function renderToggles(target: StandardTarget, attached: string[]) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {standards.map((s) => {
          const on = attached.includes(s.id)
          return (
            <button
              key={s.id}
              type="button"
              data-testid="standard-toggle"
              data-target-kind={target.kind}
              data-standard-name={s.name}
              aria-pressed={on}
              onClick={() => void toggleStandard(s.id, target, !on)}
              className={
                on
                  ? 'min-h-tap rounded border border-transparent bg-accent-inspect/10 px-2.5 font-mono text-micro text-accent-inspect'
                  : 'min-h-tap rounded border border-[var(--ink-200)] px-2.5 font-mono text-micro text-[var(--ink-500)] hover:bg-[var(--paper-2)]'
              }
            >
              {s.name}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <>
      {trigger ? (
        trigger(() => setOpen(true))
      ) : (
        <button
          type="button"
          role="menuitem"
          onClick={() => setOpen(true)}
          className="flex w-full flex-col items-start gap-0.5 rounded px-3 py-2 text-left hover:bg-[var(--paper-2)] transition-colors"
        >
          <span className="text-ui text-[var(--ink-900)]">Standards</span>
          <span className="text-micro text-[var(--ink-500)]">labels such as LOTO on this SOP, a section or a step</span>
        </button>
      )}

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center sm:p-4"
            onClick={() => setOpen(false)}
          >
            <div
              data-testid="standards-panel"
              role="dialog"
              aria-label="Standards for this SOP"
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--paper)] w-full sm:max-w-2xl h-[88vh] sm:h-[75vh] sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl"
            >
              <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--ink-100)] bg-[var(--paper)]">
                <h2 className="text-base font-semibold text-[var(--ink-900)]">Standards</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="h-9 w-9 rounded-lg hover:bg-[var(--paper-2)] flex items-center justify-center text-[var(--ink-500)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              {loading && <p className="p-4 text-meta text-[var(--ink-500)]">Loading standards…</p>}
              {loadError && <p className="p-4 text-meta text-[var(--accent-hazard)]">{loadError}</p>}

              {!loading && !loadError && panel && (
                <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-5">
                  <div aria-live="polite" className="min-h-4 text-meta">
                    {actionError && <span className="text-[var(--accent-hazard)]">{actionError}</span>}
                    {!actionError && saveState === 'saving' && (
                      <span className="text-[var(--ink-500)]">Saving…</span>
                    )}
                    {!actionError && saveState === 'saved' && <span className="text-[var(--ink-500)]">Saved ✓</span>}
                  </div>

                  <section className="flex flex-col gap-2">
                    <h3 className="text-meta font-medium text-[var(--ink-700)]">All standards</h3>
                    {standards.map((s) => (
                      <div
                        key={s.id}
                        data-testid="standard-row"
                        data-standard-name={s.name}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--ink-200)] px-3 py-2"
                      >
                        {renamingId === s.id ? (
                          <>
                            <input
                              type="text"
                              aria-label={`Rename ${s.name}`}
                              value={renameDraft}
                              maxLength={60}
                              onChange={(e) => setRenameDraft(e.target.value)}
                              className="min-h-tap flex-1 rounded-lg border border-[var(--ink-300)] bg-[var(--paper)] px-3 text-ui text-[var(--ink-900)]"
                            />
                            <button
                              type="button"
                              onClick={() => void saveRename(s.id)}
                              className="min-h-tap rounded-lg px-3 text-ui text-[var(--ink-900)] hover:bg-[var(--paper-2)]"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setRenamingId(null)}
                              className="min-h-tap rounded-lg px-3 text-ui text-[var(--ink-500)] hover:bg-[var(--paper-2)]"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="text-ui text-[var(--ink-900)]">{s.name}</span>
                            <span className="text-meta text-[var(--ink-500)]">
                              used in {s.uses} {s.uses === 1 ? 'place' : 'places'}
                            </span>
                            <span className="ml-auto flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setRenamingId(s.id)
                                  setRenameDraft(s.name)
                                  setConfirmRemoveId(null)
                                }}
                                className="min-h-tap rounded-lg px-3 text-ui text-[var(--ink-700)] hover:bg-[var(--paper-2)]"
                              >
                                Rename
                              </button>
                              {confirmRemoveId === s.id ? (
                                <button
                                  type="button"
                                  onClick={() => void confirmRemove(s.id)}
                                  className="min-h-tap rounded-lg px-3 text-ui text-[var(--accent-hazard)] hover:bg-[var(--paper-2)]"
                                >
                                  Remove — comes off {s.uses} {s.uses === 1 ? 'place' : 'places'}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConfirmRemoveId(s.id)
                                    setRenamingId(null)
                                  }}
                                  className="min-h-tap rounded-lg px-3 text-ui text-[var(--ink-700)] hover:bg-[var(--paper-2)]"
                                >
                                  Remove
                                </button>
                              )}
                            </span>
                          </>
                        )}
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        data-testid="standard-add-input"
                        aria-label="New standard"
                        value={newName}
                        maxLength={60}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="New standard, e.g. Forklift"
                        className="min-h-tap flex-1 rounded-lg border border-[var(--ink-300)] bg-[var(--paper)] px-3 text-ui text-[var(--ink-900)]"
                      />
                      <button
                        type="button"
                        data-testid="standard-add"
                        onClick={() => void addStandard()}
                        className="min-h-tap rounded-lg border border-[var(--ink-300)] px-4 text-ui text-[var(--ink-900)] hover:bg-[var(--paper-2)]"
                      >
                        Add
                      </button>
                    </div>
                  </section>

                  {target && target.kind !== 'sop' && (
                    <section className="flex flex-col gap-3">
                      <h3 className="text-meta font-medium text-[var(--ink-700)]">
                        {target.kind === 'section' ? 'On this section' : 'On this step'}
                      </h3>
                      {renderToggles(
                        target,
                        (target.kind === 'section'
                          ? panel.sections.find((s) => s.id === target.id)?.attached
                          : panel.sections.flatMap((s) => s.steps).find((st) => st.id === target.id)?.attached) ?? []
                      )}
                    </section>
                  )}
                  {(!target || target.kind === 'sop') && (
                  <section className="flex flex-col gap-3">
                    <h3 className="text-meta font-medium text-[var(--ink-700)]">On this SOP</h3>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-ui text-[var(--ink-900)]">Whole SOP</span>
                      {renderToggles({ kind: 'sop', id: sopId }, panel.sopAttached)}
                    </div>
                    {panel.sections.map((sec) => (
                      <div key={sec.id} className="flex flex-col gap-1.5 border-t border-[var(--ink-100)] pt-3">
                        <span className="text-ui text-[var(--ink-900)]">{sec.title}</span>
                        {renderToggles({ kind: 'section', id: sec.id }, sec.attached)}
                        <details className="mt-1">
                          <summary className="min-h-tap cursor-pointer text-meta text-[var(--ink-500)]">
                            Steps ({sec.steps.length})
                          </summary>
                          {sec.steps.length === 0 && (
                            <p className="text-meta text-[var(--ink-500)]">No steps to label yet.</p>
                          )}
                          {sec.steps.map((st) => (
                            <div key={st.id} className="mt-2 flex flex-col gap-1.5">
                              <span className="truncate text-meta text-[var(--ink-700)]">
                                {KIND_WORD[st.kind] ?? 'Step'} · {st.text}
                              </span>
                              {renderToggles({ kind: 'step', id: st.id }, st.attached)}
                            </div>
                          ))}
                        </details>
                      </div>
                    ))}
                  </section>
                  )}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
