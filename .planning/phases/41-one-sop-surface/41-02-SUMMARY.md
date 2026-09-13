---
phase: 41-one-sop-surface
plan: 02
subsystem: admin-sop-list
tags: [server-actions, nextjs, refactor, extraction]

# Dependency graph
requires:
  - phase: 41-one-sop-surface
    plan: 01
    provides: phase41 Playwright project, two-route bundle gate, static-import leak guard
provides:
  - listAdminSopRows server action (src/actions/admin-sop-list.ts) — the data source 41-04's status/drafts/published admin lens will fetch through
  - AdminSopListResult / AdminScopeDepartment / MillerSop types + STATUS_TABS / STUCK_AFTER_MS / NO_MATCH_ID / stripExtension / shortOwner / relativeDay (src/lib/sop-list/admin-rows.ts)
  - FLAG_PRIORITY / FLAG_STYLE / FLAG_LABEL / FLAG_DESC (src/lib/governance/flag-display.ts)
affects: [41-04-status-lens, 41-05-merged-surface]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "'use server' modules may export ONLY async functions (CLAUDE.md 2026-06-27) — pure sync helpers and const maps extracted from a server-component page must live in a plain module, imported by both the old page and the new action"
    - "Self-guarding server action: requireAdminContext() as the first statement, returning { error } on failure, since the page-level redirect('/dashboard') safety net disappears once /sops is reachable by every role"

key-files:
  created:
    - src/lib/governance/flag-display.ts
    - src/lib/sop-list/admin-rows.ts
    - src/actions/admin-sop-list.ts
    - tests/phase41/admin-sop-list-action.spec.ts
  modified:
    - src/components/admin/SopMillerBrowser.tsx

key-decisions:
  - "AdminSopListResult field list (frozen here for 41-04's status lens): { sops: MillerSop[]; departments: Department[]; railCounts: { all, draft, published, failed }; scopeDepartments: AdminScopeDepartment[] ({ id, name, count }); noAudienceCount: number; flaggedCount: number; scopeLabel: string; filtered: boolean }"
  - "Dropped the scopeItems href field per plan instruction — the merged surface switches scope with client state + history.replaceState, not <Link> navigation; the action returns railCounts and the page builds its own scope rows"

requirements-completed: [SUR-01, SUR-02, SUR-05]

# Metrics
duration: 45min
completed: 2026-09-13
---

# Phase 41 Plan 02: Admin SOP List Extraction Summary

**Extracted the `/admin/sops` list query (status/owner/department/collection filters, draft-triage ordering, rail counts, scope-department counts, `MillerSop[]` mapping) into one self-guarding `listAdminSopRows` server action, plus two plain modules for the pure helpers and flag-display maps a `'use server'` file cannot export.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3
- **Files modified:** 4 (1 modified, 3 created, plus 1 test file)

## Accomplishments

- `src/lib/governance/flag-display.ts` — `FLAG_PRIORITY`/`FLAG_STYLE`/`FLAG_LABEL`/`FLAG_DESC` copied verbatim from `admin/sops/page.tsx:50-111` with their explanatory comments intact; neither this file nor `admin-rows.ts` starts with `'use server'`/`'use client'`.
- `src/lib/sop-list/admin-rows.ts` — `STATUS_TABS`, `STUCK_AFTER_MS`, `NO_MATCH_ID`, `stripExtension`/`shortOwner`/`relativeDay`, plus `MillerSop` (moved from `SopMillerBrowser.tsx`), `AdminScopeDepartment`, and `AdminSopListResult` (new, declared here per the plan so 41-04 has a stable contract).
- `src/components/admin/SopMillerBrowser.tsx` now imports `MillerSop` from the new module and re-exports it (`export type { MillerSop }`) — every existing importer (`admin/sops/page.tsx`) keeps compiling unchanged; nothing else in the file was touched.
- `src/actions/admin-sop-list.ts` — `listAdminSopRows`, the only export, `'use server'`, opens with `requireAdminContext()` before any `.from(` call, uses the session RLS client throughout (`createAdminClient` appears zero times), and moves every filter branch intact: the `departments=none` audience-exclusion clause, the department/collection id resolution, the draft-triage `overall_confidence`/`nullsFirst` ordering, the `NO_MATCH_ID` sentinel for empty `.in()` queries, and the concurrent `Promise.all` of independent reads. Does not move the access-view assembly or the attention-view grouping (out of scope per plan — 41-03/41-04).
- `tests/phase41/admin-sop-list-action.spec.ts` — 10 comment-stripped source-contract assertions, registered and passing under `--project=phase41`. Mutation-proven both ways: removing `requireAdminContext()` fails the ordering assertion, and changing `nullsFirst: true` → `false` fails the triage-order assertion; both reverted cleanly after confirmation.
- `admin/sops/page.tsx` is byte-identical to before this plan (`git diff HEAD~3 -- admin/sops/page.tsx` empty) — it keeps its own duplicate copies of everything moved here until 41-06 replaces its body with a redirect shim, per the plan's deliberate four-wave-duplication design.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the two plain modules (row helpers + flag display)** - `3392619` (feat)
2. **Task 2: Extract listAdminSopRows as a self-guarding server action** - `27d5034` (feat)
3. **Task 3: Source-contract spec for the extracted action** - `71ba271` (test)

## Files Created/Modified

- `src/lib/governance/flag-display.ts` — governance flag priority/style/label/description maps, plain module
- `src/lib/sop-list/admin-rows.ts` — pure row helpers, status-tab/sentinel constants, `MillerSop`/`AdminScopeDepartment`/`AdminSopListResult` types, plain module
- `src/components/admin/SopMillerBrowser.tsx` — `MillerSop` type now imported + re-exported instead of declared locally
- `src/actions/admin-sop-list.ts` — `listAdminSopRows` server action
- `tests/phase41/admin-sop-list-action.spec.ts` — mutation-proven source-contract spec

## Decisions Made

- Frozen the `AdminSopListResult` shape (see frontmatter `key-decisions`) so 41-04's status lens has a fixed contract to write against, as the plan's `<output>` section required.
- Dropped `scopeItems`/`href` from the returned data per the plan — scope switching on the merged client page uses `history.replaceState`, not `<Link>` navigation (CLAUDE.md 2026-05-13 / RESEARCH Pitfall 3); the action returns `railCounts` and the future page assembles its own scope rows from it.

## Deviations from Plan

None — plan executed exactly as written. Every acceptance criterion (grep counts, positional guard check, `npm run build` pass, bundle-gate Δ 0 KB, mutation proofs) was verified directly during execution, not assumed.

## Verification

- `npx tsc --noEmit` — exits 0
- `npm run build` — exits 0; postbuild bundle gate reports `/sops/[sopId]/page` and `/sops/page` both at Δ 0 KB (this plan adds nothing to the client graph, confirming the "Server Actions must be async functions" check passed since `listAdminSopRows` is the file's only export)
- `npx playwright test --project=phase41 --project=phase30 --project=phase28` — 108 passed, 18 skipped (pre-existing fixme/live-DB tests unrelated to this plan), 0 failed
- `grep -c "all_departments" src/lib/sop-list/admin-rows.ts` — 0 (audience logic stays in the action)
- `git diff HEAD~3 -- "src/app/(protected)/admin/sops/page.tsx"` — empty (page untouched)

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `listAdminSopRows` is callable from a client component today (any authenticated session gets `{ error }` if not admin/safety_manager) — 41-04's `AdminStatusLens` can wrap `SopMillerBrowser` fed by a `useQuery` calling this action with zero further data-layer work.
- The frozen `AdminSopListResult` field list in this SUMMARY's frontmatter is the contract 41-04 should write its lens against.
- No blockers. `admin/sops/page.tsx` remains fully functional and unmodified, so nothing regresses before the shim lands in 41-06.

---
*Phase: 41-one-sop-surface*
*Completed: 2026-09-13*

## Self-Check: PASSED

All 5 created/modified artifact files confirmed present on disk; all 3 task commit hashes (`3392619`, `27d5034`, `71ba271`) confirmed in `git log --oneline --all`.
