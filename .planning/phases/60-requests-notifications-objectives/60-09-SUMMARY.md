---
phase: 60-requests-notifications-objectives
plan: 09
subsystem: objectives-server
tags: [objectives, server-actions, decision-ledger, capability-matrix, deleteSop]
requires: [60-06]
provides:
  - src/lib/objectives/core.ts (setObjectiveCore, clearObjectiveCore, confirmObjectiveCore, listObjectivesCore)
  - src/actions/objectives.ts (setObjective, clearObjective, confirmObjective, listObjectives)
affects: [60-10, 60-13, 60-14, 60-15]
key-files:
  created:
    - src/lib/objectives/core.ts
    - src/actions/objectives.ts
  modified:
    - src/actions/sops.ts
    - tests/phase60/objective-actions.spec.ts
    - tests/phase60/capability-matrix.spec.ts
    - tests/phase33/delete-sop-org-scope.spec.ts
    - scripts/decision-writers.json
    - tests/phase56/decision-writers-sweep.spec.ts
    - .planning/codebase/CAPABILITY-MATRIX.md
key-decisions:
  - "The core reads the session (org, person, role) itself and no exported function takes an organisation, so the person path and the agent path (60-10) share one role and org gate"
  - "Setter is a core argument ('person' or { agent }) that the client-reachable actions never expose: the actions file hard-codes 'person' and its schemas are strict with no setter field"
  - "A person editing an agent-set objective makes it person-set (set_by_user filled, agent and confirm pair cleared); the ledger row is objective_set with details.previous_set_by_agent. A person-set objective reports confirmed = true in the view"
  - "Select then update, insert when none, one retry as update on 23505; every update is .select()ed and a zero-row write reports failure"
requirements-completed: []
completed: 2026-10-06
---

# Phase 60 Plan 09: Objectives Server Summary

An admin or safety manager can set, change, remove and confirm the one live objective on the site, a department, a machine, a SOP (keyed on its lineage root) or a person, through one gated service-role core; each change writes one ledger row, and deleting a SOP now clears the requests, notifications and objectives about it.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | 4d57e9bd | objectives core, four actions, objective-actions spec (13 cases) |
| 2 | fb633488 | deleteSop clean-up, writer registry, sweep, matrix rows, specs |

## Exports

- **core.ts** (server-only, service role): `setObjectiveCore(input, setter)` returns `{ id, subject, text, dueOn, previous }`; `clearObjectiveCore({ subject })` returns the previous text and date; `confirmObjectiveCore({ objectiveId })` matches only an agent-set, unconfirmed row; `listObjectivesCore()` returns `{ viewerCanEdit, rows: ObjectiveView[] }`. Subject checked in the session org (department, `site_machines`, SOP, member; site has no id); SOP resolved to `lineageRoot`.
- **actions/objectives.ts** (`'use server'`, async only, no service-role import): `setObjective`, `clearObjective`, `confirmObjective` each return `{ logged }` or `{ error }`; `listObjectives()` returns the core result. One `recordDecision` after the core, literal summaries "Set an objective", "Removed an objective", "Confirmed an objective", `subject: { kind: 'objective', id }`, `sopId` the lineage root for a SOP subject. Previous text, date and agent setter go in `details`; no email anywhere.
- **sops.ts `deleteSop`**: three deletes (`notifications`, `requests`, `objectives`) each filtered on the session org, `subject_type = 'sop'` and `subject_id = sopId`, before the SOP row is deleted. A later draft's id is never the lineage root, so deleting it leaves the lineage's objective.

## Registry diff

- `tables` += `objectives`
- `extraHooks` += `setObjective` (anchor `setObjectiveCore(`), `clearObjective` (`clearObjectiveCore(`), `confirmObjective` (`confirmObjectiveCore(`)
- `allow` += the three core functions on `objectives`; `deleteSop` on `requests` and `objectives`
- `LIVE_WRITERS` += the three action keys

## Matrix rows

Added: Set, change or remove an objective (admin, safety manager); Confirm an agent-set objective (admin, safety manager); Agent sets an objective (same core gate, via the `objective.*` descriptors of 60-10, lands unconfirmed, logged as `ai_field_write`). The "Read objectives" row now names `listObjectives()`.

## Results

- `npx tsc --noEmit` clean; `npm run build` exit 0 (`/sops/[sopId]` 794 against 792, `/page` 833 against 834, both within tolerance; baselines untouched).
- phase60: 116 passed, 47 skipped (later plans); phase56: 110 passed (sweep green); phase46 source-contract (live/probe excluded) 15 passed incl. matrix-doc; phase33 `delete-sop-org-scope` 3 passed.
- No live probes were written. The phase33 spec's pre-existing live test ran because `.env.local` is present; it uses ephemeral orgs only.

## Deviations from Plan

- **Spec is source-contract only.** Order, gates, claim filters and ledger-once rules are pinned on comment-stripped source; no live DB run of the core (no live probes this run). The A-01 migration step and the no-foreign-key rule are pinned against the 00074 SQL. A deployed eval for the objective loop belongs to 60-16 / 60-18.
- **`confirmed` in `ObjectiveView`** is true for a person-set objective as well as a confirmed agent one, so the UI only needs `setByAgent && !confirmed` to flag a claim (matches `objectiveLine`).
- **Loose admin client** in the core (departments and `site_machines` are untyped; `objectives` is typed but shares the helper) with a `ponytail:` note.
- **TDD order:** specs and modules were committed together per task; RED was not captured separately. The deleteSop spec case was excluded from the Task 1 run and landed with Task 2.
- **Not pushed:** per instruction. STATE.md and ROADMAP.md untouched.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register: T-60-40 to T-60-44 mitigated as specified (role from the session inside the core; subject verified in the session org with no org parameter; strict schemas with no setter field; one ledger row per action, registered and swept; three org-scoped deletes in `deleteSop`).

## Self-Check: PASSED

`src/lib/objectives/core.ts`, `src/actions/objectives.ts` and this summary exist; commits 4d57e9bd and fb633488 exist.
