/**
 * UX-06 — Admin list rows one line (Phase 30 Wave-0 stub).
 *
 * Eventual contract (30-RESEARCH § Test Map + orchestrator decision #2):
 *   - Admin /admin/sops row = Title · status chip · ONE flag chip · owner;
 *     whole row click → builder. Nothing else.
 *   - SopDepartmentEditor + LibraryReviewCell leave the row.
 *   - The 5 icon-only actions (edit/assign/versions/video/qr) move into a
 *     LABELLED action menu in the BuilderStageShell top bar (reachable from
 *     every stage). Delete action survives for drafts in the same menu.
 *   - Fixes usability-lab F-09 (icon-only actions, WCAG).
 *   - WIRING assertions required, not token presence (CLAUDE.md 2026-06-05):
 *     the menu entries' href/onClick must reference the real destinations.
 *
 * This file starts as test.fixme — the UX-06 plan flips it live.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const ADMIN_SOPS_PAGE = path.join(
  ROOT, 'src', 'app', '(protected)', 'admin', 'sops', 'page.tsx',
)
const STAGE_SHELL = path.join(
  ROOT, 'src', 'app', '(protected)', 'admin', 'sops', 'builder', '[sopId]', 'BuilderStageShell.tsx',
)

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('UX-06 — one-line admin rows + builder action menu', () => {
  test.fixme('admin rows contain no SopDepartmentEditor / LibraryReviewCell / icon-only actions', () => {
    const src = read(ADMIN_SOPS_PAGE)
    expect(src).not.toContain('SopDepartmentEditor')
    expect(src).not.toContain('LibraryReviewCell')
    expect(src).not.toContain('VideoJobIndicator')
  })

  test.fixme('builder shell owns a labelled action menu wired to the 5 destinations', () => {
    const shell = read(STAGE_SHELL)
    expect(shell).toMatch(/\/assign/)
    expect(shell).toMatch(/\/versions/)
    expect(shell).toMatch(/\/video/)
    expect(shell).toMatch(/\/qr/)
    // Delete for drafts survives in the menu (wired, not just named).
    expect(shell).toContain('DeleteSopButton')
  })

  test.fixme('row is one line: title + status chip + one flag chip + owner, click → builder', () => {
    const src = read(ADMIN_SOPS_PAGE)
    expect(src).toContain('/admin/sops/builder/')
  })
})
