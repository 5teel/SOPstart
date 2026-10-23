---
phase: 64-leavers-and-suspended-members
plan: 01
subsystem: database
tags: [postgres, rls, supabase, access-token-hook, storage-policies, adr]

requires:
  - phase: 63-sop-first-home
    provides: current app and eval fixtures the live smoke runs against
provides:
  - organisation_members.status (active | suspended | left) with status_changed_at / status_changed_by, live
  - RLS helpers that re-check an active membership row on every request (token claim selects, row decides)
  - access-token hook that skips non-active rows
  - public.revoke_user_sessions(uuid), service_role only
  - decision kinds member_suspended, member_left, member_reinstated in the CHECK and every registry
  - scripts/apply-phase64-migration.mjs (audit, apply, assert-only, rollback) and the phase64 Playwright project
  - ADR-0024
affects: [64-02, 64-03, 64-04, 64-05, 64-06]

tech-stack:
  added: []
  patterns:
    - "RLS helpers read the caller's membership row; the token's organisation claim only selects which row"
    - "Live probe in a plpgsql DO block that always ends in an exception, so Management API probes roll back without transaction control"
    - "Column-level UPDATE grant (role only) so status is service-role-only"

key-files:
  created:
    - supabase/migrations/00082_member_status.sql
    - scripts/apply-phase64-migration.mjs
    - tests/phase64/member-status-migration.spec.ts
    - docs/adr/0024-membership-states-replace-removal.md
    - .planning/phases/64-leavers-and-suspended-members/64-BASELINE.md
    - .planning/phases/64-leavers-and-suspended-members/deferred-items.md
  modified:
    - playwright.config.ts
    - src/types/auth.ts
    - src/types/database.types.ts
    - src/lib/decisions/shape.ts
    - src/lib/decisions/read.ts
    - tests/phase59/ledger-read.spec.ts
    - tests/phase56/decision-kinds-live.spec.ts
    - tests/phase56/decision-shape.spec.ts
    - tests/phase60/ledger-kinds.spec.ts
    - scripts/apply-phase60-migration.mjs
    - docs/adr/README.md
    - .planning/codebase/CAPABILITY-MATRIX.md

key-decisions:
  - "D-19 decided by data: sop-videos holds 7 objects, 0 outside an organisation folder, so its SELECT policy is scoped to the organisation folder (no residual to record)"
  - "Migration applied first, before any app code: backwards compatible with the deployed app (default active, same helper values for active members, role still updatable)"
  - "Dropped the dead generated-videos storage policy (reads app_metadata, matches nothing)"
  - "A single failing live assertion that was a bug in the check itself (a NULL boolean) did not trigger --rollback; the printed live values already matched the expectation and the fixed check passed on a re-run"

patterns-established:
  - "Plan-level applier with --audit / --assert-only / --rollback modes and rolled-back live probes"

requirements-completed: [MEMB-01, MEMB-02, MEMB-03, MEMB-10, MEMB-12]

duration: 95min
completed: 2026-10-23
---

# Phase 64 Plan 01: Membership status in the database Summary

**Migration 00082 is live: a suspended or departed member matches no RLS policy on the same token, the hook stops issuing their site, only `role` stays client-updatable, and `revoke_user_sessions` is service_role-only.**

## Performance

- **Duration:** about 95 min
- **Tasks:** 3 of 3
- **Files modified:** 18 (6 created, 12 modified, plus the SUMMARY)

## Accomplishments

- **Live audit first (Task 1).** `--audit` dumped the real policy, helper, grant and trigger state into `64-BASELINE.md`. The raw-claim policy set was exactly the ten RESEARCH names; `sop_observations_read_org` had the unscoped own-row arm; `sop-videos` had 7 objects and 0 outside an organisation folder; `role` is the only column any session client updates.
- **00082 (Task 2).** Status columns and CHECK, UPDATE lock, row-checking helpers, hook filter on both selects, the ten raw-claim policies rewritten onto the helpers (generated-videos one dropped), observations own-arm ANDed with the org helper, `sop_observation_refs_in_org` needs an active worker, `revoke_user_sessions`, three ledger kinds, sop-videos SELECT scoped. Dry-run in a rolled-back batch before applying.
- **Registries and ADR (Task 2).** Kinds in `DECISION_KINDS`, `KIND_GROUPS.people`, `KIND_WORDS`, the hand-maintained types and the live probe; `MemberStatus` type; ADR-0024 with its index row; a capability-matrix sentence.
- **Applied and proven (Task 3).** 16 live assertions pass, including a rolled-back suspended probe and an active probe, and the deployed `home.eval.ts` passes 17 of 17 on the deploy of HEAD.

## Task Commits

| Task | Commit | What |
|---|---|---|
| 1 | `c11582e1` | applier with audit / assert-only / rollback, `phase64` project, `64-BASELINE.md` |
| 2 RED | `07e66100` | failing source contract for 00082 |
| 2 GREEN | `4353b8cc` | migration, registries, types, ADR-0024, matrix sentence, repointed kind specs |
| 3 | `f7b0e0cc` | live assertions and probes, EXPLAIN after, ADR numbers; pushed to origin master |

TDD gates: `test(64-01)` (RED) then `feat(64-01)` (GREEN) both present.

## Verification Evidence

**Spec before / after (Task 2 acceptance).** With 00082 absent, `tests/phase64/member-status-migration.spec.ts` ran 10 failed (ENOENT on the migration). After the migration and registries: 10 of 10 pass; together with `ledger-read`, `capability-matrix` and `rls-org-scope`: 33 passed. `npx tsc --noEmit` exit 0.

**Live apply.** `supabase db push` applied 00082 (the migration list showed only 00082 missing remotely). `--assert-only` then printed every assertion PASS:

| Assertion | Result |
|---|---|
| columns, default active, three-state CHECK | PASS; 56 of 56 rows active, 0 bad |
| `has_column_privilege` for authenticated | status, status_changed_at, status_changed_by, organisation_id, table-level all false; role true; anon false; service_role true |
| `revoke_user_sessions(uuid)` | anon false, authenticated false, service_role true, security definer |
| helper and hook bodies | `status = 'active'` in both helpers, twice in the hook, once in the refs helper |
| no policy reads `auth.jwt()` | 0 rows (stricter than the plan's two-claim check) |
| observations own-arm | qual starts `((organisation_id = current_organisation_id()) AND (...` |
| `decisions_kind_check` | has the three new kinds and member_removed |
| hook end to end | worker2 gets their latest active organisation and role |
| suspended probe (rolled back) | active claims: site, worker, 18 sops. Suspended on the same claims: NULL organisation, NULL role, 0 sops, 0 members; hook returns organisation null, role `pending` |
| active probe (rolled back) | site, admin, 18 sops, 6 members, no recursion error |
| uat_feedback probe (rolled back) | insert accepted, read returns it |
| PostgREST | service-role select of `organisation_members.status` succeeds |

Nothing left behind: 0 non-active membership rows and 0 `phase64-probe` rows after the run.

**Ledger kinds live.** `PHASE56_LIVE=1 ... decision-kinds-live.spec.ts`: 4 passed (every kind lands, including the three new ones).

**EXPLAIN (eval-site admin, warm, rolled back).**

| Query | Before | After |
|---|---|---|
| `count(*)` over sops | 0.095 ms | 0.23 to 0.26 ms |
| 50 newest decisions | 11.0 to 11.3 ms | 26.7 to 27.3 ms |

About 2.4x on both, far under the 50 ms stop threshold. Upgrade path (sub-select wrapping of the helper calls) is in ADR-0024.

**Build gates.** `npm run build` exit 0. Bundle numbers: `/sops/[sopId]/page` 802 KB (baseline 802 KB, delta 0); `/page` 831 KB (baseline 834 KB, delta -3 KB). `.bundle-baseline.json` untouched (`git diff --stat` empty). The delta on `/page` is not from this plan (no app component changed).

**Deployed smoke (home.eval.ts against https://sopstart.com).** Waited for the "Deploy to Fly" workflow of `f7b0e0cc` to complete (success) and `/api/version` to serve it.

- Run 1: 3 passed, 1 failed (HOME-02 worker "Most used" tab), 13 not run (the file is serial).
- Classification of the red: eval/environment. The failure screenshot shows the worker home fully loaded with data, the Eval walk fixture SOP row showing "Signed off 24 Oct" (the completion reads fine through RLS), and the shelf still on the Recent tab, so the test's tab click did not take effect. Re-run of just that test passed in 2.5 s, and the whole file then passed 17 of 17. Not caused by 00082, so no rollback.
- Screenshots read: failed HOME-02, `63-home-most-used`, `63-home-section-people` (admin sees 6 people, so the organisation_members read works), `63-home-section-signoffs`, `63-home-section-training`, `63-home-section-record`, `63-home-section-manage` (admin drafts), `63-home-read-admin`, `63-home-read-worker`, `63-real-org-list`. I read 10 of the 33 images, picking those that exercise RLS-dependent reads; the rest are layout shots of the same surfaces.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Three existing specs and the old applier were pinned to the previous kind list**
- **Found during:** Task 2 (running phase56 / phase59 / phase60)
- **Issue:** `tests/phase56/decision-shape.spec.ts`, `tests/phase60/ledger-kinds.spec.ts` (count 34, migration 00076, and the applier KINDS list) compared against 00076.
- **Fix:** repointed to 00082 and 37 kinds; `scripts/apply-phase60-migration.mjs` gets the three kinds and 00082 appended to its MIGRATION_FILES, so a fallback re-run of that applier cannot re-narrow the CHECK (per its own header rule).
- **Commit:** `4353b8cc`

**2. [Rule 1 - Bug] Suspended-probe check treated a SQL NULL as a failure**
- **Found during:** Task 3 first live run
- **Issue:** the check required `hook_org_is_site === false`; the expression is NULL when the hook returns a null organisation. The printed live values were exactly the expected ones (NULL helpers, 0 rows, hook organisation null, role pending).
- **Fix:** check changed to `!hook_org_is_site`. Because the failure was in the check and not in database behaviour, I did not run `--rollback`; I fixed the check and re-ran `--assert-only`, all PASS.
- **Commit:** `f7b0e0cc`

**3. [Rule 2 - stricter assertion] No-claim-policy check widened**
- The plan asked for zero policies reading the organisation or role claim; the live assertion checks zero policies containing `auth.jwt()` at all (the audit showed these ten were the whole set).

### Plan text vs. reality

- The plan said to write the suspended probe as an explicit transaction ending in rollback "or the DO-block pattern"; the DO-block-raises-exception form is used throughout and a dry run of the whole migration inside `BEGIN ... ROLLBACK` also worked over the Management API.

## Deferred Issues

Logged in `.planning/phases/64-leavers-and-suspended-members/deferred-items.md`: three Phase 59 specs already failing on HEAD for Phase 63 reasons (`repoint-inventory` x2 naming `createRole` in two phase63 specs; `retirement-sweep` `updateRole` guard shape). None touches a file this plan changed.

## Known Stubs

None.

## Threat Flags

None. The surface added (`revoke_user_sessions`, the column grant, the rewritten policies) is exactly what the plan's threat model covers; T-64-01 to T-64-09 are each exercised by a live assertion or the deployed smoke. The residual accepted risks (signed links, reinstate-within-the-hour, multi-site sign-out) are recorded in ADR-0024.

## Notes for the next plans

- The column and the helpers are live now; plan 64-02 can write `status` with the service role and rely on `getSessionContext` returning a null role for a non-active caller.
- `revoke_user_sessions` is only reachable by the service role (`createAdminClient().rpc(...)`).
- `--rollback` restores the old helper and hook bodies if anything later looks wrong; it leaves the column in place.

## Self-Check: PASSED

- Files: migration, applier, spec, ADR, baseline, deferred-items, this summary all present.
- Commits `c11582e1`, `07e66100`, `4353b8cc`, `f7b0e0cc` present in `git log` and pushed to origin master.
