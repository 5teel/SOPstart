# Architecture Decision Records

Short, numbered records of decisions that shape how SafeStart is built. An accepted ADR is binding:
code, plans and phases follow it until a later ADR supersedes it.

## Rules

1. **Read before you plan or build.** Every `/gsd-plan-phase`, `/gsd-execute-phase` and `/gsd-quick` run reads this index first. A plan or change that contradicts an accepted ADR stops and asks Simon — it does not proceed and does not quietly work around it.
2. **Write one when you decide something structural.** A choice about runtime shape (where work runs, what triggers it), data ownership, security boundaries, external services or infrastructure gets an ADR in the same commit as the change. Phase-local UI and naming choices stay in the phase's CONTEXT.md.
3. **Never edit an accepted ADR's decision.** To change course, write a new ADR with `Supersedes: ADR-NNNN` and set the old one's status to `Superseded by ADR-MMMM`.
4. **Enforce it where you can.** If an ADR can be checked mechanically, add a guard under `tests/lint/` (registered in a Playwright project) and name it in the ADR's `Enforced by` line.
5. Template: `0000-template.md`. Number sequentially; file name `NNNN-kebab-title.md`.

## Index

| # | Title | Status | Enforced by |
|---|---|---|---|
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted | this README · CLAUDE.md § Architecture Decisions |
| [0002](0002-no-scheduled-jobs.md) | No scheduled jobs — work runs when it is needed | Accepted | `tests/lint/no-scheduled-jobs.spec.ts` |
| [0003](0003-site-templates.md) | Site templates are code; a layout records which one it came from | Accepted | `tests/phase57/rooms.spec.ts` |
