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

  test('row is one line: title + status chip + one flag chip, and reaches the builder', () => {
    const page = read(ADMIN_SOPS_PAGE)
    const browser = read(path.join(ROOT, 'src', 'components', 'admin', 'SopMillerBrowser.tsx'))

    // 2026-08-04 (sketch 005 variant C): the row moved out of the page into
    // SopMillerBrowser, because selecting a SOP must be client state — a
    // search-param push would fire an RSC request per click (CLAUDE.md
    // [2026-05-13]). UX-06's invariant is unchanged: ONE line, ONE flag chip,
    // and the row reaches the builder. Assert it where it now lives, plus
    // that the page still WIRES it — a guard that only greps the old file
    // goes stale-green on the next relocation (CLAUDE.md [2026-07-13]).
    expect(page).toContain('<SopMillerBrowser')
    expect(page).toContain('sops={millerSops}')

    // Whole row reaches the builder (WIRING: interpolated sop id).
    expect(browser).toMatch(/href=\{`\/admin\/sops\/builder\/\$\{sop\.id\}`\}/)
    expect(browser).toContain('<StatusBadge status={sop.status as SopStatus} />')
    expect(browser).toContain('sop.flagLabel')

    // ONE flag chip: worst-first pick, still resolved server-side.
    expect(page).toContain('FLAG_PRIORITY.find((f) => r.flags.includes(f))')
    expect(page).toContain('flagLabel: flag ? FLAG_LABEL[flag] : null')
    // Owner is still resolved for the detail pane, and still suppressed when
    // the flag chip already says "No owner".
    expect(page).toContain('ownerLabelById[sop.owner_user_id]')
    expect(page).toContain("flag === 'unowned' ? null : shortOwner(owner)")
  })

  test('selecting a SOP is client state, not a URL push (hot-path latency)', () => {
    const browser = read(path.join(ROOT, 'src', 'components', 'admin', 'SopMillerBrowser.tsx'))
    expect(browser).toContain("'use client'")
    expect(browser).toContain('useState')
    expect(browser).toContain('setSelectedId(sop.id)')
    // A router PUSH would cost an RSC round-trip through the service worker on
    // every row click — the exact regression [2026-05-13] records. refresh()
    // is allowed and necessary, but only AFTER a write: the scope counts and
    // row chips are server-rendered, so assigning a department has to re-run
    // the page or the row stays in a scope it no longer belongs to.
    expect(browser).not.toContain('router.push')
    expect(browser).toContain('router.refresh()')

    // The selection handler itself must not refresh. Slice from the onClick to
    // the end of that JSX attribute and assert it does nothing but set state.
    const onSelect = browser.slice(
      browser.indexOf('onClick={() => setSelectedId'),
      browser.indexOf('data-testid="miller-row"')
    )
    expect(onSelect, 'selecting a SOP must not navigate or refresh').not.toContain('router')

    // The detail pane must render from data the list already carries; a fetch
    // or a supabase client here would reintroduce the per-click round-trip by
    // another route.
    expect(browser).not.toContain('createClient')
    expect(browser).not.toContain('fetch(')
  })

  test('the detail pane fixes what it surfaces: category and department are editable in place', () => {
    const browser = read(path.join(ROOT, 'src', 'components', 'admin', 'SopMillerBrowser.tsx'))
    const actions = read(path.join(ROOT, 'src', 'actions', 'sops.ts'))

    // Noticing a missing category in the detail pane and having to open the
    // builder to set it is the trip the Miller layout exists to remove.
    expect(browser).toContain('setSopCategory(sop.id, next)')
    expect(browser).toContain('data-testid="miller-category-select"')

    // Departments go through DepartmentPicker in sop mode WITHOUT localOnly, so
    // the write lands via assignSopDepartments — the grant-backed path (D-11),
    // never a direct sop_departments insert.
    const picker = browser.slice(
      browser.indexOf('<DepartmentPicker'),
      browser.indexOf('/>', browser.indexOf('<DepartmentPicker'))
    )
    expect(picker, 'DepartmentPicker must be mounted').toContain('mode="sop"')
    expect(picker).toContain('sopId={sop.id}')
    // Scoped to the JSX element, not the file: the comment above it explains
    // why localOnly is OFF, and a whole-file check would read that as the prop.
    expect(picker, 'localOnly would make the picker report but never write').not.toContain('localOnly')
    expect(browser).not.toContain("from('sop_departments')")

    // The category action self-enforces org scope from the SESSION, never from
    // the fetched row, and filters the write on it too (CLAUDE.md [2026-07-28]).
    const body = actions.slice(actions.indexOf('export async function setSopCategory'))
    expect(body).toContain('requireAdminContext()')
    expect(body).toContain('sopRow.organisation_id !== ctx.organisationId')
    expect(body).toContain(".eq('organisation_id', ctx.organisationId)")
    expect(body).toContain('isValidCategorySlug(categorySlug)')
  })

  test('"No department" is a reachable scope, not a dead label', () => {
    const page = read(ADMIN_SOPS_PAGE)
    // It counts the SOPs nobody can be assigned, so it must be somewhere you
    // can GO — the detail pane is what makes going there useful.
    expect(page).toContain('href="/admin/sops?departments=none"')
    expect(page).toContain("departmentFilter === 'none'")
  })
})
