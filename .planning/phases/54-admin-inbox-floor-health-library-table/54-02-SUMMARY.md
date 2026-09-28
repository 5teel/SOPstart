---
phase: 54-admin-inbox-floor-health-library-table
plan: 02
subsystem: admin governance / navigation
tags: [governance, inbox, nextjs-server-page, playwright]

requires:
  - phase: 54-01
    provides: admin-health.ts, listSiteHealthForOrg, MillerSop check-input fields, phase54 harness
provides:
  - src/lib/governance/inbox.ts (deriveInbox, inboxCounts, chipMatches, INBOX_CHIPS)
  - "/governance route (server page, requireAdminContext-gated)"
  - GovernanceInbox client component (counted chips, All-clear state)
  - GovernanceQueueRow restyled in place (severity dot, title/meta/age props) — action gate untouched
  - header + /admin/governance + /admin/sops?view=attention shims + journeys.ts + roles.ts + capability matrix all pointing at /governance
affects: [54-03, 54-04, 54-05, 54-06]

tech-stack:
  added: []
  patterns:
    - "inbox derivation is a pure module reading already-computed governance flags — never re-derives isCallerNextApprover/approval_snapshot"
    - "restyle-in-place + optional display props keeps a gated action component reusable across two rendering contexts (admin-attention lens today, inbox now) without duplicating its gate"

key-files:
  created:
    - src/lib/governance/inbox.ts
    - "src/app/(protected)/governance/page.tsx"
    - src/components/admin/governance/GovernanceInbox.tsx
  modified:
    - src/components/admin/governance/GovernanceQueueRow.tsx
    - src/components/layout/TopHeader.tsx
    - "src/app/(protected)/admin/governance/page.tsx"
    - "src/app/(protected)/admin/sops/page.tsx"
    - src/lib/journeys/journeys.ts
    - src/lib/journeys/roles.ts
    - .planning/codebase/CAPABILITY-MATRIX.md
    - tests/lint/no-static-admin-lens-import.spec.ts
    - tests/phase41/nav-and-shim.spec.ts
    - tests/phase30/admin-nav.spec.ts
    - tests/phase28/governance-queue.spec.ts
    - tests/phase30/governance-fold.spec.ts

key-decisions:
  - "Server page, not a client lens: GovernanceQueueRow/OwnerPicker already end with router.refresh(); since /governance data is server-rendered, a cleared row actually leaves the inbox on refresh (the old useQuery lens left rows stale until staleTime)."
  - "Overdue rows keep GovernanceQueueRow's Confirm current button and the row title links to the builder for the review itself — confirmSopCurrent has no other caller, a builder-only button would orphan REV-04."
  - "No row uses Finish: neither governance-queue rows, stuck/failed library rows, nor no-procedure machines produce a 'finish a draft' action; stuck/failed get Retry -> builder, empty machines get Add -> /admin/sops/new plain."
  - "/admin/governance's legacy ?filter= is dropped on purpose — the inbox has no flag-filter param, so a bookmark lands on the whole inbox."

requirements-completed: [ADM-01, ADM-04]

duration: ~70min
completed: 2026-09-29
---

# Phase 54 Plan 02: Admin inbox + door repoint Summary

`/governance` is now a real admin/safety_manager route: a server-rendered inbox of one-action rows (no owner, review overdue, awaiting the caller's approval, stuck converting, machines with no procedures) built from `deriveInbox()` over three existing reads, rendered through the untouched `GovernanceQueueRow` action gate, with every door in the app — header, both legacy URLs, journeys, roles, capability matrix — now pointing at it instead of the old `/sops?view=attention` deep link.

## Performance

- **Duration:** ~70 min
- **Tasks:** 3 completed (Task 1 is TDD: 2 commits)
- **Files modified:** 15 (3 created, 12 modified)

## Accomplishments
- `src/lib/governance/inbox.ts` — pure, unit-tested derivation of governance-queue rows, stuck/failed library rows, and no-procedure machines into severity/chip-classified `InboxItem[]`, reading `row.isCallerNextApprover` (never re-deriving approver gating)
- `/governance` server page: `requireAdminContext()` gate, one `Promise.all` over `listGovernanceQueue`/`listAdminSopRows`/`listSiteHealthForOrg`, `deriveInbox()` called server-side, plain data handed to the client `GovernanceInbox`
- `GovernanceInbox` client component: counted chips (All/No owner/Overdue/Approve/Stuck/Machines), the CLEAR/"Nothing needs attention" empty state carried over verbatim, no fetching of its own
- `GovernanceQueueRow` restyled in place (severity dot, title-links-to-builder, meta line, age column) with its four-branch action gate (approve-me → unowned → stale-role → confirm-current) byte-identical — verified by regression across phase28/29/30/41 plus a new dedicated gating-reuse spec
- Header "Governance" link, `/admin/governance` shim, `/admin/sops?view=attention` param, journeys.ts, roles.ts and the capability matrix all repointed at `/governance` in the same commit as the corresponding spec updates

## Task Commits

1. **Task 1 (TDD): inbox.ts — derive the inbox rows**
   - RED: `d1669c3` test(54-02): add failing deriveInbox unit tests
   - GREEN: `f5d6ec3` feat(54-02): deriveInbox — pure inbox row derivation
2. **Task 2: /governance page, GovernanceInbox, GovernanceQueueRow as an inbox row** - `1c08896` feat
3. **Task 3: every door points at /governance** - `726e78e` feat

**Plan metadata:** (this commit) docs: complete plan

_TDD task 1 has two commits (RED → GREEN); no REFACTOR commit needed._

## Files Created/Modified
- `src/lib/governance/inbox.ts` - `deriveInbox`/`inboxCounts`/`chipMatches`/`INBOX_CHIPS`, classifies rows into chips/severity/action, never decides who may act
- `src/app/(protected)/governance/page.tsx` - the new route; admin gate, parallel reads, `deriveInbox()`, hands plain data to `GovernanceInbox`
- `src/components/admin/governance/GovernanceInbox.tsx` - client inbox list/chips/All-clear state, reuses `GovernanceQueueRow` for every governance-sourced item
- `src/components/admin/governance/GovernanceQueueRow.tsx` - restyled chrome (severity dot, meta line, age column, optional display props); action-branch gate untouched
- `src/components/layout/TopHeader.tsx` - Governance → `/governance`
- `src/app/(protected)/admin/governance/page.tsx` - now redirects straight to `/governance` (no more `?filter=`/`?view=` query building)
- `src/app/(protected)/admin/sops/page.tsx` - `?view=attention` now redirects to `/governance`; every other legacy param still falls through to `/sops`
- `src/lib/journeys/journeys.ts` - `governance-queue` journey rewritten around the inbox; `admin-onboarding` gains a `gov` screen step; `route: '/governance'` mapped (pathways coverage stays at 0 not-mapped)
- `src/lib/journeys/roles.ts` - `/sops?view=attention` row → `Governance inbox` / `/governance`
- `.planning/codebase/CAPABILITY-MATRIX.md` - Governance queue row rewritten to name `/governance` and its three self-guarded reads
- `tests/lint/no-static-admin-lens-import.spec.ts` - `GovernanceInbox.tsx` added to the `GovernanceQueueRow` import allowlist
- `tests/phase54/governance-inbox.spec.ts` - 16 live `deriveInbox` unit tests + 6 live page/component wiring source-contract tests (was 7 Wave-0 fixmes)
- `tests/phase54/inbox-reuses-governance-gating.spec.ts` - 6 live tests proving the inbox never re-derives the approval gate (was 2 Wave-0 fixmes)
- `tests/phase41/nav-and-shim.spec.ts`, `tests/phase30/admin-nav.spec.ts`, `tests/phase28/governance-queue.spec.ts`, `tests/phase30/governance-fold.spec.ts` - repointed from `/sops?view=attention` / the old shim body to `/governance`

## Decisions Made
See `key-decisions` in frontmatter — all four were already documented as deviations in the plan's own `<objective>` block (server page vs client lens, Confirm-current kept over a builder-only Review button, no Finish action anywhere, legacy `?filter=` dropped) and were followed exactly as specified rather than re-litigated during execution.

## Deviations from Plan

None — plan executed exactly as written, including the TDD RED/GREEN sequence for Task 1 (test file committed failing against a temporarily-removed module before the implementation commit).

## Known Stubs

None — every row source (`listGovernanceQueue`, `listAdminSopRows`, `listSiteHealthForOrg`) is real, org-scoped data; the inbox renders "Nothing under this filter" only when a chip legitimately empties the list, and the All-clear state only when `items.length === 0`.

## Threat Flags

None beyond the plan's own `<threat_model>` — `/governance` adds no new mutation path; its actions are `approveStep`/`setSopOwner`/`confirmSopCurrent` (all pre-existing, self-guarded) plus plain links to the builder and `/admin/sops/new`.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `/governance` and `GovernanceInbox` are the landing surface 54-03 adds the floor-health column beside (right column, ~420px desktop / stacked on phone).
- `deriveInbox`'s `machines`/`links` inputs already come from `listSiteHealthForOrg`, so 54-03's `AdminFloorHealth`/`AdminMachinePanel` can reuse the same server-page read without a second fetch.
- No blockers. `npm run build` green, bundle gate Δ0 KB on both gated routes, `.bundle-baseline.json` untouched.

---
*Phase: 54-admin-inbox-floor-health-library-table*
*Completed: 2026-09-29*

## Self-Check

- `src/lib/governance/inbox.ts` — FOUND
- `src/app/(protected)/governance/page.tsx` — FOUND
- `src/components/admin/governance/GovernanceInbox.tsx` — FOUND
- Commit `d1669c3` — FOUND in `git log`
- Commit `f5d6ec3` — FOUND in `git log`
- Commit `1c08896` — FOUND in `git log`
- Commit `726e78e` — FOUND in `git log`

## Self-Check: PASSED
