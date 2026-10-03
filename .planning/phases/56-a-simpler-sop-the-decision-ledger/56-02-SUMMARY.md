---
phase: 56-a-simpler-sop-the-decision-ledger
plan: 02
subsystem: conversion
tags: [converter, layout_data, hazard-ppe-gate, dry-run, read-only]
requires: [56-01]
provides:
  - src/lib/sop/convert.ts (pure converter, per-SOP gate, re-run plan diff)
  - tests/phase56/convert.spec.ts (22 unit tests)
  - scripts/convert-sops-to-steps.ts (dry run only; --apply exits 2)
  - 56-CONVERSION-DRYRUN.md (all 70 production SOPs, before/after)
affects: [56-03, 56-07]
tech-stack:
  added: []
  patterns:
    - "Per-type readers that return an explicit unreadable result instead of null or a throw"
    - "Re-run diff keyed on (section_id, source_key): unchanged rows untouched, changed rows keep their id"
key-files:
  created:
    - src/lib/sop/convert.ts
    - tests/phase56/convert.spec.ts
    - scripts/convert-sops-to-steps.ts
    - .planning/phases/56-a-simpler-sop-the-decision-ledger/56-CONVERSION-DRYRUN.md
  modified: []
key-decisions:
  - "Unreadable hazard/PPE cards, empty Warning/Caution callouts and unknown block types are gate failures; empty non-safety blocks are dropped and counted (emptyDropped)"
  - "Decision options fold to `If {label}` (+ ` (escalate)`), since options carry no consequence text to put after the colon"
  - "Photo steps with no caption read `Photo needed` (the plan's `Take a photo` is banned in src/ by the phase55 photo-scan sweep)"
requirements-completed: [SOP-01]
duration: 40min
completed: 2026-10-04
---

# Phase 56 Plan 02: Converter and read-only dry run Summary

**A pure, unit-tested converter that turns layout_data (or sop_steps rows) into kinded steps with an explicit failure for every way a hazard or PPE item could be lost, run read-only over all 70 production SOPs: 70 of 70 pass the gate, nothing written.**

## Task commits

1. Task 1, converter + unit spec: `1570c6a`
2. Task 1 follow-up (copy fix, see Deviations): `08b8955`
3. Task 2, dry-run runner + report: `9b8a011`

## Needs Simon: none

All 70 SOPs pass the hazard/PPE gate. No empty hazard or PPE card exists in production, so 56-07 is not blocked on a decision.

## Totals (production, run at commit 1570c6a logic, re-run at 08b8955)

| Measure | Value |
|---|---|
| SOPs in scope (`select count(*) from sops`) | 70 (70 rows in the report) |
| ok / failing | 70 / 0 |
| Source | layout 22, rows 2, mixed 0, empty 46 |
| Hazard sources to hazard steps | 288 to 293 (the 5 extra are Text/Callout blocks inside hazard-classified sections, D-04) |
| PPE cards to ppe steps | 17 to 19 (items 111/111 present) |
| Steps / checks / photo-required | 497 / 1 / 95 |
| Images matched to `sop_images` | 194 / 194 |
| Dropped: voice / video / empty | 0 / 0 / 0 |
| Tips folded | 55 |
| Ids missing or duplicated | 0 |

288 hazard sources reconcile exactly with the research census: 166 HazardCards + 83 Warning + 37 Caution callouts + 2 fixture callouts. Block types read match the census plus the 56-01 fixture (e.g. StepBlock 323 = 322 + 1, CalloutBlock 178 = 175 + 3). Only MeasurementBlock (1, the fixture) is new.

Eval-site org run: `Eval convert fixture SOP` gives hazard 4 to 4, ppe 1 to 1 (items 2/2), step 2, check 1, ok. The full 70-row table (including the 46 empty SOPs, which are all `0->0` and ok) is in `56-CONVERSION-DRYRUN.md`.

## Per-SOP table (SOPs that produce steps; 46 empty SOPs omitted, see the report)

| Id | Title | Status | Source | Hazard | PPE (items) | Step | Check | Photo | Images | Tips folded |
|---|---|---|---|---|---|---|---|---|---|---|
| 92f826fe | Eval convert fixture SOP | published | layout | 4->4 | 1->1 (2/2) | 2 | 1 | 1 | 0/0 | 1 |
| ff64d499 | Eval plant fixture SOP | published | rows | 0->0 | 0->0 | 1 | 0 | 0 | 0/0 | 0 |
| 2c741e90 | Eval walk fixture SOP | published | rows | 0->0 | 0->0 | 2 | 0 | 1 | 0/0 | 0 |
| a039e664 | adaxx | draft | layout | 5->5 | 1->1 (3/3) | 12 | 0 | 0 | 0/0 | 0 |
| 891d1d14 | Alkaline Cleaning Tank - Machine Shop | draft | layout | 7->7 | 1->1 (8/8) | 11 | 0 | 0 | 0/0 | 0 |
| 203be502 | Alkaline Cleaning Tank Operation (Tergo Alkalox) | published | layout | 22->22 | 1->1 (15/15) | 19 | 0 | 0 | 0/0 | 6 |
| 12272c55 | Alkaline Cleaning Tank Operation (Tergo Alkalox) | draft | layout | 27->27 | 1->1 (11/11) | 14 | 0 | 0 | 0/0 | 4 |
| a8957c2f | Automated Sample Challenge Recording | published | layout | 0->1 | 0->0 | 23 | 0 | 0 | 0/0 | 0 |
| 95772b8e | Changing Plenum Chamber | draft | layout | 26->26 | 1->1 (12/12) | 14 | 0 | 3 | 3/3 | 3 |
| 35ec81bc | Changing the Blank Side Hanger | draft | layout | 22->22 | 1->1 (3/3) | 48 | 0 | 24 | 47/47 | 9 |
| 9b351c00 | Deflector Setup and Replacement | draft | layout | 46->46 | 1->1 (11/11) | 55 | 0 | 32 | 57/57 | 6 |
| c8d12da5 | Dog Bathing and Grooming Procedure | published | layout | 13->13 | 1->1 (4/4) | 12 | 0 | 0 | 0/0 | 3 |
| 60565938 | Emergency Tyre Change on a Motorway | draft | layout | 27->27 | 1->1 (8/8) | 24 | 0 | 0 | 0/0 | 6 |
| 10eff572 | Generic Workplace Task | draft | layout | 1->1 | 1->1 (8/8) | 2 | 0 | 0 | 0/0 | 0 |
| 9428b010 | IRI CSV File Configuration | draft | layout | 3->4 | 0->0 | 35 | 0 | 0 | 0/0 | 3 |
| 1834f09a | Manually Swabbing a Forming Machine | draft | layout | 18->18 | 1->1 (3/3) | 45 | 0 | 15 | 43/43 | 2 |
| 125cf9f1 | OTG Probe Maintenance | published | layout | 0->1 | 0->0 | 44 | 0 | 0 | 0/0 | 0 |
| 183c4554 | Replacing a Desktop Computer Keyboard | draft | layout | 10->10 | 1->1 (5/5) | 20 | 0 | 0 | 0/0 | 2 |
| 1ae63606 | Replacing a Desktop Computer Keyboard | draft | layout | 10->10 | 1->1 (5/5) | 20 | 0 | 0 | 0/0 | 2 |
| 4bde8c99 | Setting Up and Operating the Hot Melt Gluer | draft | layout | 19->19 | 1->1 (7/7) | 39 | 0 | 19 | 44/44 | 8 |
| 10e7b783 | Test Block Builder 1 | draft | layout | 1->1 | 0->2 (0/0) | 0 | 0 | 0 | 0/0 | 0 |
| 3b73348b | Test SOP Scratch | draft | layout | 0->0 | 0->0 | 1 | 0 | 0 | 0/0 | 0 |
| f2785cb7 | Titlk | draft | layout | 0->1 | 0->0 | 0 | 0 | 0 | 0/0 | 0 |
| e2aba917 | Working Safely in the Forming Area | draft | layout | 27->28 | 2->2 (6/6) | 54 | 0 | 0 | 0/0 | 0 |

## Deviations from Plan

**1. [Rule 1 - Bug] Retired copy in converter output.** The plan's fallback text `Take a photo` is banned in `src/` by the phase55 `photo-scan` deletion sweep (it failed 2 tests once the converter landed). Replaced with `Photo needed`; unit tests updated. Commit `08b8955`.

**2. Decision option text.** The plan says `If {label}: ...` per option; the options carry no consequence text, so the converter emits `If {label}` with ` (escalate)` where flagged rather than inventing words.

**3. Additional export.** `HANDLED_TYPES` (the keys of the reader table) is exported so the registry-parity test checks the real handler list, not a copy. It was not in the plan's export list.

Otherwise: plan executed as written. No reader needed fixing after the production run.

## Known simplifications

- Tools and time estimates are zipped by array index when step counts match, else unioned onto the first step (`ponytail` comments). The report does not yet count how many sections hit the fallback; 56-07 can add it if it matters.
- A mixed VisualBlock keeps its photo/diagram items and silently omits video items (counted only when the whole block is video). There are zero VisualBlocks in production.
- The gate is SOP-level; its count failures do not name a section (unreadable items and missing PPE items do).

## Issues Encountered

- Some SOPs have a null `title` or `organisation_id`; the runner was null-safe from the second run on (no effect on the report).
- The hazard-after count exceeds sources on 5 SOPs because D-04 promotes Text/Callout blocks inside hazard-classified sections to hazard steps. This only ever raises the count.

## Verification

- `npx playwright test --project=phase56`: 26 passed, 18 skipped (22 new converter tests).
- `npx playwright test --project=phase55`: 120 passed.
- `npx tsc --noEmit`: clean. eslint clean on the three new files.
- `grep` acceptance: no `.insert/.update/.upsert/.delete(` in the runner; `--apply` exits 2 without touching the database.

## Self-Check: PASSED
