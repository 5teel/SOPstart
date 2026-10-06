# ADR-0002: No scheduled jobs — work runs when it is needed

- **Status:** Accepted
- **Date:** 2026-10-06
- **Decided by:** Simon ("all services in the current build scope of the app should occur when needed, not in cronjobs")
- **Supersedes:** Phase 60 decisions D-08 (daily review-due sweep) and A-08 (two cron routes + Railway schedules)
- **Enforced by:** `tests/lint/no-scheduled-jobs.spec.ts`

## Context
Phase 60 added `/api/cron/review-due` and `/api/cron/machines-without-sops`, and three Railway cron services (with the existing `/api/agent-layer/synthesis-sweep`). The services were created and then deleted the same day. A schedule adds an infrastructure dependency the app cannot see, a shared secret to rotate, work done for nobody when nothing changed, and a gap of up to a day between an event and its effect. The synthesis sweep had in fact never run, because nothing scheduled it — so SOP agent metadata was never generated automatically.

## Decision
The app has **no scheduled jobs**: no cron routes, no Railway (or other) cron services, no timers that poll for work. Every piece of work runs at the moment its result is needed — **on the event that causes it** (a write, a publish, a submit) or **on the read that needs it** (computed, or materialised idempotently, when someone loads the screen that shows it).

## Consequences
- Delete `src/app/api/cron/**`, `src/lib/cron/**`, `src/app/api/agent-layer/synthesis-sweep`, and the proxy's cron exemption list.
- No `CRON_SECRET`; no header-authenticated background routes.
- Something that only matters when a person looks at it is computed when they look; something triggered by a change runs in that change's request (after the response where it must not slow the user — Next's `after()`), never on a timer.

## How to comply (the three former jobs)
| Former job | Runs instead |
|---|---|
| Review due → owner notified | On read: loading the one screen materialises the caller's due-review notifications idempotently (dedupe key per SOP + due date) before the bell/overview read them. |
| Machine without a SOP → agent request | On the event and on read: creating or unlinking a machine (site editor) raises/withdraws the agent request; loading the Office for an answerer reconciles idempotently. |
| SOP agent metadata synthesis | On the event: publishing a SOP synthesises that SOP's metadata in `after()`; a reader that finds metadata missing or stale for the version it needs triggers synthesis for that one SOP. |
