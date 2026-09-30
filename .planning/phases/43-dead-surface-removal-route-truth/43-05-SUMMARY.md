---
phase: 43-dead-surface-removal-route-truth
plan: 05

subsystem: verification
tags: [rls, security-fix, deployed-eval, validation, certification]

# Dependency graph
requires:
  - phase: 43-dead-surface-removal-route-truth
    plan: 01
    provides: dead-href guard, phase43 scaffolds, tests/evals/dead-surface.eval.ts
  - phase: 43-dead-surface-removal-route-truth
    plan: 02
    provides: createBlock() hardening (T-43-01), /admin/blocks/new — the surface that first exercised the blocks-RLS gap this plan found
  - phase: 43-dead-surface-removal-route-truth
    plan: 03
    provides: scanner wiring, WiringPatchBay lens removal, dead-state cleanup
  - phase: 43-dead-surface-removal-route-truth
    plan: 04
    provides: shim deletion, next.config.ts redirects, repointed specs
provides:
  - Phase 43 certified — full local gate suite green once, 29/29 deployed eval tests pass on production, all required screenshots read and judged
  - migration 00068_blocks_read_own_org.sql — closes a silent full-deny RLS gap on public.blocks left by migration 00037
  - 43-VALIDATION.md signed off (nyquist_compliant: true), 43-EVAL.md as the phase's UAT artefact
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reproduce RLS bugs directly against the live DB via the Supabase Management API SQL endpoint (set local role authenticated; set local request.jwt.claims = '...' inside a rolled-back transaction) — isolates 'is it the policy' from 'is it my session/claims' far faster than round-tripping through the app"
    - "INSERT ... RETURNING (or .select() after insert) needs a passing SELECT policy in addition to the INSERT's own WITH CHECK — a table with zero SELECT policies fails 42501 on insert-with-return even when the WITH CHECK is satisfied"

key-files:
  created:
    - supabase/migrations/00068_blocks_read_own_org.sql
    - .planning/phases/43-dead-surface-removal-route-truth/43-EVAL.md
    - .planning/phases/43-dead-surface-removal-route-truth/43-05-SUMMARY.md
  modified:
    - tests/lint/no-dead-internal-hrefs.spec.ts
    - .planning/phases/43-dead-surface-removal-route-truth/43-VALIDATION.md
    - CLAUDE.md

key-decisions:
  - "Rule 1 auto-fix applied to a genuine production RLS gap discovered mid-eval (migration 00037 dropped the only SELECT policy on public.blocks without a replacement) rather than treating the eval failure as a test-authoring problem — reproduced directly against the live DB before writing the fix, applied live via the Management API, then committed the migration file and re-ran the eval to confirm green"
  - "Left the pre-existing react-hooks/set-state-in-effect errors in versions/page.tsx and the unused-eslint-disable-directive warning in blocks.ts untouched — both confirmed pre-existing in 43-02/43-03 SUMMARYs, out of scope per D-02"

requirements-completed: [DED-01, DED-02, DED-03, DED-04]

duration: ~50min
completed: 2026-09-30
---

# Phase 43 Plan 05: Certification Summary

**Ran every phase gate once (tsc/full-suite/build/lint/phase43+dead-href guards), pushed, and the deployed eval caught a real production RLS gap — public.blocks had zero SELECT policies since migration 00037, silently denying every session-scoped read for months, masked because every existing reader used the admin client. Fixed with migration 00068, re-ran the eval to 29/29 green, read all 7 required screenshots, and signed off 43-VALIDATION.md.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-09-30
- **Tasks:** 2/2 completed
- **Files modified:** 6 (3 created, 3 modified, across 4 commits)

## Accomplishments

- Task 1 gates run once: `npx tsc --noEmit` clean; full suite 25 failed/250 skipped/1884 passed (16 failures exact-match `51-BASELINE-FAILURES.md`, 9 are `phase46` live-Supabase-probe failures sharing the identical `verifyOtp failed: Request rate limit reached` message — the documented OTP-budget exception, not a phase-43 regression); `npm run build` clean with the bundle gate green (`/sops/[sopId]/page` Δ-3KB, `/sops/page` Δ-4KB) and `.bundle-baseline.json` untouched since commit `5020519`; eslint over the phase's 31 changed files found and fixed one real `no-unused-vars` warning (write-only `m` in a doc-route-count loop), then reported zero; `no-dead-internal-hrefs` 4/4, `phase43` project 16/16.
- Task 2: pushed to `origin/master`, ran `npm run eval -- --phase 43` against production. First run (commit `2e4a373`) was 28/29 — test A ("New block opens the create form, creates an item, and archives it") failed with `42501 new row violates row-level security policy for table "blocks"`.
- Root-caused by reproducing directly against the live DB: migration 00037 (Phase 25 RLS cleanup) dropped `blocks_read_global_plus_org` as dead weight but never added an org-scoped SELECT policy, leaving `public.blocks` with RLS enabled and zero permissive SELECT policies — `INSERT ... RETURNING` needs a passing SELECT check on top of its own WITH CHECK, so it failed even though the org/role WITH CHECK conditions were correct (verified via a minted eval-site-admin session: JWT org/role claims matched, `organisation_members` matched, and the raw WITH CHECK expression evaluated `true` in isolation). A second surface was silently broken by the same gap: `block_versions_read_via_blocks`'s EXISTS-subquery reads FROM `public.blocks`, which is itself RLS-gated.
- Fixed with `supabase/migrations/00068_blocks_read_own_org.sql` (org-scoped SELECT policy), applied live via the Supabase Management API, reproduced clean (both direct SQL and the minted-session insert-and-return), then committed and pushed. Second eval run (commit `1ae05cd`): 29/29 passed, 2 unrelated self-skips.
- All 7 required screenshots read and judged: `new-block-form`, `new-block-created`, `scan-document`, `access-wiring-only`, `admin-library`, `admin-governance`, `worker-sops` — no CSS-token or sizing defects (paper theme, legible controls, visible selected-chip states, tinted preview panels).
- `43-VALIDATION.md` signed off: `status: complete`, `nyquist_compliant: true`, all Per-Task Verification Map rows green, sign-off checklist ticked.
- Two `CLAUDE.md` Learnings entries added: the "drop the only SELECT policy without a replacement" silent-full-deny class, and the "first client-side import of a server action is a security review trigger" pattern (referencing the T-43-01 createBlock hardening that anticipated this exact scenario for the INSERT/WITH-CHECK side, but not the SELECT side).

## Task Commits

Each fix and doc update was committed atomically:

1. **Task 1 lint fix** — `4d5f386` (fix): cleared the `no-unused-vars` warning in `tests/lint/no-dead-internal-hrefs.spec.ts`
2. **Task 1 gate results** — `2e4a373` (docs): recorded the full gate run in `43-VALIDATION.md`
3. **Task 2 RLS fix** — `1ae05cd` (fix): `supabase/migrations/00068_blocks_read_own_org.sql`, applied live
4. **Task 2 sign-off** — `0a940d2` (docs): `43-EVAL.md`, `43-VALIDATION.md` sign-off, `CLAUDE.md` learnings

## Files Created/Modified

- `supabase/migrations/00068_blocks_read_own_org.sql` — org-scoped SELECT policy on `public.blocks`, closing the gap left by migration 00037
- `tests/lint/no-dead-internal-hrefs.spec.ts` — write-only `m` replaced with `matchAll().length` in the doc-route-count loop
- `.planning/phases/43-dead-surface-removal-route-truth/43-VALIDATION.md` — Task 1 gate results, Task 2 eval results, sign-off checklist ticked, frontmatter `status: complete` / `nyquist_compliant: true`
- `.planning/phases/43-dead-surface-removal-route-truth/43-EVAL.md` — deployed eval report with a root-cause summary and the screenshot-review table, plus the raw eval-runner output
- `CLAUDE.md` — two new Learnings entries (2026-09-30)

## Decisions Made

- Treated the eval-discovered RLS gap as a Rule 1 auto-fixable bug (a genuine pre-existing production defect, not a phase-43 regression in the strict sense, but blocking phase-43 sign-off since it was first exercised by phase-43 code) — fixed inline, verified against the live DB before committing, per the deviation rules.
- Followed the plan's D-08 requirement to read every screenshot before sign-off; found no additional defects beyond the RLS gap.

## Deviations from Plan

**1. [Rule 1 - Bug] Missing org-scoped SELECT policy on `public.blocks`**
- **Found during:** Task 2, first deployed eval run (test A)
- **Issue:** Migration 00037 dropped the only SELECT policy on `public.blocks` without a replacement, leaving zero permissive SELECT policies — `INSERT ... RETURNING` and `block_versions_read_via_blocks`'s EXISTS-subquery both silently failed for any session-scoped (non-service-role) caller.
- **Fix:** Added `supabase/migrations/00068_blocks_read_own_org.sql` (org-scoped SELECT policy), applied live via the Management API, reproduced clean.
- **Files modified:** `supabase/migrations/00068_blocks_read_own_org.sql`
- **Commit:** `1ae05cd`

**2. [Rule 1 - Bug] Unused-var lint warning in a phase-touched file**
- **Found during:** Task 1, eslint scope check
- **Issue:** `tests/lint/no-dead-internal-hrefs.spec.ts`'s doc-route-count loop assigned to `m` but never read it, tripping `@typescript-eslint/no-unused-vars` (D-02 requires zero in phase-touched files).
- **Fix:** Replaced the manual while-loop with `[...src.matchAll(re)].length`.
- **Files modified:** `tests/lint/no-dead-internal-hrefs.spec.ts`
- **Commit:** `4d5f386`

## Issues Encountered

None beyond the two deviations above, both resolved.

## User Setup Required

None — no external service configuration required. The RLS migration was applied live directly (no separate deploy step needed for a DB-only change).

## Journeys / Pathways Map

No routes changed in this plan. `tests/evals/sop-surface.eval.ts` test E ("pathways map reports zero unmapped screens") passed on the deployed eval, confirming the map stayed accurate through all of phase 43's route changes (43-02's `/admin/blocks/new`, 43-04's shim deletions).

## Next Phase Readiness

- Phase 43 is complete and certified. `.planning/phases/43-dead-surface-removal-route-truth/43-VALIDATION.md` is signed off; `43-EVAL.md` is the UAT artefact.
- `git log origin/master..HEAD` is empty — everything is pushed. No dev server, eval runner, or browser process left running.
- No blockers for the next phase.

---
*Phase: 43-dead-surface-removal-route-truth*
*Completed: 2026-09-30*

## Self-Check: PASSED

All 4 created files verified present on disk; all 4 commit hashes (`4d5f386`, `2e4a373`, `1ae05cd`, `0a940d2`) verified in `git log`.
