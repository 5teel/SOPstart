---
phase: 35-competency-classifier-training-matrix-records
plan: 04
subsystem: worker-profile
tags: [profile, competency, transparency, playwright]

dependency-graph:
  requires:
    - phase: 35-02
      provides: getMyCompetencyStates server action, StatePill component
  provides:
    - "CompetencySection — worker-facing 'My competency' section on /profile (CMP-01/D-04)"
    - "profile-competency.spec.ts — self-scoped/informational/gate-free source-contract"
  affects: [no-competency-gate.spec.ts (CompetencySection branch now active), /pathways]

tech-stack:
  added: []
  patterns:
    - "Async Server Component analog of ObservationsSection — Promise-await a self-scoped server action, blueprint-frame card, trust-framing caption, read-only row map"

key-files:
  created:
    - src/components/profile/CompetencySection.tsx
    - tests/phase35/profile-competency.spec.ts
  modified:
    - src/app/(protected)/profile/page.tsx

decisions:
  - "CompetencySection copies ObservationsSection's shape wholesale (same card/caption/row idiom) rather than inventing a new profile-section pattern — consistent trust framing across both transparency surfaces"
  - "No new CSS tokens or components needed — StatePill (35-02) and blueprint-frame/pill classes (existing) cover the entire render; zero new dependencies"

requirements-completed: [CMP-01, CMP-04]

duration: ~20min
completed: 2026-07-24
---

# Phase 35 Plan 04: Worker /profile "My competency" section Summary

Added the worker-facing "Your training" section to `/profile`, rendering each worker's own derived competency state per required SOP via the self-scoped `getMyCompetencyStates()` action and the shared `StatePill` component — read-only, informational, and now actively covered by the CMP-04 no-competency-gate guard's `CompetencySection` branch (previously skipped pending this plan).

## What Was Built

**`src/components/profile/CompetencySection.tsx`** — async Server Component modelled directly on `ObservationsSection`: awaits `getMyCompetencyStates()` (self-scoped to `auth.uid()`, session client only, no admin client, no role gate), renders a blueprint-frame card headed "Your training" with the same trust-framing caption style as the neighbouring observations section ("they're yours to see, and they never lock anything"), and lists each required SOP's title + `StatePill`. Empty state ("No required SOPs yet.") handled. Zero lock icons, zero disabled controls, zero "you can't do this yet" copy — purely informational per CMP-04.

**`src/app/(protected)/profile/page.tsx`** (modified) — imports and mounts `CompetencySection` as a sibling directly below `ObservationsSection`, same section spacing idiom as the rest of the page.

**`tests/phase35/profile-competency.spec.ts`** — positive source-contract complement to `no-competency-gate.spec.ts`: asserts `CompetencySection` imports the self-scoped `getMyCompetencyStates` (never `getTrainingMatrix`/`getTrainingRecordForPerson` — the admin reads a worker must never call), renders `StatePill`, carries the "yours to see" trust-framing phrase, contains no lock/disabled/gating affordance, and that `profile/page.tsx` mounts it.

## Verification

- `npx tsc --noEmit` — clean
- `npm run build` — compiled successfully; `/sops/[sopId]` worker bundle unchanged (1057 KB, within tolerance) — this feature is entirely on the `/profile` route, no worker walkthrough bundle impact
- `npx playwright test --project=phase35` — 66 passed, 4 skipped (staged 35-02 RLS-probe fixmes) — includes the now-active `no-competency-gate.spec.ts` `CompetencySection` assertion and the new `profile-competency.spec.ts` (6/6)
- `npx playwright test --project=phase35-unit` — 17 passed (unrelated to this plan's files, confirms no regression)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two false-positive regexes in my own `profile-competency.spec.ts` (test-authoring bugs, not implementation bugs)**
- **Found during:** Task 2 verification (`npx playwright test --project=phase35 tests/phase35/profile-competency.spec.ts`)
- **Issue:** (a) A bare `/lock/i` check matched the component's own reassurance copy ("...they never **lock** anything"), which is correct CMP-04-compliant prose, not a gating affordance. (b) A `(can't|cannot|not able to).{0,20}(yet|until)` check matched the file's own header comment quoting the forbidden phrase as documentation (`// "you can't do this yet" copy anywhere here`) — the same "doc comment mention is fine" allowance the `no-competency-gate.spec.ts` file explicitly documents for its own `GATE_PATTERN`.
- **Fix:** (a) Narrowed to match actual lock affordances (`isLocked`, `<Lock`, `lock-icon`, `locked=`) instead of the bare substring. (b) Stripped `//` line comments before running the phrase check, so only real worker-facing copy/markup is evaluated.
- **Files modified:** tests/phase35/profile-competency.spec.ts
- **Commit:** c6970e3 (fixed before commit, not a follow-up)

No deviations in the plan's implementation files (`CompetencySection.tsx`, `profile/page.tsx`) — both matched the plan's design exactly on first pass.

---

**Total deviations:** 1 auto-fixed (test-authoring bugs in a spec I wrote in the same task, caught by my own first verification run)
**Impact on plan:** None on shipped implementation code.

## Known Stubs

None. `CompetencySection` renders real data from `getMyCompetencyStates()` — no hardcoded empty arrays, no placeholder text.

## Threat Flags

None. No new network endpoints, auth paths, or schema changes — `CompetencySection` consumes the already-shipped, already-self-scoped `getMyCompetencyStates()` server action (35-02) and the already-shipped `StatePill` component; no new trust surface.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- Phase 35's four plans are complete: classifier + pure modules (35-01), server-side data layer + StatePill (35-02), training matrix + records UI + CSV export (35-03), worker `/profile` competency section (35-04, this plan).
- The one staged item carried forward from 35-02 is the four `test.fixme` runtime RLS probes in `tests/phase35/competency-rls-probe.spec.ts` — needs live sopstart.com UAT before the phase's final verification gate (Railway-only-testing convention), not a blocker for this plan.
- No blockers for phase verification/UAT.

---
*Phase: 35-competency-classifier-training-matrix-records*
*Completed: 2026-07-24*

## Self-Check: PASSED

- FOUND: src/components/profile/CompetencySection.tsx
- FOUND: tests/phase35/profile-competency.spec.ts
- FOUND: src/app/(protected)/profile/page.tsx (modified)
- FOUND commit caa759f (Task 1)
- FOUND commit c6970e3 (Task 2)
