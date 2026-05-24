'use client'

/**
 * SCP-VERIFY-05 LOCK: This component MUST NOT contain bulk-verify UI.
 * No "approve all", "verify all", "select all", or trust-score skip allowed.
 * The 2.5-minute friction at 50 blocks IS the safety feature (Spike 004 verdict).
 * Static-analysis check in `__tests__/VerifyChecklistGate.test.tsx` regression-guards
 * this. The grep-guard Playwright spec at `tests/lint/no-bulk-verify-ui.spec.ts`
 * also runs in CI.
 *
 * Phase 21 (Plan 21-04 Task 1) — VerifyChecklistGate.
 *
 * The gate IS the publish surface. Layout:
 *   ┌─────────────────────────────────────┐
 *   │ [ X / N verified ]  [Publish] btn   │  ← sticky VerifyProgressIndicator
 *   ├─────────────────────────────────────┤
 *   │ ☐ StepBlock   Tighten valve...  [2] │  ← BlockChecklistRow per block
 *   │ ☑ PhotoGrid   Image grid       │
 *   │ ☐ StepBlock   ...               [1] │
 *   └─────────────────────────────────────┘
 *
 * Keyboard:  j next / k prev / a approve / d decline / Enter focus-source
 *            (see keyboard-bindings.ts — single source of truth)
 *
 * D-21-09 isolation: admin-only. Statically importing this from a worker
 * route would pull TanStack-Query / Wave-1 actions into the worker bundle.
 */

import { useCallback, useEffect, useRef } from 'react'
import { useVerifyChecklist } from './useVerifyChecklist'
import { useChecklistKeybinds, CHECKLIST_KEYBINDS } from './keyboard-bindings'
import { BlockChecklistRow } from './BlockChecklistRow'
import { VerifyProgressIndicator } from './VerifyProgressIndicator'
import { useSelectionSync } from '@/components/admin/source-viewer/useSelectionSync'

export type VerifyChecklistGateProps = {
  sopId: string
  /** Called whenever the gate transitions to/from "ready to publish". */
  onPublishReady?: (ready: boolean) => void
  /** Called when the admin presses the publish button (gate-validated). */
  onPublish?: () => void
  /** Disable keybindings (e.g. modal is open). */
  enabled?: boolean
}

export function VerifyChecklistGate({
  sopId,
  onPublishReady,
  onPublish,
  enabled = true,
}: VerifyChecklistGateProps): React.JSX.Element {
  const checklist = useVerifyChecklist(sopId)
  const selection = useSelectionSync()
  const listRef = useRef<HTMLDivElement | null>(null)

  // Fan onPublishReady out as a side effect of isReady transitions.
  const prevReady = useRef<boolean | null>(null)
  useEffect(() => {
    if (prevReady.current !== checklist.isReady) {
      prevReady.current = checklist.isReady
      if (onPublishReady) onPublishReady(checklist.isReady)
    }
  }, [checklist.isReady, onPublishReady])

  const focusSourcePane = useCallback(
    (blockId: string) => {
      const block = checklist.blocks.find((b) => b.id === blockId)
      if (!block) return
      if (block.provenance) {
        selection.setActiveProvenance(block.provenance, block.id)
      } else {
        // Block has no provenance (legacy pre-Phase-21 row) — still fire so
        // listeners can clear or jump to the canvas.
        selection.setActiveProvenance(null, block.id)
      }
    },
    [checklist.blocks, selection],
  )

  useChecklistKeybinds({
    blocks: checklist.blocks,
    activeIdx: checklist.activeIdx,
    setActiveIdx: checklist.setActiveIdx,
    approve: checklist.approve,
    decline: checklist.decline,
    focusSourcePane,
    enabled,
  })

  // Auto-scroll the active row into view when activeIdx changes.
  useEffect(() => {
    const container = listRef.current
    if (!container) return
    const row = container.querySelector<HTMLElement>(
      `[data-testid="block-checklist-row"][data-block-id="${checklist.activeBlockId}"]`,
    )
    if (row && typeof row.scrollIntoView === 'function') {
      row.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [checklist.activeIdx, checklist.activeBlockId])

  const handlePublish = useCallback(() => {
    if (!checklist.isReady) return
    if (onPublish) onPublish()
  }, [checklist.isReady, onPublish])

  if (checklist.isLoading) {
    return (
      <aside
        data-testid="verify-checklist-gate"
        data-state="loading"
        className="w-[320px] min-w-[320px] border-l border-[var(--ink-200)] bg-[var(--ink-50)] flex items-center justify-center text-sm text-[var(--ink-500)]"
        style={{ height: '100%' }}
      >
        Loading checklist…
      </aside>
    )
  }

  if (checklist.totalCount === 0) {
    return (
      <aside
        data-testid="verify-checklist-gate"
        data-state="empty"
        className="w-[320px] min-w-[320px] border-l border-[var(--ink-200)] bg-[var(--ink-50)] flex items-center justify-center text-sm text-[var(--ink-500)] px-4 text-center"
        style={{ height: '100%' }}
      >
        No blocks to verify in this SOP yet.
      </aside>
    )
  }

  return (
    <aside
      data-testid="verify-checklist-gate"
      data-state={checklist.isReady ? 'ready' : 'pending'}
      data-verified-count={checklist.verifiedCount}
      data-total-count={checklist.totalCount}
      className="w-[320px] min-w-[320px] max-w-[40vw] border-l border-[var(--ink-200)] bg-[var(--ink-50)] flex flex-col"
      style={{ height: '100%' }}
    >
      <VerifyProgressIndicator
        verifiedCount={checklist.verifiedCount}
        totalCount={checklist.totalCount}
        isReady={checklist.isReady}
        onPublish={handlePublish}
      />

      {checklist.error ? (
        <div
          role="alert"
          data-testid="verify-checklist-error"
          onClick={checklist.clearError}
          className="m-2 px-2 py-1 rounded border border-red-500/30 bg-red-500/10 text-red-700 text-xs cursor-pointer"
        >
          {checklist.error} (click to dismiss)
        </div>
      ) : null}

      <div
        ref={listRef}
        data-testid="verify-checklist-rows"
        className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1"
      >
        {checklist.blocks.map((block, idx) => (
          <BlockChecklistRow
            key={block.id}
            block={block}
            active={idx === checklist.activeIdx}
            onClick={() => checklist.setActiveIdx(idx)}
            onApprove={() => checklist.approve(block.id)}
            onDecline={() => checklist.decline(block.id)}
          />
        ))}
      </div>

      <footer
        data-testid="verify-checklist-keyhelp"
        className="px-3 py-2 border-t border-[var(--ink-200)] text-[10px] font-mono uppercase tracking-wider text-[var(--ink-500)] flex flex-wrap gap-x-3 gap-y-1"
      >
        <span>
          <kbd>{CHECKLIST_KEYBINDS.next}</kbd> next
        </span>
        <span>
          <kbd>{CHECKLIST_KEYBINDS.prev}</kbd> prev
        </span>
        <span>
          <kbd>{CHECKLIST_KEYBINDS.approve}</kbd> approve
        </span>
        <span>
          <kbd>{CHECKLIST_KEYBINDS.decline}</kbd> decline
        </span>
        <span>
          <kbd>{CHECKLIST_KEYBINDS.focusSource}</kbd> source
        </span>
      </footer>
    </aside>
  )
}
