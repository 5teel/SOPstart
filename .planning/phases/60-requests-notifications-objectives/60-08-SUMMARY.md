---
phase: 60-requests-notifications-objectives
plan: 08
subsystem: cron
tags: [cron, notifications, requests, proxy]
requires: [60-04, 60-07]
provides:
  - "POST /api/cron/review-due (owner review-due notifications, once per due date)"
  - "POST /api/cron/machines-without-sops (agent-raised new-SOP request per bare machine)"
  - "isCronAuthorized, handleCron, reviewDueTargets, runReviewDueSweep, runMachinesWithoutSopsSweep"
affects: [src/lib/supabase/middleware.ts]
tech-stack:
  patterns: ["bearer-first thin route over a shared handler; sweeps in a plain server module"]
key-files:
  created:
    - src/lib/cron/auth.ts
    - src/lib/cron/route.ts
    - src/lib/cron/sweeps.ts
    - src/lib/notifications/review-due.ts
    - src/app/api/cron/review-due/route.ts
    - src/app/api/cron/machines-without-sops/route.ts
  modified:
    - src/lib/supabase/middleware.ts
    - tests/phase60/review-due.spec.ts
    - tests/phase60/cron-route.spec.ts
    - tests/phase60/agent-requests.spec.ts
decisions:
  - "Both routes share src/lib/cron/route.ts (handleCron) so the 401-before-read and strict-body logic exists once; the synthesis route and its spec are untouched"
metrics:
  tasks: 2
  files: 10
completed: 2026-10-06
---

# Phase 60 Plan 08: Cron routes Summary

Two fail-closed daily cron routes (review-due notifications and agent new-SOP requests for machines with no SOP), exempted from the session proxy by exact path through `CRON_PATHS`.

## What was built

- `isCronAuthorized` copies the synthesis route's bearer check (unset secret fails closed, length check then `timingSafeEqual`). The synthesis route keeps its own copy and is untouched.
- `handleCron` checks the bearer first (401 before any read), then parses an optional body with zod `.strict()` (`{ organisationId }` UUID only). Malformed or extra-key body returns 400.
- `runReviewDueSweep` reads each org's published SOPs with an explicit org filter, selects with `reviewDueTargets` (latest published per lineage, with owner, due on or before now + 30 days), and calls `notify` with kind `review_due`, place Office, key `review_due:<sopId>:<date>`.
- `runMachinesWithoutSopsSweep` reads `site_machines` / `sop_machines` per org, calls `raiseRequestAsAgent` with `DEFAULT_AGENT_NAME` for each machine `machinesWithoutSops` returns, and returns `{ raised, skipped }`. Never calls `recordDecision`.
- `middleware.ts`: single-path equality replaced by `CRON_PATHS` (synthesis-sweep, review-due, machines-without-sops), still named `isCronRoute`.

## Results

- phase60: 102 passed, 54 skipped (other plans' fixmes; none left in review-due, cron-route, agent-requests)
- phase26.5 (including synthesis-sweep-auth) and phase15-stubs green; `npx tsc --noEmit` clean; `npm run build` exit 0, lists both routes.

## Commits

- 5a2bda16 feat(60-08): daily review-due cron route with fail-closed bearer and exact-path proxy exemption
- ec5945ca feat(60-08): daily machines-without-SOPs cron route raising agent new-SOP requests

## For 60-18 (Railway schedules; Simon runs these after deploy)

```
curl -X POST https://sopstart.com/api/cron/review-due -H "Authorization: Bearer $CRON_SECRET"
curl -X POST https://sopstart.com/api/cron/machines-without-sops -H "Authorization: Bearer $CRON_SECRET"
```

## Deviations from Plan

- **Shared handler file added** (`src/lib/cron/route.ts`, not in the plan's file list): keeps both route files thin and the auth-then-body order in one place. Not a rule deviation, a small structure choice.
- **Stub case "the ledger row carries the agent name" replaced**: the agent producer writes no ledger row by design (60-04), so the case now pins the agent name passed to `raiseRequestAsAgent` and the absence of `recordDecision`.
- Specs are source-contract plus pure-function checks; no live route calls were made (per instructions). Live behaviour is for the 60-16/60-18 deployed eval.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model (T-60-35..39 mitigated as specified).

## Self-Check: PASSED

All created files exist; commits 5a2bda16 and ec5945ca present.
