---
phase: 63-sop-first-home-library-site-map-and-the-sopstart-start
plan: 05
subsystem: ui
tags: [hooks, react-query, supabase-rls, search, list]
requires: [63-02]
provides:
  - src/hooks/useLibrary.ts (useLibrary, LibraryRow)
  - src/hooks/useRecentSops.ts (useRecentSops)
  - src/hooks/useSopSearch.ts (useSopSearch)
  - src/lib/library/search.ts (sanitizeSearch, matchesTitle)
  - src/components/home/SopList.tsx, SopRow.tsx
  - libraryQueryFn exported from src/hooks/useWorkerSops.ts
affects: [63-06, 63-10, 63-11, 63-12]
key-files:
  created:
    - src/hooks/useLibrary.ts
    - src/hooks/useRecentSops.ts
    - src/hooks/useSopSearch.ts
    - src/lib/library/search.ts
    - src/components/home/SopList.tsx
    - src/components/home/SopRow.tsx
    - tests/phase63/sop-list.spec.ts
  modified:
    - src/hooks/useWorkerSops.ts
    - src/components/requests/RequestComposer.tsx
    - src/app/(protected)/admin/sops/new/blank/page.tsx
    - src/app/(protected)/admin/sops/new/blank/WizardClient.tsx
key-decisions:
  - "useLibrary reuses libraryQueryFn (one `library-sops` cache key and shape) but never calls useWorkerSops, so no getUserSopAssignments server action fires on home mount"
  - "sanitizeSearch also strips { } (superset of the plan list) because the tools filter builds a PostgREST array literal"
  - "Most used is ranked from per-row doneCount via the shared mostUsed() instead of a second completions read"
  - "A walk whose steps have not loaded yet shows no status rather than falling through to a completion line"
requirements-completed: []
duration: 40min
completed: 2026-10-08
---

# Phase 63 Plan 05: SOP list data and components Summary

**One browser-client derivation of every SOP row (area, type, object, minutes, own status, done count) plus Recent, Most used, step-and-tool search, and the SopList / SopRow components with the search-miss Ask for one / Write it path. Built unmounted; 63-11 mounts it.**

## Hook API

- `useLibrary(userId)` returns `{ rows: LibraryRow[], areas: LibraryArea[], byId: Map, loading, error, refetch }`.
- `LibraryRow = { id, rootId, title, version, categorySlug, areaId, areaName, colourVar, type, kind, minutes, status, doneCount, lastAt }`.
- `useRecentSops(userId, rows)` returns `{ recent, mostUsed: {row, count}[], remember(rootId) }`; localStorage `sopstart-recent:<userId>` through `useSyncExternalStore` (server snapshot `''`), `remember` dispatches a same-tab `storage` event.
- `useSopSearch(query, visibleIds)` returns `{ ids: Set, pending }`; 250 ms debounce, one `sop_focus_steps` query (`text` ilike OR `required_tools` contains), limit 500.

## Query keys (all browser client, RLS)

`library-sops` (shared fn), `library-lineage`, `library-completions:<userId>` and `library-walks:<userId>` (both `.eq('worker_id', userId)`), `library-areas:<ids>` (departments, site_machines, sop_machines and sop_departments, the last two `.in('sop_id', ids)`), `library-minutes:<ids>` (paged past PostgREST's 1000-row cap), `library-walk-steps:<walkSopIds>`, `library-search:<term>:<ids>`.

## List structure

Search box with clear; "In {area}" chip (`area-filter`); when a query or area is active a flat "N SOPs" list (title/area/type match OR step/tool hit, within the area); otherwise Recent, Most used (` · done N×`), and "All SOPs · n" with an Area | Type segmented toggle. Area headers are `area-group` buttons calling `onArea`. Empty search: "No SOP for “q”." with a lazy `RequestComposerTrigger` (`new_sop`, `about={{ site: true }}`, `initialNote={q}`) and, for `canWrite`, a `Write it` link to `/admin/sops/new/blank?title=`.

## Prefill edits

- `RequestComposerTrigger` gains `initialNote` (the dialog mounts only while open, so each open starts from it).
- Blank wizard page reads `?title=` (string only, trimmed, max 200) and passes `initialTitle`; `WizardClient` uses it as the title field's starting value. `createSopFromWizard` is unchanged.

## Verification

- `npx tsc --noEmit`: exit 0.
- `npx playwright test --project=phase63 -g "sop list"`: 11 passed.
- `phase15-stubs` design-tokens, no-undefined-css-tokens, no-dead-internal-hrefs: 13 passed.
- Neighbouring source-contract specs touching useWorkerSops / RequestComposer / blank wizard (phase30, 36, 37, 55, 57, 58, 60): 214 passed.
- `npm run build` exit 0; bundle gate green: `/page` 837 KB (baseline 837, delta 0), `/sops/[sopId]/page` 795 KB (baseline 795, delta 0). The components are unmounted so no route size moved. `.bundle-baseline.json` untouched.

## Deviations from Plan

- `sanitizeSearch` additionally strips `{` and `}` (T-63-11 hardening; the tools filter builds `cs.{term}`).
- Specs were written with the code and went green first run (no separate red commit); each task is one commit.
- Not visually checked: the list is unmounted until 63-11, so there is no rendered screen to screenshot; the first look is the 63-12 deployed run.

## Known ceilings (ponytail)

- Minutes are summed client-side from step estimates; fine to a few hundred SOPs.
- Tool search matches an exact tool name (array contains) and the step search caps at 500 rows; a search view if a site outgrows that.

## Known Stubs

None.

## Task Commits

1. Task 1 (hooks, search sanitiser): `edf20637`
2. Task 2 (SopList, SopRow, prefills): `6d1b4483`

## Self-Check: PASSED

All seven new files and four edits exist; both commits present.
