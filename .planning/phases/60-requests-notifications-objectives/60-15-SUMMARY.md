---
phase: 60-requests-notifications-objectives
plan: 15
subsystem: shell
tags: [overview, notifications, requests, objectives, react-query]
requires: [60-06, 60-13]
provides:
  - SiteOverview lazy body (Objectives, Notifications, My requests, Office line)
  - overview-focus helper (requestOverviewSection, takeOverviewSection, OVERVIEW_SECTION_EVENT)
affects: [60-16]
key-files:
  created:
    - src/components/shell/SiteOverview.tsx
    - src/lib/shell/overview-focus.ts
  modified:
    - tests/phase60/overview-structure.spec.ts
decisions:
  - "Notification reads and mark-read use the browser client under RLS; no server action (Next 16.2.1 action-queue orphan)"
  - "My requests section hides when all three groups are empty (plan text), so the 'Ask for a new SOP' header action lives only inside a non-empty section; workers still have 'Make a request' on the machine panel"
metrics:
  tasks: 2
  completed: 2026-10-06
---

# Phase 60 Plan 15: Site overview body Summary

A self-contained lazy `SiteOverview` showing, in order, Objectives, Notifications (browser-client reads, mark-read of `read_at` only, up to five unread plus "Show read"), My requests (Asked of you / You asked / Answered) and the "Open requests in the Office" line. Nothing mounts it until 60-16.

## What was built

- `src/lib/shell/overview-focus.ts`: plain module; one pending section, a window event, `takeOverviewSection()` clears it.
- `src/components/shell/SiteOverview.tsx` (`'use client'`, no CSS import, props `role, select, machines, departments`):
  - **Objectives** (`overview-objectives`): shared `useObjectives()` (key `OBJECTIVES_KEY`); site line, then department lines in `departments` order; admin / safety manager always see the section with a lazy `ObjectiveSlot` (which loads `ObjectiveEditor`) for the site.
  - **Notifications** (`overview-notifications`): two browser-client queries under `NOTIFICATIONS_KEY` (unread, limit 50) and `[...NOTIFICATIONS_KEY, 'read']` (last 10); window-focus refetch, no interval. Opening a row dims it, updates `read_at` with a 3 s ceiling (failure still navigates), invalidates both keys, then `placeTarget`: select target goes through `select()` (overview also requests the My requests scroll), a SOP address goes by `router.push` inside the click handler only.
  - **My requests** (`overview-requests`): `listMyRequests` + `groupMyRequests`; Withdraw (no dialog, "Withdrawn."), Decline (`ask-decline`, `ReasonDialog`, `declineAsk`), Stop asking (`ReasonDialog`, `stopAsking`); 10 s receipt replaces the row then the list refetches; "Show all n" after five; "Ask for a new SOP" via lazy `RequestComposerTrigger` for workers and supervisors.
  - **Office line** (`overview-office-link`): `OFFICE_INBOX_KEY`, requests count, `select({ kind: 'room', id: 'office', tab: 'requests' })`, hidden at 0.
  - `['user-sop-assignments']` is invalidated on a decline, on opening an `asked` notification, and once per new set of unread `asked` ids.

## Queries and keys

`OBJECTIVES_KEY`, `NOTIFICATIONS_KEY`, `[...NOTIFICATIONS_KEY, 'read']`, `MY_REQUESTS_KEY`, `OFFICE_INBOX_KEY`, `['user-sop-assignments']`. `SHELL_KEY` is never invalidated.

## Verification

- `npx tsc --noEmit`: clean.
- `npm run build`: passes. `/page` 834 KB (Δ 0). `/sops/[sopId]` reads 794 KB vs 792 baseline (Δ +2, within the gate's tolerance); nothing statically imports the overview, so that figure is from earlier plans, not this one.
- phase60 (including the 9 live `overview-structure` cases), phase57 and phase15-stubs projects: 323 passed, 25 skipped, 0 failed. Token lints pass.
- `SiteSummary.tsx` untouched.

## Deviations from Plan

**1. [Rule 3 - Blocking] `update({ read_at } as never)`**: the hand-extended `notifications` table type resolves `Update` to `never` under the browser client, so `tsc` rejected the call. The payload is cast with a comment; the column is still `read_at` only, and RLS grants no other. Regenerating `database.types.ts` would remove the cast.

**2. [Plan reading] Decline dialog body** says "Whoever asked will see your reason." because `MyRequest` carries no asker name.

**3. [Plan reading] Section hide rule** follows the plan's "absent when all three groups are empty"; the original fixme about the `/page` marker is 60-16's job (mounting), so the spec asserts instead that no static importer exists.

## Known Stubs

None. The overview is intentionally unmounted until 60-16.

## Self-Check: PASSED

- src/components/shell/SiteOverview.tsx: FOUND
- src/lib/shell/overview-focus.ts: FOUND
- Commits b5c12eb8 (feat) and 95c96c23 (test): FOUND
