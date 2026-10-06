# ADR-0001: Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-10-06
- **Decided by:** Simon
- **Supersedes:** —
- **Enforced by:** `docs/adr/README.md` rules · CLAUDE.md § Architecture Decisions (read by every GSD planner and executor)

## Context
Structural choices have lived inside per-phase CONTEXT.md files and executor summaries. A choice made in one phase is invisible to the next, so Phase 60 shipped three scheduled jobs (and Railway cron services) for work that should simply have happened when it was needed — nothing written down said otherwise.

## Decision
Structural decisions are recorded as numbered ADRs in `docs/adr/`. Accepted ADRs are binding on every plan and change until superseded by a later ADR.

## Consequences
- Planners and executors read `docs/adr/README.md` before planning or building; a contradiction stops the work and goes to Simon.
- New structural choices add an ADR in the same commit; mechanically checkable ones add a lint guard.

## How to comply
Use `0000-template.md`; add the row to the README index; link the guard in `Enforced by`.
