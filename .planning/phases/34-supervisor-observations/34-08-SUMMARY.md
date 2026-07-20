---
phase: 34-supervisor-observations
plan: 08
subsystem: ui
tags: [react, server-component, blueprint-ui, observations, journeys, uat]

requires:
  - phase: 34-supervisor-observations (34-04)
    provides: "src/actions/observations.ts — listObservationsForWorker, getObservationLabels"
  - phase: 34-supervisor-observations (34-05)
    provides: "src/components/observations/ObservationRow.tsx — shared row primitive"
provides:
  - "src/components/profile/ObservationsSection.tsx — worker 'Observations about you' section + trust banner"
  - "profile/page.tsx renders the section below OrgSwitcher"
  - "journeys.ts + uat/tests.ts document the record-observation and worker-visibility flows"
affects: [34-09, 35]

tech-stack:
  added: []
  patterns:
    - "Additive server-component section on /profile, mirroring the OrgSwitcher precedent — fetch via Promise.all, render inside a blueprint-frame card"
    - "Tinted trust-banner background via color-mix(in srgb, var(--accent-decision) 6%, white) — declared token only, no --brand-yellow (CLAUDE.md 2026-07-14 undefined-token learning)"

key-files:
  created:
    - src/components/profile/ObservationsSection.tsx
  modified:
    - src/app/(protected)/profile/page.tsx
    - src/lib/journeys/journeys.ts
    - src/lib/uat/tests.ts
    - tests/phase34/worker-observation-visibility.spec.ts

key-decisions:
  - "Kept the OBS-02 runtime proof as a documented Railway-only test.fixme with a fleshed-out step-by-step body, matching the 34-04 record-observation.spec.ts precedent (this codebase's Railway-only UAT convention — no local dev/localhost runtime tests). Strengthened the source-contract backstop instead: a new assertion confirms listObservationsForWorker() takes no worker-id parameter and filters observed_worker_id by the session-derived userId, not a client-supplied id — the actual self-scoping guarantee the runtime test would otherwise be the only proof of."
  - "Trust banner uses color-mix(in srgb, var(--accent-decision) 6%, white) instead of the sketch's raw rgba(251,191,36,.06) amber tint — the sketch's colour isn't a declared CSS custom property in this codebase and --brand-yellow is explicitly banned; --accent-decision (also amber, #d97706) achieves the same tinted-callout look from a token that is confirmed declared."

requirements-completed: [OBS-02, OBS-03]

duration: ~20min
completed: 2026-07-20
---

# Phase 34 Plan 08: Worker Observation Visibility + Pathways/UAT Documentation Summary

**Shipped `ObservationsSection` on the worker's own `/profile` — full-transparency "Observations about you" list (verdict, note, observer, date, SOP version) with a plain-language NZ Privacy Act trust banner and zero edit/delete/hide controls — plus the phase's `journeys.ts` + `uat/tests.ts` flow documentation.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-20
- **Tasks:** 2 completed
- **Files modified:** 5 (1 new component, 4 modified)

## Accomplishments

- `ObservationsSection` (server component) fetches `listObservationsForWorker()` + `getObservationLabels()` in parallel and renders a `blueprint-frame` card: header with a record-count pill, a tinted trust-banner callout with the exact D-08 copy ("These are records your supervisors made after watching you work — they're part of your training evidence, and they're yours to see. Nothing here is hidden from you."), then the observation list via the existing `ObservationRow` primitive (newest first, already sorted server-side) or an empty state ("No observations yet."). No edit/delete/dismiss affordance exists anywhere in the component — append-only per D-08.
- `profile/page.tsx` renders `<ObservationsSection />` below the existing Account section and `<OrgSwitcher />`, a thin additive edit that keeps the file a small list of sections (unchanged structure otherwise).
- `tests/phase34/worker-observation-visibility.spec.ts` flipped live: the two Wave-0 source-contract stubs now pass for real, plus a new assertion confirms `listObservationsForWorker()` is parameterless and self-scopes via the session `userId` (never a caller-supplied worker id). The runtime proof stays a documented Railway-only `test.fixme` (per the 34-04 precedent and this codebase's local-dev-testing prohibition) with its body fleshed out into explicit verification steps.
- `journeys.ts` gained two flows: "Record an observation of a worker" (Supervisor, spanning `/admin/team` person panel and `/activity`) and "See observations recorded about you" (Worker, `/profile`) — both on real, already-existing routes, so `/pathways` "All screens" gains zero not-mapped entries.
- `uat/tests.ts` gained two plain-language click-path tests (`p34-record-observation`, `p34-worker-sees-observations`) with layman tryIt steps and yes/no questions, no internal IDs.

## Task Commits

1. **Task 1: ObservationsSection + trust banner on /profile** — `cc8fdfa` (feat)
2. **Task 2: Flip worker-visibility runtime proof + journeys.ts + uat/tests.ts** — `7999380` (test)

## Files Created/Modified

- `src/components/profile/ObservationsSection.tsx` — worker-facing observations list + trust banner, read-only
- `src/app/(protected)/profile/page.tsx` — renders `<ObservationsSection />`
- `tests/phase34/worker-observation-visibility.spec.ts` — flipped source-contract assertions live + stronger self-scoping backstop + fleshed-out runtime `test.fixme` body
- `src/lib/journeys/journeys.ts` — `record-observation` (Supervisor) + `worker-sees-observations` (Worker) flows
- `src/lib/uat/tests.ts` — `p34-record-observation` + `p34-worker-sees-observations` plain-language checks

## Decisions Made

See `key-decisions` in frontmatter — Railway-only runtime carry (matches 34-04 precedent) and the trust-banner token substitution (`--accent-decision` color-mix instead of the sketch's undeclared raw rgba amber).

## Deviations from Plan

None — plan executed exactly as written. The plan itself offered the Railway-only `test.fixme` carry as an explicit alternative to flipping fully live, and this codebase's established convention (CLAUDE.md Railway-only-testing feedback, and the 34-04 `record-observation.spec.ts` precedent in this same phase) is to take that carry rather than attempt a live-session Playwright run against local dev.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `npx tsc --noEmit` clean.
- `npm run build` (next build) clean, including the post-build bundle-size/isolation checks.
- `npx playwright test --project=phase34` — 12 passed, 8 correctly skipped (fixme runtime specs owned by later Railway UAT passes across the whole phase, not just this plan).
- `grep -qi "observation" src/lib/journeys/journeys.ts src/lib/uat/tests.ts` — both hit.
- `grep -rn -- "--brand-yellow" src/components/profile/ObservationsSection.tsx "src/app/(protected)/profile/page.tsx"` — zero hits.
- OBS-02 and OBS-03 are both proven at the source-contract level; the worker-facing half of Phase 34's trust story (D-08) is shipped in the same wave as the supervisor write UI (34-05/34-06/34-07).
- No blockers for 34-09 (org-label admin settings) or Phase 35 (training matrix, which consumes these observation rows).

---
*Phase: 34-supervisor-observations*
*Completed: 2026-07-20*
