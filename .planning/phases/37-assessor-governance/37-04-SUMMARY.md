---
phase: 37-assessor-governance
plan: 04
subsystem: activity
tags: [server-actions, playwright, assessor-governance, competency]

# Dependency graph
requires:
  - phase: 37-02
    provides: isSignedOffAssessor(personId, sopId, client, orgId) predicate
  - phase: 37-03
    provides: recordObservation gate pattern (branch-before-gate, admin-client predicate read, override-reason shape) mirrored onto signOffCompletion
provides:
  - signOffCompletion gated on decision === 'approved' only, role array widened to admit admin (D-06), is_assessor_override/override_reason stamped on the completion_sign_offs insert
  - Server-computed isAssessor/canOverride props on the completion detail page, feeding a blocked-teaching state + request-assessment CTA for plain supervisors and a progressive-disclosure override sheet for admin/safety_manager
  - tests/phase37/assessor-ui-signoff.spec.ts flipped from 4 test.fixme runtime stubs to 12 live source-contract assertions
affects: [37-05, 37-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The sign-off gate is the completions.ts twin of observations.ts's recordObservation gate — same branch-before-gate shape, same admin-client predicate-read rationale, same two bare error codes, so client code can share one mapSignOffError-style copy layer across both surfaces"
    - "Inline progressive-disclosure sheet (not a new component) when the nearest existing sheet component hardcodes its own title/copy — RejectReasonSheet's fixed 'Reject completion' title and copy meant the override reason UI was added inline in CompletionDetailClient rather than forking a near-duplicate sheet component"

key-files:
  created: []
  modified:
    - src/actions/completions.ts
    - src/app/(protected)/activity/[completionId]/page.tsx
    - src/app/(protected)/activity/[completionId]/CompletionDetailClient.tsx
    - tests/phase37/assessor-ui-signoff.spec.ts

key-decisions:
  - "Gate inserted between the org-scope guard and the supervisor_assignments check (not replacing either) — a supervisor who passes the assessor gate still needs the assignment; admin/safety_manager override skips both exactly as before"
  - "isSignedOffAssessor's server-side call in page.tsx runs inside the same Promise.all as the photo signed-URL loop and the sections query — no serial waterfall added to an already-multi-query page (CLAUDE.md 2026-07-13)"
  - "Override reason UI built inline in CompletionDetailClient rather than forking RejectReasonSheet into a near-duplicate component, per the plan's own guidance once RejectReasonSheet's hardcoded title/copy ruled out reuse"
  - "Client-side error mapping (mapSignOffError) treats the server's verdict as authoritative even when the client thought the action was permitted — covers the race where a needs_support reset lands between page render and the Approve click (T-37-04-01)"

patterns-established:
  - "assessor-ui-signoff.spec.ts scopes wiring assertions to a control's OWN disabled={...} expression (Reject) or a narrow window around a specific handler name (Approve/handleApproveClick) rather than a wide radius around a shared anchor — a wide radius bled from the Reject button's onClick into the adjacent Approve button's disabled prop in the same flex row on first pass, which is exactly the kind of scoping bug this idiom exists to avoid"

requirements-completed: [ASR-01]

# Metrics
duration: ~30min
completed: 2026-07-28
---

# Phase 37 Plan 04: Sign-Off Surface Assessor Gate + UI Summary

**`signOffCompletion` now gates approval on `isSignedOffAssessor` (rejection stays fully ungated), admits `admin` into the role array so the override path is reachable, and the sign-off bar shows a teaching/request-assessment state for blocked supervisors plus an audited override sheet for admin/safety_manager.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- `signOffCompletion`'s role array widened from `['supervisor', 'safety_manager']` to `['supervisor', 'safety_manager', 'admin']`, making the D-06 override path reachable on the sign-off surface for the first time
- The assessor gate runs only on `decision === 'approved'`, positioned after the org-scope guard and before the `supervisor_assignments` check — verified positionally (index comparisons), not just via presence
- `completion_sign_offs` insert stamps `is_assessor_override` / `override_reason` whenever an admin/safety_manager overrides without assessor status
- `page.tsx` widens `isSupervisor` to include `admin` and computes `isAssessor`/`canOverride` server-side, in parallel with the existing photo-URL and section-steps fetches
- `CompletionDetailClient.tsx`: a blocked plain supervisor sees the D-08 teaching copy plus a "Request assessment" CTA (Reject stays fully enabled); an admin/safety_manager without assessor status gets a progressive-disclosure override reason sheet before Approve commits; a real assessor's flow is byte-identical to before
- `tests/phase37/assessor-ui-signoff.spec.ts` flipped from 4 `test.fixme` stubs to 12 live source-contract assertions, including two positional (index-comparison) checks and a scoped-window wiring check proving the Approve control's blocked state is actually referenced by the button, not merely present elsewhere in the file
- `npx tsc --noEmit` clean and `npm run build` clean after every task; `npx playwright test --project=phase37` green (63 passed, 8 pre-existing skips); `npm run test` shows the same 37 pre-existing failures as before this plan (confirmed via `git stash` comparison — none touch files this plan modified)

## Task Commits

1. **Task 1: Gate signOffCompletion on the approved decision, widen the role array to include admin** - `80e524c` (feat)
2. **Task 2: Server-computed assessor props + blocked/override sign-off UI** - `c7e23a9` (feat)
3. **Task 3: Flip assessor-ui-signoff.spec.ts live** - `6a4e743` (test)

## Files Created/Modified
- `src/actions/completions.ts` - role array widened to admit `admin`; `isSignedOffAssessor` gate inserted branch-before-gate (only on `decision === 'approved'`), after the org-scope guard, before the supervisor_assignments check; `completion_sign_offs` insert stamps the two audit columns
- `src/app/(protected)/activity/[completionId]/page.tsx` - `isSupervisor` widened to include `admin`; `organisation_id` added to the completion select/interface; `isSignedOffAssessor` called once, server-side, inside the existing `Promise.all` alongside photo URLs and section steps; `isAssessor`/`canOverride`/`sopId` passed to the client component
- `src/app/(protected)/activity/[completionId]/CompletionDetailClient.tsx` - `blockedFromApproving` derived state; blocked-supervisor teaching copy + request-assessment CTA above the sign-off bar; inline progressive-disclosure override reason sheet for admin/safety_manager; `handleApprove` accepts an optional override reason; both new server error codes mapped to human copy via `mapSignOffError`
- `tests/phase37/assessor-ui-signoff.spec.ts` - rewritten from 4 `test.fixme` runtime/browser stubs to 12 live `fs.readFileSync` + `toContain`/positional-index source-contract assertions, including a scoped-disabled-prop check for the Reject control and a scoped-window wiring check for the Approve control

## Decisions Made
- Reused `RejectReasonSheet`'s visual idiom (backdrop, drag handle, textarea + char counter, primary/cancel buttons) inline in `CompletionDetailClient.tsx` for the override reason sheet rather than forking a new component file — `RejectReasonSheet` hardcodes its own title and body copy, so true reuse wasn't available and the plan explicitly preferred inline addition over a near-duplicate sheet component in that case
- `mapSignOffError` centralizes the two new bare error-code → human-copy mappings so both the direct-approve path and the override-sheet path show consistent language even when the server's verdict differs from what the client expected (T-37-04-01)

## Deviations from Plan

None — plan executed exactly as written. One correction made during Task 3: the first draft of the Reject-control wiring assertion used a 400-character radius window around `setRejectSheetOpen(true)`, which bled into the adjacent Approve button's `disabled=` expression in the same flex row and produced a false failure. Fixed by scoping the assertion to the Reject button's own `disabled={...}` expression specifically (matching the plan's acceptance-criteria wording: "assert by inspecting the reject button's own disabled prop, not the file globally") — not a Rule 1-4 deviation, a test-authoring correction caught by running the test itself.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required; no new migrations (this plan reuses migration 00056's columns, applied live in 37-03).

## Next Phase Readiness

- `isSignedOffAssessor` is now wired into both write paths named in ASR-01 (`recordObservation` in 37-03, `signOffCompletion` in this plan) with matching gate shape, error codes, and override semantics — 37-05 (record-modal UI) can follow the identical blocked/override pattern established here
- `requestAssessorReview` now has a second call site (the completion detail page, in addition to any 37-05 observation-modal usage) proving the D-08 request flow generalizes across surfaces
- No blockers

---
*Phase: 37-assessor-governance*
*Completed: 2026-07-28*

## Self-Check: PASSED

- FOUND: src/actions/completions.ts
- FOUND: src/app/(protected)/activity/[completionId]/page.tsx
- FOUND: src/app/(protected)/activity/[completionId]/CompletionDetailClient.tsx
- FOUND: tests/phase37/assessor-ui-signoff.spec.ts
- FOUND: .planning/phases/37-assessor-governance/37-04-SUMMARY.md
- FOUND commit: 80e524c (Task 1)
- FOUND commit: c7e23a9 (Task 2)
- FOUND commit: 6a4e743 (Task 3)
