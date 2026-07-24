---
phase: 35-competency-classifier-training-matrix-records
plan: 02
subsystem: auth
tags: [server-actions, rls, zod, supabase, playwright, competency]

requires:
  - phase: 35-01
    provides: classifyCompetency, buildMatrix, generateTrainingCsv (src/lib/competency/*)
provides:
  - "getTrainingMatrix / getTrainingRecordForPerson / getMyCompetencyStates / exportTrainingCsv server actions (src/actions/competency.ts)"
  - "MatrixFiltersSchema / CsvExportFiltersSchema Zod validators (src/lib/validators/competency.ts)"
  - "StatePill sketch-05 pill primitive (src/components/admin/competency/StatePill.tsx)"
  - "auth/org-scope source-contract + staged runtime RLS probe (tests/phase35/competency-actions.spec.ts, competency-rls-probe.spec.ts)"
affects: [35-03, 35-04, matrix UI, PersonPanel training record, worker profile competency section]

tech-stack:
  added: []
  patterns:
    - "RECORDER_ROLES-gated admin-client reads with self-enforced organisation_id (mirrors observations.ts/grants.ts)"
    - "callerOrgId() re-derivation via organisation_members — never trust the session organisationId as the sole org-scope source for an admin-client write/read path"
    - "Self-scoped worker read (getMyCompetencyStates) — session client only, no role gate, no admin client"
    - "Per-function source-contract slicing (extractFunction) to pin auth posture per function, not whole-file"

key-files:
  created:
    - src/lib/validators/competency.ts
    - src/components/admin/competency/StatePill.tsx
    - src/actions/competency.ts
    - tests/phase35/state-pill.spec.ts
    - tests/phase35/competency-actions.spec.ts
    - tests/phase35/competency-rls-probe.spec.ts
  modified:
    - src/styles/blueprint-theme.css

decisions:
  - "StatePill inline-styles the accent color via a declared CSS custom property name (var(--accent-x)) rather than a fixed set of Tailwind classes — keeps the 4-state + needs-support mapping in one small component without a new per-state CSS class"
  - "Only one new CSS class added (.state-pill-support for the amber 'Needs support' chip) — the D-07 compact colored-cell matrix variant is deferred to the Wave-3 matrix table plan that actually renders it (YAGNI; StatePill itself needs no compact variant)"
  - "callerOrgId() included in src/actions/competency.ts as a small local helper re-deriving org via organisation_members (mirrors grants.ts) even though getSessionContext's organisationId is already DB-derived — defense-in-depth per the plan's explicit instruction and existing precedent"
  - "getTrainingMatrix/getTrainingRecordForPerson/exportTrainingCsv all read sop_access_people via admin.from(...), never the session client — confirmed via migration 00046 that the self-read policy's admin/safety_manager branch excludes 'supervisor'"

requirements-completed: [CMP-01, MTX-02, MTX-03, TRN-01, TRN-02, CMP-04]

duration: ~50min
completed: 2026-07-24
---

# Phase 35 Plan 02: Server-side competency data layer + StatePill Summary

Built the four role-gated server actions (matrix, per-worker record, self-scoped worker states, CSV export) that expose Phase 35's competency data, the Zod filter validators they consume, and the sketch-05 `StatePill` primitive — plus a source-contract test suite that mechanically pins the auth/org-scope posture per function (RECORDER_ROLES gate, admin-client self-enforced org-scope, `sop_access_people` read via the admin client) closing the recurring role-check-missing / cross-org / supervisor-empty bug classes before any UI ships.

## Performance

- **Duration:** ~50 min
- **Tasks:** 3
- **Files modified:** 5 created + 1 modified (src/styles/blueprint-theme.css)

## Accomplishments
- `src/actions/competency.ts`: `getTrainingMatrix`, `getTrainingRecordForPerson`, `exportTrainingCsv` — all RECORDER_ROLES-gated (`supervisor`/`admin`/`safety_manager`), admin-client + self-enforced `organisation_id`, department/person ownership verified before any read, `sop_access_people` read via the admin client (confirmed against migration 00046 that its self-read policy's admin branch excludes `supervisor` — the Phase 34-10 dead-feature class)
- `getMyCompetencyStates` — self-scoped to `auth.uid()`, session client only, no admin client, no role gate (D-04)
- `src/lib/validators/competency.ts` — `MatrixFiltersSchema` (required `departmentId`, optional `workerId`/`sopId`) and `CsvExportFiltersSchema` (all-optional incl. `dateFrom`/`dateTo`)
- `src/components/admin/competency/StatePill.tsx` — renders the sketch-05 pill vocabulary (Signed off / Observed ✓ / Awaiting sign-off / Read only / Not started) + a coaching-toned "Needs support" chip, purely informational (no `onClick`/`disabled`)
- `tests/phase35/competency-actions.spec.ts` — 18 source-contract assertions, per-function scoped (not whole-file grep)
- `tests/phase35/competency-rls-probe.spec.ts` — 4 `test.fixme` runtime probes (supervisor same-org allowed, worker denied, admin cross-org denied, worker self-only) staged for live sopstart.com UAT

## Task Commits

1. **Task 1: Zod filter validators + StatePill primitive + declared CSS tokens** - `ced36c6` (feat)
2. **Task 2: src/actions/competency.ts — matrix / record / self / CSV server actions** - `5b596b4` (feat)
3. **Task 3: auth/org-scope source-contract + per-role runtime RLS probe** - `6896487` (test)

## Files Created/Modified
- `src/lib/validators/competency.ts` - `MatrixFiltersSchema` / `CsvExportFiltersSchema`
- `src/components/admin/competency/StatePill.tsx` - sketch-05 pill vocabulary, informational-only
- `src/styles/blueprint-theme.css` - added `.state-pill-support` amber chip class
- `src/actions/competency.ts` - four server actions orchestrating the Wave-1 pure functions
- `tests/phase35/state-pill.spec.ts` - pill label + declared-token + no-gate source-contract + real Zod parse tests
- `tests/phase35/competency-actions.spec.ts` - per-function auth/org-scope source-contract (18 tests)
- `tests/phase35/competency-rls-probe.spec.ts` - staged runtime RLS probe matrix (4 fixme cases)

## Decisions Made
- Deferred the D-07 compact colored-cell matrix variant CSS to the Wave-3 plan that builds the actual matrix table — StatePill itself only needed the "Needs support" chip class this plan (YAGNI; avoids unused CSS)
- Kept `CompetencyState` at exactly four members (already locked in 35-01); `awaitingSignOff` presentation boolean drives the "Awaiting sign-off" pill without a 5th canonical state
- Added a local `callerOrgId()` helper (mirrors `grants.ts`) even though `getSessionContext().organisationId` is already DB-derived, per the plan's explicit "never the JWT claim alone" instruction and existing repo precedent

## Deviations from Plan

None - plan executed as written. All acceptance criteria met on first implementation pass (fixed two test-authoring bugs in my own `state-pill.spec.ts` during self-verification — see below, not deviations from the plan's *implementation* files).

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test-authoring bugs in state-pill.spec.ts's own assertions (not the plan's implementation files)**
- **Found during:** Task 1 verification (`npx playwright test --project=phase35 tests/phase35/state-pill.spec.ts` — 2/6 failing)
- **Issue:** (a) The "every var(--x) declared" test grepped for the literal pattern `var(--x` but `StatePill.tsx` sets the accent via a JS template literal (`var(${accentVar})`), which never contains a literal `--` after `var(` — the regex matched zero references and the `toBeGreaterThan(0)` assertion failed. (b) The "no onClick" test used a bare `/onClick/` regex, which matched the doc comment's own prose ("No onClick, no disabled/lock affordance...") rather than an actual JSX handler.
- **Fix:** (a) Changed the token-reference regex to match the quoted string literals StatePill actually assigns (`'--accent-signoff'` etc.) instead of a literal `var(--` prefix. (b) Tightened both assertions to require the JSX-attribute form (`onClick=`, `disabled=`) so a documentation mention doesn't false-positive.
- **Files modified:** tests/phase35/state-pill.spec.ts
- **Commit:** ced36c6 (part of Task 1 commit — fixed before commit, not a follow-up)

No other deviations — src/actions/competency.ts, src/lib/validators/competency.ts, StatePill.tsx, and the source-contract/RLS-probe test files matched the plan's design exactly.

---

**Total deviations:** 1 auto-fixed (test-authoring bug in a spec I wrote in the same task, caught by my own first verification run)
**Impact on plan:** None on shipped implementation code — only my own test assertions needed correction before they accurately reflected the acceptance criteria. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness

- `src/actions/competency.ts`'s four exports are ready for Wave-3 consumption: `TrainingMatrixView` (matrix UI, third `TeamViewShell` mode) calls `getTrainingMatrix`; `PersonPanel`'s training-record growth point calls `getTrainingRecordForPerson`; the worker `/profile` `CompetencySection` (not yet created — lands in 35-04, already guarded by the `no-competency-gate.spec.ts` `fs.existsSync` skip from 35-01) calls `getMyCompetencyStates`; both matrix header and PersonPanel CSV buttons call the shared `exportTrainingCsv`.
- `StatePill` is ready to drop into any of those three surfaces unchanged.
- `tests/phase35/competency-rls-probe.spec.ts`'s four `test.fixme` cases are staged and need to be un-fixme'd (real Supabase env in `.env.local`) during sopstart.com UAT before the phase's final verification gate — this is the one explicitly-deferred verification item (Railway-only-testing convention), not a blocker for Wave-3 UI work.
- No blockers for 35-03/35-04.

---
*Phase: 35-competency-classifier-training-matrix-records*
*Completed: 2026-07-24*

## Self-Check: PASSED

- FOUND: src/lib/validators/competency.ts
- FOUND: src/components/admin/competency/StatePill.tsx
- FOUND: src/actions/competency.ts
- FOUND: tests/phase35/state-pill.spec.ts
- FOUND: tests/phase35/competency-actions.spec.ts
- FOUND: tests/phase35/competency-rls-probe.spec.ts
- FOUND commit ced36c6 (Task 1)
- FOUND commit 5b596b4 (Task 2)
- FOUND commit 6896487 (Task 3)
