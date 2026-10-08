---
phase: 63-sop-first-home-library-site-map-and-the-sopstart-start
plan: 02
subsystem: ui
tags: [pure-modules, classifier, address, playwright]
requires: [63-01]
provides:
  - src/lib/library/areas.ts (SITE_WIDE, areaOf, buildAreas, LibraryArea, AreaInputs)
  - src/lib/library/sop-type.ts (SOP_TYPES, sopTypeOf)
  - src/lib/library/object-kind.ts (OBJECT_KINDS, objectKindOf)
  - src/lib/library/status.ts (rowStatus)
  - src/lib/library/recent.ts (recentKey, parseRecent, pushRecent, mergeRecent, mostUsed)
  - src/lib/shell/home-state.ts (the whitelisted home address module)
affects: [63-05, 63-06, 63-07, 63-09, 63-10, 63-11, 63-13, 63-14]
key-files:
  created:
    - src/lib/library/areas.ts
    - src/lib/library/sop-type.ts
    - src/lib/library/object-kind.ts
    - src/lib/library/status.ts
    - src/lib/library/recent.ts
    - src/lib/shell/home-state.ts
    - tests/phase63/library.spec.ts
    - tests/phase63/recent.spec.ts
    - tests/phase63/home-state.spec.ts
key-decisions:
  - "Area: first linked machine's department (sort, then name), else first non-archived sop_departments tag by name, else Site-wide; areas exist only when they hold a visible SOP; Site-wide last; colour cycles var(--area-1..8)"
  - "Home tab null means the section's first tab (inbox / people); only access, requests and decisions are written"
  - "backForPath returns an href string ('/?s=record'), not a state; legacyPathRedirect returns fixed templates"
  - "home-state imports isSafePlace from notifications/places.ts (one SAFE regexp, no copy); 63-13/20 move it when places.ts is rewritten"
requirements-completed: []
duration: 25min
completed: 2026-10-08
---

# Phase 63 Plan 02: pure library and home-address modules Summary

**Six plain modules: the area / type / object-kind classifier, the row status line, Recent / Most used merges, and one whitelisted home address module that old place tokens, stored notification places and focus `from` tokens all resolve through.**

## Accomplishments

- Real-org shape (research s2) classifies to exactly Engineering (1), Forming (2), General (1); the machine department beats the General visibility tag.
- `rowStatus` uses the walk's own `walkOrder` / `currentIndex`, so list and Read agree on "step N of M"; no due / overdue vocabulary.
- `parseRecent` drops non-UUID ids, non-numeric times, caps at 10, never throws (T-63-06).
- `home-state.ts`: `parseHome` / `formatHome` round-trip for every canonical state; `resolveHome` sends a role-forbidden section to the home (T-63-05); hostile tokens never survive as text (T-63-04). `place.ts`, `focus-path.ts`, `places.ts` and the proxy are untouched.

## Task Commits

1. Task 1 (classifier, status, Recent): `537c601d`
2. Task 2 (home address module): `60f50e70`

## Verification

- `npx playwright test --project=phase63`: 29 passed (library classifier 7, recent 5, home state 12, inventory 4 + 1 existing).
- `npx tsc --noEmit`: exit 0.
- No directive / Next / Supabase / React imports in the new modules; `git diff --stat` on place.ts, focus-path.ts, places.ts, middleware.ts empty.

## Deviations from Plan

- Specs were written alongside the modules and went green on first run (no separate red commit); each task is one commit.
- Requirements MAP-01, HOME-02, HOME-05 not ticked: this plan delivers only their pure half; the surfaces land in 63-05..63-14.

## Known Stubs

None.

## Self-Check: PASSED

All nine files exist; commits `537c601d` and `60f50e70` present; `.bundle-baseline.json` untouched.
