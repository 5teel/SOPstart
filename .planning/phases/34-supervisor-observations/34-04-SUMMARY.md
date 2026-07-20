---
phase: 34-supervisor-observations
plan: 04
subsystem: backend
tags: [server-actions, supabase, rls, zod]

requires:
  - phase: 34-supervisor-observations (34-02)
    provides: "RecordObservationSchema (src/lib/validators/observations.ts)"
  - phase: 34-supervisor-observations (34-03)
    provides: "Live sop_observations table + organisations.observation_labels column, hardened by migrations 00052/00053"
provides:
  - "src/actions/observations.ts — recordObservation, listObservationsForWorker, listObservationsForPerson, listWorkerSopsForPicker, getObservationLabels, setObservationLabels"
affects: [34-05, 34-06, 34-07, 34-08, 34-09]

tech-stack:
  added: []
  patterns:
    - "Inline supervisor|admin|safety_manager role-array check (not requireAdminContext(), which excludes supervisor) — mirrors completions.ts::signOffCompletion / escalation.ts::authOrg()"
    - "Session-client-only write for an RLS-gated table (D-12) — recordObservation never touches createAdminClient; org-scope + role-scope + FK-ownership are all enforced by RLS (migrations 00052/00053), not app code"
    - "Admin-client write with explicit self-enforced .eq('id', organisationId) for a table with no authenticated UPDATE policy (organisations) — CLAUDE.md 2026-06-15 pattern"
    - "Observer/worker display-name resolution via admin.auth.admin.listUsers email map (no user_profiles table) — mirrors org-model.ts::listOrgTree"

key-files:
  created:
    - src/actions/observations.ts
  modified:
    - tests/phase34/record-observation.spec.ts

key-decisions:
  - "Scoped the 'no createAdminClient' source-contract assertion in record-observation.spec.ts to the recordObservation function body specifically, not the whole file — the D-12 guarantee (RLS is the safety mechanism, no service-role write path) is about the observation INSERT, not about setObservationLabels (which legitimately needs admin client since organisations has no authenticated UPDATE policy) or observer-name resolution (which legitimately needs admin.auth.admin.listUsers). The whole-file ban as originally written by the Wave-0 stub was stricter than the plan's own instructions, which explicitly call for createAdminClient in setObservationLabels."
  - "listWorkerSopsForPicker's 'code' field maps to sops.sop_number (the existing column) — no new document-code column exists yet (that's Phase 38 DOC-01/02 scope)"

requirements-completed: [OBS-01, OBS-03]

duration: ~25min
completed: 2026-07-20
---

# Phase 34 Plan 04: recordObservation + Read Actions Summary

**Shipped `src/actions/observations.ts` — the write action plus the three read paths (worker self, org person panel, SOP picker) and D-02 org-label config — flipping the OBS-01 and OBS-03 runtime stubs live against the migration 00052/00053-hardened table.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-20
- **Tasks:** 2 completed
- **Files modified:** 2 (1 new action file, 1 spec file adjusted)

## Accomplishments

- `recordObservation` inserts into `sop_observations` using the session client only (no `createAdminClient` in that function) — role-gated to supervisor/admin/safety_manager, server-resolves `sop_version` from `sops.version` immediately before insert (D-10), and relies on the live RLS policies from 34-03 (including the 00053 cross-org FK-ownership guard) as the actual safety mechanism.
- `getObservationLabels`/`setObservationLabels` implement the D-02 per-org renamable verdict labels: reads use the session client (organisations has a `SELECT` RLS policy for org members); writes use the admin client with an explicit `.eq('id', organisationId)` self-scope since `organisations` has no authenticated `UPDATE` policy — `organisationId` is always session-derived, never accepted from client input.
- `listObservationsForWorker` (self-scoped, feeds the worker profile / OBS-02), `listObservationsForPerson` (org-scoped, gated to the three recorder roles, feeds the person panel), and `listWorkerSopsForPicker` (org's published SOPs sorted assigned-first per D-06, sourced from the existing `sop_assignments` table — no new required-SOPs data source) round out the read surface every later plan in this phase will call.
- `record-observation.spec.ts` and `sop-version-stamp.spec.ts` both flip from green-when-absent stubs to real, passing source-contract assertions against the live file.

## Task Commits

1. **Task 1: recordObservation + org-label read/write** — `5b0618e`
2. **Task 2: Read actions (listObservationsForWorker/ForPerson/listWorkerSopsForPicker)** — `03d9fb7`

## Files Created/Modified

- `src/actions/observations.ts` — all 6 exports: `recordObservation`, `getObservationLabels`, `setObservationLabels`, `listObservationsForWorker`, `listObservationsForPerson`, `listWorkerSopsForPicker`
- `tests/phase34/record-observation.spec.ts` — the "never createAdminClient" assertion re-scoped to `recordObservation`'s function body (see Decisions)

## Decisions Made

- See `key-decisions` in frontmatter.
- Used `(supabase as any)` / `(admin as any)` casts for `sop_observations` and `organisations.observation_labels` reads/writes, matching the existing `departments.ts` / `org-model.ts` / `approvals.ts` precedent for tables not yet in the generated `database.types.ts`.
- Formatted the `sops.select('version')` call as a single-line chain (`.from('sops').select('version').eq('id', sopId).single()`) to match the literal string the sop-version-stamp source-contract test asserts on, following the finalized body already validated in 34-PATTERNS.md/34-RESEARCH.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Wave-0 stub test asserted a whole-file ban on `createAdminClient(` that contradicted the plan's own instructions**
- **Found during:** Task 1, first verification run.
- **Issue:** `record-observation.spec.ts`'s "write uses the session client" test checked `expect(src).not.toContain('createAdminClient(')` against the entire file. The plan's Task 1 `<action>` explicitly instructs using `createAdminClient()` inside `setObservationLabels` (because `organisations` has no authenticated `UPDATE` policy) — a legitimate, different code path from the observation insert the D-12 guarantee actually targets.
- **Fix:** Re-scoped the assertion to extract just the `recordObservation` function body (from its `export async function recordObservation` declaration to the next top-level export) and check that substring only. This preserves the real security guarantee (the observation write itself never reaches for the admin client) while allowing the plan-mandated admin-client usage elsewhere in the same file.
- **Files modified:** `tests/phase34/record-observation.spec.ts`
- **Commit:** `5b0618e`

---

**Total deviations:** 1 auto-fixed (Rule 1 — stale/overly-broad test assertion)
**Impact on plan:** No scope change; the underlying threat-model guarantee (T-34-04-05) is unchanged and still enforced — only the test's matching scope was corrected to match what the plan actually specifies.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None — no external service configuration required. `.env` credentials already present for the live-DB source-contract tests (which don't hit the network; only the runtime `test.fixme` specs owned by later plans do).

## Next Phase Readiness

- `npx tsc --noEmit` clean.
- `npx playwright test --project=phase34` — 14 passed, 5 correctly skipped (owned by later plans: 34-05..09 runtime UAT + 34-08's profile-section wiring).
- All 6 exports from `src/actions/observations.ts` are available for 34-05 (RecordObservationModal), 34-06 (PersonPanel), 34-07 (activity row action), 34-08 (worker profile "Observations about you"), and 34-09 (org-label admin settings UI).
- No blockers for downstream plans.

---
*Phase: 34-supervisor-observations*
*Completed: 2026-07-20*

## Self-Check: PASSED

- FOUND: src/actions/observations.ts
- FOUND: .planning/phases/34-supervisor-observations/34-04-SUMMARY.md
- FOUND commit: 5b0618e
- FOUND commit: 03d9fb7
