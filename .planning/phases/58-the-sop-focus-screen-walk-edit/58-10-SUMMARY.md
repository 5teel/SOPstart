---
phase: 58-the-sop-focus-screen-walk-edit
plan: 10
subsystem: focus-frame
tags: [focus-frame, browse, back-esc, entry-hrefs, worker-bundle]
requires: [58-02, 58-04]
provides:
  - "src/components/focus/{FocusFrame,FocusTopBar,FocusRail,BrowseDocument,KindChip}.tsx"
  - "src/hooks/useFocusBack.ts: useFocusBack, useRegisterOverlay, FocusOverlayContext"
  - "every entry into a SOP from the one screen is focusHref(id, { from })"
affects: [58-11, 58-13]
key-files:
  created:
    - src/components/focus/FocusFrame.tsx
    - src/components/focus/FocusTopBar.tsx
    - src/components/focus/FocusRail.tsx
    - src/components/focus/BrowseDocument.tsx
    - src/components/focus/KindChip.tsx
    - src/hooks/useFocusBack.ts
  modified:
    - src/components/sop/plant/MachinePanel.tsx
    - src/components/sop/plant/NowCard.tsx
    - src/components/shell/WorkerShell.tsx
    - src/components/shell/RoomBodies.tsx
    - src/components/shell/AdminRoomBodies.tsx
    - src/components/admin/governance/AdminMachinePanel.tsx
    - src/lib/journeys/journeys.ts
    - tests/phase58/frame-structure.spec.ts
    - tests/phase52/plant-panel.spec.ts
    - tests/phase52/plant-now-card.spec.ts
    - tests/phase54/admin-machine-panel.spec.ts
    - tests/phase57/machine-body.spec.ts
    - tests/evals/one-screen.eval.ts
key-decisions:
  - "FocusFrame always renders `children`; the page passes BrowseDocument for browse (the plan had the frame render it itself). Keeps the frame free of SOP data props and gives walk/edit the same seam"
  - "The 'Updated' chip in BrowseDocument is a local span with the same token tone as RelBadge 'new', not RelBadge: the Phase 57 retirement sweep allows only the shell to import from components/sop/plant"
  - "Show me renders whenever the Now card has an item (it was machine-only); with the locate-on-map behaviour gone it is just a second link to the browse address"
requirements-completed: []
duration: ~35 min
completed: 2026-10-05
---

# Phase 58 Plan 10: Focus frame and browse state Summary

**The focus frame (slim top bar, 300 px rail, 820 px column), its browse state, a deterministic Back/Esc hook, and every entry from the one screen now pointed at `/sops/<id>?from=<place>`.**

FOC-01 and FOC-03 are not ticked: nothing mounts the frame until the 58-11 page swap, so they are not proven end to end yet.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | `6ab28cc0` | FocusFrame, FocusTopBar, FocusRail, BrowseDocument, KindChip, useFocusBack, frame half of `frame-structure` spec (10 live cases) |
| 2 | `0eb59c12` | `focusHref(..., { from })` on machine rows, Noticeboard rows, Now card (Walk it, Show me), admin rows; four specs + one-screen eval repointed; journeys.ts note |

## What was built

- **Back/Esc** (`useFocusBack`): `goBack()` races `beforeBack` against 3 s, then `router.push(backHref(from))`. Esc closes the topmost registered overlay (`useRegisterOverlay(open, close)`; the rail sheet registers itself, 58-12 dialogs will), else blurs a focused field, else Back. The only effect adds and removes the key listener; navigation runs only in handlers. A re-entry guard stops a double press navigating twice.
- **Rail**: `w-75`; below `lg` a full-screen sheet (`max-lg:fixed max-lg:inset-0 max-lg:z-40`) opened by "Steps · n of N" (CSS only, no viewport hook). `rowState` / `onPick` props are the seam 58-11 uses for done, current and locked rows. Default pick scrolls to `#step-<id>` and focuses it.
- **Browse**: summary card (count, minutes only when estimates exist, objective, SOP standards), "Updated since you last walked it" when told, superseded banner with a `focusHref` link to the current version and no Start walking, read-only step cards in walk order under group headings, signed images, tips, standards labels, empty state, `resumeSlot`, and a sticky "Start walking" only when `onStartWalking` is passed for a non-superseded version.
- **Entry points**: `SopRows` / `AdminSopRows` take `from` (machine id from the machine bodies, `'noticeboard'` from the room bodies). Title link and Walk link both go to browse (D-27). Now card `from` is its machine id, or `'noticeboard'` for a site-wide SOP; its minutes now read `sop_focus_steps`. `onShowMe` and its WorkerShell pass-through are gone.

## Guard sweep (hits repointed in the same commit)

| File | Hit | Now |
|------|-----|-----|
| tests/phase52/plant-panel.spec.ts | Walk link `?tab=walk`, plain Read link | Walk and title link assert `focusHref(sop.id, { from })`, no `?tab=` |
| tests/phase52/plant-now-card.spec.ts | Walk it `?tab=walk`, `onShowMe` call, minutes from `sop_sections` | `focusHref(... 'noticeboard')`, Show me is a link, no `onShowMe`, `sop_focus_steps` |
| tests/phase54/admin-machine-panel.spec.ts | `/sops/${sop.id}` literal | `focusHref(sop.id, { from })` (builder href literal left for 58-14) |
| tests/phase57/machine-body.spec.ts | worker Walk link, admin title and Walk regex, room `SopRows` / `AdminSopRows` literals | `focusHref` forms and `from="noticeboard"` |
| tests/evals/one-screen.eval.ts | 5 `?tab=walk` hrefs/URLs, Show me locate-on-map | `?from=<machine uuid>` / `?from=noticeboard`; Show me opens `/sops/<id>?from=`; admin Edit href assertion untouched |
| src/lib/journeys/journeys.ts | `Walk it tab (?tab=walk)` detail text | describes the `?from=` address |

Two existing guards went red on the first run and were fixed in this plan: the Phase 57 retirement sweep (only the shell may import `components/sop/plant/*`, which `BrowseDocument` did via `RelBadge`) and the Phase 57 repoint inventory (my frame spec quoted a retired literal; it now builds it from parts).

## One-wave note

Until 58-11 swaps the page, the new links open the old tabbed page at `/sops/<id>?from=...` with its default first tab (Read). The walk tab is one tap away. The old page still renders `BackToSite`; `from` is accepted and ignored there. The one-screen eval's `back-to-site` assertions were left alone for that reason and are 58-11's to change.

## Verification

- `npx tsc --noEmit` clean.
- `phase52`, `phase54`, `phase57`, `phase58`, `phase15-stubs` (design-tokens, no-undefined-css-tokens, no-dead-internal-hrefs): 446 passed, 36 skipped (other plans' fixmes), 0 failed.
- `npm run build` exit 0. Bundle gate: `/sops/[sopId]` 794 KB (baseline 795, delta -1 KB), `/` 832 KB (baseline 831, delta +1 KB), tolerance +/-2 KB; baseline untouched. The focus components are not imported by any page yet, so this delta is the Now card change only.
- Compiled CSS (`.next/static/css`) contains `w-75`, `max-w-205`, `border-l-accent-hazard`, `border-l-accent-measure`, `max-lg:inset-0`, `bg-accent-measure/14`, `min-h-tap-glove`.
- `grep "tab=walk" src` (minus ReadTab and the page) and `grep onShowMe src`: nothing.
- `npx playwright test --list --project=evals one-screen`: 20 tests listed; deployed evals not run.

## Deviations from Plan

**1. [Design] Frame takes `children` for every mode.** The plan had the frame render `BrowseDocument` for `browse`. The frame instead renders `children`, and 58-11 passes `BrowseDocument` (it needs page-level props: live version, updated flag, resume card). Same result, no SOP data props on the frame.

**2. [Rule 3 - blocking] "Updated" chip is not `RelBadge`.** See key-decisions; same classes, different testid (`focus-updated`).

**3. [Scope] Show me always renders for a Now item** (was machine-only). Both buttons share one href.

**4. Section-level standards labels** are not shown in browse (SOP and step level are). Nothing reads them yet; add with the walk's section label if the eval shows they are missed.

Unchanged by design: the admin Edit links and Workshop draft links (58-14), and the red items already in `deferred-items.md`.

## Known Stubs

None. `placeForPath` null-on-`/sops/*` stays a `test.fixme` in `frame-structure.spec.ts` for 58-11.

## Threat Flags

None new. T-58-from: Back is `backHref(from)` and every href goes through `focusHref`; T-58-20: no HTML-injection API in `src/components/focus` (spec asserts); T-58-21: no router call in any effect (spec asserts); T-58-bundle: focus files import no shell, plant or admin module (spec asserts).

## Self-Check: PASSED

- All six new source files and this summary exist.
- Commits `6ab28cc0` and `0eb59c12` exist.
