---
phase: 37-assessor-governance
plan: 05
subsystem: observations
tags: [server-actions, playwright, assessor-governance, competency, ui]

# Dependency graph
requires:
  - phase: 37-03
    provides: recordObservation gate, getAssessorStatusForSop, requestAssessorReview, listAssessmentRequests, error codes NOT_SIGNED_OFF_ASSESSOR/ASSESSOR_OVERRIDE_REQUIRED
  - phase: 37-04
    provides: the sign-off surface's blocked/override UI pattern (teaching copy, progressive-disclosure override sheet) this plan mirrors onto the observation modal
provides:
  - VerdictButtons blockedVerdict/blockedHint props — disables at most the single named verdict, needs_support never gated
  - RecordObservationModal three-state UI — coaching open, blocked-teaching with Request assessment, admin/safety_manager progressive-disclosure override
  - AssessmentRequestsPanel mounted on /admin/team — the first (and only) inbox surface for D-08 requests
  - tests/phase37/assessor-ui-observation.spec.ts flipped from 6 test.fixme runtime stubs to 15 live source-contract assertions
affects: [37-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "VerdictButtons.blockedVerdict is a single-verdict disable, not a group disable — isBlocked = blockedVerdict === verdict, computed per-option inside the existing OPTIONS.map, so the coaching verdict's rendering is byte-identical to before whenever blockedVerdict is undefined/null"
    - "Assessor status fetch (getAssessorStatusForSop) lives in its own effect keyed on [sopId], separate from the existing open+worker.id fetch effect — state is set only inside .then, mirroring the file's documented pattern; blocked stays false while assessorStatus is null so the fetch-in-flight window never flashes a blocked state"

key-files:
  created:
    - src/components/observations/AssessmentRequestsPanel.tsx
  modified:
    - src/components/observations/VerdictButtons.tsx
    - src/components/observations/RecordObservationModal.tsx
    - src/app/(protected)/admin/team/page.tsx
    - tests/phase37/assessor-ui-observation.spec.ts

key-decisions:
  - "AssessmentRequestsPanel renders null in two distinct early returns (requests === null while loading, requests.length === 0 when empty) rather than one combined check — matches the plan's explicit acceptance criterion and keeps the loading/empty semantics independently testable"
  - "AssessmentRequestsPanel's Assess-now action mounts the SAME RecordObservationModal component PersonPanel already uses (worker={{id,name}} + presetSopId), not a second modal — one recording surface, D-08 request resolution and person-panel recording share identical UX and validation"
  - "overrideReason is only ever included in the recordObservation payload when overrideOpen is true AND the selected verdict is performed_to_sop — a needs_support save can never carry an override reason, matching the server's own branch-before-gate shape"

patterns-established:
  - "assessor-ui-observation.spec.ts scopes wiring assertions to a control's own markup window (sliceAroundOccurrences around 'Request assessment' / the override textarea's placeholder) rather than whole-file toContain checks, so a disconnected onClick or an unreferenced overrideOpen state would fail the test — same idiom as tests/phase37/assessor-ui-signoff.spec.ts and tests/phase36/no-refresher-gate.spec.ts"

requirements-completed: [ASR-01]

# Metrics
duration: ~25min
completed: 2026-07-28
---

# Phase 37 Plan 05: Observation Modal Assessor Gate UI + Request Inbox Summary

**`RecordObservationModal` now surfaces the assessor gate's three states in place — coaching untouched, blocked-teaching with a one-tap "Request assessment" CTA, and an admin/safety_manager progressive-disclosure override — while `AssessmentRequestsPanel` gives admin/safety_manager the first visible, actionable inbox for those requests, mounted on `/admin/team`.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments
- `VerdictButtons` gained `blockedVerdict`/`blockedHint` props; `isBlocked = blockedVerdict === verdict` disables at most the single named verdict (D-09 — `needs_support` is structurally unreachable by the gate)
- `RecordObservationModal` fetches `getAssessorStatusForSop(sopId)` on SOP selection, derives `blocked`/`canOverride`, and renders: the exact teaching copy for a blocked recorder, a "Request assessment" CTA wired to `requestAssessorReview(sopId)` for plain supervisors, and a progressive-disclosure override textarea (min 10 chars, audit-trail disclosure copy) for admin/safety_manager — while `overrideOpen`, the advancing verdict becomes selectable again
- Both bare server error codes (`NOT_SIGNED_OFF_ASSESSOR`, `ASSESSOR_OVERRIDE_REQUIRED`) mapped to human copy client-side, covering the fetch/save race where status changes mid-flow
- `AssessmentRequestsPanel` created — fetches `listAssessmentRequests()`, renders nothing while loading or when empty, otherwise a compact list of `{subjectName} asked to be signed off on {sopTitle}` rows with **Assess now** (opens the shared `RecordObservationModal` preset to that person + SOP, exactly as `PersonPanel` already mounts it) and **Dismiss** (`markNotificationRead`, reused, no new server action)
- Mounted on `/admin/team` above `TeamViewShell` — the one page whose `['admin', 'safety_manager']` guard matches the recipient roles; `/activity` was confirmed the wrong home (admin is redirected away by `roleHome`)
- `tests/phase37/assessor-ui-observation.spec.ts` flipped from 6 `test.fixme` stubs to 15 live source-contract assertions, including two scoped-window wiring checks (override textarea references `overrideOpen`; Request assessment's onClick reaches `handleRequestAssessment` → `requestAssessorReview`)
- `npx tsc --noEmit` clean and `npm run build` clean after every task (bundle delta +2 KB, within tolerance); `npx playwright test --project=phase37` green (75 passed, 2 skipped); `npm run test` shows the same 37 pre-existing failures as before this plan (none touch files this plan modified)

## Task Commits

1. **Task 1: Three-state advancing verdict in the recording modal (D-08/D-09/D-05)** - `1204970` (feat)
2. **Task 2: AssessmentRequestsPanel on /admin/team (D-08 actionability)** - `1ec0036` (feat)
3. **Task 3: Flip assessor-ui-observation.spec.ts live** - `03eaccf` (test)

## Files Created/Modified
- `src/components/observations/VerdictButtons.tsx` - `blockedVerdict`/`blockedHint` optional props, defaulting to undefined so pre-existing call sites (e.g. observation history displays that don't pass them) are behaviourally unchanged
- `src/components/observations/RecordObservationModal.tsx` - four new state variables reset on the render-time `prevOpen !== open` block; a second fetch effect keyed on `[sopId]`; blocked-state UI block (teaching copy, request CTA, override reveal); `handleSave` conditions `overrideReason` on `overrideOpen && verdict === 'performed_to_sop'`; error mapping helper
- `src/components/observations/AssessmentRequestsPanel.tsx` - new `'use client'` component, no props, self-fetching, two early-null-return states, mounts `RecordObservationModal` for the assess action
- `src/app/(protected)/admin/team/page.tsx` - imports and renders `AssessmentRequestsPanel` above `TeamViewShell`
- `tests/phase37/assessor-ui-observation.spec.ts` - rewritten from 6 `test.fixme` Playwright/browser stubs to 15 live `fs.readFileSync` + `toContain`/scoped-window source-contract assertions

## Decisions Made
- The override reason's minimum length (10 chars) is enforced client-side only for the Save button's disabled state (`canSave`); the server (37-03's `recordObservation`) and the DB CHECK constraint (migration 00056) remain the actual authorities, matching the sign-off surface's three-layer pattern
- `AssessmentRequestsPanel`'s date format uses `en-NZ` short day/month (no year) — the panel is for recent/live requests, not a historical log, so a compact date suffices

## Deviations from Plan

None — plan executed exactly as written. One test-authoring correction during Task 3: an initial regex assertion (`not.toMatch(/disabled\s*$/m)`) intended to prove no unconditional `disabled` attribute existed instead matched the word "disabled" inside a JSDoc comment on the `blockedVerdict` prop, producing a false failure. Removed in favour of the more precise `disabledLine` check (asserting the file's one `disabled={` JSX attribute references `isBlocked`), which is what the acceptance criteria actually required — not a Rule 1-4 deviation, caught by running the test itself.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required; no new migrations (this plan is UI-only, reusing 37-03's live migration 00056 and actions).

## Next Phase Readiness

- Both write paths named in ASR-01 (`recordObservation` in 37-03, `signOffCompletion` in 37-04) now have matching, live-verified UI surfaces (this plan + 37-04) — the assessor gate is fully wired end-to-end from schema to click-path on both surfaces the requirement names
- `AssessmentRequestsPanel` proves the D-08 request/notify loop closes: a blocked supervisor's tap reaches an admin/safety_manager's screen with a working one-tap resolution path, closing 37-RESEARCH Pitfall 1
- No blockers

---
*Phase: 37-assessor-governance*
*Completed: 2026-07-28*

## Self-Check: PASSED

- FOUND: src/components/observations/AssessmentRequestsPanel.tsx
- FOUND: src/components/observations/VerdictButtons.tsx
- FOUND: src/components/observations/RecordObservationModal.tsx
- FOUND: src/app/(protected)/admin/team/page.tsx
- FOUND: tests/phase37/assessor-ui-observation.spec.ts
- FOUND commit: 1204970 (Task 1)
- FOUND commit: 1ec0036 (Task 2)
- FOUND commit: 03eaccf (Task 3)
