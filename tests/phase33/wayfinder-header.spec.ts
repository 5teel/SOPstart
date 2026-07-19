/**
 * SC-6 — Wayfinder builder header: back/here/forward zones, inline lock
 * reason on the forward chip, ONE self-describing "Tools for this SOP ▾"
 * menu replacing the scattered tools cluster.
 *
 * Contract (33-04-PLAN must_haves, RESEARCH Pattern 6):
 *   - `BuilderStageShell.tsx` (component name KEPT — pinned by 6 spec files)
 *     header rebuilt as a light Wayfinder bar: white bg, `--ink-100`
 *     hairline zone dividers. Back zone: "← Library" link (href kept).
 *     Here zone: amber "YOU'RE EDITING" tick + title + `v{n}`. Forward
 *     zone: single chip = next stage, carrying the lock reason as a
 *     sentence when gated ("Locked — {remaining} steps below still need
 *     checking").
 *   - `BuilderStageStepper` file/`BuilderStage` union/stage keys/display
 *     labels ('Edit'/'Check'/'Send to workers') kept verbatim (pinned by
 *     tests/phase30/plain-language.spec.ts + builder-review-flow.spec.ts).
 *   - Tools cluster consolidated into ONE "Tools for this SOP ▾" menu in a
 *     `--paper-2` tools row: the 4 SopActionsMenu links with locked new
 *     labels (repointing tests/phase30/list-rows.spec.ts's 4 OLD labels),
 *     the 2 flow-modal triggers, Delete this draft
 *     (`<DeleteSopButton sopId={sopId}` shape kept, regex-pinned).
 *   - Only declared CSS tokens used (`--ink-100`, `--paper-2`,
 *     `--brand-yellow`, `--accent-ok`) — grep `-- "--token:" src/` before
 *     referencing anything new (2026-07-14 undefined-token learning).
 *
 * Flipped LIVE in: 33-04 (files_modified: tests/phase33/wayfinder-header.spec.ts)
 * — this Wave-0 version is a placeholder test.fixme ONLY until 33-04 lands;
 * do not treat it as done once 33-04 ships without confirming the fixme was
 * removed.
 *
 * Registration: playwright.config.ts `phase33` project
 *   testDir: '.', testMatch: /tests\/phase33\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase33`
 */
import { test, expect } from '@playwright/test'

test.describe('SC-6 — Wayfinder builder header (Wave 0 stub — flips live in 33-04)', () => {
  test.fixme(
    'BuilderStageShell renders back/here/forward Wayfinder zones with inline lock-reason chip and a single "Tools for this SOP" menu, all pinned identifiers (component name, stage labels, DeleteSopButton shape) kept verbatim',
    async ({ page }) => {
      /**
       * Real path constant this will assert against once built:
       *   - src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx
       *     (component name KEPT verbatim)
       *
       * Steps (once flipped live):
       * 1. Source-contract: confirm BuilderStageShell still exports the
       *    same component name, handlePublish/approval handlers, and
       *    hasSourceDoc = showPane derivation (zero-repoint pinned specs).
       * 2. Source-contract: confirm the header renders back/here/forward
       *    zones with `--ink-100` dividers; only declared CSS tokens
       *    referenced (no undefined bare var(--x)).
       * 3. Navigate to a locked builder stage; confirm the forward chip's
       *    text reads "Locked — {N} steps below still need checking"
       *    (inline lock reason, not a separate subline).
       * 4. Click "Tools for this SOP"; confirm ONE menu opens containing
       *    the locked new labels + both flow-modal triggers + Delete this
       *    draft (`<DeleteSopButton sopId={sopId}` shape intact).
       * 5. Confirm BuilderStageStepper's stage keys and 'Edit'/'Check'/
       *    'Send to workers' labels are unchanged.
       */
      void page
      expect(true).toBe(true)
    },
  )
})
