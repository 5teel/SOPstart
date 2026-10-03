---
phase: 56-a-simpler-sop-the-decision-ledger
plan: 04
subsystem: database
tags: [migration, live-apply, rls, append-only-ledger, probe]
requires: [56-03]
provides:
  - scripts/apply-phase56-migration.mjs (apply + assertions + probe + cache reload; --assert-only)
  - scripts/probe-decisions-immutable.mjs (owner + service_role refusal against a real decision row)
  - tests/phase56/schema-runtime.spec.ts (live matrix, PHASE56_LIVE=1)
  - Migrations 00069 and 00070 LIVE on production
affects: [56-05, 56-06, 56-07, 56-08, 56-09, 56-10]
key-files:
  created:
    - scripts/apply-phase56-migration.mjs
    - scripts/probe-decisions-immutable.mjs
    - tests/phase56/schema-runtime.spec.ts
  modified:
    - tests/phase56/schema-shape.spec.ts
key-decisions:
  - "The probe always ends in a raise (PROBE_OK / PROBE_FAIL) so it rolls back and cannot change a row even if a trigger were missing; the report travels in the exception message"
  - "Applier gained --assert-only so a live migration is never re-applied just to re-run the assertions"
requirements-completed: [SOP-02, SOP-03, DEC-01, DEC-03, DEC-04]
duration: 25min
completed: 2026-10-04
---

# Phase 56 Plan 04: Live Apply of 00069 and 00070 Summary

**Migrations 00069 and 00070 are live on production (project gknxhqinzjvuupccyojv), applied in order via the Management-API fallback; the database has refused UPDATE, DELETE and TRUNCATE on an existing decision for the owner and service_role, and the five-test live runtime matrix passed on its first run.**

## What is live in production

- **00069:** `sops.placement` (NOT NULL, default `site`, `sops_placement_check`), `sync_sop_placement()` (invoker, not elevated) + trigger `sop_machines_sync_placement` (AFTER INSERT OR DELETE, row, enabled), tables `sop_focus_steps`, `sop_conversion_runs`, `standards`, `standard_attachments` (RLS on; 1 / 1 / 2 / 3 policies), six-name seed (39 of 39 organisations have >= 6 standards).
- **00070:** table `decisions` (RLS on, 1 SELECT policy), `decisions_refuse_change()` (not elevated), triggers `decisions_no_update_delete` and `decisions_no_truncate` (both `tgenabled = 'A'`), privilege revokes, RPC lockdown, seven-source backfill (5 rows).
- PostgREST schema cache reloaded (`NOTIFY pgrst, 'reload schema'`).
- Migration history: `supabase db push` refused to run (it tried 00068 first; 00068's policy is already live from an earlier out-of-band apply and is not idempotent, so it failed with 42710 and applied nothing). The applier fell back to the Management API for 00069 then 00070. Neither file is recorded in `supabase_migrations.schema_migrations` (it still stops at 00067, as it did for 00068). Do NOT run a bare `supabase db push` later without first repairing history (`supabase migration repair --status applied 00068 00069 00070`), or it will fail on 00068 again. Not done here: it is a history-table decision outside this plan.

## Applier output (post-apply assertions; 46 PASS, 0 FAIL, exit 0)

First full run (apply + assertions); the run after it used `--assert-only` and printed the identical assertions plus the probe, cache reload and summary (the first run's tail was cut by a `head` pipe I attached, not by the script). Key lines:

```
supabase db push failed ... ERROR: policy "blocks_read_own_org" for table "blocks" already exists (SQLSTATE 42710)
  Applying 00069_sop_kinds_placement_standards.sql via Management API ...
  Applying 00070_decisions_ledger.sql via Management API ...
Management API raw-SQL apply: SUCCESS (all MIGRATION_FILES, in order)

PASS  5 tables exist with RLS enabled; policy counts 1 / 1 / 2 / 3 / 1
PASS  8 policies pinned (cmd, role = authenticated only, org predicate, role predicate, WITH CHECK clauses; standards write WITH CHECK identical to USING; attach INSERT check names sops/sop_sections/sop_focus_steps and all three target columns)
PASS  sops.placement nullable=NO default='site' check=CHECK ((placement = ANY (ARRAY['machine','site'])))
PASS  count(placement='machine') = count(distinct sop_id) from sop_machines: machine=17 linked=17 wrong_site=0
PASS  trigger sop_machines_sync_placement tgenabled=O tgtype=13 prosecdef=false
PASS  every organisation has >= 6 standards: orgs=39 seeded=39
PASS  standard_attachments: num_nonnulls check, composite FK to standards (cascade), 3 per-level cascades
PASS  decisions triggers: decisions_no_truncate tgenabled=A tgtype=34; decisions_no_update_delete tgenabled=A tgtype=27
PASS  decisions_refuse_change prosecdef=false, raises append-only
PASS  CHECKs decisions_agent_named (btrim + actor_name) and decisions_person_has_id (backfill arm) present
PASS  only FK on decisions is supersedes_decision_id, confdeltype = 'a'
PASS  service_role UPDATE/DELETE/TRUNCATE = false, INSERT/SELECT = true
PASS  authenticated INSERT/UPDATE/DELETE/TRUNCATE = false; anon SELECT/INSERT = false
PASS  EXECUTE on accept_block_update / decline_block_update false for authenticated and anon
```

### Backfill table

| source | eligible | backfilled |
|---|---|---|
| sop_approvals | 0 | 0 |
| sop_completion_signatures | 1 | 1 |
| sop_observations | 0 | 0 |
| sop_review_events | 0 | 0 |
| sop_block_update_decisions | 0 | 0 |
| completion_sign_offs | 1 | 1 |
| sop_assignments (self-adds excluded) | 3 | 3 |

Ledger total after apply: 5 (live = 0). After the live runtime spec: 7 (two `probe` rows, see below).

### Immutability probe (path: Management API `set local role service_role` worked; no supabase-js fallback needed)

Run inside the applier and again standalone (`node scripts/probe-decisions-immutable.mjs`, exit 0):

```
probing decision e4d9b4e3-4efd-49e9-8ef3-ffba35e3f7c8
owner UPDATE: decisions is append-only: UPDATE refused - record a new decision that supersedes it
owner DELETE: decisions is append-only: DELETE refused - record a new decision that supersedes it
owner TRUNCATE: decisions is append-only: TRUNCATE refused - record a new decision that supersedes it
service_role UPDATE: permission denied for table decisions
service_role DELETE: permission denied for table decisions
service_role TRUNCATE: permission denied for table decisions
row unchanged after the attempts
probe: OK
```

The owner refusals come from the trigger (message contains `append-only`); the service_role refusals come from the revoked privileges (the trigger is the second layer, proven by the owner half).

## Live runtime spec (PHASE56_LIVE=1, run once, 5 passed in 5.4s)

```
1. placement follows sop_machines: admin insert/delete, machine cascade, SOP delete   PASS
2. standards scoping, attachments and cascades                                        PASS
3. focus steps: same-org read, cross-org invisible                                    PASS
4. ledger: read scope, no session insert, append-only, agent name CHECK               PASS
5. orphan block-update RPC is not callable by an admin session                        PASS
```

- Without the env var: 5 skipped. `grep -c "mintAccessToken("` = 3 (definition + 2 beforeAll calls): two OTP spends total, no rate-limit hit.
- The A2 question is settled: deleting a SOP that still has a machine link succeeds, and a machine delete flips placement back to `site`.
- Cleanup verified live: 0 `Phase56 %` organisations left. Two ledger rows with summary `probe` remain by design (append-only; the person row and the named-agent row; their organisation no longer exists since `decisions` carries no foreign keys).
- Full quick `phase56` project: 44 passed, 23 skipped.

## Task commits

1. Task 1 (applier, probe, shape-spec order tests): `a8e62cf`
2. Task 2 (live runtime spec): `0aad465`

## Deviations from Plan

**1. [Rule 3 - Blocking] Added `--assert-only` to the applier.** My first applier run had its output piped through `head`, which closed the pipe before the probe and NOTIFY steps could print. Re-running the applier would have re-applied two already-live migrations (idempotent, but the plan forbids it), so I added a flag that skips step 1 and re-runs the assertions, probe and cache reload. That run exited 0 with 46 PASS. Commit `a8e62cf`.

**2. [Rule 2 - Missing critical] Probe returns its report via a deliberate final raise** rather than a notice (the Management API returns no notices), which also makes the probe rollback-only. Probe also attempts service_role TRUNCATE, which the plan did not list.

**3. The plan's step 4 said "db push, then fallback":** db push does not work on this project right now (history drift, see above); the fallback is the path that ran.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or schema beyond what 56-03 declared.

## Self-Check: PASSED

- scripts/apply-phase56-migration.mjs, scripts/probe-decisions-immutable.mjs, tests/phase56/schema-runtime.spec.ts: present.
- Commits a8e62cf and 0aad465 present on master.
- 00069 and 00070 verified live by the assertions above (tables, triggers, privileges, counts).
