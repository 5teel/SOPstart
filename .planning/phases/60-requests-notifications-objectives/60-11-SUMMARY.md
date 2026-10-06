---
phase: 60-requests-notifications-objectives
plan: 11
subsystem: office
tags: [requests, office, tabs, receipts, ledger, evals]
requires:
  - phase: 60-05
    provides: "OfficeInbox.requests, officePinCount, listOpenRequests"
  - phase: 60-04
    provides: "answerRequest"
provides:
  - "Office Requests tab (second in order); supervisors get Inbox + Requests"
  - "RequestRow with Accept / Decline, agent chip, link-carrying receipts that hold"
  - "Decisions about-line for request rows"
  - "postCron eval helper (wrong bearer -> 401, then CRON_SECRET mismatch fails fast)"
affects: [60-12, 60-16, 60-18]
tech-stack:
  added: []
  patterns: ["RowDone gains link / hold / after", "tab patches SHELL_KEY with officePinCount, never invalidates"]
key-files:
  created:
    - src/components/office/RequestsTab.tsx
    - src/components/office/RequestRow.tsx
  modified:
    - src/lib/shell/office-tabs.ts
    - src/components/office/OfficePane.tsx
    - src/components/office/InboxRow.tsx
    - src/actions/office.ts
    - scripts/check-bundle-size.ts
    - .planning/codebase/CAPABILITY-MATRIX.md
    - src/lib/journeys/journeys.ts
    - tests/evals/requests.eval.ts
    - tests/evals/office.eval.ts
key-decisions:
  - "Receipt tail after the ledger words is a separate `after` field on RowDone (observe-me: 'They've been told you'll observe.')"
  - "A link is only offered when the ledger write succeeded; a failed-ledger receipt has no link and uses the failed styling"
  - "Request-decision about-line reads only asker + about_title from details; notes never leave the server"
requirements-completed: [RQS-02, RQS-04]
duration: ~35 min
completed: 2026-10-06
---

# Phase 60 Plan 11: Office Requests tab Summary

**Requests tab in the Office: one row per open request with Accept and Decline, agent-raised rows marked, receipts that carry a link and hold until the next action.**

## Accomplishments

- **Tab order:** `OFFICE_TABS = inbox, requests, decisions, people, access`; admin / safety manager see all five, supervisor `['inbox','requests']`, worker none. `WIDE_TABS` unchanged (Requests is normal width). `parsePlace` whitelists `requests` automatically, so 60-03's place case now selects the Requests tab.
- **Receipt hold rule:** a `RowDone` with `hold` is not cleared by the 10 s timer; it clears on the next receipt or a tab change. The link renders as a `next/link` after the words. Change-a-SOP: "Open the SOP" (editor for admin / safety manager, browse address for a supervisor, F-23). New SOP: "Start the SOP" for admin / safety manager only. Observe-me: "Accepted · logged in the decision ledger. They've been told you'll observe."
- **Pin / count agreement:** `RequestsTab.handleDone` refetches `OFFICE_INBOX_KEY`, then patches `SHELL_KEY.inboxCount` with `officePinCount(items, requests)` via `setQueryData` (admins only); the Requests segment shows `requests.length`.
- **Decisions:** `listDecisions` selects `details` and reads a request decision as "<asker>'s request about <about_title>" (asker from `asker_user_id` via the existing `userLabels` call, or `asker_agent`); falls back to the summary.
- **Matrix / journeys:** new row "Office -- Requests tab"; Inbox row text updated; Office journey gains a Requests step (`tab=requests`).
- **Eval cases filled (2 of 13 fixme, 11 remain):** supervisor Requests tab + pin + receipt; agent request from the machines sweep (wrong bearer 401 first, real secret, accept screenshot `60-requests-tab`, decline dialog `60-decline-dialog`, second sweep raises nothing). Authored and `--list`ed only, not run.

## Verification

- `npx tsc --noEmit` clean; `npm run build` exit 0, "Marker self-validation OK".
- Bundle: `/page` 833 KB (baseline 834, Δ -1 KB); `/sops/[sopId]/page` 794 KB (baseline 792, Δ +2 KB, at the tolerance edge; the new code lives only in the lazy Office chunk). `.bundle-baseline.json` untouched.
- phase60 + phase59 + phase15-stubs: 323 passed, 46 skipped (fixme). phase46 matrix-doc 9 passed. `--list --project=evals requests` lists 13 cases.

## Repointed pins

- `tests/phase59/place-tab.spec.ts` (five tabs, supervisor two, requests normal width)
- `tests/phase59/office-pane-structure.spec.ts` (hold rule, requests arm, ledger-suffix regex now allows the `after` tail)
- `tests/phase59/ledger-read.spec.ts` ("details never leave the server" now pins that notes are never read and `details` is never returned)
- `tests/phase59/capability-matrix.spec.ts`, `tests/phase60/capability-matrix.spec.ts` (new case), `tests/phase60/notification-places.spec.ts`
- `tests/evals/office.eval.ts`: idle supervisor and supervisor cases now expect two tabs, no chips.

## Deviations from Plan

**1. [Rule 1 - Pinned spec] Repointed two pins the plan did not list** (`ledger-read.spec.ts`, and the ledger-suffix regex in `office-pane-structure.spec.ts`). Both asserted exact earlier text that this plan legitimately changes. Committed with Task 1.

**2. [Ordering] `src/actions/office.ts` (Decisions about-line) committed with Task 1, not Task 2**, because the Task 1 spec file pins it and would otherwise fail between commits.

## Known Stubs

None.

## Threat Flags

None. `answerRequest` still re-checks the session role; a worker's `?tab=requests` resolves to the Inbox at render time; "No requests waiting." is a forbidden marker for `/page`, self-validated.

## Commits

- cb0f9277: Requests tab, row, receipt link slot, Decisions about-line, repointed pins
- 2ebe1a61: matrix, journeys, eval cases

Not pushed (per instruction).
