---
phase: 63-sop-first-home-library-site-map-and-the-sopstart-start
plan: 13
subsystem: routing
tags: [notifications, redirects, proxy, back-bar, adr-0002, bundle-gate]
requires: [63-11]
provides:
  - notificationPlace writes home sections (Sign-offs, My record)
  - BackToSite reads "Back" and uses backForPath (src/lib/shell/back-path.ts)
  - proxy uses legacyPathRedirect; next.config sends departments and site to /?s=manage&view=site
  - ensureReviewDueNotifications runs on the home load
affects: [63-14, 63-17, 63-18, 63-20]
key-files:
  created:
    - src/lib/shell/back-path.ts
  modified:
    - src/lib/notifications/places.ts
    - src/lib/shell/place.ts
    - src/lib/shell/home-state.ts
    - src/components/layout/BackToSite.tsx
    - src/lib/supabase/middleware.ts
    - next.config.ts
    - src/app/page.tsx
key-decisions:
  - "backForPath lives in its own import-free module (back-path.ts) and home-state re-exports it: importing home-state from the protected layout moved the whole module into a shared, counted chunk and the detail route read 805 KB (+3). With the lean module the gate is 802 / 831 exactly."
  - "HOME-05 is not ticked: this is the writer half; 63-14 (literal sweep, retired pages, address eval) completes it."
requirements-completed: []
completed: 2026-10-08
---

# Phase 63 Plan 13: Address writers Summary

**Notifications, Back bars, the proxy and next.config now speak the home address; due reviews are written when the home loads. Stored `?place=` notifications and old links still resolve through the legacy readers.**

## What changed

| Area | Change |
|---|---|
| Notification places | approve_next / review_due / signoff -> `/?s=signoffs`; request_answered -> `/?s=record`; new_version / asked unchanged (`/sops/<uuid>`). `isSafePlace` and `placeTarget` untouched |
| Back bar | `BackToSite` label "Back", `backForPath(usePathname())` from `back-path.ts`; `placeForPath` deleted |
| Proxy | `legacyPathRedirect` replaces `officeRedirectFor` (deleted); same one block, same cookie copy, fixed templates |
| next.config | `/admin/departments` and `/admin/site` -> `/?s=manage&view=site` (`permanent: false`, as before) |
| Home load | `src/app/page.tsx` runs `ensureReviewDueNotifications(organisationId, userId)` in a `Promise.all` with the organisation-name read, for every signed-in member with an organisation (ADR-0002 on read; own rows only, idempotent, never throws). The shell-action call sites are unchanged |

## Specs repointed in the same commits

- `tests/phase60/notification-places.spec.ts` (new templates; legacy stored places `/?place=office`, `/`, `/sops/<uuid>` still resolve via `homeFromAddress`)
- `tests/phase59/legacy-redirects.spec.ts` (rewritten onto `legacyPathRedirect` / `backForPath`, plus the next.config redirect)
- `tests/phase63/home-state.spec.ts` (dropped the `officeRedirectFor` comparison; `backForPath` targets pinned against `formatHome`)
- Source-contract strings (`officeRedirectFor(path, ...)`, `placeForPath(`, helper templates now read from `home-state.ts` / `back-path.ts`): phase28 `library-and-worker`, phase30 `admin-nav`, phase43 `route-truth`, phase57 `retirement-sweep` `shell-structure` `place` (placeForPath tests removed) `departments`, phase58 `frame-structure`, phase59 `retirement-sweep`; token-in-comment edits in the phase58/59/60 repoint inventories.

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm run build` | exit 0; gate `/sops/[sopId]/page` 802 (baseline 802, +0), `/page` 831 (831, +0) |
| phase52/57/58/59/60/63 + phase15-stubs (`--grep-invert "live\|probe"`) | 836 passed, 3 skipped, 0 failed |
| phase28/30/41/43 | 116 passed, 1 failed = `phase43 dead-controls` "dead state removed from the creation surfaces", already in `deferred-items.md` (owner 63-14 / 63-18), not touched by this plan |

## Deviations from Plan

1. **[Rule 3 - blocking] Bundle gate went red (805 vs 802) with `BackToSite` importing `home-state`.** Diagnosed by building the parent versions of the changed src files and diffing the counted chunk list: the protected layout chunk grew 2213 -> 5144 bytes and a new shared `1086-*.js` (home-state) appeared, because the detail route had kept home-state in the uncounted page chunk until the layout imported it. Fixed without touching the baseline: `backForPath` moved to `src/lib/shell/back-path.ts` (no imports), `home-state.ts` re-exports it, and `home-state.spec.ts` pins the literals to `formatHome`. Gate then 802 / 831. `.bundle-baseline.json` untouched.
2. **Spec edits outside the plan's file list** (Rule 3): the source-contract and inventory specs listed above, because deleting `placeForPath` / `officeRedirectFor` would have turned them red or vacuous.
3. Two plan tasks landed as two feature commits plus one fix commit; `place.ts` loses both functions in the second (the proxy still needed `officeRedirectFor` until then).
4. `Back to the site` copy remains in `SentPanel.tsx` and `CompletionList.tsx` (not Back bars; the literal sweep is 63-14 / 63-16).

## Known stubs

None.

## Commits

- `347701d3` notifications write home addresses; Back bar reads Back
- `0cd1decd` proxy and next.config speak the home address; due reviews on home load
- `b6ef20a0` Back bar imports a lean back-path module so the bundle gate holds (802 / 831)

## Self-Check: PASSED

`back-path.ts`, this file and the three commits exist; `grep placeForPath|officeRedirectFor src` finds only one prose mention in `src/lib/uat/tests.ts` (63-17 owns the UAT prose); `.bundle-baseline.json` unmodified.
