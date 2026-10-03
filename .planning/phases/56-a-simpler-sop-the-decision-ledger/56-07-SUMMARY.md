---
phase: 56-a-simpler-sop-the-decision-ledger
plan: 07
subsystem: sop-conversion
tags: [converter, supabase, production-apply, idempotent]
requires: [56-02, 56-04]
provides:
  - "scripts/convert-sops-to-steps.ts --apply (upsert by section_id+source_key, upsert-before-delete, per-SOP run log, hash no-op)"
  - "Every production SOP converted into sop_focus_steps (810 rows) with an ok run row each"
affects: [56-09, 56-10]
tech-stack:
  added: []
  patterns: ["upsert before delete so a failure leaves a superset", "hash+converter_version no-op on re-run", "gate checked per SOP before any write"]
key-files:
  created:
    - tests/phase56/convert-apply.spec.ts
    - .planning/phases/56-a-simpler-sop-the-decision-ledger/56-CONVERSION-APPLY.md
  modified:
    - scripts/convert-sops-to-steps.ts
key-decisions:
  - "Upserts omit the existing id and rely on onConflict section_id,source_key, so existing rows keep their id (attachments survive) and batches never mix id/no-id rows"
  - "A gate-failing SOP inserts an ok=false run row on every run and never writes steps (re-evaluated each run)"
requirements-completed: [SOP-01]
duration: ~35 min
completed: 2026-10-04
---

# Phase 56 Plan 07: Production conversion Summary

`--apply` for the converter runner, proven in a throwaway org (6/6 live tests), then run against production: 70 of 70 SOPs converted with 0 failures, and a re-run changed nothing.

## Precondition result

56-02-SUMMARY.md reads `Needs Simon: none`; the reviewed dry run had 70 ok / 0 failing; a fresh dry run before applying matched (70 / 70 ok / 0 failing). No `accept unconverted` rows exist.

## Production run ids and totals

| Step | Run id | Result |
|---|---|---|
| Eval-site org (`b5b39f18...`) | b2097aa9-33d2-4cab-b265-dd65a4a1a546 | 4 converted / 0 unchanged / 0 failed |
| `--apply --all` | 91bb2768-ac0f-44d3-9985-c3523101eb70 | 66 converted / 4 unchanged / 0 failed |
| `--apply --all` re-run | d65adabe-5c15-4996-96ac-043cf4229864 | 0 converted / 70 unchanged / 0 failed |

**70 production SOPs converted (4 in the eval-site run, 66 in the `--all` run), 0 failed, 0 unconverted.** Exit code 0 on every run. No SOP failed mid-run, so no repair was needed.

Totals (from 56-CONVERSION-APPLY.md): hazard sources 288 -> 293 hazard steps; PPE cards 17 -> 19 PPE steps, items 111/111; 497 steps, 1 check, 95 photo-required; images matched 194/194. 810 `sop_focus_steps` rows (293 + 19 + 497 + 1), 70 `sop_conversion_runs` rows, all ok. Per-SOP before/after table: `56-CONVERSION-APPLY.md`.

Of the 70 SOPs, 24 have hazard/PPE content or steps; 46 are empty (probe, fixture and empty-upload SOPs) and got an ok run row with zero steps.

## Sanity numbers (service key, before eval-site apply vs after second all-run)

| Count | Before | After |
|---|---|---|
| `sop_steps` rows | 415 | 415 |
| non-null `sop_sections.layout_data` | 164 | 164 |
| `sop_sections` rows | 213 | 213 |
| `sops` | 70 | 70 |

Nothing the old SOP page and builder read was changed.

Library-linked content (D-13): 46 `sop_section_blocks` junctions point at non-`parsed_inline` blocks, across 30 SOPs (all Phase 46 probe SOPs). Every one of those 30 SOPs has an ok run row. Production's real SOPs use only parsed-inline blocks.

## Eval-site known answer

Convert fixture SOP (`92f826fe`): hazard 4, ppe 1 (both items, "Safety glasses / Cut-resistant gloves"), step 2 (the photo one `photo_required`), check 1. The Warning ("Stored energy") sorts before "Isolate the press." and the Caution before the photo step.

## Throwaway-org proof (tests/phase56/convert-apply.spec.ts, PHASE56_LIVE=1)

6 of 6 pass: convert (hazard before its step, tip folded, measurement is a check); re-run no-op (focus rows byte-identical, run row count 1); layout edit updates the same row id and a step-level standard attachment survives; removing an item deletes only that row; `sop_sections` and `sop_steps` rows equal the snapshot throughout; gate-failing SOP exits non-zero, writes no focus steps, and records an ok=false run row with a failure sentence; `--apply` without scope exits 2. Throwaway org and user deleted (no leftovers). Without the env var the spec is skipped (phase56 project: 70 passed, 20 skipped).

## Deviations from Plan

None - plan executed as written. The runner file contains no write to `sop_sections` or `sop_steps` (grep count 0); `onConflict: 'section_id,source_key'` appears once.

## Commits

- `567550f` feat(56-07): runner --apply path and live apply spec
- `197baa9` feat(56-07): convert production SOPs to focus steps, apply report

## Known Stubs

None.

## Self-Check: PASSED
