---
phase: 63-sop-first-home-library-site-map-and-the-sopstart-start
plan: 11
subsystem: ui
tags: [home-shell, section-menu, tab-bar, legacy-redirect, focus-address, bundle-gate]
requires: [63-04, 63-05, 63-06, 63-07, 63-08, 63-09, 63-10]
provides:
  - src/components/home/HomeShell.tsx (HomeShell, HomeShellProps)
  - src/components/home/SectionMenu.tsx (SectionMenu, SECTION_LABEL)
  - src/components/home/TabBar.tsx (TabBar)
affects: [63-12, 63-13, 63-14, 63-18, 63-19, 63-20]
key-files:
  created:
    - src/components/home/HomeShell.tsx
    - src/components/home/SectionMenu.tsx
    - src/components/home/TabBar.tsx
    - tests/phase63/home-shell.spec.ts
    - .planning/phases/63-sop-first-home-library-site-map-and-the-sopstart-start/deferred-items.md
  modified:
    - src/app/page.tsx
    - src/lib/sop/focus-path.ts
    - src/components/home/SopList.tsx
    - src/components/home/ReadView.tsx
    - src/components/shell/NotificationBell.tsx
    - src/components/shell/WorkerObjective.tsx
    - scripts/check-bundle-size.ts
    - tests/phase58/focus-path.spec.ts
    - tests/phase60/bell-structure.spec.ts
  deleted:
    - src/components/shell/OneScreen.tsx
key-decisions:
  - "ReadView stays a static import: making it lazy (plan fallback i) saved 1 KB on the detail route and put a loading flash on the one action every worker does; recorded, not kept"
  - "The phone List | Site map toggle and wordmark sit in a bar OUTSIDE the list column, so the toggle is still reachable while the map is showing"
  - "TabBar is a flex child at the foot of the h-dvh column, not position:fixed, so no page padding is needed; it pads for env(safe-area-inset-bottom) inline (no existing utility)"
  - "On a phone the account control (Profile, Sign out) is the foot of the list; the side menu is not rendered there"
  - "A section the role lacks, or an unknown ?s=, resolves to the home through resolveHome at state creation and on every select (T-63-31)"
requirements-completed: []
duration: 4h
completed: 2026-10-08
---

# Phase 63 Plan 11: Home shell and the `/` swap Summary

**`/` now renders the SOP-first home for every role (section menu, list, reader pane; phone tab bar with a List | Site map toggle), old `?place=` addresses redirect on the server, the focus screen's from / Back speak the home address, and the bell is a dot. Built, tested and read locally; NOT pushed: the bundle gate is red on `/sops/[sopId]/page` (+7 KB) and needs an orchestrator decision.**

## Status: blocked on the bundle gate (do not push)

`npm run build` exits 1 in `postbuild`. `.bundle-baseline.json` is untouched.

| Route | Parent build (63-10) | This plan | Baseline | Gate |
|---|---|---|---|---|
| `/sops/[sopId]/page` | 795 KB | **802 KB** (+7) | 795 | RED (tolerance 2) |
| `/page` | 837 KB | **831 KB** (-6) | 837 | green (the gate is one-sided) |

Marker self-validation OK; pdfjs / mammoth / konva isolation OK; the new `/page` markers and the new detail-route marker all validate.

### Summed-file diff for `/sops/[sopId]/page` (parent `23c4d3d1` build vs this plan, same machine)

| Chunk | Parent | Now |
|---|---|---|
| `webpack-*.js` (runtime) | 5,489 | 5,564 |
| `app/(protected)/layout-*.js` | 4,542 | 2,213 |
| `9307` (react-query) / `3107` | 11,485 | 11,749 |
| **new shared chunk `2988`** | -- | **9,461** |

Net about +7 KB. Chunk `2988` is made of modules both `/` and the focus screen import, now that the home is a second consumer: `nzDay` formatting 1.5 KB, `home-state` 2.3 KB (focus-path now imports it), `focus.ts` walk text 1.4 KB (`useLibrary` calls `walkOrder`), `Wordmark` 0.7 KB, `focus-path`, `place`, `places`. Before this plan those modules lived in the detail route's own page chunk (the gate's known blind spot: `%5BsopId%5D/page-*` is never counted) or in the protected layout chunk. The focus screen's real download is unchanged; the instrument now counts bytes it could not see. The home itself is in `app/page-*.js` (31 KB) and is in no chunk the detail route loads (checked by grepping every counted chunk for `Search SOPs, steps and tools`; the same literal is now a forbidden marker on the detail route so a future hoist fails loudly).

Lazy seams tried:

| Seam | Result |
|---|---|
| Map, five section bodies, bell, objective line (all `next/dynamic`, in from the start) | what the 802 already includes |
| (i) `ReadView` behind `next/dynamic` with a skeleton | 802 -> 801 (-1). Not enough, costs a flash on every first Read; reverted |
| (ii) search hook behind a dynamic import | not tried: the shared chunk holds no search code, so it cannot move this number |

Nothing left to lazy-load without lazy-loading `useLibrary` or `home-state`, which the home needs on first paint. Orchestrator options: (a) move the detail baseline 795 -> 802 by hand, as 59-12 and 60-16 did for runtime-only movement; (b) lower `/page` 837 -> 831 at the same time; (c) fix the blind spot so the detail page chunk is counted (re-baselines both numbers).

## What was built

- **HomeShell** (`'use client'`, props `siteName, userEmail, userId, role, initial`): one `useState(resolveHome(initial, role))`; the only writer is `select()` which sets state and calls `history.replaceState` (exactly one in the file; no router, no server action; spec-pinned). Esc closes Read, then leaves the area, ignoring typing targets and `[aria-modal="true"]`. `useLibrary` and `useRecentSops` feed the list; `SiteMap`, `MyRecordSection`, `TrainingSection`, `SignOffsSection`, `PeopleSection`, `ManageSection`, the bell and the objective line are `next/dynamic({ ssr: false })`.
- **Layout**: root `flex h-dvh flex-col lg:flex-row`; `SectionMenu` is `max-lg:hidden`; My SOPs is list column (`lg:w-100`) + reader pane; a phone-only bar (wordmark, List | Site map) above them; other sections take the rest of the width; `TabBar` is `lg:hidden`. Nothing reads `matchMedia`, `innerWidth` or `localStorage` in the shell, menu or tab bar.
- **SectionMenu / TabBar**: both take their list from `sectionsForRole(role)` (worker: My SOPs, My record; supervisor adds Sign-offs; admin and safety manager all six with Manage SOPs last, quiet, above a hairline). No counts. A role with one section gets no tab bar.
- **page.tsx**: session gate unchanged (`/welcome`, `/pending`); `?place=` redirects through `redirect(formatHome(legacyToHome(place, tab, sop)))` before any data read; otherwise `parseHome` over the whitelisted keys. `OneScreen.tsx` deleted.
- **focus-path.ts**: `focusHref` encodes `from` as `homeFrom(homeFromToken(from))` (omitted for the home); `backHref(from)` is `formatHome(homeFromToken(from))`, so Back returns to the exact home state. Legacy tokens (`office`, `workshop`, a department) still map, so the Office links keep working until 63-14.
- **Bell (R5)**: `shell-bell-dot` (a dot) only when something is unread; aria-label "Notifications, unread"; no number, no "99+". HomeShell opens My record then `requestOverviewSection('notifications')`.
- **Gate script**: removed the machine-body marker; `/page` gains `Esc for the whole site`, `Every way in ends in the same editor.`, `A record to look up, not a to-do list.`, `and who signed it off.`; the detail route gains `Search SOPs, steps and tools` (the home list must never be hoisted into a shared chunk).

## Verification

- `npx tsc --noEmit` clean.
- Playwright: phase52, 57, 58, 59, 60, 63, phase15-stubs and phase30/36/37/41/54 all green except the three pre-existing reds below (phase63 482 passed; all of phase 52/57/58/59/60 matched the all-green baseline once the specs that read `OneScreen` / the office from-token were repointed). Whole suite once after the first repoint pass: 2312 passed, 14 failed = 3 pre-existing, 7 live phase46 probes (passed when re-run alone, shared OTP budget), 4 mine (lint HomeShell regex, phase41 bundle-gate, 2 phase54 governance-inbox) fixed in the next commit.
- Local production build (`next start` on port 4299, stopped afterwards, nothing left running) with real minted sessions (admin, worker, site supervisor), desktop 1280 and phone 390 x 844 at 2x, every PNG read: signed-out `/` is 307 to `/welcome` and `/api/version` is 200; admin home (menu with six sections, Manage quiet and last, list, map, bell, account foot), Read pane, Sign-offs, People, Manage SOPs, My record; worker home (two sections) and phone (two tabs, List | Site map toggle, map with key, Read full width with a back link); supervisor desktop (three sections). Flow checked in a browser: area header click filters the list and zooms the map (`/?area=`), opening a SOP writes `?sop=&area=`, Esc closes Read then the area, Start goes to `/sops/<id>?from=sop%3D<id>` and Back lands on the identical `/?sop=<id>`. `?place=` redirects: office -> `/?s=signoffs`, workshop -> `/?s=manage`, edit -> `/?s=manage&view=site`, `dept:<id>` -> `/?area=<id>`, `https://evil` -> `/`.
- Screens are not yet deployed: the deployed eval is 63-12.

## Deviations from Plan

1. **[Rule 3 - blocking] Repointed specs outside the plan's file list** because deleting `OneScreen.tsx` and changing the `from` token broke them (all are owned by 63-19 / 63-20 in the inventory; none deleted): `tests/lint/no-static-admin-lens-import` (HomeShell, SectionMenu, TabBar join the worker-shell list; the admin seam test now covers the section bodies), `phase30/create-entry`, `phase30/dead-weight`, `phase36/no-refresher-gate`, `phase37/no-competency-gate-worker`, `phase41/nav-and-shim`, `phase41/bundle-gate`, `phase54/governance-inbox` (+ `from=s%3Dsignoffs`), `phase57/one-query` (the two OneScreen cases removed; AdminShell is now unreferenced until 63-20), `phase57/shell-structure`, `phase57/retirement-sweep` (home-state.ts joins the two homes of the list address; this red dated from 63-02), `phase59/inbox-model`, `phase59/place-tab`, `phase59/shell-wide`.
2. **[Rule 1] `home-shell.spec` `lazy` regex** first matched across lines in the lint spec (`[^;]*` with no semicolons in the file); tightened to a single line.
3. **Phone account control** (Profile, Sign out) added at the foot of the list because the side menu is hidden below `lg`; not in the plan.
4. **`journeys.ts` not changed here**: the route is unchanged and the plan list gives the living-map update to 63-17.
5. Requirements HOME-01, HOME-05, MAP-04, GATE-01 are not ticked: the gate is red and nothing is deployed yet.

## Known Stubs

None.

## Deferred

See `deferred-items.md` (three reds that fail identically at 63-10: phase54 deletion-sweep, phase43 dead-controls, phase56 decision-writers-sweep).

## Threat Flags

None. T-63-30 (open redirect): fixed templates over whitelisted tokens, verified with `https://evil`. T-63-31: `resolveHome` on creation and every select. T-63-32: no router in the shell, spec-pinned. T-63-33: section bodies are lazy and their literals are forbidden markers on `/`.

## Self-Check: PASSED (code); gate RED

Commits `3df694d8`, `6928880b`, `407dffc1` present. `.bundle-baseline.json` untouched. Not pushed.
