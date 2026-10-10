'use client'

/**
 * Phase 58 (58-13, WRK-04, D-02, D-17) -- the AI check at the top of the editor
 * column. Not run / running / findings / all clear / failed. Each open finding
 * can be shown (scroll + focus the step) or cleared; clearing writes a decision
 * ledger row on the server. Ticking a step never clears a finding.
 *
 * Design base 2026-10-10 (ADR-0007): a plain section, findings as divided rows.
 * No violet frame, no sparkle, no cards inside a card.
 */
import { useState } from 'react'
import { AlertTriangle, Check, Loader2 } from 'lucide-react'
import { clearFinding } from '@/actions/findings'
import { scrollToStep } from '@/components/focus/FocusRail'
import type { useFindings } from '@/hooks/useFindings'

export interface AiCheckBannerProps {
  api: ReturnType<typeof useFindings>
  /** Admins and safety managers run the check (it spends money). */
  canRun: boolean
  /** "Isolation · 4" for a step id; null when the step is unknown (shown as the whole SOP). */
  stepLabel(stepId: string): string | null
}

const NO_SOURCE = 'AI check — wording and clarity only; there is no source document to compare against.'

const ghost = 'min-h-tap rounded-lg border border-ink-300 bg-paper-1 px-4 text-ui text-ink-900'

export function AiCheckBanner({ api, canRun, stepLabel }: AiCheckBannerProps) {
  const [clearing, setClearing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const real = api.findings.filter((f) => f.kind !== 'all_clear')
  const open = real.filter((f) => !f.cleared_at)
  const cleared = real.filter((f) => f.cleared_at)

  async function clear(findingId: string) {
    setClearing(findingId)
    setError(null)
    const res = await clearFinding({ findingId })
    if ('error' in res) setError("Couldn't clear that finding.")
    else await api.refresh()
    setClearing(null)
  }

  let body
  if (api.loading) {
    body = <p className="text-ui text-ink-500">Loading the AI check…</p>
  } else if (api.running) {
    body = (
      <p role="status" className="flex items-center gap-2 text-reading text-ink-900">
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        AI is checking this SOP… about 20 seconds.
      </p>
    )
  } else if (api.runError || api.loadFailed) {
    body = (
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-2 text-reading font-semibold text-ink-900">
          <AlertTriangle className="size-4 text-accent-escalate" aria-hidden="true" />
          The AI check didn&apos;t run.
        </p>
        {api.runError && api.runError !== "The AI check didn't run." && <p className="text-ui text-ink-700">{api.runError}</p>}
        <div>
          <button type="button" data-testid="ai-check-retry" className={ghost} onClick={() => (api.loadFailed && !api.runError ? api.reload() : void api.run())}>
            Try again
          </button>
        </div>
      </div>
    )
  } else if (!api.lastRunAt) {
    body = (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ui text-ink-700">It reads every step and flags anything unclear or unsafe.</p>
        {canRun && (
          <button
            type="button"
            data-testid="ai-check-run"
            onClick={() => void api.run()}
            className="inline-flex min-h-tap items-center gap-2 rounded-lg bg-ink-900 px-4 text-ui font-semibold text-paper"
          >
            Run the AI check
          </button>
        )}
      </div>
    )
  } else if (open.length > 0) {
    body = (
      <div className="flex flex-col gap-2">
        <p className="section-heading">
          {open.length} {open.length === 1 ? 'thing' : 'things'} to check
        </p>
        <ul className="flex flex-col divide-y divide-ink-200 border-t border-ink-200">
          {open.map((f) => {
            const label = f.step_id ? stepLabel(f.step_id) : null
            return (
              <li key={f.id} data-testid="ai-finding" className="flex flex-col gap-2 py-3">
                <span className="mono text-meta text-ink-600">{label ?? 'Whole SOP'}</span>
                <span className="text-ui text-ink-900">{f.description}</span>
                <span className="flex flex-wrap gap-2">
                  {f.step_id && label && (
                    <button type="button" data-testid="ai-finding-show" className={ghost} onClick={() => scrollToStep(f.step_id as string)}>
                      Go to it
                    </button>
                  )}
                  {canRun && (
                    <button
                      type="button"
                      data-testid="ai-finding-clear"
                      disabled={clearing === f.id}
                      className={ghost}
                      onClick={() => void clear(f.id)}
                    >
                      Clear finding
                    </button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    )
  } else {
    body = (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-reading text-ink-900">
          <Check className="size-4 text-accent-ok" aria-hidden="true" />
          AI check: nothing left to look at.
        </p>
        {canRun && (
          <button type="button" data-testid="ai-check-rerun" className={ghost} onClick={() => void api.run()}>
            Run again
          </button>
        )}
      </div>
    )
  }

  return (
    <section data-testid="ai-check-banner" aria-label="AI check" className="flex flex-col gap-3 border-b border-ink-200 pb-4">
      <p className="text-ui font-semibold text-ink-700">AI check</p>
      {body}
      {!api.loading && !api.hasSource && (
        <p data-testid="ai-check-no-source" className="text-ui text-ink-500">
          {NO_SOURCE}
        </p>
      )}
      {cleared.length > 0 && !api.running && (
        <ul className="flex flex-col gap-1">
          {cleared.map((f) => (
            <li key={f.id} data-testid="ai-finding-cleared" className="text-ui text-ink-500">
              <span className="mono text-meta">{(f.step_id ? stepLabel(f.step_id) : null) ?? 'Whole SOP'}</span>
              {' · '}Cleared · logged in the decision ledger
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-ui text-accent-escalate">
          {error}
        </p>
      )}
    </section>
  )
}
