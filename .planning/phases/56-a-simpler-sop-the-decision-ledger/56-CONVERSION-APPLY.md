# Phase 56 - Conversion apply

## Precondition check (read before any --apply)

- 56-02-SUMMARY.md reads `## Needs Simon: none` (all 70 SOPs pass the hazard/PPE gate; no decision outstanding).
- 56-CONVERSION-DRYRUN.md: 70 SOPs, 70 ok, 0 failing; no Needs-Simon SOP, so no `accept unconverted` rows.
- Dry run re-run against current data before applying: 70 SOPs, 70 ok, 0 failing (matches the reviewed report).
- Order followed: throwaway-org live spec (6/6) -> eval-site org (run b2097aa9-33d2-4cab-b265-dd65a4a1a546, 4 converted) -> `--apply --all` (run 91bb2768-ac0f-44d3-9985-c3523101eb70, below; the eval-site org's 4 SOPs showed as unchanged) -> second `--apply --all` (run d65adabe-5c15-4996-96ac-043cf4229864): 0 converted / 70 unchanged / 0 failed.
- The Action column below is from the first `--all` run.

- Date: 2026-10-03T23:52:47.446Z
- Commit: 567550f
- Scope: all SOPs
- CONVERTER_VERSION: 1
- SOPs in scope at run time (`select count(*) from sops`): 70; rows below: 70
- Applied: 66 converted / 4 unchanged / 0 failed

## Totals

- SOPs: 70, ok: 70, failing: 0
- Source: layout 22, rows 2, mixed 0, empty 46
- Hazard sources -> hazard steps: 288 -> 293
- PPE cards -> ppe steps: 17 -> 19 (items 111/111)
- Steps: 497, checks: 1, photo-required: 95
- Images matched to sop_images: 194/194
- Dropped: voice 0, video 0, empty 0; tips folded 55; ids missing/duplicated 0

### Block types read vs census (56-RESEARCH 2026-10-04)

| Type | Read now | Census |
|---|---|---|
| CalloutBlock | 178 | 175 |
| HazardCardBlock | 166 | 164 |
| HeadingBlock | 4 | 4 |
| MeasurementBlock | 1 | - |
| PPECardBlock | 17 | 16 |
| PhotoGridBlock | 4 | 4 |
| StepBlock | 323 | 322 |
| StepWithPhotosBlock | 90 | 89 |
| TextBlock | 79 | 79 |
| row:step | 3 | - |

## Needs Simon

Needs Simon: none

## Per SOP

| Id | Title | Status | Source | Hazard before->after | PPE cards->steps (items) | Step | Check | Photo | Images matched/total | Dropped v/vid/empty | Tips folded | Result | Action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 03d13ae9 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| 4bfaf2be | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| 62a79334 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| 3577fd08 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| 74a37afc | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| a9b5512c | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| 72cb397a | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| 9a9618ef | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| cd5f9c66 | Org B SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| 91e349a3 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| 15e560f6 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| d8b6b533 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| 79ec85fc | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| beff4069 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| f942cea6 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| ffa48d04 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| 2cb332d1 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| 9526c317 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| 942d53a1 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| 1c40a002 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| 9954294e | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| 6113a213 | Org B SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| 35ff669d | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| dba2b7f0 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| 068f5644 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| 92f826fe | Eval convert fixture SOP | published | layout | 4->4 | 1->1 (2/2) | 2 | 1 | 1 | 0/0 | 0/0/0 | 1 | ok | unchanged |
| ff64d499 | Eval plant fixture SOP | published | rows | 0->0 | 0->0 (0/0) | 1 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | unchanged |
| aee074df | Eval site fixture SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | unchanged |
| 2c741e90 | Eval walk fixture SOP | published | rows | 0->0 | 0->0 (0/0) | 2 | 0 | 1 | 0/0 | 0/0/0 | 0 | ok | unchanged |
| 646c4ba3 | 001 | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| a039e664 | adaxx | draft | layout | 5->5 | 1->1 (3/3) | 12 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| 891d1d14 | Alkaline Cleaning Tank – Machine Shop | draft | layout | 7->7 | 1->1 (8/8) | 11 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| 12272c55 | Alkaline Cleaning Tank Operation — Machine Shop (Tergo Alkalox) | draft | layout | 27->27 | 1->1 (11/11) | 14 | 0 | 0 | 0/0 | 0/0/0 | 4 | ok | converted |
| 203be502 | Alkaline Cleaning Tank Operation — Machine Shop (Tergo Alkalox) | published | layout | 22->22 | 1->1 (15/15) | 19 | 0 | 0 | 0/0 | 0/0/0 | 6 | ok | converted |
| aef337b2 | as | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| a8957c2f | Automated Sample Challenge Recording | published | layout | 0->1 | 0->0 (0/0) | 23 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| 95772b8e | Changing Plenum Chamber — IS Machine Forming Section | draft | layout | 26->26 | 1->1 (12/12) | 14 | 0 | 3 | 3/3 | 0/0/0 | 3 | ok | converted |
| 35ec81bc | Changing the Blank Side Hanger | draft | layout | 22->22 | 1->1 (3/3) | 48 | 0 | 24 | 47/47 | 0/0/0 | 9 | ok | converted |
| 9b351c00 | Deflector Setup and Replacement for Proper Gob Loading — Glass Forming Machine | draft | layout | 46->46 | 1->1 (11/11) | 55 | 0 | 32 | 57/57 | 0/0/0 | 6 | ok | converted |
| c8d12da5 | Dog Bathing and Grooming Procedure | published | layout | 13->13 | 1->1 (4/4) | 12 | 0 | 0 | 0/0 | 0/0/0 | 3 | ok | converted |
| 60565938 | Emergency Tyre Change on a Motorway | draft | layout | 27->27 | 1->1 (8/8) | 24 | 0 | 0 | 0/0 | 0/0/0 | 6 | ok | converted |
| a3103ff8 | Forming Area Mandatory Minimum Safety Requirements and Procedures | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| 10eff572 | Generic Workplace Task — Awaiting Procedure Details | draft | layout | 1->1 | 1->1 (8/8) | 2 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| 9428b010 | IRI CSV File Configuration | draft | layout | 3->4 | 0->0 (0/0) | 35 | 0 | 0 | 0/0 | 0/0/0 | 3 | ok | converted |
| 1834f09a | Manually Swabbing a Forming Machine | draft | layout | 18->18 | 1->1 (3/3) | 45 | 0 | 15 | 43/43 | 0/0/0 | 2 | ok | converted |
| 125cf9f1 | OTG Probe Maintenance | published | layout | 0->1 | 0->0 (0/0) | 44 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| 1ae63606 | Replacing a Desktop Computer Keyboard at a Workstation | draft | layout | 10->10 | 1->1 (5/5) | 20 | 0 | 0 | 0/0 | 0/0/0 | 2 | ok | converted |
| 183c4554 | Replacing a Desktop Computer Keyboard at a Workstation | draft | layout | 10->10 | 1->1 (5/5) | 20 | 0 | 0 | 0/0 | 0/0/0 | 2 | ok | converted |
| 4bde8c99 | Setting Up and Operating the Hot Melt Gluer | draft | layout | 19->19 | 1->1 (7/7) | 39 | 0 | 19 | 44/44 | 0/0/0 | 8 | ok | converted |
| 10e7b783 | Test Block Builder 1 | draft | layout | 1->1 | 0->2 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| 3b73348b | Test SOP Scratch | draft | layout | 0->0 | 0->0 (0/0) | 1 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| f2785cb7 | Titlk | draft | layout | 0->1 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| e2aba917 | Working Safely in the Forming Area — Mandatory Safety Requirements | draft | layout | 27->28 | 2->2 (6/6) | 54 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| 1152be9f |  | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| 7367dfdf |  | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| e38f8ae6 |  | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| b09bfad2 |  | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| 37a7880a |  | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| 6e31f699 |  | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| d88eb00d |  | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| 403829f8 |  | uploading | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| 39fcfe45 |  | parsing | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| dd33ccf3 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| 8be4b28e | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| 1ed11b9e | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| e6765591 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| ff7dd133 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| e4f82994 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| f347db12 | Org B SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
| 352fb675 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0/0 | 0/0/0 | 0 | ok | converted |
