---
phase: 58-the-sop-focus-screen-walk-edit
plan: 03
subsystem: database
tags: [supabase, rls, migration, triggers, capability-matrix, eval-fixtures]
requires: [58-01]
provides:
  - "migration 00071 live: sop_walks, sop_ai_findings, step tick + clear_focus_step_tick trigger, sops.objective, sops.allow_forward_jump"
  - "scripts/apply-phase58-migration.mjs (Management-API assertions, PGRST205-aware)"
  - "typed sop_walks / sop_ai_findings / new sops and sop_focus_steps columns"
  - "eight Phase 58 capability-matrix rows + live spec"
  - "ten EVAL focus fixtures in the eval-site org"
affects: [58-04, 58-05, 58-06, 58-08, 58-09, 58-11, 58-12, 58-13]
key-files:
  created:
    - supabase/migrations/00071_focus_editor_walk.sql
    - scripts/apply-phase58-migration.mjs
    - tests/phase58/focus-rls-live.spec.ts
  modified:
    - src/types/database.types.ts
    - .planning/codebase/CAPABILITY-MATRIX.md
    - tests/phase58/capability-matrix.spec.ts
    - scripts/eval-fixtures.mjs
key-decisions:
  - "sop_walks insert/update WITH CHECK also requires the SOP to be in the caller's org, so a walk cannot point at a foreign SOP (beyond the plan's org + worker_id pair)"
  - "Trigger keeps an already-raised needs_recheck on a second edit (old.verified_by_admin_id is not null OR old.needs_recheck) and lowers it when an update sets the tick; the plan's formula would have lost the flag on a second edit"
  - "sop_ai_findings.kind left unconstrained (severity only is checked against the reviewer's critical/warning); plan 58-06 may emit step-level kinds"
  - "Live spec uses throwaway organisations (Phase 56 idiom), not the eval-site org, so nothing shared is touched"
requirements-completed: []
completed: 2026-10-05
---

# Phase 58 Plan 03: Schema for walks, findings and the step tick Summary

**Migration 00071 is live: in-progress walks, AI findings, a self-clearing step tick, the objective and the forward-jump flag, all asserted through the Management API, typed, probed with a live RLS spec, with the capability matrix and eval fixtures in place.**

Requirement ids FOC-02, FOC-04, WRK-04, SOP-04 are only enabled by this schema (no action or UI uses it yet), so they are not ticked.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | `a868b205` | 00071, applier, live RLS spec |
| 2 | `5717ebe5` | applied live, types extended |
| 3 | `00d316fc` | matrix rows, capability spec, eval fixtures |

## Migration history

`npx supabase migration list` before the push: 00001..00070 matched local and remote, `00071` local only. History was clean, so no repair was needed. Applied via `supabase db push` (not the fallback).

## Applier output (all PASS, run on apply; `--assert-only` re-run printed 0 FAIL lines)

```
PASS  public.sop_walks exists with RLS enabled            reg=sop_walks rls=true
PASS  public.sop_ai_findings exists with RLS enabled      reg=sop_ai_findings rls=true
PASS  five new columns exist                              found 5
PASS  run_id nullable; allow_forward_jump NOT NULL default false; objective check <= 500
PASS  trigger clear_focus_step_tick: enabled, BEFORE UPDATE row, not elevated-privilege (tgtype=19)
PASS  sop_walks carries exactly 3 policies                INSERT,SELECT,UPDATE
PASS  every sop_walks policy: authenticated only, org + auth.uid() in qual and with_check, sop in org
PASS  sop_ai_findings select policy is org-scoped, admin/safety_manager only
PASS  no non-SELECT policy on sop_focus_steps or sop_ai_findings
PASS  NOTIFY pgrst reload schema issued
=== ALL POST-APPLY ASSERTIONS PASSED ===
```

## Verification

- `npx tsc --noEmit`: clean after the type edits.
- `PHASE58_LIVE=1 npx playwright test --project=phase58 focus-rls-live`: 8/8 passed, run once (peer-worker and foreign-org reads, forged insert, foreign-SOP walk, one in_progress per worker, finding visibility, no authenticated write to `sop_focus_steps` / `sop_ai_findings`, tick cleared on text edit, tick kept on reorder, recheck lowered on re-tick).
- `phase15-stubs rls-org-scope` 3/3, `phase46 capability-matrix-doc` 9/9, `phase58 capability-matrix` 10/10.
- Fixture run: all ten `EVAL focus` names present (jump, draft, ready, blank, lineage v2/v3/v4, publish, parsing, parsing video, parse failed); a second run printed no created/reset lines and 17 of 19 eval steps ticked with 0 needing recheck, unchanged.

## Deviations from Plan

**1. [Rule 2 - security] Walk WITH CHECK also pins the SOP to the caller's org.** Insert and update checks include an `exists` on `sops` scoped to `current_organisation_id()`. Without it a worker could point their own walk at a SOP id from another organisation.

**2. [Rule 1 - bug in plan formula] Trigger recheck flag.** The plan set `needs_recheck = (old.verified_by_admin_id is not null)`. A second edit of an already-unticked, already-flagged step would then drop the flag. The trigger uses `old.verified_by_admin_id is not null or old.needs_recheck`, and an update that sets the tick lowers it (live spec test 7).

**3. [Rule 3 - types] Hand-extended types, not a regenerated file.** `database.types.ts` is hand-maintained (2440 lines against a 3553-line `supabase gen types` output, as in 56-03). The `sop_focus_steps`, `sop_ai_findings`, `sop_walks` blocks and the two new `sops` columns were spliced in from the real generated output; `kind` keeps its `'hazard' | 'ppe' | 'step' | 'check'` union. tsc is clean.

**3b. Live spec throwaway orgs.** The plan said a throwaway SOP in the eval-site org; the spec follows the Phase 56 idiom (throwaway organisations, deleted afterwards) so the shared eval org is never touched.

**4. Applier reads both `.env.local` and `.env`.** Cosmetic; `.env.local` is the one that holds the keys.

## Known Stubs

None. `sop_walks` and `sop_ai_findings` are empty in production until plans 58-06 and 58-09 write them.

## Threat Flags

None beyond the plan's threat model; each mitigation (T-58-walk, T-58-gate, T-58-step-write, T-58-03, T-58-04) is asserted by the applier or the live spec.

## Self-Check: PASSED

- Files present: 00071 migration, applier, live spec, extended types, matrix, capability spec, fixtures
- Commits `a868b205`, `5717ebe5`, `00d316fc` exist
- Migration verified live through the Management API
