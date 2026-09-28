---
phase: 54-admin-inbox-floor-health-library-table
plan: 06
subsystem: testing
tags: [playwright, deployed-eval, governance, admin-library-table, plant-floor]

# Dependency graph
requires:
  - phase: 54-admin-inbox-floor-health-library-table
    provides: "54-01..54-05 -- /governance inbox + floor health, AdminLibraryTable, WorkerSimpleList, the deletion of the Phase 41 Miller/lens surface"
provides:
  - "tests/evals/governance.eval.ts -- live deployed eval proving the inbox/floor/panel/Assign-owner flow in the isolated eval-site org, with an owner reset + read-back (D-13b) and a cross-tenant title-leak probe (T-54-01)"
  - "tests/evals/sop-surface.eval.ts -- rewritten for the admin checks table, deep links, Access lens, legacy /governance redirects and the worker fallback (replaces the Phase 41 Miller/scope-column eval)"
  - "tests/evals/plant-home.eval.ts -- repointed off the deleted worker-miller-scope testid onto worker-list, and its machine-count assertion relaxed for the shared eval-site org now carrying two machines"
  - "tests/phase54/deletion-sweep.spec.ts -- TESTS_EXCLUDED_DIRS now empty, so the sweep scans tests/evals too"
  - "54-EVAL.md -- committed 26/26-passed deployed eval report against https://sopstart.com"
  - "54-VALIDATION.md signed off (status: complete, nyquist_compliant: true, wave_0_complete: true)"
  - "a CLAUDE.md Learnings entry for shared eval-fixture side effects and default-timeout flakiness on dynamic-chunk navigations"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A new eval's beforeAll that writes to a SHARED eval-site org/layout must be checked against every sibling eval reading that same org -- an 'exactly N machines' assertion in one file breaks the moment another file's fixture grows the org"
    - "expect() assertions immediately after a page.goto() into a next/dynamic + useQuery client component need an explicit generous timeout (SLOW), not the bare 5s default -- it passes on a warm dev server and flakes on a cold prod navigation"

key-files:
  created:
    - tests/evals/governance.eval.ts
  modified:
    - tests/evals/sop-surface.eval.ts
    - tests/evals/plant-home.eval.ts
    - tests/phase54/deletion-sweep.spec.ts
    - tests/phase51/site-actions-contract.spec.ts
    - .planning/phases/54-admin-inbox-floor-health-library-table/54-VALIDATION.md
    - .planning/phases/54-admin-inbox-floor-health-library-table/54-EVAL.md
    - CLAUDE.md

key-decisions:
  - "governance.eval.ts reuses the shared tests/evals/lib/plant-fixture.ts helper (ensurePlantFixture) for the base EVAL Press + link setup, then layers its own EVAL Oven machine and owner-reset/read-back logic on top, rather than duplicating the whole fixture -- matches the Phase 52/53 precedent of one shared fixture module"
  - "OwnerPicker's member popover is asserted by role-label pattern (/^admin \\(/), not by email -- the deployed eval-site org's getOrgMembers() rows have no email/full_name, so memberLabel() falls back to '{role} ({userId8})'"
  - "sop-surface.eval.ts's ?owner=me test asserts against real prod data (eval-admin may legitimately own zero SOPs), accepting either the table or its own empty state, rather than asserting the table is always populated"

requirements-completed: [ADM-01, ADM-02, ADM-03, ADM-04]

# Metrics
duration: ~24min (commit-to-commit; wall time was longer including three ~8min deployed-eval runs)
completed: 2026-09-29
---

# Phase 54 Plan 06: Deployed Eval + Validation Sign-Off Summary

**Authored the live `governance.eval.ts` deployed eval, rewrote `sop-surface.eval.ts` for the admin checks table, repointed `plant-home.eval.ts` off the deleted Miller testid, fixed a stale phase51 source-contract spec and three eval assertions the first two production runs surfaced, and closed the phase with 26/26 deployed evals green on sopstart.com plus a signed-off `54-VALIDATION.md`.**

## Performance

- **Duration:** ~24 min commit-to-commit (04:56 → 05:20, 2026-09-29 AEST); wall time also included three full `npm run eval -- --phase 54` runs (~8 min each) between fix iterations
- **Tasks:** 2
- **Files modified:** 8 (1 created, 7 modified) across 5 commits

## Accomplishments

- Wrote `tests/evals/governance.eval.ts`: a `beforeAll` that reuses `ensurePlantFixture` for EVAL Press, adds a second unlinked machine ("EVAL Oven") so the "machines with no procedures" inbox row is provable, resets the fixture SOP's `owner_user_id` to null and reads it back (D-13b — never assumes prior run state), and reads one real-org SOP title for a cross-tenant disclosure probe (T-54-01). Five tests cover the inbox (red row, No owner chip count, EVAL Oven's Add link, EVAL Press's red pin, no real-org title on the page), the machine panel (NO OWNER badge, Open/Edit hrefs, "owner none"), the Machines chip filter, Assign-owner clearing the row and the pin, and the header door.
- Rewrote `tests/evals/sop-surface.eval.ts` for the surface that replaced Phase 41's Miller/lens surface: the checks table (5 circles per row, one builder chain per row), chips + deep links (`?status=draft`, `?owner=me`), the Access lens (opens full-width, returns without a reload, `?view=access` direct link), legacy `/governance` redirects (`/admin/sops?view=attention`, `/sops?view=attention`, `/admin/governance`), pathways coverage, and the worker fallback at desktop/mobile/admin-on-phone (no library table, no Governance link, `WorkerSimpleList`/`PhoneHome`).
- Repointed `tests/evals/plant-home.eval.ts` off the deleted `worker-miller-scope` testid onto `worker-list` (both occurrences), and relaxed its "exactly 1 machine" assertion to "at least 1" since `governance.eval.ts`'s new EVAL Oven now permanently shares that org.
- Widened `tests/phase54/deletion-sweep.spec.ts` (`TESTS_EXCLUDED_DIRS = []`) so the tests/evals directory is scanned for dead-name references too, now that every eval naming the retired surface has been rewritten.
- Ran the full suite once: 26 pre-existing failures (16 `51-BASELINE-FAILURES.md` stubs + 9 `phase46` OTP-rate-limit probes, both expected/non-regressive) plus **one genuine regression** — `tests/phase51/site-actions-contract.spec.ts` still enumerated the pre-54 export list for `src/actions/site.ts` and 54-01's `listSiteHealthForOrg` wasn't in it. Fixed by adding it to `EXPECTED_EXPORTS` (it is guard-first and delegates its read to the already-covered `listSiteForOrg`).
- `npm run build` green, bundle gate unchanged from 54-05's numbers (`/sops/[sopId]` 1043 KB Δ-5, `/sops` 935 KB Δ-5, both within ±2 KB tolerance), `.bundle-baseline.json` untouched.
- Pushed, provisioned fixtures, and ran `npm run eval -- --phase 54` three times: first run 23/23 passed / 3 failed (an `OwnerPicker` member-label mismatch, a shared-fixture machine-count assumption, and a chip-value read racing a still-loading dynamic chunk); second run 25/26 (one remaining timeout-related flake on the same chip); third run **26/26 passed**. Opened and read every screenshot the plan named (governance-inbox, governance-panel, governance-after-assign, admin-library, admin-library-filtered, admin-access, admin-governance, worker-sops, worker-mobile, admin-mobile, plant-home, plant-home-panel) — all visually correct: red dot + "No owner" chip + red pin on the inbox/floor, NO OWNER badge tinted red in the panel, the pin clearing to green after Assign owner, the checks-table circles coloured correctly with real prod data (33 SOPs), the Access lens's org/collection tree, the legacy-redirect landing on the real inbox, and no admin chrome anywhere on the worker/mobile views.
- Signed off `54-VALIDATION.md` (every task row ✅ green, Wave 0 + sign-off checklists ticked, frontmatter `status: complete` / `nyquist_compliant: true` / `wave_0_complete: true`) and logged a dated CLAUDE.md Learnings entry for the shared-fixture-org and default-timeout patterns this run surfaced (both needed a fix-forward, satisfying the GSD trigger-4 rule).

## Task Commits

1. **Task 1: Author the governance eval, rewrite the sop-surface eval, repoint plant-home, widen the sweep** - `61f4df6` (test)
2. **Task 2 fix: repoint the stale phase51 site-actions-contract export list** - `76fa362` (fix)
2. **Task 2 fix: three deployed-eval assertions corrected against live behaviour** - `3d86355` (fix)
2. **Task 2: sign off validation, commit the 26/26 deployed eval report** - `1b01599` (docs)

**Plan metadata commit:** pending (this SUMMARY + STATE/ROADMAP, owned by the orchestrator)

## Files Created/Modified

- `tests/evals/governance.eval.ts` — new: the deployed governance-inbox/floor-health/panel eval in the isolated eval-site org
- `tests/evals/sop-surface.eval.ts` — rewritten for the admin checks table, deep links, Access lens, legacy redirects, worker fallback
- `tests/evals/plant-home.eval.ts` — `worker-miller-scope` → `worker-list`; machine-count assertion relaxed to `>=1`
- `tests/phase54/deletion-sweep.spec.ts` — `TESTS_EXCLUDED_DIRS` emptied so `tests/evals` is swept too
- `tests/phase51/site-actions-contract.spec.ts` — `listSiteHealthForOrg` added to `EXPECTED_EXPORTS`
- `.planning/phases/54-admin-inbox-floor-health-library-table/54-VALIDATION.md` — signed off, every row green
- `.planning/phases/54-admin-inbox-floor-health-library-table/54-EVAL.md` — committed 26/26-passed deployed eval report
- `CLAUDE.md` — new dated Learnings entry

## Decisions Made

- Reused `tests/evals/lib/plant-fixture.ts`'s `ensurePlantFixture` for the base EVAL Press setup inside `governance.eval.ts` rather than duplicating the upsert logic — matches the Phase 52/53 shared-fixture-module precedent (CLAUDE.md pattern).
- Picked the OwnerPicker's admin member by role-label pattern (`/^admin \(/`), not by email, after observing the deployed popover renders `getOrgMembers()` rows with no email/full_name for this org — `memberLabel()`'s documented fallback shape.
- `?owner=me`'s test now accepts either the populated table or its own "No SOPs match these filters." empty state, since `eval-admin` legitimately owns zero SOPs in the real 33-SOP org — asserting a specific SOP count there would be asserting fixture state that doesn't exist.
- Relaxed `plant-home.eval.ts`'s single-machine assertion rather than deleting `governance.eval.ts`'s EVAL Oven fixture or moving it to a different org — the eval-site org is intentionally shared across Phase 52/53/54 evals, and the "no procedures yet" inbox row needs a second real machine to prove against.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stale `EXPECTED_EXPORTS` list in `tests/phase51/site-actions-contract.spec.ts`**
- **Found during:** Task 2, full-suite run
- **Issue:** 54-01 added `listSiteHealthForOrg` to `src/actions/site.ts` but the Phase 51 source-contract spec's hardcoded export list was never updated — a genuine regression (not a `51-BASELINE-FAILURES.md` entry) caught by the full-suite gate this task runs.
- **Fix:** Added `listSiteHealthForOrg` to `EXPECTED_EXPORTS`; confirmed the function is guard-first (`requireAdminContext()` before its own logic) and delegates its actual read to the already-covered `listSiteForOrg`.
- **Files modified:** `tests/phase51/site-actions-contract.spec.ts`
- **Verification:** `npx playwright test --project=phase51 tests/phase51/site-actions-contract.spec.ts` (7/7 green)
- **Committed in:** `76fa362`

**2. [Rule 1 - Bug] Three deployed-eval assertions failed against live behaviour on the first production run**
- **Found during:** Task 2, first `npm run eval -- --phase 54` run (23 passed / 3 failed)
- **Issue:** (a) `governance.eval.ts`'s Assign-owner test clicked a button matched on the org member's email, but the deployed eval-site org's `getOrgMembers()` rows have no email/full_name, so `OwnerPicker`'s `memberLabel()` fell back to `"{role} ({userId8})"` — the click target never existed. (b) `plant-home.eval.ts` asserted exactly 1 `plant-machine`, which broke the moment `governance.eval.ts`'s own beforeAll permanently added a second machine ("EVAL Oven") to the same shared eval-site org. (c) `sop-surface.eval.ts`'s `?owner=me` test asserted the table was visible, but `eval-admin` owns zero SOPs on real prod data, so the correct render is the table's own empty state.
- **Fix:** (a) match the popover button by role-label pattern instead of email; (b) relaxed the machine-count assertion to `>=1` (EVAL Press is still asserted by name separately); (c) accept either the table or the empty state, keyed off the resolved chip value.
- **Files modified:** `tests/evals/governance.eval.ts`, `tests/evals/plant-home.eval.ts`, `tests/evals/sop-surface.eval.ts`
- **Verification:** Second `npm run eval -- --phase 54` run surfaced one more instance of the SAME `?owner=me` test (a default-5s `toHaveValue()` timeout racing a `next/dynamic` chunk load + fresh query) — fixed in the same file by wrapping the chip-value read with the shared `SLOW` timeout and waiting for the settled render first. Third run: 26/26 passed.
- **Committed in:** `3d86355`

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs the phase's own new eval/action code exposed, fixed in the same session)
**Impact on plan:** No scope creep — both fixes were required to make this task's own verification (the full suite gate and the deployed eval gate) actually pass. No unrelated code touched.

## Issues Encountered

The `?owner=me` fix took two iterations across two deployed-eval runs (see deviation 2) — the first pass fixed the visible-table assumption but left a still-too-short default timeout on the chip-value read, which only surfaced on the second live run against a cold navigation. Logged as a CLAUDE.md Learning per the GSD multi-round-fix trigger.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 54 (ADM-01..04) is fully proven on https://sopstart.com with `54-EVAL.md` as the committed UAT artefact: the governance inbox, floor health, machine panel, admin library table, deep links, the Access lens, legacy redirects and the worker fallback all pass the deployed eval, and every screenshot was read.
- `tests/evals/lib/plant-fixture.ts` now has a second consumer (`governance.eval.ts`) beyond `plant-home.eval.ts`/`phone-home.eval.ts` — any future eval needing the eval-site org's scene/EVAL Press should keep using it rather than re-implementing the upsert logic, and should check for other consumers before adding a NEW permanent fixture to that shared org.
- No blockers for whatever phase comes next.

---
*Phase: 54-admin-inbox-floor-health-library-table*
*Completed: 2026-09-29*
