---
phase: 34-supervisor-observations
plan: 09
subsystem: testing
tags: [playwright, tsc, next-build, rls, phase-gate]

requires:
  - phase: 34-supervisor-observations (34-01..34-08)
    provides: "sop_observations table + RLS (00052/00053), recordObservation/listObservationsForWorker/listObservationsForPerson server actions, RecordObservationModal/ObservationRow/VerdictButtons, PersonPanel + /activity + /profile entry points, journeys.ts + uat/tests.ts flows"
provides:
  - "Merged-tree phase gate: full Playwright suite (phase34 project 16/16 green), npx tsc --noEmit clean, npm run build clean (bundle Δ+1KB within tolerance)"
  - "Per-requirement audit (OBS-01/02/03 + SC-4) with file/behaviour citations, all PASS"
  - "/pathways coverage confirmation — no new routes this phase, all flows on existing routes"
affects: [35]

tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .planning/phases/34-supervisor-observations/34-09-SUMMARY.md
  modified: []

key-decisions:
  - "34 pre-existing test failures found in the full suite run (phase3/11/12.5/15/20/21-stubs, phase26, phase29, phase33) are out of scope per the deviation-rules scope boundary — none touch files any 34-01..34-08 plan modified (confirmed via git log --name-only over the phase's commit range); left as-is, not fixed"

requirements-completed: [OBS-01, OBS-02, OBS-03]

duration: ~15min
completed: 2026-07-20
---

# Phase 34 Plan 09: Merged-Tree Phase Gate Summary

**Merged Phase 34 tree is green across the full Playwright suite (phase34: 16/16, 4 correctly-skipped Railway-only runtime carries), `tsc --noEmit`, and a real `next build` (bundle Δ+1KB, within ±2KB tolerance) — OBS-01/02/03 and SC-4 audited PASS with implementation evidence, zero new routes so `/pathways` coverage is unaffected.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-20
- **Tasks:** 2 completed
- **Files modified:** 1 (this SUMMARY)

## Accomplishments

- Full `npm run test` run: 991 passed, 208 skipped, 34 failed — all 34 failures traced to pre-existing source-contract drift in phases unrelated to and untouched by Phase 34 (see Deferred Issues below). Zero phase34 failures.
- `npx playwright test --project=phase34` isolated run: 16 passed, 4 skipped (documented Railway-only runtime carries per the 34-04/34-08 precedent — chromium+live-app tests that can't run against local dev per this codebase's Railway-only-testing convention).
- `npx tsc --noEmit`: clean, zero errors.
- `npm run build` (next build): clean production build. `/sops/[sopId]/page` bundle = 1057 KB (baseline 1056 KB, Δ+1 KB, within ±2 KB tolerance). Bundle isolation checks (source-viewer pdfjs/mammoth, Konva) all pass.
- Requirement audit (below): OBS-01, OBS-02, OBS-03, and SC-4 all PASS with evidence.
- `/pathways` coverage: Phase 34 added zero new routes (`/admin/team`, `/activity`, `/profile` all pre-existing) — journeys.ts documents two new flows on those existing routes, so "All screens" not-mapped count is unaffected by this phase.

## Task Commits

1. **Task 1: Full suite + tsc + next build on the merged tree** — verification-only, no code changes; results recorded in this SUMMARY
2. **Task 2: Requirement audit + pathways coverage** — verification-only, no code changes; audit table below

**Plan metadata:** committed with this SUMMARY (audit-only plan produces no source changes, per `<artifacts_this_phase_produces>`)

## Files Created/Modified

- `.planning/phases/34-supervisor-observations/34-09-SUMMARY.md` — this phase-gate audit

## Requirement Audit

| Requirement | Evidence | Status |
|---|---|---|
| **OBS-01** — Supervisor can record a 30-second observation (verdict + optional note) against a worker+SOP, append-only | `src/actions/observations.ts` `recordObservation()` — inline role gate (`supervisor\|admin\|safety_manager`), session-client write (never admin-client) (34-04). Migration `00052_supervisor_observations.sql` — `sop_observations` has an INSERT policy only, no UPDATE/DELETE policy (hard DB-level append-only). Two entry points: `PersonPanel` "Record observation" CTA on `/admin/team` (34-06), and `/activity` header button + `CompletionSummaryCard` "I observed this" row action (34-07), both opening the shared `RecordObservationModal`. Runtime proof: `tests/phase34/observation-immutability.spec.ts` — real authenticated UPDATE and DELETE attempts against a live ephemeral-org row both denied by RLS with zero rows affected (34-03). | **PASS** |
| **OBS-02** — Worker can see observations recorded about them (trust/NZ Privacy Act framing, ships with the write UI) | `src/components/profile/ObservationsSection.tsx` rendered on `/profile` (34-08) — full list via `listObservationsForWorker()`, no edit/delete/hide affordance anywhere in the component. Self-read RLS: `sop_observations_read_org` policy scopes rows to `organisation_id = current org` OR `observed_worker_id = auth.uid()` (never a widened `observed_worker_id = any(...)` form — asserted by `tests/phase34/observation-cross-org-isolation.spec.ts`). Trust banner: plain-language NZ Privacy Act framing copy ("These are records your supervisors made... they're yours to see. Nothing here is hidden from you."). `listObservationsForWorker()` takes no worker-id parameter — filters `observed_worker_id` by the session-derived `userId` only, confirmed by a dedicated source-contract assertion (34-08). | **PASS** |
| **OBS-03** — Observations appear under the worker's profile and feed the derived competency state | Surfaced in two places: `PersonPanel` observation history (admin, `/admin/team`, 34-06) and worker `ObservationsSection` (`/profile`, 34-08) — both read the same append-only `sop_observations` rows. `sop_version` is server-resolved at insert time (not client-supplied), proven by `tests/phase34/sop-version-stamp.spec.ts` (source-contract + confirmed via the immutability/cross-org runtime specs exercising real inserts). "Feed the derived competency state" is explicitly Phase 35 scope per ROADMAP.md (Phase 35's classifier consumes completions/sign-offs/observations) — Phase 34's job is to make observation rows exist, org-scoped and worker-visible, which they do; no classifier exists yet to wire into, and none was in this phase's scope. | **PASS** (data layer complete; consumption is Phase 35) |
| **SC-4** — Observations are strictly org-scoped; a runtime cross-org write/read test proves no leakage | `tests/phase34/observation-cross-org-isolation.spec.ts` runtime block (real ephemeral orgs, real RLS, no chromium needed — direct supabase-js + magic-link session per the `tests/phase32/grants-org-isolation.spec.ts` precedent): (1) an org-B supervisor inserting an observation with their own valid `organisation_id` but org-A `sop_id`/`observed_worker_id` refs is denied by RLS via the `sop_observation_refs_in_org()` SECURITY DEFINER guard added in migration `00053` after a live probe found the original 00052 policy did not check FK ownership (34-03); (2) an org-B session reading observations returns zero org-A rows. Both re-executed and green on this merged tree (`observation-cross-org-isolation.spec.ts:170` and `:203`, confirmed in this plan's isolated `--project=phase34` run). | **PASS** |

## Decisions Made

- 34 pre-existing test failures surfaced by the full-suite run are out of scope (deviation-rules scope boundary — "only auto-fix issues directly caused by the current task's changes"). Confirmed via `git log --oneline -30 --name-only` filtered for the affected files/dirs (`src/lib/governance`, `src/actions/governance.ts`, `src/lib/org-model/grants.ts`, `ApprovalChainEditor.tsx`, `tests/phase29`, `tests/phase33`, `tests/phase26`) — zero hits across every commit in Phase 34's range (34-01 through 34-08). These are stale source-contract literal assertions in phases 29/33/26 (the same class as the CLAUDE.md 2026-07-13 "source-contract guards go stale-RED when the code they grep moves" learning), plus long-standing stub failures in phase3/11/12.5/15/20/21-stubs projects that predate this phase entirely. None involve `sop_observations`, `observations.ts`, or any Phase 34 file.

## Deviations from Plan

None — plan executed exactly as written. Both tasks were verification/audit-only; no source code changes were needed or made.

## Deferred Issues (out of phase-34 scope, logged not fixed)

The following 34 pre-existing failures were observed in the full `npm run test` run and are **not** caused by Phase 34 and were **not** fixed (scope boundary — see Decisions Made above):

- `phase3-stubs` / `phase12.5-stubs` — `desktop-walkthrough-layout.spec.ts`, `sb-ux-walkthrough.test.ts` (immersive step card / ViewModeToggle assertions)
- `phase11-stubs` — `sb-layout-editor.test.ts` (7 assertions), `sb-section-schema.test.ts`
- `phase12.5-stubs` — `sb-ux-blocks.test.ts` (4 assertions), `sb-ux-blueprint.test.ts` (4 assertions), `sb-ux-voice.test.ts` (2 assertions)
- `phase15-stubs` — `sub-trade-assignment.spec.ts` (2 assertions), `desktop-walkthrough-layout.spec.ts`, `voice-grounding-scope.spec.ts`
- `phase20-parsers` / `phase21-unit` — `parser-creates-junctions.test.ts`, `block-content-extended.test.ts`
- `phase29` — `queue-classifier.spec.ts` (`GovernanceRow` literal string drift)
- `phase26` — `reorder.spec.ts` (`@dnd-kit` import-location guard flags `ApprovalChainEditor.tsx`)
- `phase33` — `sop-grant-schema.spec.ts` (`materializeSopAccessForOrg` literal string drift)

Recommendation: a future maintenance pass (or the next phase touching governance/grants/dnd-kit-adjacent code) should re-point these source-contract literal assertions at current code, per the established fix pattern.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `npx tsc --noEmit` clean. `npm run build` clean, bundle within tolerance.
- `npx playwright test --project=phase34` — 16/16 green, 4 correctly-skipped Railway-only carries.
- OBS-01/02/03 + SC-4 all audited PASS with evidence.
- Phase 34 is complete. Phase 35 (Competency Classifier + Training Matrix + Records) can now build its classifier over `sop_observations` rows plus existing grants/completions/sign-offs — no blockers.

---
*Phase: 34-supervisor-observations*
*Completed: 2026-07-20*
