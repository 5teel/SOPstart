---
phase: 33-per-sop-access-granularity-wayfinder-builder-header
plan: 03
subsystem: database
tags: [supabase, migration, access-grants, sop-target, live-push]
requires:
  - 33-02 (migration 00050 file + assert-phase33-sop-target-schema.ts gate script)
provides:
  - Live schema: access_grants.sop_id nullable arm + access_grants_exactly_one_target XOR CHECK
  - Live index swap: uq_access_grants_subject_target present, uq_access_grants_subject_collection dropped, idx_access_grants_sop present
  - Proven grant-row equivalence (10/10 pre-existing rows byte-identical, sop_id null)
affects:
  - 33-05+ grants.ts plans (can now be truthfully verified against the live schema)
tech-stack:
  added: []
  patterns:
    - --capture/--verify Management-API equivalence gate (Phase 32 32-03 idiom, reused verbatim)
key-files:
  created: []
  modified: []
key-decisions:
  - "Applied 00050 via npx supabase db push --linked (non-TTY, SUPABASE_ACCESS_TOKEN from .env.local)"
  - "No fix-forward edits needed to assert-phase33-sop-target-schema.ts — 33-02's script ran clean first try"
duration: ~5min (automation) + checkpoint wait
completed: 2026-07-19
---

# Phase 33 Plan 03: Live Push of Migration 00050 (SOP-Target Arm) Summary

**Migration 00050 applied to the live Supabase DB and proven: sop_id XOR arm + index swap live, all 10 pre-existing access_grants rows byte-identical.**

## What Was Done

### Task 1: Pre-flight capture (auto)
- Confirmed `SUPABASE_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` resolve from `.env.local`
- Ran `npx tsx scripts/assert-phase33-sop-target-schema.ts --capture` against the live DB (read-only)
- Snapshot: **10 access_grants rows** captured to the OS temp dir BEFORE any push
- No script bugs found — zero fix-forward edits, so no code commit for this task

### Task 2: Push 00050 + verify (checkpoint:human-verify, gate=blocking)
Ran automatically in strict order:
1. `npx supabase db push --linked` — applied `00050_access_grants_sop_target.sql` cleanly ("Finished supabase db push", no errors)
2. `npx tsx scripts/assert-phase33-sop-target-schema.ts --verify` — **all 8 checks PASSED on first attempt** (no PGRST205 retry needed):

| Check | Result |
|---|---|
| All 10 pre-existing access_grants rows byte-identical (sop_id null) | PASS |
| access_grants.sop_id column exists | PASS |
| access_grants.collection_id is nullable | PASS |
| access_grants_exactly_one_target CHECK exists | PASS |
| uq_access_grants_subject_target index exists | PASS |
| uq_access_grants_subject_collection dropped | PASS |
| idx_access_grants_sop index exists | PASS |
| SELECT on access_grants — no 42P17 RLS recursion | PASS |

**Checkpoint approved by user 2026-07-19** ("approved" — all 8 assertions accepted).

## Threat Register Outcomes

- T-33-03-01 (grant-row drift): mitigated — byte-equivalence PASS on every pre-existing row
- T-33-03-02 (PGRST205 false-negative): mitigated — Management API raw SQL used for all schema probes; retry path unexercised (first-attempt PASS)
- T-33-03-03 (duplicate-grant window): mitigated — old index proven ABSENT, new index proven PRESENT by name

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — this plan touched only the live DB schema; no UI/code surfaces.

## Verification

- `npx supabase db push` clean ✓
- `--verify` exit 0, 8/8 PASS against the live DB ✓
- No modifications to STATE.md or ROADMAP.md (orchestrator-owned) ✓
