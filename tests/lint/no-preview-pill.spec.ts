/**
 * Phase 24 Plan 01 — D-24 LOCK: no "PREVIEW" pill in flow components.
 *
 * Modeled after tests/lint/no-bulk-verify-ui.spec.ts (grep-absence pattern).
 * Reads each of the three flow-facing files via readFileSync and asserts
 * the string PREVIEW does not appear. Plans 02/03 will remove the pill
 * and the "Graph (preview)" label — un-fixme this test when that lands.
 *
 * CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
 * Registered in playwright.config.ts under project phase24-stubs.
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { join } from 'path'

// TODO(24-02/24-03): un-fixme this test when Plans 02/03 remove the PREVIEW pill
// from FlowGraphCanvas.tsx (line ~115) and the "Graph (preview)" label from FlowTab.tsx (line ~24).
test.fixme('no PREVIEW pill or label in flow components', () => {
  const files = [
    'src/components/sop/flow/FlowGraphCanvas.tsx',
    'src/components/sop/tabs/FlowTab.tsx',
    'src/app/(protected)/admin/sops/builder/[sopId]/BuilderFlowButton.tsx',
  ]
  for (const f of files) {
    const content = readFileSync(join(process.cwd(), f), 'utf8')
    expect(content, `${f} must not contain PREVIEW pill or label`).not.toMatch(/PREVIEW/)
  }
})
