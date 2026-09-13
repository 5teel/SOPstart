---
phase: 41-one-sop-surface
plan: 08
subsystem: testing
tags: [playwright, source-contract-tests, refactor, repoint]

# Dependency graph
requires:
  - phase: 41-one-sop-surface
    plan: 06
    provides: "/admin/sops as a guard-first redirect shim to /sops; the nine legacy specs' named expected-red list"
  - phase: 41-one-sop-surface
    plan: 07
    provides: "Zero in-app code paths route through the shim; WiringPatchBay/SelectionStrip hrefs + copy repointed to /sops; the confirmed 8-file/19-test red list for this plan"
provides:
  - "All nine legacy source-contract specs (phase28 governance-queue + library-and-worker, phase29 queue-approve-action, phase30 list-rows, phase32 library-filter-deeplink + wire-up-mode, phase33 sop-drilldown, sb-auth-builder) repointed onto the code's new homes — every previously-pinned contract (GQ-01/02/04, OWN-02/04, APR-03/04, REV-02/03/04, UX-06, no-audience-department semantics, CR-01/CR-02, SC-2/SC-4/SC-5, SB-AUTH-05) still has a live, equally-strong guard"
  - "tests/phase41/spec-repoint-inventory.spec.ts flipped live, mutation-proven: comment-stripped sweep of tests/ for any CODE reference (not prose) to src/app/(protected)/admin/sops/page.tsx outside a 5-file allowlist"
  - "Rule 1 fix: AdminSopSurface.tsx's by-department scope rows + \"No department\" link restored (the 41-05 bundle-budget extraction computed scopeDepartments/noAudienceCount into `counts` state but never rendered them) — verified bundle-neutral (+1KB unchanged both gated routes)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Comment-stripped literal/regex matching for source-contract sweeps that must ignore a file's own explanatory prose about where a contract moved FROM (mirrors tests/phase41/reference-sweep.spec.ts's stripComments idiom, CLAUDE.md 2026-08-04 self-invalidating-header class) — every repointed spec's header comment legitimately names the old path, so a raw substring sweep would false-positive on its own documentation"
    - "Ordering-preserving repoints: when a contract's value is WHERE a call happens relative to another (CR-02 ensure-before-read), the repointed assertion keeps an index-comparison, not just presence, at the new file"

key-files:
  created: []
  modified:
    - tests/phase28/governance-queue.spec.ts
    - tests/phase28/library-and-worker.spec.ts
    - tests/phase29/queue-approve-action.spec.ts
    - tests/phase30/create-entry.spec.ts
    - tests/phase30/list-rows.spec.ts
    - tests/phase32/library-filter-deeplink.spec.ts
    - tests/phase32/wire-up-mode.spec.ts
    - tests/phase33/sop-drilldown.spec.ts
    - tests/sb-auth-builder.test.ts
    - tests/phase41/spec-repoint-inventory.spec.ts
    - src/components/sop/AdminSopSurface.tsx
    - .planning/phases/41-one-sop-surface/deferred-items.md

key-decisions:
  - "Rule 1 fix (not deferred): AdminSopSurface.tsx's department scope column was silently dropped by 41-05's bundle-budget extraction — the data (scopeDepartments/noAudienceCount) was still computed and held in `counts` state, but never rendered. Restored the desktop-only rows verbatim from the pre-shim page (matches T-41-14's 'stop and report a dropped behaviour' framing, but the fix was small, cheap, and squarely a Rule 1 bug — the classic 'hook fetched the data then threw it away' class per CLAUDE.md 2026-07-13). This is the one src/ file this plan touches, contradicting the plan's stated 'touches NO file under src/' — documented here as a deviation, same posture as 41-05's own mid-plan deviation fix and 41-07's 6-extra-file discovery."
  - "The inventory guard's original design (raw substring match against the shim path) would have false-positived on every repointed spec's own explanatory comment. Rewrote it to strip full-line comments before matching, and excluded the guard's own source file from its walk (it necessarily spells out the fragment it searches for)."
  - "sb-auth-builder.test.ts's SB-AUTH-01 (unrelated 'useForm' assertion against WizardClient.tsx, which uses plain useState) and 8 tests in sb-layout-editor.test.ts/sb-section-schema.test.ts (Phase 26 Puck-removal rot) were confirmed pre-existing via git-stash re-run and logged to deferred-items.md rather than fixed — out of this plan's scope (test-file repointing of the nine named specs only)."

requirements-completed: [SUR-01, SUR-02, SUR-04]

# Metrics
duration: 38min
completed: 2026-09-13
---

# Phase 41 Plan 08: Spec Repoint Summary

**Repointed all nine legacy source-contract specs off the emptied `admin/sops/page.tsx` onto their code's new homes (lenses, admin-sop-list.ts, admin-access-view.ts, AdminSopSurface.tsx, governance.ts), flipped the mutation-proven repoint-inventory guard live, and fixed a genuine dropped capability (department scope rows) the 41-05 bundle-budget refactor had silently lost.**

## Performance

- **Duration:** ~38 min
- **Started:** 2026-09-13T13:01:58+10:00 (approx, immediately after 41-07)
- **Completed:** 2026-09-13T13:40:28+10:00
- **Tasks:** 3
- **Files modified:** 12 (10 test files, 1 source file, 1 planning doc)

## Accomplishments

- **Task 1** — Repointed `tests/phase28/governance-queue.spec.ts` (queue read + role guard onto `AdminAttentionLens.tsx` + `src/actions/governance.ts`'s `requireAdmin()`, plus a fix to a stale shim-redirect-destination assertion 41-06 had left behind) and `tests/phase28/library-and-worker.spec.ts` (owner filter/columns/flag-chip mapping onto `admin-sop-list.ts`, the "Owned by me" toggle onto `AdminSopSurface.tsx`'s history-state scope row) and `tests/phase29/queue-approve-action.spec.ts` (attention-view grouping onto `AdminAttentionLens.tsx`/`flag-display.ts`, leaving the `GovernanceQueueRow.tsx`-based `approveStep`/`isCallerNextApprover` assertions untouched per the plan's double-guard instruction). Net +2 tests (added a split real-data-gate assertion), zero deleted.
- **Task 2** — Repointed `tests/phase30/list-rows.spec.ts` (row rendering onto `AdminStatusLens.tsx`, row-mapping onto `admin-sop-list.ts`) and renamed `tests/phase30/create-entry.spec.ts`'s `ADMIN_SOPS_PAGE` → `ADMIN_SOPS_SHIM` (it now points at a redirect shim), extending its no-duplicate-create-entry check to also cover the merged `/sops` surface. While repointing "No department is a reachable scope", discovered the department scope column was genuinely missing from `AdminSopSurface.tsx` — restored it (Rule 1, see Deviations).
- **Task 3** — Repointed `tests/phase32/library-filter-deeplink.spec.ts` (server-side filtering onto `admin-sop-list.ts`, header banner onto `AdminStatusLens.tsx`, the `isAccessView` precedence onto `AdminSopSurface.tsx`'s `resolveAdminScope`, plus a stale-copy fix for `SelectionStrip.tsx`'s 41-07 "Open in the SOP list" rename) and `tests/phase32/wire-up-mode.spec.ts` (CR-02 ensure-before-read ordering onto `admin-access-view.ts`, preserving the index-comparison, not just presence) and `tests/phase33/sop-drilldown.spec.ts` (the single join-read + `?sop=` deep-link entry point onto `admin-access-view.ts`/`AdminSopSurface.tsx`) and `tests/sb-auth-builder.test.ts`'s SB-AUTH-05 (onto `admin-sop-list.ts`'s `SOP_SELECT` + `TopHeader.tsx`'s create entry). Flipped `tests/phase41/spec-repoint-inventory.spec.ts` live with a comment-stripped sweep (the naive substring version would have false-positived on every repointed spec's own explanatory comments) and a 5-file allowlist, mutation-proven by repointing one spec back to the shim path and confirming the guard names the exact file:line, then reverting. Removed `list-rows.spec.ts`'s now-dead `ADMIN_SOPS_PAGE` constant.

## Task Commits

Each task was committed atomically:

1. **Task 1: Repoint governance/owner/approval-gating specs** - `fb8872e` (test)
2. **Task 2: Repoint row-contract + create-entry specs; Rule 1 fix for dropped department scope UI** - `5284976` (test)
3. **Task 3: Repoint access-view specs; flip inventory guard live** - `1623642` (test)

## Files Created/Modified

- `tests/phase28/governance-queue.spec.ts` — queue/role-guard/attention-view assertions moved to `AdminAttentionLens.tsx`/`src/actions/governance.ts`/`AdminSopSurface.tsx`; fixed a stale shim-destination assertion
- `tests/phase28/library-and-worker.spec.ts` — owner/flag-chip/header-chip assertions moved to `admin-sop-list.ts`/`AdminSopSurface.tsx`/`AdminAttentionLens.tsx`/`flag-display.ts`
- `tests/phase29/queue-approve-action.spec.ts` — attention-view grouping moved to `AdminAttentionLens.tsx`/`flag-display.ts`; `GovernanceQueueRow.tsx` assertions untouched (double-guarded with 41-04's spec)
- `tests/phase30/create-entry.spec.ts` — `ADMIN_SOPS_PAGE` → `ADMIN_SOPS_SHIM`; duplicate-create-entry check extended to `/sops`
- `tests/phase30/list-rows.spec.ts` — row/owner/flag/no-department assertions moved to `AdminStatusLens.tsx`/`admin-sop-list.ts`/`AdminSopSurface.tsx`; dead constant removed
- `tests/phase32/library-filter-deeplink.spec.ts` — filter/header/precedence assertions moved to `admin-sop-list.ts`/`AdminStatusLens.tsx`/`AdminSopSurface.tsx`; `WiringPatchBay`/`SelectionStrip` hrefs+copy updated for 41-07
- `tests/phase32/wire-up-mode.spec.ts` — CR-02 ordering assertion moved to `admin-access-view.ts`
- `tests/phase33/sop-drilldown.spec.ts` — join-read + `?sop=` entry-point assertions moved to `admin-access-view.ts`/`AdminSopSurface.tsx`
- `tests/sb-auth-builder.test.ts` — SB-AUTH-05 moved to `admin-sop-list.ts`/`TopHeader.tsx`
- `tests/phase41/spec-repoint-inventory.spec.ts` — flipped live, comment-stripped, mutation-proven
- `src/components/sop/AdminSopSurface.tsx` — Rule 1 fix: restored by-department scope rows + "No department" link
- `.planning/phases/41-one-sop-surface/deferred-items.md` — logged 3 new pre-existing/unrelated failure groups found during full-suite verification

## Decisions Made

See frontmatter `key-decisions`. Headline: the plan stated "touches NO file under src/", but repointing the "No department is a reachable scope" assertion surfaced a genuine dropped capability (data computed, never rendered) — fixed under Rule 1 rather than weakening the assertion or leaving the suite red, and documented as a deviation from the plan's stated file-scope.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] AdminSopSurface.tsx dropped the department scope column + "No department" link entirely**
- **Found during:** Task 2, repointing `tests/phase30/list-rows.spec.ts`'s "'No department' is a reachable scope, not a dead label" test
- **Issue:** The pre-shim `admin/sops/page.tsx` rendered a "By department" scope-rail section (department name + count rows, plus a "No department" row for `noAudienceCount > 0`) below the main status tabs. 41-05's bundle-budget extraction (`AdminSopSurface.tsx`) kept computing `scopeDepartments`/`noAudienceCount` (returned by `listAdminSopRows`, held in `AdminSopSurface`'s `counts` state via `onResult`) but never rendered them — the UI affordance to reach `?departments=<id>` or `?departments=none` without already knowing the URL was silently lost. The `?departments=` deep link itself still worked (resolveAdminScope handles it), but there was no discoverable way to navigate there.
- **Fix:** Restored the desktop-only "By department" `MillerColumnHeader` + `MillerItem` rows (department names + counts, "No department" row) in `AdminSopSurface.tsx`'s `desktopRows`, wired through the existing `applyScope`/`navToUrl` state machine (`history.replaceState`, no `<Link>` href, matching the file's established pattern). Verbatim behavior match to the pre-shim page (same nesting: "No department" only shows when `scopeDepartments.length > 0`, matching the original's guard).
- **Files modified:** `src/components/sop/AdminSopSurface.tsx`
- **Verification:** `npx tsc --noEmit` clean; `npm run build` — both gated routes stay at their pre-existing +1KB delta (the fix lives entirely inside the already-lazy `AdminSopSurface` chunk, gated behind `useIsAdmin()`); `tests/phase30/list-rows.spec.ts`'s two "No department" tests pass.
- **Committed in:** `5284976` (Task 2 commit)

**2. [Rule 1 - Stale guard] Two stale assertions caused by prior plans' already-shipped changes**
- **Found during:** Task 1 (`governance-queue.spec.ts`'s shim `?filter=` redirect test) and Task 3 (`library-filter-deeplink.spec.ts`'s `SelectionStrip` copy test)
- **Issue:** `admin/governance/page.tsx`'s redirect destination was retargeted from `/admin/sops?view=attention` to `/sops?view=attention` by 41-06, but the phase28 spec's literal-string assertion still expected the old destination. `SelectionStrip.tsx`'s visible "Open in library" copy was changed to "Open in the SOP list" by 41-07 (SUR-06), but the phase32 spec still expected the old copy.
- **Fix:** Updated both assertions to the current, correct strings.
- **Files modified:** `tests/phase28/governance-queue.spec.ts`, `tests/phase32/library-filter-deeplink.spec.ts`
- **Verification:** Both files pass in isolation and as part of the full suite.
- **Committed in:** `fb8872e` (Task 1), `1623642` (Task 3)

---

**Total deviations:** 2 auto-fixed (1 Rule-1 bug restoring a dropped UI capability, 1 Rule-1 stale-guard fix spanning 2 files). No scope creep — the department-scope fix restores functionality the merge silently lost; the stale-guard fixes repoint assertions to changes prior plans already shipped correctly.

## Issues Encountered

During Task 3's mutation-proof of the inventory guard, `git checkout -- tests/phase32/wire-up-mode.spec.ts` (used to revert the mutation) reverted the file all the way to the last COMMIT, not to my uncommitted Task-3-in-progress edit — silently undoing the CR-02 repoint I'd made earlier in the same task before it was committed. Caught immediately by re-running the phase32 project (the old `PAGE`/`ensureSopCollections(params.sop)` assertion reappeared); redone and re-verified. Lesson for future sessions: `git checkout --` on a file with uncommitted-but-not-yet-reverted changes rolls back to HEAD, not to "before this specific edit" — safer to use a scoped diff/patch or commit-then-mutate-then-revert-via-diff when mutation-testing a file with other pending edits.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Every legacy source-contract spec that read `admin/sops/page.tsx` now reads the code's actual, current home. `tests/phase41/spec-repoint-inventory.spec.ts` is live and mutation-proven, so any future spec left pointed at the shim will be caught immediately rather than going stale-green.
- Phase 41 (one-sop-surface) is functionally complete: `/admin/sops` is a pure redirect shim, `/sops` is the one merged surface, every admin lens is code-split and permission-gated, every legacy deep-link resolves, the reference sweep found zero remaining in-app `/admin/sops` navigation, and this plan closes out the last red tests from the migration.
- Full suite: 1485 passed, 31 failed (all pre-existing/unrelated — legacy phase3/11/12.5 stub rot, one Phase-40-era wizard-sop-dept spec, one worker-library-chip spec, and 5 phase46 live-network probe failures during this run), 209 skipped. Zero failures attributable to `admin/sops/page.tsx`.
- No blockers.

---
*Phase: 41-one-sop-surface*
*Completed: 2026-09-13*

## Self-Check: PASSED

All 12 created/modified artifact files confirmed present on disk; all 3 task commit hashes (`fb8872e`, `5284976`, `1623642`) confirmed in `git log --oneline --all`.
