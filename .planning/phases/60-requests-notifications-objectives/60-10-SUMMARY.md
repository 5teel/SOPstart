---
phase: 60-requests-notifications-objectives
plan: 10
subsystem: agent-objectives
tags: [ai-fields, objectives, agent-layer, signals, capability-matrix]
requires: [60-09]
provides:
  - FieldContext.subjectId / agentName
  - src/lib/ai-fields/registrations/objectives.ts (objective.site, objective.department, objective.machine, objective.sop, objective.person, objectives.all)
  - readObjectiveCore (src/lib/objectives/core.ts)
  - readObjectiveSignals + SignalBundle.objectives (src/lib/agent-layer/signals.ts)
affects: [60-13, 60-18]
key-files:
  created:
    - src/lib/ai-fields/registrations/objectives.ts
  modified:
    - src/lib/validators/ai-fields.ts
    - src/actions/ai-fields.ts
    - src/lib/ai-fields/registrations/index.ts
    - src/lib/objectives/core.ts
    - src/app/api/ai-fields/read/route.ts
    - src/lib/agent-layer/signals.ts
    - src/lib/agent-layer/synthesis.ts
    - tests/phase60/ai-objective-fields.spec.ts
key-decisions:
  - "An agent objective write is ONE ledger row: the ai_field_write that applyAiWrite already writes, naming the agent. The core writes no ledger row (60-09 left that to the caller), and the descriptors do not either. Pinned in the spec"
  - "agentName is set by applyAiWrite from the validated top-level AGENT_NAMES field and overwrites anything the caller put in context (T-60-46)"
  - "The SOP id travels as subjectId, never sopId, so the published-SOP gate in applyAiWrite does not divert an objective to a proposal; the objective descriptors are stakeLevel low (A-09)"
  - "The descriptors call the plain server-only core, not an action, so the agent setter is never on a client-reachable action"
  - "Synthesis memory does carry the objectives: agent_memory.signal_source is free text (00040, no check), so 'objectives' needed no database change"
requirements-completed: []
completed: 2026-10-06
---

# Phase 60 Plan 10: Agent Objectives Summary

An agent now reads every objective (`objectives.all`) and sets one (`objective.<subject>`) through the existing `/api/ai-fields` interface, under the calling session's admin / safety manager gate, landing unconfirmed under the agent's name; the synthesis run sees the objectives in force for the SOP it reviews.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | 0b9366de | context widening, descriptors, `readObjectiveCore`, read route forwards `subjectId` |
| 2 | ba82d335 | `readObjectiveSignals`, synthesis memory observation, spec (8 cases) |

The spec file was committed with Task 2 because it covers both tasks.

## Context keys

- `FieldContextSchema` += `subjectId` (uuid) and `agentName` (`AGENT_NAMES` enum).
- `applyAiWrite`: `agentName = parsed.data.agentName ?? DEFAULT_AGENT_NAME` is spread into `safeContext` last, so a caller-supplied `context.agentName` is overwritten; the ledger subject is `context.subjectId ?? sectionId ?? sopId ?? null`.
- `acceptProposal` rebuilds `subjectId` and `agentName` with the existing four keys.

## Descriptors

- `objective.site | department | machine | sop | person`: low stake. `read` returns the current objective view (or null) via the new `readObjectiveCore` (any member, SOP resolved to its lineage root). `write` takes a string or strict `{ text, dueOn? }` and calls `setObjectiveCore(..., { agent: ctx.agentName })`; a missing `subjectId` (except site) throws.
- `objectives.all`: read-only, returns `listObjectivesCore().rows`.
- Barrel header rule updated (action or plain server core) and the new file imported.

## Signals delivery

`readObjectiveSignals(organisationId, sopId)` returns `{ lines }`: the SOP's lineage objective, its linked machines' objectives and the site objective, as `Objective · <text> · set by <agent or 'a person'>[ · unconfirmed]`. Own try/catch, explicit `organisation_id` on every query, SOP verified in the org first. In `SignalBundle` and `readAllSignals`. `writeMemoryFromSignals` appends one `Objectives in force: ...` observation (`signalSource: 'objectives'`). `sop-pack.ts` is unchanged (`git diff f1b2ff93` empty, pinned in the spec); the embedding text is untouched.

## Matrix

The "Agent sets an objective" row was added by 60-09 and already says: same core gate, lands unconfirmed, logged once as `ai_field_write`. This plan implements exactly that, so no edit was needed.

## Results

- `npx tsc --noEmit` clean; `npm run build` exit 0 (`/sops/[sopId]` 794 vs 792, `/page` 833 vs 834, within tolerance; baselines untouched).
- phase60: 118 passed, 33 skipped (later plans); phase23-stubs 14 passed; phase26.5 39 passed; phase56 99 passed; phase55 `sop-pack` 7 passed.
- No live probes run; no external API called.

## Deviations from Plan

- **[Rule 3] Read route forwards `subjectId`** (`src/app/api/ai-fields/read/route.ts`, not in the plan's file list): the read descriptors could not see a subject otherwise.
- **[Rule 3] `readObjectiveCore` added to the 60-09 core**: the descriptors may not touch a database client, and `resolveSubject` (lineage root) is private to the core.
- **Spec is source-contract plus a real run of the context schema**, no live DB run of an agent write (no live probes this run); the deployed proof belongs to 60-16 / 60-18. RED was not captured separately (spec and module committed together).
- **`sop_machines` read in signals uses an untyped client** (`ponytail:` note) because the table is not in `database.types`.
- Not pushed, per instruction. STATE.md and ROADMAP.md untouched.

## Known Stubs

None.

## Threat Flags

None beyond the register: T-60-45 (role gate lives in the core), T-60-46 (agent name validated and overwritten server-side), T-60-47 (subject checked in the session org by the core), T-60-48 (one `ai_field_write` row names the agent; row stores `set_by_agent` and stays unconfirmed).

## Self-Check: PASSED

`src/lib/ai-fields/registrations/objectives.ts` and this summary exist; commits 0b9366de and ba82d335 exist.
