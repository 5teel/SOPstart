---
phase: 60-requests-notifications-objectives
plan: 03
subsystem: models
tags: [requests, notifications, objectives, pure-modules, playwright]
requires: [60-01]
provides:
  - src/lib/requests/model.ts (kinds, states, words, role rules, note rules, officePinCount, groupMyRequests, view types)
  - src/lib/notifications/kinds.ts (kinds, words, notificationTitle, dedupeKey)
  - src/lib/notifications/places.ts (notificationPlace, isSafePlace, placeTarget)
  - src/lib/objectives/model.ts (subjects, OBJECTIVE_MAX, ObjectiveView, objectiveLine, setByWords, normaliseObjectiveText)
  - OBJECTIVES_KEY, MY_REQUESTS_KEY, NOTIFICATIONS_KEY in src/lib/shell/query-keys.ts
affects: [60-04, 60-05, 60-06, 60-07, 60-08, 60-09, 60-10, 60-11, 60-12, 60-13, 60-14, 60-15, 60-16]
key-files:
  created:
    - src/lib/requests/model.ts
    - src/lib/notifications/kinds.ts
    - src/lib/notifications/places.ts
    - src/lib/objectives/model.ts
  modified:
    - src/lib/shell/query-keys.ts
    - tests/phase60/request-model.spec.ts
    - tests/phase60/notification-places.spec.ts
    - tests/phase60/objective-model.spec.ts
key-decisions:
  - "Notification titles use a first name (not the full name), so a surname never lands in a stored title"
  - "setByWords runs on the server and ObjectiveView.setByLabel carries the finished words, so an admin email never reaches a worker's browser"
  - "placeTarget returns a Place object for select (what the shell's select() takes), and the overview for anything unsafe"
requirements-completed: []
duration: ~20 min
completed: 2026-10-06
---

# Phase 60 Plan 03: Pure Models Summary

Four plain, directive-free modules fix the request, notification and objective contracts once, each backed by a live spec; three React Query keys joined `query-keys.ts`.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | bb099430 | requests model and spec |
| 2 | 33fcdae0 | notification kinds / places, objectives model, query keys, two specs |

## Exports

- **requests/model.ts**: `REQUEST_KINDS`, `RAISABLE_KINDS`, `REQUEST_STATES`, `REQUEST_KIND_WORDS` (do_sop reads "Asked to do a SOP"), `REQUEST_STATE_WORDS`, `ROLE_PLURAL`, `MIN_NOTE`, `MAX_NOTE`, `canAnswerRequests` (= `canAsk`), `subjectTypesFor`, `noteRule`, `declineNoteRule`, `officePinCount`, `groupMyRequests(rows, me, now, youAskedLimit = 5)` returning `{ askedOfYou, youAsked, youAskedTotal, answered }`, types `RequestSubject`, `OfficeRequest`, `MyRequest`.
- **notifications/kinds.ts**: `NOTIFICATION_KINDS`, `NOTIFICATION_KIND_WORDS`, `notificationTitle(input, now)` (discriminated input; capped at 200), `dedupeKey(input)`.
- **notifications/places.ts**: `notificationPlace(kind, { sopId })` (throws on a non-UUID), `isSafePlace`, `placeTarget` -> `{ type: 'select', place: Place } | { type: 'href', href }`.
- **objectives/model.ts**: `OBJECTIVE_SUBJECTS`, `OBJECTIVE_MAX`, `ObjectiveView`, `setByWords`, `normaliseObjectiveText` (`{ ok, text | message }`), `objectiveLine(o, now, prefix?)` returning `{ prefix, text, when, overdue, setBy, agent, unconfirmed }`.

## Results

- `npx playwright test --project=phase60`: 38 passed, 93 skipped (later plans' stubs), 0 failed. The three specs hold 27 live cases, no `test.fixme` left in them.
- `npx tsc --noEmit`: clean.
- No `'use server'` or `server-only` in any of the four modules (asserted by the specs).

## Deviations from Plan

- **Extra exports for the spec stubs**: `REQUEST_STATE_WORDS` and `declineNoteRule` (the Wave 0 stubs named a words entry per state and a decline-note validator).
- **TDD order**: the modules were written alongside the specs and the RED run was not captured separately; both were committed together per task.
- **Rule 1 fix during Task 2**: the `request_answered` title branch failed tsc narrowing; narrowed with `'about' in input`.
- **Not pushed**: per the orchestrator instruction, no `git push`.

## Known Stubs

None. `placeTarget('/?place=office&tab=requests')` selects the plain Office because `parsePlace` whitelists tabs and `requests` is not an Office tab until 60-11; the spec pins that current behaviour and 60-11 will update it.

## Threat Flags

None. T-60-11 (open redirect through a place) and T-60-12 (email or free text in a title) are mitigated by `isSafePlace` / fixed templates and by `setByWords` plus note-free titles.

## Self-Check: PASSED

Four modules and three specs present; commits bb099430 and 33fcdae0 exist.
