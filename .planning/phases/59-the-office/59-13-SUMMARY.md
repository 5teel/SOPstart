---
phase: 59-the-office
plan: 13
subsystem: addresses and maps
tags: [office, proxy-redirects, training-bridge, pathways, capability-matrix, eval]
requires: [59-12]
provides:
  - "officeRedirectFor(pathname, search) in src/lib/shell/place.ts, called by the proxy; fixed templates, sop only when a UUID"
  - "/admin/training bridge (requireAdminContext first) + TrainingBridge, linked from the Smoko room (A-05)"
  - "journeys.ts, UAT list and capability matrix describe the Office tabs and the bridge"
  - "supervisor-Office, legacy-address and training-bridge eval cases"
affects: [59-14, 59-15, 59-16]
requirements-completed: []
key-files:
  created:
    - src/app/(protected)/admin/training/page.tsx
    - src/components/admin/competency/TrainingBridge.tsx
  modified:
    - src/lib/shell/place.ts
    - src/lib/supabase/middleware.ts
    - src/components/shell/AdminShell.tsx
    - src/lib/journeys/journeys.ts
    - src/lib/uat/tests.ts
    - .planning/codebase/CAPABILITY-MATRIX.md
    - tests/phase59/{legacy-redirects,capability-matrix,retirement-sweep}.spec.ts
    - tests/evals/office.eval.ts
completed: 2026-10-06
---

# Phase 59 Plan 13: Addresses and maps Summary

**Every old governance address now redirects on the server into the Office, the training matrix stays reachable for admins on `/admin/training`, and the pathways, UAT and capability matrix describe the Office as built. `npm run build` is clean with `/` at 834 KB, delta 0 against the recorded baseline; `.bundle-baseline.json` untouched.**

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | 951ecc33 | `officeRedirectFor`, proxy block, training bridge + Smoko link, journeys, proxy-pinning specs repointed |
| 2 | c818d6a8 | capability matrix rows, UAT, 59-13 sweep cases live, eval cases |

## Redirect table

| Address | Lands on |
|---|---|
| `/governance` | `/?place=office` |
| `/governance?view=library` | `/` |
| `/sops?view=attention` | `/?place=office` |
| `/admin/team` | `/?place=office&tab=people` |
| `/admin/access[?sop=<uuid>]`, `/sops?view=access[&sop=]` | `/?place=office&tab=access[&sop=<uuid>]` |
| `/sops` (anything else) | `/` |

A `sop` value that is not a UUID is dropped. The proxy block copies the refreshed session cookies onto the redirect; no client effect redirects any of these.

## Maps

- **journeys.ts:** the admin-home run now has Office Inbox, Decisions, People & roles and Access screens (each with its `?place=office&tab=` address and who sees it) plus a Smoko-room training screen. The governance, team, access, observation, assessment-request and training-matrix journeys all point at `/` or `/admin/training`. No journey names a retired address as a route.
- **UAT:** links repointed to the Office tabs and `/admin/training`; new `p59-office` plain click-path entry.
- **CAPABILITY-MATRIX.md:** new rows Office -- Inbox, Decisions, People & roles, Access; Access lens, Manage departments and Training matrix rows and the route note edited (cells, not labels).

## Deviations from Plan

**1. [Rule 3 - Blocking] Proxy-pinning specs repointed in 59-13.** The inventory marks `phase28/library-and-worker`, `phase30/admin-nav` and `phase43/route-truth` as 59-14 rows, but each asserts the removed destination literal in the proxy, so they went red the moment the proxy changed. Repointed their proxy assertions to `officeRedirectFor(` plus the helper literal (the page-wiring halves stay for 59-14). Same for `phase28/governance-queue` (journey route assertion) and `phase54/deletion-sweep` (the one permitted attention comparison now lives in `place.ts`) and `phase57/retirement-sweep`'s list-address allowance (proxy and `place.ts`).

**2. [Rule 3 - Blocking] Pathways coverage specs exempt the three redirect-only pages.** `phase30/governance-fold` and `phase57/shell-structure` require every page route to be named in `journeys.ts`, but the plan forbids naming `/governance`, `/admin/team`, `/admin/access` as routes while their page files still exist (59-14 deletes them). Both specs carry a small `REDIRECT_ONLY` exemption. Until 59-14 the live `/pathways` "All screens" panel will flag those three as not mapped; 59-14 removes the pages and the exemptions become dead.

**3. Eval case dropped.** `/sops?view=access` in the Office eval tripped the phase57 repoint-inventory token guard; the access-view mapping is covered by the unit spec instead.

## Verification

- `npx tsc --noEmit` clean; `npm run build` exits 0 (`/page` 834 KB delta 0, `/sops/[sopId]/page` 794 KB delta +2, within tolerance).
- Playwright projects phase59, 58, 57, 54, 53, 46, 43, 41, 32, 30, 28, 15-stubs and phase55 deletion-sweep: all green (810 passed, 35 skipped later-plan stubs). `npx playwright test --list --project=evals office` lists the three new 59-13 cases. Evals not run (59-16).
- `LIVE_PLANS` not appended (59-14 does that).

## Known Stubs

None.

## Threat Flags

None. T-59-47: destinations are literal templates, sop UUID-gated, spec asserts the proxy builds nothing from the query. T-59-48: server-only, spec asserts no client copy. T-59-51: `requireAdminContext()` precedes every read on the bridge page (spec-ordered). T-59-51b: maps edited in the same commits as the routes; phase46 doc spec and the 59 matrix spec pass.

## Self-Check: PASSED

- Commits 951ecc33 and c818d6a8 exist; training page, TrainingBridge and this SUMMARY exist; STATE.md, ROADMAP.md and `.bundle-baseline.json` untouched; nothing pushed.
