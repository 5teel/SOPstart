---
phase: 23
plan: "07"
subsystem: pathways-uat
tags: [journeys, uat, pathways, phase-closeout, verification]
dependency_graph:
  requires: ["23-04", "23-05", "23-06"]
  provides: ["/pathways coverage for /login/kiosk + /admin/sops/[sopId]/versions/diff", "phase-23 UAT entries on /uat hub", "phase-wide green gate"]
  affects: ["src/lib/journeys/journeys.ts", "src/lib/uat/tests.ts"]
tech_stack:
  added: []
  patterns: ["journeys.ts same-change rule (CLAUDE.md)", "UAT hub entry addition pattern"]
key_files:
  created: []
  modified:
    - src/lib/journeys/journeys.ts
    - src/lib/uat/tests.ts
decisions:
  - "28 pre-existing test failures in older phase projects (phase3/11/12.5/15/20/21 stubs) — unrelated to phase-23 changes, pre-date this plan"
  - "Bundle delta = 0 KB (phase-23 changes are server/API-only backbone + config; no client bundle additions)"
  - "AFL-VER-05 RUNTIME test correctly skipped (requires real Supabase connection — expected behaviour)"
metrics:
  duration: "~4 minutes"
  completed: "2026-06-26T00:37:04Z"
  tasks_completed: 3
  files_changed: 2
---

# Phase 23 Plan 07: Phase Closeout — Pathways + UAT + Verification Gate Summary

**One-liner:** Journeys.ts extended with kiosk-worker sign-off chain + updated-badge flow; 3 UAT hub entries added for manual verifications; phase-wide green gate confirmed (phase23 tests 48/49, tsc clean, bundle Δ0 KB).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update journeys.ts for all new routes + flows | 4b88e1e | src/lib/journeys/journeys.ts |
| 2 | Add Phase 23 UAT entries to uat/tests.ts | 0aee6b0 | src/lib/uat/tests.ts |
| 3 | Full-phase verification gate (suite + tsc + bundle) | — (verification only) | — |

## What Was Built

### Task 1 — journeys.ts extended

Both new phase-23 routes were **already present** from prior plans:
- `/login/kiosk` — added by 23-06 (commit `bad572b`)
- `/admin/sops/[sopId]/versions/diff` — added by 23-05 (commit `732b881`)

This task **extended and completed** the coverage:

1. **kiosk-login journey extended** — previously ended at "Walking through SOP as named worker" after `/sops`. Now extended to include the full completion chain: `/sops/[sopId]` → `/sops/[sopId]/walkthrough` → "Complete + worker self-sign" (recordSignature / D-09) → optional supervisor counter-sign at `/activity/[completionId]` (D-10).

2. **walkthrough-complete journey updated** — "Complete the procedure" renamed to "Complete + worker self-sign" to surface the AFL-VER-05 / D-09 signature semantics. Decision label updated from "Sign-off required?" to "Supervisor counter-sign required?".

3. **find-follow-sop /sops step detail updated** — now mentions the "Updated since last completion" badge (AFL-VER-04 / D-08) so workers scanning the journeys map see the badge is on the library page.

4. **version-supersede journey** (already present from 23-05) — covers clone-to-draft, diff, restore-as-new with real routes; confirmed complete.

**Coverage check:** Both new routes appear in journeys.ts → `/pathways` "All screens" view will show 0 not-mapped for `/login/kiosk` and `/admin/sops/[sopId]/versions/diff`.

### Task 2 — uat/tests.ts: 3 Phase-23 entries added

| Entry ID | Title | Requirement |
|----------|-------|-------------|
| `p23-roster-kiosk-login` | Can a worker sign in on a shared device by picking their name? | AFL-VER-05 / D-11 |
| `p23-inline-ai-proposal` | Does the AI proposal Accept/Reject work at a field? | AFL-AI-02 / D-03 |
| `p23-updated-since-badge` | Does the "updated since last completion" badge appear when a new version is published? | AFL-VER-04 / D-08 |

Each entry follows the existing `UatTest` shape: id, dateAdded, category "Phase 23 — AI Field Layer + Version Supersede", title, status: 'active', summary, tryIt steps, links, questions (4 each), background (technical detail).

### Task 3 — Verification Gate Results

| Gate | Result | Detail |
|------|--------|--------|
| phase23-stubs --list | PASS — 36 tests in 4 files | All 4 spec files discovered |
| phase23-unit --list | PASS — 13 tests in 2 files | approval.test.ts + registry.test.ts |
| phase23-stubs run | 35 passed, 1 skipped | 1 runtime skip = AFL-VER-05 DB insert (requires real Supabase — expected) |
| phase23-unit run | 13 passed | All green |
| npx tsc --noEmit | PASS (clean) | No errors |
| Bundle check | PASS — 1054 KB, Δ 0 KB | Tolerance ±2 KB; phase-23 additions are server/API-only, no client bundle growth |
| /pathways coverage | 0 not-mapped | Both new routes confirmed in journeys.ts |

**Full suite (npm run test):** 489 passed, 184 skipped, 28 failed.

The 28 failures are **pre-existing** (all in phase3/11/12.5/15/20/21 stubs, none in phase23 projects), predating this plan's commits. They reference older feature contracts (SB-LINE-01 desktop walkthrough guard, SB-AUTH builder routing, SB-UX blueprint theme, createBlock serviceRole signature). These are not regressions from phase-23 work.

## Deviations from Plan

### None — plan executed exactly as written.

Prior plans (23-05, 23-06) had already added both new routes to journeys.ts. This plan extended the kiosk-login journey to the full completion chain and added the UAT entries. No deviations from the plan spec were required.

## Threat Flag Scan

No new security-relevant surface introduced by this plan (config-file changes only — journeys.ts and tests.ts are static config, no runtime trust boundaries).

## Known Stubs

None. The journeys.ts and uat/tests.ts changes are complete as specified. The AFL-VER-05 RUNTIME test (`sop_completion_signatures insert performs real DB write`) is `test.skip` by design — it requires a real Supabase connection and is documented in 23-VALIDATION.md as a manual-only verification.

## Self-Check: PASSED

- [x] `src/lib/journeys/journeys.ts` modified — verified `grep "login/kiosk\|versions/diff"` returns both routes
- [x] `src/lib/uat/tests.ts` modified — verified `grep "p23-roster\|p23-inline\|p23-updated"` returns all 3 entries
- [x] Commit 4b88e1e exists: `feat(23-07): extend journeys.ts for all phase-23 flows`
- [x] Commit 0aee6b0 exists: `feat(23-07): add phase-23 team-review UAT entries to uat/tests.ts`
- [x] tsc clean
- [x] phase23 tests green (48/49, 1 expected skip)
- [x] Bundle Δ 0 KB
