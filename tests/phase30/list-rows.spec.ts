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
  test('admin rows contain no SopDepartmentEditor / LibraryReviewCell / icon-only actions', () => {
    const src = read(ADMIN_SOPS_PAGE)
    expect(src).not.toContain('SopDepartmentEditor')
    expect(src).not.toContain('LibraryReviewCell')
    expect(src).not.toContain('VideoJobIndicator')
    // No icon-only action Links survive in the row region.
    expect(src).not.toContain('!min-w-[40px]')
    expect(src).not.toContain('DeleteSopButton')
    expect(src).not.toContain('lucide-react')
  })

  test('builder shell owns a labelled action menu wired to the 5 destinations', () => {
    const shell = read(STAGE_SHELL)
    // Href WIRING (CLAUDE.md 2026-06-05): the menu links interpolate the real
    // sopId into the real destination routes — not just route-name tokens.
    expect(shell).toMatch(/\/admin\/sops\/\$\{sopId\}\/assign/)
    expect(shell).toMatch(/\/admin\/sops\/\$\{sopId\}\/versions/)
    expect(shell).toMatch(/\/admin\/sops\/\$\{sopId\}\/video/)
    expect(shell).toMatch(/\/admin\/sops\/\$\{sopId\}\/qr/)
    // Delete for drafts survives in the menu (wired, not just named):
    // DeleteSopButton receives the sopId and the menu gates it on draft status.
    expect(shell).toMatch(/<DeleteSopButton\s+sopId=\{sopId\}/)
    expect(shell).toMatch(/isDraft=\{initialSop\.status === 'draft'\}/)
    expect(shell).toMatch(/\{isDraft && \(/)
  })

  test('action menu controls are labelled, not icon-only (usability-lab F-09)', () => {
    const shell = read(STAGE_SHELL)
    // Visible text labels for each destination — Phase 33 (33-04) Wayfinder
    // "Tools for this SOP" menu locked labels (sketches/builder-header-
    // orientation README § Decisions 2026-07-19), repointed off the old
    // Phase 30 labels in the SAME commit as the source change (CLAUDE.md
    // 2026-07-13 stale-guard class).
    expect(shell).toContain('Assign this SOP to workers')
    expect(shell).toContain('See earlier versions')
    expect(shell).toContain('Make a training video')
    expect(shell).toContain('Print a QR code')
    // The old Phase 30 labels no longer appear.
    expect(shell).not.toContain('Assign to team')
    expect(shell).not.toContain('Version history')
    expect(shell).not.toContain('Generate video')
    expect(shell).not.toContain('Print QR code')
    // The menu never uses the icon-only evidence-btn idiom from the old rows.
    expect(shell).not.toContain('evidence-btn')
    // Trigger is a labelled control ("Tools for this SOP" visible text + aria).
    expect(shell).toMatch(/aria-haspopup="menu"/)
    expect(shell).toMatch(/aria-expanded=\{open\}/)
  })

  test('row is one line: title + status chip + one flag chip + owner, click → builder', () => {
    const src = read(ADMIN_SOPS_PAGE)
    // Whole row is the builder link (WIRING: interpolated sopId).
    expect(src).toMatch(/href=\{`\/admin\/sops\/builder\/\$\{sop\.id\}`\}/)
    // Title · status chip · ONE flag chip · owner.
    expect(src).toContain('<StatusBadge status={sop.status as SopStatus} />')
    expect(src).toContain('FLAG_LABEL[flag]')
    expect(src).toContain('ownerLabelById[sop.owner_user_id]')
    // ONE flag chip: worst-first pick from the governance queue flags.
    expect(src).toContain('FLAG_PRIORITY.find((f) => r.flags.includes(f))')
  })
})
