/**
 * UX-06 — Admin list rows one line (Phase 30 Wave-0 stub).
 *
 * Eventual contract (30-RESEARCH § Test Map + orchestrator decision #2):
 *   - Admin /admin/sops row = Title · status chip · ONE flag chip · owner;
 *     whole row click → builder. Nothing else.
 *   - SopDepartmentEditor + LibraryReviewCell leave the row.
 *   - The icon-only actions (edit/assign/versions) move into a
 *     LABELLED action menu in the BuilderStageShell top bar (reachable from
 *     every stage). Delete action survives for drafts in the same menu.
 *   - Fixes usability-lab F-09 (icon-only actions, WCAG).
 *   - WIRING assertions required, not token presence (CLAUDE.md 2026-06-05):
 *     the menu entries' href/onClick must reference the real destinations.
 *
 * Repointed in 41-08 (Phase 41, SUR-01/02/04): the admin library rows moved
 * off admin/sops/page.tsx (now a redirect shim) onto listAdminSopRows
 * (src/actions/admin-sop-list.ts) for data and AdminStatusLens.tsx for
 * rendering; the department scope column + "No department" link moved onto
 * AdminSopSurface.tsx.
 *
 * Repointed a second time in 54-05 (Phase 54, D-07/D-08) onto the admin library table,
 * and a third time in 57-09 (D-13): the table is deleted, so every assertion that
 * read it went with it. What survives: the builder Tools menu, the category fix,
 * and the row data listAdminSopRows still builds for the Workshop and the inbox.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const STAGE_SHELL = path.join(
  ROOT, 'src', 'app', '(protected)', 'admin', 'sops', 'builder', '[sopId]', 'BuilderStageShell.tsx',
)
const CATEGORY_BUTTON = path.join(
  ROOT, 'src', 'components', 'focus', 'admin', 'CategoryButton.tsx',
)
const ADMIN_SOP_LIST = path.join(ROOT, 'src', 'actions', 'admin-sop-list.ts')
const SOPS_ACTIONS = path.join(ROOT, 'src', 'actions', 'sops.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('UX-06 — one-line admin rows + builder action menu', () => {
  test('builder shell owns a labelled action menu wired to the 3 destinations', () => {
    const shell = read(STAGE_SHELL)
    // Href WIRING (CLAUDE.md 2026-06-05): the menu links interpolate the real
    // sopId into the real destination routes — not just route-name tokens.
    expect(shell).toMatch(/\/admin\/sops\/\$\{sopId\}\/assign/)
    expect(shell).toMatch(/\/admin\/sops\/\$\{sopId\}\/versions/)
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
    // The old Phase 30 labels no longer appear.
    expect(shell).not.toContain('Assign to team')
    expect(shell).not.toContain('Version history')
    expect(shell).not.toContain('Generate video')
    // The menu never uses the icon-only evidence-btn idiom from the old rows.
    expect(shell).not.toContain('evidence-btn')
    // Trigger is a labelled control ("Tools for this SOP" visible text + aria).
    expect(shell).toMatch(/aria-haspopup="menu"/)
    expect(shell).toMatch(/aria-expanded=\{open\}/)
  })

  test('listAdminSopRows builds the flag label and the owner label each row carries', () => {
    const listAction = read(ADMIN_SOP_LIST)
    expect(listAction).toContain('FLAG_PRIORITY.find((f) => r.flags.includes(f))')
    expect(listAction).toContain('flagLabel: flag ? FLAG_LABEL[flag] : null')
    expect(listAction).toContain('ownerLabelById[sop.owner_user_id]')
    expect(listAction).toContain("flag === 'unowned' ? null : shortOwner(owner)")
  })

  test('the category fix lives in the builder Tools menu', () => {
    // Noticing a missing category used to mean opening the retired detail
    // pane; it now lives beside "Pick machines for this SOP" in the builder
    // Tools menu (D-09) so it never gets stranded by the table replacing the
    // Miller frame.
    const categoryButton = read(CATEGORY_BUTTON)
    expect(categoryButton).toContain('setSopCategory(sopId, next)')
    expect(categoryButton).toContain('data-testid="builder-category-select"')

    // The category action self-enforces org scope from the SESSION, never
    // from the fetched row, and filters the write on it too (CLAUDE.md
    // [2026-07-28]).
    const body = read(SOPS_ACTIONS)
    const fn = body.slice(body.indexOf('export async function setSopCategory'))
    expect(fn).toContain('requireAdminContext()')
    expect(fn).toContain('sopRow.organisation_id !== ctx.organisationId')
    expect(fn).toContain(".eq('organisation_id', ctx.organisationId)")
    expect(fn).toContain('isValidCategorySlug(categorySlug)')
  })

  test('"No department" count is still reported by listAdminSopRows', () => {
    expect(read(ADMIN_SOP_LIST)).toContain('noAudienceCount')
  })

  test('"No department" means no AUDIENCE — all_departments does not count as unassigned', () => {
    const listAction = read(ADMIN_SOP_LIST)
    // all_departments = true is an audience and writes NO sop_departments rows,
    // so "has no junction rows" is not the same as "nobody can be assigned
    // this". Without this, setting a SOP to Everyone left it sitting in the
    // "No department" scope and the fix looked like it had done nothing.
    expect(listAction).toMatch(/!tagged\.has\(r\.id\)\s*&&\s*!r\.all_departments/)
    expect(listAction).toMatch(/!sopIdsWithDept\.has\(r\.id\)\s*&&\s*!r\.all_departments/)
    // Both the filter and the count must read all_departments to do that.
    expect(listAction).toContain("select('id, all_departments')")
    expect(listAction).toContain("select('id, status, all_departments')")
  })
})
