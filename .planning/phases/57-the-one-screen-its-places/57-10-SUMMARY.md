---
phase: 57-the-one-screen-its-places
plan: 10
subsystem: testing
tags: [playwright, deployed-eval, rooms, validation]
requires: [57-01, 57-02, 57-03, 57-04, 57-05, 57-06, 57-07, 57-08, 57-09]
provides:
  - one-screen deployed eval (20 tests, three roles, signed-out, real org read-only)
  - evals repointed off every retired surface
  - Smoko and Workshop hit-areas tuned onto the real scene's floor
  - 57-EVAL.md (44/44 on sopstart.com) and signed-off 57-VALIDATION.md
affects: []
key-files:
  created: []
  modified:
    - tests/evals/one-screen.eval.ts
    - tests/evals/governance.eval.ts
    - tests/evals/dead-surface.eval.ts
    - tests/evals/site-editor.eval.ts
    - tests/evals/cut-features.eval.ts
    - tests/phase55/deletion-sweep.spec.ts
    - tests/phase57/repoint-inventory.spec.ts
    - src/lib/site/rooms.ts
    - .planning/phases/57-the-one-screen-its-places/57-VALIDATION.md
    - .planning/phases/57-the-one-screen-its-places/57-EVAL.md
    - CLAUDE.md
  deleted:
    - tests/evals/plant-home.eval.ts
    - tests/evals/sop-surface.eval.ts
decisions:
  - "Smoko and Workshop moved to empty floor on the real scene; Office and Noticeboard unchanged"
  - "plant-home and sop-surface evals deleted; their still-relevant assertions live in one-screen.eval.ts"
metrics:
  completed: 2026-10-05
  tasks: 3
requirements-completed: [SHL-01, SHL-02, SHL-04, SHL-05, PLC-01, PLC-02, PLC-03, PLC-04, PLC-05]
---

# Phase 57 Plan 10: Deployed-eval sign-off Summary

The phase is proven on sopstart.com: 44 of 44 evals pass at `5fe93d3` for worker, supervisor, admin, signed-out and the read-only real org. I read every screenshot. The first eval run passed too, but the real-org shot showed two rooms in the wrong place, so I moved them.

## Commits

| Commit | What |
|---|---|
| `9e9708c7` | `test(57-10)`: one-screen eval (19 tests at the time), four evals repointed, plant-home and sop-surface deleted, inventory 57-10 live |
| `5fe93d33` | `fix(57-10)`: Smoko and Workshop onto the real scene's floor |
| `e342823d` | `docs(57-10)`: 57-EVAL.md, 57-VALIDATION.md signed off, CLAUDE.md learning, pathways check folded into the eval |

Pushed to origin/master (48 phase commits went with the first push).

## What was done

**Task 1.** `one-screen.eval.ts` now has 20 tests and zero `fixme`. It covers:
- **Worker.** Three panes with four signposts and no header; map click equals list click; Esc and close return to the overview; machine, Office, machine shows no stale detail; search lights shapes; Now card; walking a SOP from a machine and from the Noticeboard; deep links (`?place=`, worker `?place=edit`, a bad token); a bridge page and its Back link; the worker due pin; a phone layout with 44px+ rows.
- **Supervisor.** Office card with a number that matches the Office pin.
- **Admin.** Health pin on EVAL Press (owner reset first); Office count equals the governance "N open"; machine detail with Walk, Edit and new-SOP-for-machine; Workshop drafts; edit mode with add, remove and the in-use refusal; every retired address.
- **Other.** Real org read-only with a zoom shot per room; signed-out Log In; the pathways "0 not mapped" check.

The testids and assertions follow the [2026-09-29] shared-org rules: by name or id, `SLOW` after navigation, no "exactly N".

- **Repointed evals.** governance (floor-health asserts moved to `/`, test E is now the Office card), dead-surface (access view and legacy list addresses), site-editor (`/?place=edit`, worker sees no editor), cut-features (`/`).
- **Folded in and deleted.** From `plant-home`: scene render, EVAL Press due pin, Now card, panel and camera, department chip fit, ask-bar highlight, no-scope-column. From `sop-surface`: the pathways zero-unmapped check, the worker-sees-no-library-table checks, and the legacy governance URLs.
- **Not folded.** The admin library table, chips, filters and deep links, because the table is deleted (57-09). The "no site means a list" fallback is not asserted; no list exists any more.
- **Sweeps.** The `plant-home` exclusion is gone from phase55's deletion sweep, and `57-10` is live in the repoint inventory.

**Task 2.** `npm run build` with the bundle gate (`/page` 831 KB, `/sops/[sopId]/page` 795 KB, both delta 0) and `tsc` were clean. I ran `npm run test` once, ran `node scripts/eval-fixtures.mjs` (it created the supervisor), pushed, then ran `npm run eval -- --phase 57`.

### Full-suite comparison

20 failures, none from phase 57. Anything not on the orchestrator's baseline is marked.

| Group | Count | Cause |
|---|---|---|
| phase11-stubs | 8 | Baseline: SB-AUTH-01, SB-LAYOUT-01/02/D01/06/13/16, SB-SECT-05 |
| phase25-integration `wizard-sop-dept.spec.ts:61` | 1 | Baseline |
| phase46 live probes | 6 | `verifyOtp failed: Request rate limit reached`, the shared OTP budget; not re-run |
| phase12.5-stubs | 5 | **Not on the baseline.** `ECONNREFUSED localhost:3000` (and one `ERR_CONNECTION_REFUSED`). `sb-ux-blocks` and `sb-ux-blueprint` need a dev server on :3000, which is not running; none of the five touches phase-57 code. I did not re-run them on a pre-phase commit. |

### Screenshots read

Read: worker-overview, worker-zoomed, worker-mobile, worker-search, worker-noticeboard, supervisor-overview, admin-overview, admin-machine, admin-edit, admin-edit-refused, admin-office, bridge-governance, and the real-org overview plus per-room shots (second run). Per-shot results are in `57-EVAL.md`. In short:
- Pastel tints and tokens render; the red health pin and refusal text show their colour.
- Mobile rows are glove-sized, and the admin Office card, Workshop drafts, Noticeboard body and edit strip all have content.
- The eval-site scene is grey placeholder boxes, so the room outlines there sit on empty ground. That proves rendering, not a meaningful location.

### Room placement

The first real-org screenshot showed Smoko and Workshop on the white ground outside the building. I pulled the real org's scene and machine polygons, overlaid them with the rooms and a 0.1 grid, and chose empty floor:
- **Smoko:** right of the pallet stack, clear of the Office room.
- **Workshop:** on the floor under the workbench, in front of the band saw.
- **Check:** no room overlaps a machine polygon of that scene.
- **Unchanged:** the Noticeboard sits on empty floor between the IS machines and the pallets. The Office sits on the Office terminal, which is expected (D-18).
- **Evidence:** `rooms.spec.ts` stays green, and the second run is 44/44.

**Task 3.** `57-VALIDATION.md` is `status: complete`, `wave_0_complete: true`, with every row green and the checklist ticked. The D-01 descope of "an admin can position each room's shape" is recorded as a Deferred Idea, not a gap. One CLAUDE.md learning was added, covering the unchecked fixed-fraction geometry.

## Deviations from Plan

**1. [Rule 1 - Bug] Room geometry off the floor.** Found at the first screenshot read. Fixed in `src/lib/site/rooms.ts` (`5fe93d33`); described above.

**2. [Rule 3 - Blocking] Admin machine detail has no `admin-panel-open` testid.** The governance eval's test B asserted a testid the 57-05 body does not have. I assert the title link by its role and name instead. Same file, same commit as Task 1.

**3. [Rule 2 - Coverage] Pathways check re-added.** Deleting `sop-surface` would have dropped the deployed "0 not mapped" check that CLAUDE.md's pathways rule leans on. I added it to `one-screen.eval.ts` and ran it alone against sopstart.com: 1 passed. It was not part of the 44-test run.

**4. Governance test A no longer asserts the red pin on the governance page.** The floor card is gone (57-05); the pin is asserted on `/` by the one-screen eval and in governance test D.

## Known Stubs

None.

## Threat Flags

None. The evals write only as eval-site users in the eval-site org. The real-org test is read-only: one overview shot plus four room zooms.

## Notes for Simon

- On the real org the Office terminal is a machine under the Office room, and the room wins the click. Reach the machine from its list row.
- The eval site's scene is placeholder boxes: rooms render there but mean nothing. The real scene is where placement is judged.

## Self-Check: PASSED

- Files: `tests/evals/one-screen.eval.ts`, `src/lib/site/rooms.ts`, `57-EVAL.md`, `57-VALIDATION.md` exist; `plant-home.eval.ts` and `sop-surface.eval.ts` are gone.
- Commits `9e9708c7`, `5fe93d33`, `e342823d` are in `git log`, and the first two are pushed.
- STATE.md and ROADMAP.md are not modified.
