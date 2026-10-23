---
phase: 64-leavers-and-suspended-members
plan: 06
subsystem: governance
tags: [sign-off, deployed-eval, validation, learnings]

requires:
  - phase: 64-05
    provides: Needs a new owner handover, eval case 4
provides:
  - 64-EVAL.md (deployed proof, every 64-* screenshot read, reds classified)
  - 64-VALIDATION.md signed (nyquist_compliant, wave_0_complete)
  - MEMB-01..13 evidence list in REQUIREMENTS.md
  - Phase 64 Learnings in docs/LEARNINGS.md, one rule in CLAUDE.md
  - six stale specs repointed, one self-skipping case deleted, People grid stacking fix
affects: [verify-work 64]

tech-stack:
  added: []
  patterns:
    - "A scroll box holding a sticky z-10 column gets isolate so it cannot paint over sibling UI"

key-files:
  created:
    - .planning/phases/64-leavers-and-suspended-members/64-EVAL.md
  modified:
    - src/components/office/PeopleTab.tsx
    - tests/evals/sop-ledger.eval.ts
    - tests/phase26/konva-worker-isolation.spec.ts
    - tests/phase26/spine-regression.spec.ts
    - tests/phase40/dat01-category-column.spec.ts
    - tests/phase54/governance-inbox.spec.ts
    - tests/phase59/repoint-inventory.spec.ts
    - tests/phase59/retirement-sweep.spec.ts
    - tests/phase63/home-shell.spec.ts
    - .planning/phases/64-leavers-and-suspended-members/64-VALIDATION.md
    - .planning/REQUIREMENTS.md
    - docs/LEARNINGS.md
    - CLAUDE.md

key-decisions:
  - "Stale specs were repointed to current shapes, never loosened to pass: createRole is no longer a retired token (ADR-0021), the home-shell marker follows the Training lanes ('ran it on their own', ADR-0019), the completion spine spec accepts the complete_walk RPC and also forbids deletes"
  - ".bundle-baseline.json untouched; /page sits at 831 KB against a 834 baseline (delta -3; the gate passes a downward move)"

requirements-completed: [MEMB-01, MEMB-02, MEMB-03, MEMB-04, MEMB-05, MEMB-06, MEMB-07, MEMB-08, MEMB-09, MEMB-10, MEMB-11, MEMB-12, MEMB-13]

duration: 3h
completed: 2026-10-24
---

# Phase 64 Plan 06: Sign-off

**Phase 64 is proven on sopstart.com: the full deployed eval ran once (122 of 123, the one red an eval written before ADR-0023 and now fixed), people.eval is 6 of 6 on the final deploy, the live database assertions pass, and every MEMB requirement has written evidence.**

## Accomplishments

- `--assert-only` against the live project: all PASS (hook end to end, suspended probe, active probe, uat_feedback probe, PostgREST status select).
- One full `npm run eval -- --phase 64` on the deploy of `e38fdeaf`: 122 passed, 1 failed, 4 skipped behind it. Case list, reds and screenshot readings are in `64-EVAL.md`.
- Every `64-*` screenshot was read, plus eight sibling screenshots across worker, supervisor, admin and a newly approved account (the RLS helper change sits under every policy); all show their data.
- Known stale specs from the plan's objective all fixed: `repoint-inventory` (x2), `retirement-sweep`, `home-shell` bundle seams; the self-skipping Konva plant case deleted.
- VALIDATION signed; REQUIREMENTS gains the Phase 64 evidence list (the 13 boxes and traceability rows were already Complete from the earlier plans); Learnings written.

## Task Commits

| Commit | What |
|---|---|
| `e38fdeaf` | repoint four stale specs, drop the self-skipping konva plant case |
| `a22f36f4` | sop-ledger B reads the ADR-0023 walking order |
| `17b5004a` | People grid sticky column stays under the tab group; repoint three specs the suite found stale |
| docs commit | 64-EVAL.md, VALIDATION, REQUIREMENTS, ROADMAP, STATE, LEARNINGS, CLAUDE.md, this summary |

## Gate numbers

| Gate | Number |
|---|---|
| `npx tsc --noEmit` | exit 0 (three times, last after the final spec edits) |
| `npm run build` | exit 0 (twice; the second after the PeopleTab change) |
| `/sops/[sopId]/page` | 802 KB, baseline 802, delta 0 (same as 64-04 and 64-05) |
| `/page` | 831 KB, baseline 834, delta -3 (same as 64-01 to 64-05) |
| `.bundle-baseline.json` | untouched |

Proposal for the orchestrator (not done here): `/page` has sat at 831 against a 834 baseline since 64-01; the gate lets it move down. Whether to lower it to 831 is the orchestrator's call; the baseline file was not edited.

## Full suite (`npm run test`, once)

2181 passed, 283 skipped, 7 failed on the first run. After triage:

| Spec | Class | Resolution |
|---|---|---|
| `phase54/governance-inbox` INBOX_CHIPS | caused by 64-05 (handover chip) | expected list gains `handover` |
| `phase40/dat01` sops write census | caused by 64-05 (`reassignApprovalStep` writes `approval_snapshot`) plus two ADR-0015 clear-stamp writes never classified | three exempt entries with reasons, count 39 to 42 |
| `phase26/spine-regression` R8 | stale since 2026-10-15 (`complete_walk` RPC replaced the insert) | accepts insert or RPC, and now also fails on a delete |
| `phase46/sop-edit-owner-access` (4 tests) | environment: `verifyOtp failed: Request rate limit reached` (full eval had spent the budget) | re-run once alone: 13 of 14 pass; the last still hit the same rate limit. Not looped. |

Compared with Phase 63's list: no new environment-only failure type; the phase46 OTP probes are the same shape.

## Deviations from Plan

**1. [Rule 1 - Bug] sop-ledger eval B asserted the pre-ADR-0023 order** (all hazards first). Fixed the assertion to the walking order shown in the screenshot; C to F ran green afterwards. Commit `a22f36f4`.

**2. [Rule 1 - Bug] People grid sticky column overlapped the tabs on a scrolled phone** (deferred from 64-03). `isolate` on the scroll box; verified on a new deployed screenshot. Commit `17b5004a`.

**3. [Rule 1 - Bug] Specs broken by 64-05 and older shapes** (governance-inbox, dat01, spine-regression) fixed as above.

**4. Screenshot coverage.** Not every one of the ~300 screenshots was opened; all 64-* and eight cross-role siblings were. The rest are covered by assertions that all passed. Stated in 64-EVAL.md.

Fix rounds used: 2 of 2.

## Deferred Issues

- phase46 live probe `IMAGES NEGATIVE` red on OTP rate limit only; re-run after the hour rolls over.
- Chart view shot cuts before the Suspended tag (coverage gap, tag shown in grid, phone and sheet shots).
- An admin cannot untick an already-linked suspended worker in the supervises picker (from 64-05).

## Candidates for global Cross-Project Learnings

- A signed JWT stays valid after its session is revoked, so any RLS that trusts token claims keeps a removed user in until expiry; re-check the membership row in the policy helper, and treat session revocation as sign-out only. (Applies to any Supabase multi-tenant project; the orchestrator may promote it. The global file was not edited.)

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

- 64-EVAL.md present; 19 `64-member-` references.
- Commits `e38fdeaf`, `a22f36f4`, `17b5004a` in `git log`, pushed to origin master.
- `grep -c "[x] **MEMB-"` on REQUIREMENTS.md prints 13; VALIDATION frontmatter `nyquist_compliant: true`, `wave_0_complete: true`.
