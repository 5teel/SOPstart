/**
 * Phase 21.5 (Plan 21.5-05) — builder-review-flow.spec.ts
 *
 * SOURCE-CONTRACT assertions for the BuilderStageShell integration.
 * No chromium runtime required — reads source files from disk.
 *
 * Rationale: live UAT is deferred (CLAUDE.md Railway-only-testing); these
 * source-contract checks serve as the CI gate for the shell wiring, the
 * safety invariants, and the adaptive-stepper contract (consistent with
 * Phase 15/21 approach).
 *
 * Assertions:
 *   1. R1/R7  — BuilderStageShell imports the four stage components;
 *               page.tsx renders BuilderStageShell (not BuilderWithSourceViewer)
 *   2. R7/R10 — Shell has handlePublish/onPublish and the POST /publish target;
 *               no VerifyProgressIndicator or second publish-button mount
 *   3. R10    — Server publish route still contains unverified_blocks 400 gate
 *   4. R4     — NavRow/NavRow + BlockChecklistRow use humanizeBlockType, not raw {block.type}
 *   5. R10    — no-bulk-verify-ui.spec.ts exists + is registered in a playwright project
 *   6. R8     — Shell derives hasSourceDoc/showPane and gates Review on it
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')

function readSrc(relPath: string): string {
  const full = path.join(REPO_ROOT, relPath)
  if (!fs.existsSync(full)) {
    throw new Error(`SOURCE-CONTRACT: file not found — ${relPath} (at ${full})`)
  }
  return fs.readFileSync(full, 'utf-8')
}

// ---------------------------------------------------------------------------
// Test 1: R1/R7 — Shell imports + page.tsx renders shell
// ---------------------------------------------------------------------------
test('R1/R7: BuilderStageShell imports stage components; page.tsx renders BuilderStageShell', () => {
  const shellSrc = readSrc(
    'src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx',
  )
  const pageSrc = readSrc(
    'src/app/(protected)/admin/sops/builder/[sopId]/page.tsx',
  )

  // Shell must import all four stage components
  expect(shellSrc, 'Shell must import BuilderStageStepper').toContain('BuilderStageStepper')
  expect(shellSrc, 'Shell must import ReviewStation').toContain('ReviewStation')
  expect(shellSrc, 'Shell must import PublishStage').toContain('PublishStage')
  expect(shellSrc, 'Shell must import BuilderClient').toContain('BuilderClient')

  // page.tsx must render BuilderStageShell
  expect(pageSrc, 'page.tsx must import BuilderStageShell').toContain(
    "import { BuilderStageShell } from './BuilderStageShell'",
  )
  expect(pageSrc, 'page.tsx must render <BuilderStageShell').toContain('<BuilderStageShell')

  // page.tsx must NOT import or render BuilderWithSourceViewer
  expect(pageSrc, 'page.tsx must not import BuilderWithSourceViewer').not.toContain(
    "import { BuilderWithSourceViewer }",
  )
  expect(pageSrc, 'page.tsx must not render <BuilderWithSourceViewer').not.toContain(
    '<BuilderWithSourceViewer',
  )
})

// ---------------------------------------------------------------------------
// Test 2: R7/R10 — Sole publish trigger via handlePublish; no bulk-verify or
//         secondary publish-button mount
// ---------------------------------------------------------------------------
test('R7/R10: Shell has handlePublish/onPublish and POST /publish; no VerifyProgressIndicator mount', () => {
  const shellSrc = readSrc(
    'src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx',
  )

  // handlePublish callback present
  expect(shellSrc, 'Shell must define handlePublish').toContain('handlePublish')
  // onPublish prop passed to PublishStage
  expect(shellSrc, 'Shell must pass onPublish to PublishStage').toContain('onPublish')
  // POST /publish target present
  expect(shellSrc, "Shell must contain POST to /api/sops/.../publish").toMatch(
    /\/api\/sops\/.*\/publish/,
  )

  // Shell must NOT import or JSX-render VerifyProgressIndicator (secondary publish button).
  // Filter out comment lines before checking — the JSDoc comment may mention the name.
  const shellNonCommentLines = shellSrc
    .split(/\r?\n/)
    .filter((l) => {
      const t = l.trim()
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
    })
    .join('\n')
  expect(
    shellNonCommentLines,
    'Shell must not import or render VerifyProgressIndicator',
  ).not.toContain('VerifyProgressIndicator')

  // Shell must not contain a standalone publish-button that is NOT inside PublishStage
  // (proxy check: no data-testid="publish-button" rendered by the shell directly)
  // The shell delegates to PublishStage which owns the button.
  const shellLines = shellSrc.split(/\r?\n/)
  const directPublishBtn = shellLines.filter(
    (l) => l.includes('data-testid="publish-button"') && !l.trim().startsWith('//')
  )
  expect(
    directPublishBtn,
    'Shell must not directly render data-testid="publish-button" (PublishStage owns it)',
  ).toHaveLength(0)
})

// ---------------------------------------------------------------------------
// Test 3: R10 server gate — publish route still returns 400 unverified_blocks
// ---------------------------------------------------------------------------
// Phase 29 factored the gate out of the route into assertPublishGates()
// (publish-core.ts) so the chain-gate divert could reuse the identical checks.
// Assert the gate WHERE IT LIVES, plus that the route still CALLS it.
test('R10: Server publish route still contains the 400 unverified_blocks gate', () => {
  const coreSrc = readSrc('src/lib/governance/publish-core.ts')

  expect(coreSrc, "Publish gate must contain 'unverified_blocks' literal").toContain(
    "error: 'unverified_blocks'",
  )
  expect(coreSrc, 'Publish gate must reject with status: 400').toMatch(/status:\s*400/)

  const routeSrc = readSrc('src/app/api/sops/[sopId]/publish/route.ts')
  expect(routeSrc, 'Publish route must call the shared gate').toContain('assertPublishGates(')
})

// ---------------------------------------------------------------------------
// Test 4: R4 — Humanized labels: NavRow + BlockChecklistRow use
//         humanizeBlockType, not raw {block.type}
// ---------------------------------------------------------------------------
test('R4: NavRow and BlockChecklistRow use humanizeBlockType, not raw {block.type}', () => {
  const navRowPath = 'src/app/(protected)/admin/sops/builder/[sopId]/NavRow.tsx'
  const checklistRowPath =
    'src/components/admin/verify-checklist/BlockChecklistRow.tsx'

  // NavRow must exist and import humanizeBlockType
  const navRowSrc = readSrc(navRowPath)
  expect(navRowSrc, 'NavRow must import humanizeBlockType').toContain('humanizeBlockType')

  // NavRow must not render raw block.type — check for JSX {block.type} pattern
  expect(navRowSrc, 'NavRow must not render raw {block.type}').not.toMatch(
    /\{block\.type\}/,
  )

  // BlockChecklistRow may or may not exist (it's a Phase 21 component)
  const checklistRowFull = path.join(REPO_ROOT, checklistRowPath)
  if (fs.existsSync(checklistRowFull)) {
    const checklistRowSrc = fs.readFileSync(checklistRowFull, 'utf-8')
    expect(checklistRowSrc, 'BlockChecklistRow must import humanizeBlockType').toContain(
      'humanizeBlockType',
    )
    expect(checklistRowSrc, 'BlockChecklistRow must not render raw {block.type}').not.toMatch(
      /\{block\.type\}/,
    )
  }

  // ReviewStation must not render raw {block.type}
  const reviewStationSrc = readSrc(
    'src/app/(protected)/admin/sops/builder/[sopId]/ReviewStation.tsx',
  )
  expect(reviewStationSrc, 'ReviewStation must not render raw {block.type}').not.toMatch(
    /\{block\.type\}/,
  )
})

// ---------------------------------------------------------------------------
// Test 5: R10 lock — no-bulk-verify-ui.spec.ts exists and is registered in
//         a playwright project
// ---------------------------------------------------------------------------
test('R10: no-bulk-verify-ui.spec.ts exists and is registered in playwright.config.ts', () => {
  const lockSpecPath = 'tests/lint/no-bulk-verify-ui.spec.ts'
  const lockSpecFull = path.join(REPO_ROOT, lockSpecPath)

  expect(
    fs.existsSync(lockSpecFull),
    `D-21-07 lock spec must exist at ${lockSpecPath}`,
  ).toBe(true)

  // Playwright config must reference this file via a project testMatch
  const playwrightConfigSrc = readSrc('playwright.config.ts')

  // The phase15-stubs project regex includes 'no-bulk-verify-ui'
  expect(
    playwrightConfigSrc,
    'playwright.config.ts must have a project regex matching no-bulk-verify-ui',
  ).toContain('no-bulk-verify-ui')
})

// ---------------------------------------------------------------------------
// Test 6: R8 — Shell derives hasSourceDoc/showPane and gates Review on it
// ---------------------------------------------------------------------------
test('R8: BuilderStageShell derives hasSourceDoc/showPane and gates ReviewStation on hasSourceDoc', () => {
  const shellSrc = readSrc(
    'src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx',
  )

  // showPane derivation must be present (CONV-12 logic)
  expect(shellSrc, 'Shell must derive showPane').toContain('showPane')

  // hasSourceDoc must be set equal to showPane
  expect(shellSrc, 'Shell must set hasSourceDoc = showPane').toContain(
    'hasSourceDoc = showPane',
  )

  // ReviewStation must only render when hasSourceDoc
  // Proxy: the ReviewStation JSX block should be guarded with hasSourceDoc
  expect(shellSrc, 'Shell must guard ReviewStation on hasSourceDoc').toMatch(
    /hasSourceDoc[\s\S]*ReviewStation|ReviewStation[\s\S]*hasSourceDoc/,
  )

  // showVerifyGate must also be derived
  expect(shellSrc, 'Shell must derive showVerifyGate').toContain('showVerifyGate')
})
