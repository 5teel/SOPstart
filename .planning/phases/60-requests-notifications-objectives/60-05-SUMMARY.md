---
phase: 60-requests-notifications-objectives
plan: 05
subsystem: office-data
tags: [office, inbox, requests, pin, journeys]
requires: [60-03, 60-04]
provides:
  - listOpenRequests() in src/lib/governance/load-inbox.ts; LoadedInbox.requests
  - OfficeInbox.requests (admin, safety manager, supervisor)
  - officePinCount(items, requests) wired in getAdminShell, WorkerShell, InboxTab
  - Machines inbox kind retired; stale-department row reads "Open SOP"
affects: [60-11, 60-12, 60-16, 60-17]
key-files:
  modified:
    - src/lib/governance/inbox.ts
    - src/components/office/InboxRow.tsx
    - src/lib/governance/load-inbox.ts
    - src/actions/office.ts
    - src/actions/shell.ts
    - src/components/shell/WorkerShell.tsx
    - src/components/office/InboxTab.tsx
    - src/lib/journeys/journeys.ts
    - tests/phase59/{inbox-model,office-pane-structure}.spec.ts
    - tests/phase54/governance-inbox.spec.ts
    - tests/phase57/one-query.spec.ts
    - tests/phase60/{office-requests,retirement-sweep,repoint-inventory}.spec.ts
    - tests/evals/{office,one-screen}.eval.ts
key-decisions:
  - "deriveInbox lost its machines and links inputs (plan item 1); the Phase 54 call shapes that passed them were edited, not kept as ignored inputs"
  - "listOpenRequests uses the session client (RLS requests_read) and the raisable kinds only, so an ask is never an Office row"
  - "Evals read the Requests tab count if it exists (absent until 60-11) so pin = Inbox + Requests holds before and after the tab lands"
requirements-completed: []
completed: 2026-10-06
---

# Phase 60 Plan 05: Office Data Summary

The Machines inbox kind is gone, the one Office read now carries open requests beside the inbox rows, and the pin is computed by `officePinCount` in all three places.

## Commits

| Tasks | Commit | What |
|-------|--------|------|
| 1 + 2 | 7388fbd6 | model, row, read, shell, pin, journeys, source-contract specs |
| 3 | f7441663 | evals repointed, `'60-05'` added to `LIVE_PLANS` |

Tasks 1 and 2 share `load-inbox.ts` and `office.ts` (the call-site argument removal and the new requests list sit in the same hunks), so they were committed together rather than split with partial staging.

## Model diff

- `inbox.ts`: `'machines'` removed from `InboxChip`, `InboxItem['kind']`, `INBOX_CHIPS`, `inboxCounts`; the `Write a SOP` action label, the machines loop, the `machinesWithoutSops` import (the function stays in `admin-health.ts` for 60-08) and the `machines` / `links` inputs of `deriveInbox` are gone. Header comment says machines without SOPs arrive as agent-raised new-SOP requests.
- `InboxRow.tsx`: the `fix` branch is a `Link` to `focusHref(g.id, { mode: 'edit', from: 'office' })` reading "Open SOP". No machines-only branch existed to drop.
- `load-inbox.ts`: `listOpenRequests()` (session client, state open, raisable kinds, newest first; asker via `userLabels` or the agent name, about-title via `aboutTitles`); `loadInbox` adds it to its single `Promise.all` and returns `requests`. `OfficeInbox` in `office.ts` gains `requests: OfficeRequest[]`; the supervisor branch reads it beside its two reads. Neither `office.ts` nor `shell.ts` imports the service role.

## Pin call sites

- `src/actions/shell.ts`: `inboxCount: officePinCount(inbox.items, inbox.requests)` (chips still count items only)
- `src/components/shell/WorkerShell.tsx`: `pending = officePinCount(inbox.items, inbox.requests)` (supervisor pin and card)
- `src/components/office/InboxTab.tsx`: `SHELL_KEY` `setQueryData` patch uses `officePinCount(freshItems, fresh.requests)`; no `invalidateQueries(SHELL_KEY)` in `src/components/office`

## Repointed specs and evals

- phase59 `inbox-model` (chip order, no machines kind, supervisor call shape, pin literal), `office-pane-structure` (fix link and "Open SOP", shell patch literal)
- phase54 `governance-inbox` (the two machines cases became one "no machines input, no machines chip" case; `loadInbox` Promise.all assertion scoped to `loadInbox` and now lists `listOpenRequests()`)
- phase57 `one-query` (two pin literals)
- phase60 `office-requests` (four live source-contract cases on the wiring; tab cases stay fixme for 60-11), `retirement-sweep` (60-05 block live), `repoint-inventory` (`LIVE_PLANS = ['60-05']`)
- `office.eval.ts`: pin helper returns `total` = Inbox tab + Requests tab count (absent tab counts 0); the Machines case now asserts no machines chip, no machines-kind row and no oven row, with the zero-SOP oven fixture kept so the negative is meaningful. The quoted retired literal was dropped from the eval because the inventory walk flags it. The idle-supervisor "no tab control" case is untouched (60-11).
- `one-screen.eval.ts`: supervisor row count and admin Inbox tab count subtract the Requests tab count.
- `journeys.ts`: Office queue journey drops machines and "Fix assignment", `fix` screen is "Open the SOP" at `/sops/[sopId]`, branch "Open SOP (stale department)", detail points machines-without-SOPs at the Requests tab. Remaining `/assign` journey references belong to the assign page (60-17).

## Results

- `npx tsc --noEmit` clean.
- `npm run build` exit 0. Bundle: `/page` 833 KB (baseline 834, Δ -1 KB); `/sops/[sopId]/page` 794 KB (baseline 792, Δ +2 KB, within tolerance, unchanged from 60-04). `.bundle-baseline.json` untouched.
- phase60 + phase59 + phase54 + phase57 projects: 388 passed, 0 failed (82 skipped, later plans' stubs). `npx playwright test --list --project=evals` lists 87 tests.
- Not run: live probes, deployed evals, the full suite. Not pushed (per orchestrator). STATE.md and ROADMAP.md untouched.

## Deviations from Plan

- **[Rule 3 - blocking]** `tests/phase57/one-query.spec.ts` pinned `inbox.items.length` literals for the shell and WorkerShell; repointed in the same commit. Not in the plan's file list.
- Tasks 1 and 2 committed together (see above).
- The `office.eval.ts` negative assertion on the retired action label was removed: the repoint inventory flags any quoted retired token outside `tests/phase60/`, and the sweep spec there already asserts its absence from source.

## Known Stubs

None. The Requests tab count the evals read is absent until 60-11 and is handled as 0.

## Threat Flags

None. T-60-21 (worker still refused; requests read under RLS), T-60-22 (one helper, spec asserts each call site) and T-60-23 (link built by `focusHref`) are mitigated as specified.

## Self-Check: PASSED

Commits 7388fbd6 and f7441663 exist; all modified files present.
