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
 *     labels (repointed tests/phase30/list-rows.spec.ts's 4 OLD labels),
 *     the 2 flow-modal triggers, Delete this draft
 *     (`<DeleteSopButton sopId={sopId}` shape kept, regex-pinned).
 *   - Only declared CSS tokens used (`--ink-100`, `--paper-2`,
 *     `--brand-yellow`, `--accent-ok`) — grep `-- "--token:" src/` before
 *     referencing anything new (2026-07-14 undefined-token learning).
 *
 * Flipped LIVE in 33-04 — this file was a Wave-0 test.fixme placeholder;
 * every assertion below reads the real BuilderStageShell/BuilderStageStepper
 * source (source-contract, matching the WIRING discipline of
 * tests/phase30/list-rows.spec.ts).
 *
 * Registration: playwright.config.ts `phase33` project
 *   testDir: '.', testMatch: /tests\/phase33\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase33`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SHELL = path.join(
  ROOT, 'src', 'app', '(protected)', 'admin', 'sops', 'builder', '[sopId]', 'BuilderStageShell.tsx',
)
const STEPPER = path.join(
  ROOT, 'src', 'app', '(protected)', 'admin', 'sops', 'builder', '[sopId]', 'BuilderStageStepper.tsx',
)

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('SC-6 — Wayfinder builder header', () => {
  test('BuilderStageShell keeps component name + zero-repoint pins (handlers, hasSourceDoc = showPane)', () => {
    const src = read(SHELL)
    expect(src).toContain('export function BuilderStageShell(')
    expect(src).toContain('handlePublish')
    expect(src).toContain('hasSourceDoc = showPane')
    expect(src).toContain("import { approveStep, requestChanges } from '@/actions/approvals'")
  })

  test('header renders back/here/forward Wayfinder zones with --ink-100 dividers', () => {
    const src = read(SHELL)
    expect(src).toContain('data-testid="wayfinder-bar"')
    expect(src).toContain('data-testid="wayfinder-back"')
    expect(src).toContain('data-testid="wayfinder-here"')
    expect(src).toContain('data-testid="wayfinder-forward"')
    // Light schema — no dark #0a0a0b bar remains.
    expect(src).not.toContain('#0a0a0b')
    expect(src).toMatch(/border-\[var\(--ink-100\)\]/)
    // Back zone keeps its href.
    expect(src).toMatch(/href="\/admin\/sops"/)
    // Here zone: amber tick over a --brand-yellow rule + title + version.
    expect(src).toContain('var(--brand-yellow, #fbbf24)')
    expect(src).toContain('{sopTitle}')
    expect(src).toContain('v{sopVersion}')
  })

  test('forward chip carries the inline lock reason sentence', () => {
    const src = read(STEPPER)
    expect(src).toContain('Locked — ${remaining} steps below still need checking')
    expect(src).toContain("data-testid=\"wayfinder-forward-chip\"")
    // Phase 29 pending-approval third chip state.
    expect(src).toContain('Waiting for approval')
    expect(src).toContain('approvalPending')
  })

  test('ONE "Tools for this SOP" menu holds all 7 locked items — no standalone triggers', () => {
    const src = read(SHELL)
    // Exactly one menu trigger.
    const triggerMatches = src.match(/data-testid="tools-menu-trigger"/g) ?? []
    expect(triggerMatches.length).toBe(1)
    expect(src).toContain('Tools for this SOP')
    // No old standalone action-menu component survives.
    expect(src).not.toContain('SopActionsMenu')
    // The 4 link items with locked labels.
    expect(src).toContain('Assign this SOP to workers')
    expect(src).toContain('See earlier versions')
    expect(src).toContain('Make a training video')
    expect(src).toContain('Print a QR code')
    // Both flow-modal triggers render inside the popover.
    expect(src).toContain('<BuilderFlowButton sop={sop} />')
    expect(src).toContain('<BuilderFlowEditButton sop={sop} sopId={sopId} />')
    // DeleteSopButton shape intact (regex-pinned by tests/phase30/list-rows.spec.ts).
    expect(src).toMatch(/<DeleteSopButton\s+sopId=\{sopId\}/)
    expect(src).toMatch(/isDraft=\{initialSop\.status === 'draft'\}/)
    expect(src).toMatch(/\{isDraft && \(/)
  })

  test('BuilderStageStepper stage keys and Edit/Check/Send to workers labels are unchanged', () => {
    const src = read(STEPPER)
    expect(src).toContain("export type BuilderStage = 'build' | 'review' | 'publish';")
    expect(src).toContain("label: 'Edit'")
    expect(src).toContain("label: 'Check'")
    expect(src).toContain("label: 'Send to workers'")
  })

  test('only declared CSS tokens referenced (no undefined bare var(--x))', () => {
    const shellSrc = read(SHELL)
    const stepperSrc = read(STEPPER)
    for (const src of [shellSrc, stepperSrc]) {
      for (const m of src.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\s*\)/g)) {
        // Every bare var(--x) reference in these two files must be one of
        // the tokens declared in src/styles/blueprint-theme.css.
        expect(
          ['--ink-100', '--ink-300', '--ink-500', '--ink-700', '--ink-900', '--paper-2', '--accent-ok'],
        ).toContain(m[1])
      }
    }
  })
})
