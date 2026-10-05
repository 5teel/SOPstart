# Phase 58 - Cutover: final converter run (58-14, D-23)

The last run of `scripts/convert-sops-to-steps.ts` against production, made BEFORE the converter was retired and before any admin was routed to the focus editor from the admin screens. Service client from `.env`, production project, one real org (`bd2c2b88`) plus the eval fixture orgs and probe orgs that live in the same database.

- Dry run: 2026-10-05T07:27:14Z (read-only, nothing written)
- Apply (`npx tsx scripts/convert-sops-to-steps.ts --apply --all`): started 2026-10-05T07:27:24Z, finished 2026-10-05T07:27:33Z, exit 0, run id `723b5378-d712-414d-951f-966efe040e03`
- **Freeze start: 2026-10-05T07:27:33Z.** An edit made in the old builder after this moment is not captured. The freeze ends when 58-14's Task 3 is pushed and the old builder addresses redirect.

## What the dry run said (read before applying)

- 89 SOPs in scope, 89 passed the hazard/PPE gate, 0 failing. Hazard sources -> hazard steps 288 -> 293, PPE cards -> ppe steps 17 -> 19 with items 111/111.
- **Planned step writes: insert 0, update 0, delete 0.** No SOP's layout had changed since the Phase 56 apply except nine empty shells (probe / fixture SOPs with no content) whose hash moved, so they only get a new `sop_conversion_runs` row. In other words nobody edited a real SOP in the old builder after Phase 56, and the run captured nothing new.
- **Native SOPs left alone: 7**, all eval fixtures with `new:` / `edit:` keys (`EVAL focus draft`, `jump`, three `lineage` rows, `publish`, `ready`). No real-org SOP is native, so the editor had not been used on a real SOP yet.
- **Still parsing, left alone: 5** (three eval parsing fixtures, one `parsing` and one `uploading` untitled SOP in the real org).
- **Ticks to carry (draft SOPs only): 6**, on two drafts - `1ae63606` Replacing a Desktop Computer Keyboard at a Workstation (5) and `4bde8c99` Setting Up and Operating the Hot Melt Gluer (1). Published SOPs carry none.
- Stop rule (a gate failure, or a delete that would remove a ticked or `edit:` row): not triggered.

Rules the runner applied this time (new in 58-14, all in `scripts/convert-sops-to-steps.ts`): a SOP with a `new:` / `edit:` key, a tick set in the editor, or a step edited after its last conversion run is "native" and is never read, updated or deleted; a SOP still `uploading` / `parsing` is left alone; a delete that would remove a ticked or native row throws.

# Dry run (read-only)


- Date: 2026-10-05T07:27:14.069Z
- Commit: 08ef12eb
- Scope: all SOPs
- CONVERTER_VERSION: 1
- SOPs in scope at run time (`select count(*) from sops`): 89; rows below: 89
- Read-only: this run wrote nothing.

### Totals

- SOPs: 89, ok: 89, failing: 0, native (left alone): 7
- Planned writes: insert 0, update 0, delete 0; ticks to carry (draft SOPs): 6
- Source: layout 22, rows 2, mixed 0, empty 65
- Hazard sources -> hazard steps: 288 -> 293
- PPE cards -> ppe steps: 17 -> 19 (items 111/111)
- Steps: 497, checks: 1, photo-required: 95
- Images matched to sop_images: 194/194
- Dropped: voice 0, video 0, empty 0; tips folded 55; ids missing/duplicated 0

#### Block types read vs census (56-RESEARCH 2026-10-04)

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

### Needs Simon

Needs Simon: none

### Per SOP

| Id | Title | Status | Source | Hazard before->after | PPE cards->steps (items) | Step | Check | Photo | Existing steps | Plan (+ins ~upd -del =same) | Ticks | Gate |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 03d13ae9 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| 8344988f | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | convert: +0 ~0 -0 (=0) | 0 | ok |
| 4bfaf2be | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| 62a79334 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| 3577fd08 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| 74a37afc | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| a9b5512c | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| 72cb397a | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| 9a9618ef | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| cd5f9c66 | Org B SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| 91e349a3 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| 15e560f6 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| d8b6b533 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| 79ec85fc | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| beff4069 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| c33567a3 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | convert: +0 ~0 -0 (=0) | 0 | ok |
| f942cea6 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| ffa48d04 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| 2cb332d1 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| 9526c317 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| 9ba02ef3 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | convert: +0 ~0 -0 (=0) | 0 | ok |
| 942d53a1 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| 1c40a002 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| 9954294e | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| 6113a213 | Org B SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| 35ff669d | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| dba2b7f0 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| 23ef3dc1 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | convert: +0 ~0 -0 (=0) | 0 | ok |
| 068f5644 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| 92f826fe | Eval convert fixture SOP | published | layout | 4->4 | 1->1 (2/2) | 2 | 1 | 1 | 8 | unchanged | 0 | ok |
| 33ac8099 | EVAL focus blank | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | convert: +0 ~0 -0 (=0) | 0 | ok |
| 5b04afc4 | EVAL focus draft | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 4 | native (native keys) - left alone | 0 | ok |
| 215e2b2b | EVAL focus jump | published | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 4 | native (native keys) - left alone | 0 | ok |
| eb0e1415 | EVAL focus lineage | published | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 2 | native (native keys) - left alone | 0 | ok |
| 2c53f8f9 | EVAL focus lineage | published | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 2 | native (native keys) - left alone | 0 | ok |
| 2dc37786 | EVAL focus lineage | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 2 | native (native keys) - left alone | 0 | ok |
| 51ef4bad | EVAL focus parse failed | parsing | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | still parsing - left alone | 0 | ok |
| aaf1e057 | EVAL focus parsing | parsing | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | still parsing - left alone | 0 | ok |
| 87ddb832 | EVAL focus parsing video | parsing | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | still parsing - left alone | 0 | ok |
| ab5dca05 | EVAL focus publish | published | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 2 | native (native keys) - left alone | 0 | ok |
| 76962d01 | EVAL focus ready | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 3 | native (native keys) - left alone | 0 | ok |
| ff64d499 | Eval plant fixture SOP | published | rows | 0->0 | 0->0 (0/0) | 1 | 0 | 0 | 1 | unchanged | 0 | ok |
| aee074df | Eval site fixture SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| 2c741e90 | Eval walk fixture SOP | published | rows | 0->0 | 0->0 (0/0) | 2 | 0 | 1 | 2 | unchanged | 0 | ok |
| 646c4ba3 | 001 | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| a039e664 | adaxx | draft | layout | 5->5 | 1->1 (3/3) | 12 | 0 | 0 | 18 | unchanged | 0 | ok |
| 891d1d14 | Alkaline Cleaning Tank – Machine Shop | draft | layout | 7->7 | 1->1 (8/8) | 11 | 0 | 0 | 19 | unchanged | 0 | ok |
| 12272c55 | Alkaline Cleaning Tank Operation — Machine Shop (Tergo Alkalox) | draft | layout | 27->27 | 1->1 (11/11) | 14 | 0 | 0 | 42 | unchanged | 0 | ok |
| 203be502 | Alkaline Cleaning Tank Operation — Machine Shop (Tergo Alkalox) | published | layout | 22->22 | 1->1 (15/15) | 19 | 0 | 0 | 42 | unchanged | 0 | ok |
| aef337b2 | as | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| a8957c2f | Automated Sample Challenge Recording | published | layout | 0->1 | 0->0 (0/0) | 23 | 0 | 0 | 24 | unchanged | 0 | ok |
| 95772b8e | Changing Plenum Chamber — IS Machine Forming Section | draft | layout | 26->26 | 1->1 (12/12) | 14 | 0 | 3 | 41 | unchanged | 0 | ok |
| 35ec81bc | Changing the Blank Side Hanger | draft | layout | 22->22 | 1->1 (3/3) | 48 | 0 | 24 | 71 | unchanged | 0 | ok |
| 9b351c00 | Deflector Setup and Replacement for Proper Gob Loading — Glass Forming Machine | draft | layout | 46->46 | 1->1 (11/11) | 55 | 0 | 32 | 102 | unchanged | 0 | ok |
| c8d12da5 | Dog Bathing and Grooming Procedure | published | layout | 13->13 | 1->1 (4/4) | 12 | 0 | 0 | 26 | unchanged | 0 | ok |
| 60565938 | Emergency Tyre Change on a Motorway | draft | layout | 27->27 | 1->1 (8/8) | 24 | 0 | 0 | 52 | unchanged | 0 | ok |
| a3103ff8 | Forming Area Mandatory Minimum Safety Requirements and Procedures | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| 10eff572 | Generic Workplace Task — Awaiting Procedure Details | draft | layout | 1->1 | 1->1 (8/8) | 2 | 0 | 0 | 4 | unchanged | 0 | ok |
| 9428b010 | IRI CSV File Configuration | draft | layout | 3->4 | 0->0 (0/0) | 35 | 0 | 0 | 39 | unchanged | 0 | ok |
| 1834f09a | Manually Swabbing a Forming Machine | draft | layout | 18->18 | 1->1 (3/3) | 45 | 0 | 15 | 64 | unchanged | 0 | ok |
| 125cf9f1 | OTG Probe Maintenance | published | layout | 0->1 | 0->0 (0/0) | 44 | 0 | 0 | 45 | unchanged | 0 | ok |
| 183c4554 | Replacing a Desktop Computer Keyboard at a Workstation | draft | layout | 10->10 | 1->1 (5/5) | 20 | 0 | 0 | 31 | unchanged | 0 | ok |
| 1ae63606 | Replacing a Desktop Computer Keyboard at a Workstation | draft | layout | 10->10 | 1->1 (5/5) | 20 | 0 | 0 | 31 | unchanged | 5 | ok |
| 4bde8c99 | Setting Up and Operating the Hot Melt Gluer | draft | layout | 19->19 | 1->1 (7/7) | 39 | 0 | 19 | 59 | unchanged | 1 | ok |
| 10e7b783 | Test Block Builder 1 | draft | layout | 1->1 | 0->2 (0/0) | 0 | 0 | 0 | 3 | unchanged | 0 | ok |
| 3b73348b | Test SOP Scratch | draft | layout | 0->0 | 0->0 (0/0) | 1 | 0 | 0 | 1 | unchanged | 0 | ok |
| f2785cb7 | Titlk | draft | layout | 0->1 | 0->0 (0/0) | 0 | 0 | 0 | 1 | unchanged | 0 | ok |
| e2aba917 | Working Safely in the Forming Area — Mandatory Safety Requirements | draft | layout | 27->28 | 2->2 (6/6) | 54 | 0 | 0 | 84 | unchanged | 0 | ok |
| b09bfad2 |  | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| 37a7880a |  | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| e38f8ae6 |  | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| 1152be9f |  | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| 39fcfe45 |  | parsing | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | still parsing - left alone | 0 | ok |
| 7367dfdf |  | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| d88eb00d |  | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| 6e31f699 |  | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| 403829f8 |  | uploading | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | still parsing - left alone | 0 | ok |
| dd33ccf3 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| 8be4b28e | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| 1ed11b9e | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| e6765591 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| ff7dd133 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| e4f82994 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| edbb819b | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | convert: +0 ~0 -0 (=0) | 0 | ok |
| 37e62eed | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | convert: +0 ~0 -0 (=0) | 0 | ok |
| 564416d7 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | convert: +0 ~0 -0 (=0) | 0 | ok |
| f347db12 | Org B SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| 352fb675 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok |
| 01af82e8 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | convert: +0 ~0 -0 (=0) | 0 | ok |

# Apply


- Date: 2026-10-05T07:27:32.998Z
- Commit: 08ef12eb
- Scope: all SOPs
- CONVERTER_VERSION: 1
- SOPs in scope at run time (`select count(*) from sops`): 89; rows below: 89
- Applied: 9 converted / 68 unchanged / 0 failed / 7 native left alone / 5 still parsing; ticks carried: 6

### Totals

- SOPs: 89, ok: 89, failing: 0, native (left alone): 7
- Planned writes: insert 0, update 0, delete 0; ticks to carry (draft SOPs): 6
- Source: layout 22, rows 2, mixed 0, empty 65
- Hazard sources -> hazard steps: 288 -> 293
- PPE cards -> ppe steps: 17 -> 19 (items 111/111)
- Steps: 497, checks: 1, photo-required: 95
- Images matched to sop_images: 194/194
- Dropped: voice 0, video 0, empty 0; tips folded 55; ids missing/duplicated 0

#### Block types read vs census (56-RESEARCH 2026-10-04)

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

### Needs Simon

Needs Simon: none

### Per SOP

| Id | Title | Status | Source | Hazard before->after | PPE cards->steps (items) | Step | Check | Photo | Existing steps | Plan (+ins ~upd -del =same) | Ticks | Gate | Action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 03d13ae9 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| 8344988f | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | convert: +0 ~0 -0 (=0) | 0 | ok | converted |
| 4bfaf2be | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| 62a79334 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| 3577fd08 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| 74a37afc | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| a9b5512c | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| 72cb397a | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| 9a9618ef | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| cd5f9c66 | Org B SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| 91e349a3 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| 15e560f6 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| d8b6b533 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| 79ec85fc | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| beff4069 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| c33567a3 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | convert: +0 ~0 -0 (=0) | 0 | ok | converted |
| f942cea6 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| ffa48d04 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| 2cb332d1 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| 9526c317 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| 9ba02ef3 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | convert: +0 ~0 -0 (=0) | 0 | ok | converted |
| 942d53a1 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| 1c40a002 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| 9954294e | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| 6113a213 | Org B SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| 35ff669d | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| dba2b7f0 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| 23ef3dc1 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | convert: +0 ~0 -0 (=0) | 0 | ok | converted |
| 068f5644 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| 92f826fe | Eval convert fixture SOP | published | layout | 4->4 | 1->1 (2/2) | 2 | 1 | 1 | 8 | unchanged | 0 | ok | unchanged |
| 33ac8099 | EVAL focus blank | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | convert: +0 ~0 -0 (=0) | 0 | ok | converted |
| 5b04afc4 | EVAL focus draft | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 4 | native (native keys) - left alone | 0 | ok | native |
| 215e2b2b | EVAL focus jump | published | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 4 | native (native keys) - left alone | 0 | ok | native |
| eb0e1415 | EVAL focus lineage | published | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 2 | native (native keys) - left alone | 0 | ok | native |
| 2c53f8f9 | EVAL focus lineage | published | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 2 | native (native keys) - left alone | 0 | ok | native |
| 2dc37786 | EVAL focus lineage | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 2 | native (native keys) - left alone | 0 | ok | native |
| 51ef4bad | EVAL focus parse failed | parsing | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | still parsing - left alone | 0 | ok | in_flight |
| aaf1e057 | EVAL focus parsing | parsing | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | still parsing - left alone | 0 | ok | in_flight |
| 87ddb832 | EVAL focus parsing video | parsing | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | still parsing - left alone | 0 | ok | in_flight |
| ab5dca05 | EVAL focus publish | published | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 2 | native (native keys) - left alone | 0 | ok | native |
| 76962d01 | EVAL focus ready | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 3 | native (native keys) - left alone | 0 | ok | native |
| ff64d499 | Eval plant fixture SOP | published | rows | 0->0 | 0->0 (0/0) | 1 | 0 | 0 | 1 | unchanged | 0 | ok | unchanged |
| aee074df | Eval site fixture SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| 2c741e90 | Eval walk fixture SOP | published | rows | 0->0 | 0->0 (0/0) | 2 | 0 | 1 | 2 | unchanged | 0 | ok | unchanged |
| 646c4ba3 | 001 | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| a039e664 | adaxx | draft | layout | 5->5 | 1->1 (3/3) | 12 | 0 | 0 | 18 | unchanged | 0 | ok | unchanged |
| 891d1d14 | Alkaline Cleaning Tank – Machine Shop | draft | layout | 7->7 | 1->1 (8/8) | 11 | 0 | 0 | 19 | unchanged | 0 | ok | unchanged |
| 12272c55 | Alkaline Cleaning Tank Operation — Machine Shop (Tergo Alkalox) | draft | layout | 27->27 | 1->1 (11/11) | 14 | 0 | 0 | 42 | unchanged | 0 | ok | unchanged |
| 203be502 | Alkaline Cleaning Tank Operation — Machine Shop (Tergo Alkalox) | published | layout | 22->22 | 1->1 (15/15) | 19 | 0 | 0 | 42 | unchanged | 0 | ok | unchanged |
| aef337b2 | as | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| a8957c2f | Automated Sample Challenge Recording | published | layout | 0->1 | 0->0 (0/0) | 23 | 0 | 0 | 24 | unchanged | 0 | ok | unchanged |
| 95772b8e | Changing Plenum Chamber — IS Machine Forming Section | draft | layout | 26->26 | 1->1 (12/12) | 14 | 0 | 3 | 41 | unchanged | 0 | ok | unchanged |
| 35ec81bc | Changing the Blank Side Hanger | draft | layout | 22->22 | 1->1 (3/3) | 48 | 0 | 24 | 71 | unchanged | 0 | ok | unchanged |
| 9b351c00 | Deflector Setup and Replacement for Proper Gob Loading — Glass Forming Machine | draft | layout | 46->46 | 1->1 (11/11) | 55 | 0 | 32 | 102 | unchanged | 0 | ok | unchanged |
| c8d12da5 | Dog Bathing and Grooming Procedure | published | layout | 13->13 | 1->1 (4/4) | 12 | 0 | 0 | 26 | unchanged | 0 | ok | unchanged |
| 60565938 | Emergency Tyre Change on a Motorway | draft | layout | 27->27 | 1->1 (8/8) | 24 | 0 | 0 | 52 | unchanged | 0 | ok | unchanged |
| a3103ff8 | Forming Area Mandatory Minimum Safety Requirements and Procedures | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| 10eff572 | Generic Workplace Task — Awaiting Procedure Details | draft | layout | 1->1 | 1->1 (8/8) | 2 | 0 | 0 | 4 | unchanged | 0 | ok | unchanged |
| 9428b010 | IRI CSV File Configuration | draft | layout | 3->4 | 0->0 (0/0) | 35 | 0 | 0 | 39 | unchanged | 0 | ok | unchanged |
| 1834f09a | Manually Swabbing a Forming Machine | draft | layout | 18->18 | 1->1 (3/3) | 45 | 0 | 15 | 64 | unchanged | 0 | ok | unchanged |
| 125cf9f1 | OTG Probe Maintenance | published | layout | 0->1 | 0->0 (0/0) | 44 | 0 | 0 | 45 | unchanged | 0 | ok | unchanged |
| 183c4554 | Replacing a Desktop Computer Keyboard at a Workstation | draft | layout | 10->10 | 1->1 (5/5) | 20 | 0 | 0 | 31 | unchanged | 0 | ok | unchanged |
| 1ae63606 | Replacing a Desktop Computer Keyboard at a Workstation | draft | layout | 10->10 | 1->1 (5/5) | 20 | 0 | 0 | 31 | unchanged | 5 | ok | unchanged |
| 4bde8c99 | Setting Up and Operating the Hot Melt Gluer | draft | layout | 19->19 | 1->1 (7/7) | 39 | 0 | 19 | 59 | unchanged | 1 | ok | unchanged |
| 10e7b783 | Test Block Builder 1 | draft | layout | 1->1 | 0->2 (0/0) | 0 | 0 | 0 | 3 | unchanged | 0 | ok | unchanged |
| 3b73348b | Test SOP Scratch | draft | layout | 0->0 | 0->0 (0/0) | 1 | 0 | 0 | 1 | unchanged | 0 | ok | unchanged |
| f2785cb7 | Titlk | draft | layout | 0->1 | 0->0 (0/0) | 0 | 0 | 0 | 1 | unchanged | 0 | ok | unchanged |
| e2aba917 | Working Safely in the Forming Area — Mandatory Safety Requirements | draft | layout | 27->28 | 2->2 (6/6) | 54 | 0 | 0 | 84 | unchanged | 0 | ok | unchanged |
| b09bfad2 |  | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| 37a7880a |  | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| e38f8ae6 |  | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| 1152be9f |  | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| 39fcfe45 |  | parsing | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | still parsing - left alone | 0 | ok | in_flight |
| 7367dfdf |  | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| d88eb00d |  | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| 6e31f699 |  | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| 403829f8 |  | uploading | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | still parsing - left alone | 0 | ok | in_flight |
| dd33ccf3 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| 8be4b28e | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| 1ed11b9e | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| e6765591 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| ff7dd133 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| e4f82994 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| edbb819b | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | convert: +0 ~0 -0 (=0) | 0 | ok | converted |
| 37e62eed | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | convert: +0 ~0 -0 (=0) | 0 | ok | converted |
| 564416d7 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | convert: +0 ~0 -0 (=0) | 0 | ok | converted |
| f347db12 | Org B SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| 352fb675 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | unchanged | 0 | ok | unchanged |
| 01af82e8 | Phase46 approver-edit probe SOP | draft | empty | 0->0 | 0->0 (0/0) | 0 | 0 | 0 | 0 | convert: +0 ~0 -0 (=0) | 0 | ok | converted |

## After the apply (checked against production by a second read)

- `sop_focus_steps`: 829 rows in total. The 6 planned ticks landed: `1ae63606` 5 of 31 steps ticked, `4bde8c99` 1 of 59. (The other ticked rows in the table belong to the native eval fixtures and were not touched.)
- Apply summary line: `apply: 9 converted / 68 unchanged / 0 failed / 7 native left alone / 5 still parsing`. The nine "converted" rows wrote no steps (empty shells); their `sop_conversion_runs` rows carry before/after counts and `ok = true`.

### SOPs with zero steps after the run (named explicitly)

Real org (`bd2c2b88`, SOPstart) - none of these has any content to convert (the converter reads source `empty`); the worker never sees a published SOP among them:

| SOP id | Status | Title |
|---|---|---|
| `646c4ba3` | draft | `001` |
| `aef337b2` | draft | `as` |
| `a3103ff8` | draft | Forming Area Mandatory Minimum Safety Requirements and Procedures (converter source `empty`: no layout and no step rows) |
| `7367dfdf`, `37a7880a`, `6e31f699`, `d88eb00d`, `e38f8ae6`, `1152be9f`, `b09bfad2` | draft | untitled shells (converter source `empty`) |
| `403829f8` | uploading | untitled, upload never finished |
| `39fcfe45` | parsing | untitled, parse never finished |

Fixtures and probes (other orgs, not customer data): `33ac8099` EVAL focus blank, `aee074df` Eval site fixture SOP, `51ef4bad` / `aaf1e057` / `87ddb832` EVAL focus parse failed / parsing / parsing video (deliberately without steps), `6113a213` / `cd5f9c66` / `f347db12` Org B SOP, and the "Phase46 approver-edit probe SOP" rows left by live probes (`2f03802a`, `fdc50e35`, `189eb641`, `c293512d`, `141b1611`, `6f77d708`, `7a88b59f`, `a590f111`, `68342f48`, `714df145`, `fc66c0be`, `9b347868`, `e6d86d0d`, `ae6cff75`, `492f6300`, `824ed9ea`, `1ad8745e`, `7291ce78`, `78b9b2a1`, `67c9044e`, `86e5b66f`, `36c1cc3d`, `3fff1329`, `602e2421`, `e91909b1`, `b2ca92b1`, `7a355269`, `d5370512`, `e118e7e4`, `23042cf1`, `785816f3`, `bddf88db`, `8c87536c`, `e83f1fae`, `e0f3f6bc`, `c0b184f6`, `16080372`, `1563ca39`; org prefix per SOP is in the run table above).

The zero-step real-org drafts are what `--missing` (Task 2) is for: after this plan the converter can only fill a SOP that has no steps, and never touches one that has.

# Post-retirement sweep (58-18, D-23)

Run 2026-10-05 at commit `5119898c` (every plan 58-01..58-17), production database, after the retirement code was pushed. Railway's `/api/version` still read the previous deploy (`1aa29086`) when these ran; both modes are converter-side only and read the same tables, so the order does not change the result.

## Default dry run (`npx tsx scripts/convert-sops-to-steps.ts --all`) - read-only

- 92 SOPs in scope, 92 ok, 0 failing, 9 native (left alone: the 7 fixtures from the cutover plus 2 new eval fixtures).
- Planned writes: insert 0, update 0, delete 0; ticks to carry 0. Source: layout 22, rows 2, empty 68. The real-org content is unchanged since the 58-14 apply (hazard 288->293 and PPE 17->19 totals identical).

## `--missing --all` (writes only SOPs with zero steps that are not uploading / parsing)

- Output line: `missing: 0 converted / 56 unchanged / 0 failed / 31 native left alone / 5 still parsing (run da4322c4-7e86-4a27-bf9c-7cd249237060)`
- **Zero SOPs needed steps.** Every SOP that has content has steps; the SOPs still without steps are the same empty shells named above (converter source `empty`: no layout and no step rows), the 5 parse fixtures / unfinished parses, and nothing a worker can open (none is published). Nothing was written to `sop_focus_steps`.
- 31 "native" is the `--missing` mode's meaning: any SOP that already carries steps is left alone, so it is larger than the dry run's 9.
