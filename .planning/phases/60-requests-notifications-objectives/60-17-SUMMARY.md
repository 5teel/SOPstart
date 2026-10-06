---
phase: 60-requests-notifications-objectives
plan: 17
subsystem: retirement
tags: [deletion, redirect, sweeps, requests]
requires: [60-06, 60-12, 60-16]
provides: [assign-page dropped feature, legacy assign address 307 to the SOP edit address]
affects: [src/actions/assignments.ts, src/lib/sop/focus-path.ts, scripts/dropped-features.json, scripts/decision-writers.json]
key-files:
  deleted:
    - src/app/(protected)/admin/sops/[sopId]/assign/page.tsx
    - src/app/api/sops/[sopId]/assignments/route.ts
    - src/components/admin/AssignmentRow.tsx
    - src/components/admin/SubTradePicker.tsx
    - src/actions/sub-trades.ts
    - src/lib/validators/sub-trades.ts
    - src/hooks/useNotifications.ts
  modified:
    - src/actions/assignments.ts
    - src/lib/sop/focus-path.ts
    - scripts/decision-writers.json
    - scripts/dropped-features.json
requirements: [RQS-03]
metrics:
  commits: 3
  completed: 2026-10-06
---

# Phase 60 Plan 17: Retire the assign screen Summary

The assign screen and everything only it used are deleted; `/admin/sops/<uuid>/assign` now 307s server-side to the SOP edit address, and an `assign-page` dropped feature plus a live 60-17 retirement block make any return fail a sweep.

## Importers found before deletion (grep over src)

| Symbol | Importers | Outcome |
|---|---|---|
| `assignSopToRole`, `assignSopToUser`, `removeAssignment`, `getAssignments` | assign page, `AssignmentRow`, assignments API route only | deleted |
| `requestRemoveAssignment` | none | deleted (its `worker_notifications` insert went with it; the table and the Phase 37 assessment path are untouched, A-02) |
| `useNotifications` | none | deleted |
| `SubTradePicker` | assign page only | deleted |
| `listSubTrades`, `getUserSubTrades`, `getSopSubTrades`, `assignUserSubTrades`, `assignSopSubTrades` | `SubTradePicker` only | whole `sub-trades.ts` deleted, plus `lib/validators/sub-trades.ts` (only importer was the actions file) |
| `getOrgMembers` (kept) | approvals, governance, admin settings, OwnerPicker, ApprovePanel | stays |
| `selfAddSop`, `selfRemoveSop`, `getUserSopAssignments` (kept) | worker hooks | stay |

In `assignments.ts` the `zod` import, `recordDecision` import and the role schema went with the actions; `getAdminContext` stays (used by `getOrgMembers`). No table dropped.

## Redirect

`legacyRedirectFor` admin regex is now `(?:builder/<id>|<id>/(?:versions|assign))`, UUID gated, fixed template. The existing proxy hook already applies it with cookies copied; no middleware change.

## Repointed specs

- `tests/phase58/legacy-redirects.spec.ts` (assign maps to edit; non-UUID null)
- `tests/phase57/shell-structure.spec.ts` (redirect-only exemption for the assign page removed)
- `tests/e2e/sub-trade-assignment.spec.ts` (reduced to the People-tab case; absence asserted in the phase60 sweep, since the inventory forbids the retired tokens in other specs)
- `tests/phase56/decision-writers-sweep.spec.ts` + `scripts/decision-writers.json` (three writers removed; surviving `sop_assignments` writers are asserted registered)
- `tests/phase60/capability-matrix.spec.ts` (60-17 case live; `assignSopToRole` expectation dropped)

## Lock-in

- `assign-page` (phase 60) in `scripts/dropped-features.json` (route-page + five file entries) and in `LIVE_FEATURES`, `FEATURES`, and the allowed phase list of `deletion-sweep.spec.ts`
- `retirement-sweep.spec.ts` 60-17 block live (files gone, symbols gone from src and registry, no link anchored on href / router call, redirect + proxy wiring); `'60-17'` appended to `LIVE_PLANS`
- CAPABILITY-MATRIX "Self-add SOP" and "Ask someone to do a SOP" notes updated; `.planning/codebase/ARCHITECTURE.md` assignment line updated (route-truth guard flagged it)
- `requests.eval.ts`: the 60-17 fixme is a live case (admin opens the legacy address, asserts `this-sop` rendered and URL is the SOP, screenshot `60-legacy-assign`); no `test.fixme` remains. Not run deployed here (60-18 runs the eval).

## Verification

`tsc --noEmit` clean (after clearing stale `.next/types`), `npm run build` green; `/sops/[sopId]` 794 KB vs baseline 795 (Δ -1), `/page` 836 vs 834 (Δ +2, in tolerance, unrelated to this plan); `.bundle-baseline.json` untouched. Playwright (`--grep-invert "live|probe"`): phase60 164, phase55 157, phase56 96, phase57 112, phase58 216, phase59 142, phase15-stubs 36, phase43 10, phase52 72, phase46 15 all green; `playwright test --list` clean. ESLint clean on touched files; remaining lint errors are in untracked scratch folders.

## Deviations from Plan

**1. [Rule 3 - Blocking] Deleted all of `sub-trades.ts` and `validators/sub-trades.ts`, not selected exports.** Every export's last caller was `SubTradePicker`; the file was dead and its source-contract spec asserted exports that no longer have a UI. The user-level sub-trade write path had no other caller. Tables untouched.

**2. [Rule 1 - Bug] Two guards outside the plan's file list went red and were fixed:** `deletion-sweep` "not vacuous" allowed phases only 55/57/58/59 (added 60), and `no-dead-internal-hrefs` flagged the assign address in `ARCHITECTURE.md` (line repointed to the ask flow).

## Known Stubs

None.

## Self-Check: PASSED

Commits 3f2b5534, 00bbd595, aeabdac7 exist; deleted paths absent; STATE.md / ROADMAP.md / `.bundle-baseline.json` untouched; nothing pushed.
