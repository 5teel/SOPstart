---
phase: 32-visual-org-model-library-permissions
plan: 09
subsystem: ui
tags: [nextjs, react, typescript, supabase, admin-page, permission-wiring]

# Dependency graph
requires:
  - phase: 32-08
    provides: "WiringPatchBay/SelectionStrip component layer, WiringCollection/WiringNewSop types"
  - phase: 32-07
    provides: "/admin/team org model + TeamViewShell client-wrapper precedent"
  - phase: 32-05
    provides: "createGrant/listGrants (src/actions/grants.ts), sop_departments/sop_collections materialization"
  - phase: 32-04
    provides: "listOrgTree (src/actions/org-model.ts), OrgTree types"
provides:
  - "/admin/sops?view=access — the D-hybrid wiring surface as a third page fold (D-09)"
  - "/admin/sops?departments=<id> / ?collection=<id> — server-side library filter with an Open in library (N) header (SC-4)"
  - "PublishStage 'Wire up access →' CTA to ?view=access&sop=<id> once published (D-12a)"
affects: [phase-32-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "WiringPatchBayShell — same class of fix as 32-07's TeamViewShell: an async Server Component page.tsx can fetch listOrgTree()/listGrants()/collections server-side but cannot hold the onWireUpComplete router.refresh() callback itself, so a thin 'use client' wrapper owns it."
    - "Focus-based deep-link, not click-to-navigate: WiringPatchBay's quiet-by-default trace interaction (SC-3) is preserved — focusing a department/collection draws its wires in place, and a separate 'Open in library →' link (rendered in SelectionStrip) is the explicit opt-in to leave the wiring view for the filtered library list."
    - "Sentinel-id `.in('id', […])` guard — when a department/collection filter resolves to zero matching SOPs, `.in('id', [NO_MATCH_ID])` forces an empty result set without special-casing an empty-array argument to PostgREST."

key-files:
  created:
    - src/components/admin/wiring/WiringPatchBayShell.tsx
  modified:
    - src/app/(protected)/admin/sops/page.tsx
    - src/app/(protected)/admin/sops/builder/[sopId]/PublishStage.tsx
    - src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx
    - src/components/admin/wiring/WiringPatchBay.tsx
    - src/components/admin/wiring/SelectionStrip.tsx
    - src/styles/blueprint-theme.css
    - src/lib/journeys/journeys.ts
    - src/lib/uat/tests.ts
    - tests/phase32/library-filter-deeplink.spec.ts

key-decisions:
  - "Open in library is a link inside SelectionStrip, not a navigate-on-click — WiringPatchBay's focus interaction stays purely in-page (SC-3's quiet-by-default trace), so a focused department/collection surfaces an explicit 'Open in library →' opt-in rather than hijacking the click."
  - "The (N) count in 'Open in library (N)' lives on the destination page's own filtered-result banner (page.tsx), not inside WiringPatchBay — the plan's Task 1 action text places the count render on the SOP-list side of the deep-link, and WiringPatchBay already has no per-department SOP count in its props to render it there without a new data plumb."
  - "WiringPatchBayShell added (not in the plan's files_modified) — same RSC-boundary requirement as 32-07's TeamViewShell precedent: page.tsx is async and cannot pass a client onWireUpComplete callback across the Server/Client boundary."
  - "PublishStage's wireUpHref is derived by the parent shell from initialSop.status === 'published' (re-derived on every router.refresh() after a successful publish), not a local 'just published' flag — this is the same signal the stepper's demote-off-Publish effect already trusts."
  - "sop_departments/sop_collections/collections reads in page.tsx use the established `(supabase as any)` cast (departments.ts/org-model.ts/governance.ts precedent) since these tables are not yet in database.types.ts."

patterns-established:
  - "Any future WiringPatchBay affordance that needs to leave the wiring view for another page renders as an explicit link in SelectionStrip, never as a click-to-navigate override of the existing focus/connect click handlers."

requirements-completed: [SC-4, SC-5]

# Metrics
duration: 45min
completed: 2026-07-18
---

# Phase 32 Plan 09: Access View, Library-Filter Deep-Links & Publish CTA (Phase Gate) Summary

**`/admin/sops?view=access` lands the D-hybrid wiring surface as a third page fold; focusing a department/collection surfaces an "Open in library →" link that server-filters the plain library list with an "Open in library (N)" count; a "Wire up access →" CTA appears on PublishStage once a SOP is published — closing SC-4/SC-5 and the phase gate.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-07-18T09:00:00Z (approx)
- **Completed:** 2026-07-18T09:48:46Z
- **Tasks:** 2
- **Files modified:** 9 (1 created, 8 modified)

## Accomplishments

- `/admin/sops?view=access` — new third fold (D-09) beside "Needs attention": server-fetches `listOrgTree()` + `listGrants()` + a flat `collections` read (with a dependent `sop_collections` count query) concurrently with the existing governance reads, and mounts `WiringPatchBayShell` (a thin client wrapper — same RSC-boundary class as 32-07's `TeamViewShell` — owning `onWireUpComplete={() => router.refresh()}`)
- SC-4 viz-as-library-filter: `?departments=<id>` / `?collection=<id>` resolve the matching SOP id set through the org-scoped `sop_departments`/`sop_collections` junction reads, then `.in('id', ids)` the plain library query; an "Open in library (N)" banner with a "Clear filter" link renders above the filtered list
- `WiringPatchBay` computes `openInLibraryHref` when focus is a department or collection (org/area/person have no library query-param equivalent) and passes it to `SelectionStrip`, which renders an "Open in library →" link in the selection state — the existing quiet-by-default trace click behaviour (SC-3) is untouched; this is an additive opt-in link, not a click-to-navigate override
- `PublishStage` gains an optional `wireUpHref` prop; `BuilderStageShell` supplies `/admin/sops?view=access&sop={sopId}` once `initialSop.status === 'published'` (D-12a) — the CTA renders below the existing "You can unpublish or edit later" reversibility note
- `journeys.ts`: the `enter-admin-tools` journey's `sops` step and `builder-review-publish`'s `publish` step now mention the Access tab/CTA; a new `wire-up-access` journey walks CTA → access view → connect mode → ✓ Done → library filter
- `uat/tests.ts`: new `p32-wiring-access-view` review entry covering trace clarity, wire-up ease, filter usefulness, and blast-radius trust
- `library-filter-deeplink.spec.ts` (SC-4) flipped live: 3 source-contract assertions (page.tsx filter/header wiring, WiringPatchBay's focus-href, SelectionStrip's link render) — Rule-3 degrade, no chromium binary in this environment, matching every other 32-0x spec's precedent; the true click-through browser scenario is a documented `test.fixme` runtime smoke
- Phase gate: `npx tsc --noEmit` clean, `npm run build` clean (bundle `/sops/[sopId]/page` Δ +1 KB, within ±2 KB tolerance), `npx playwright test --project=phase32 --project=phase32-unit` — 58 passed, 7 skipped (documented fixme runtime smokes requiring chromium+live app), 0 failed
- `npm run test` (full suite): 33 pre-existing failures, all in phase3/11/12.5/15/20/21/26/29 stub/legacy specs with no relation to any file this plan touched (none import/reference `page.tsx`, `PublishStage.tsx`, `BuilderStageShell.tsx`, `WiringPatchBay.tsx`, `SelectionStrip.tsx`, `journeys.ts`, or `uat/tests.ts`) — not a regression, matches the established "pre-existing stub failures are not regressions" precedent (CLAUDE.md Learnings, e.g. Phase 23)
- `/pathways` "0 not-mapped" regression spec (`tests/phase30/governance-fold.spec.ts`) still passes after the journeys.ts edits

## Task Commits

Each task was committed atomically:

1. **Task 1: ?view=access arm + library-filter deep-links** — `e197baa` (feat)
2. **Task 2: Publish CTA + journeys/uat + phase gate** — `182d09e` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `src/app/(protected)/admin/sops/page.tsx` — `?view=access` arm, `?departments=`/`?collection=` server-filter + header, `WiringPatchBayShell` mount
- `src/components/admin/wiring/WiringPatchBayShell.tsx` — client wrapper (deviation, see below)
- `src/components/admin/wiring/WiringPatchBay.tsx` — `openInLibraryHref` computed from focus
- `src/components/admin/wiring/SelectionStrip.tsx` — `openInLibraryHref` prop + link render
- `src/styles/blueprint-theme.css` — `.open-in-library` link styling
- `src/app/(protected)/admin/sops/builder/[sopId]/PublishStage.tsx` — `wireUpHref` prop + CTA
- `src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx` — supplies `wireUpHref`
- `src/lib/journeys/journeys.ts` — Access tab/CTA mentions + new `wire-up-access` journey
- `src/lib/uat/tests.ts` — new `p32-wiring-access-view` entry
- `tests/phase32/library-filter-deeplink.spec.ts` — SC-4 flipped live

## Decisions Made

See `key-decisions` in frontmatter. The two load-bearing ones: (1) Open in library is an explicit SelectionStrip link, not a click-to-navigate override, preserving WiringPatchBay's quiet-by-default trace (SC-3); (2) `WiringPatchBayShell` is a necessary RSC-boundary wrapper, same class as 32-07's `TeamViewShell`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] Added `WiringPatchBayShell.tsx`, not in the plan's `files_modified`**
- **Found during:** Task 1
- **Issue:** `/admin/sops/page.tsx` is an async Server Component. It can fetch `listOrgTree()`/`listGrants()`/collections server-side, but cannot hold or pass a client `onWireUpComplete` callback (`router.refresh()`) to `WiringPatchBay` across the Server/Client boundary — Next.js only allows serializable props across that boundary.
- **Fix:** Added a minimal `'use client'` wrapper (`WiringPatchBayShell.tsx`) that receives the server-fetched `tree`/`collections`/`grants`/`newSop` as plain serializable props and owns the `router.refresh()` callback itself. Identical pattern to 32-07's `TeamViewShell.tsx` deviation.
- **Files modified:** `src/components/admin/wiring/WiringPatchBayShell.tsx` (new)
- **Verification:** `npx tsc --noEmit` clean; `npm run build` clean; `page.tsx` mounts `WiringPatchBayShell` (grep-confirmed by the flipped spec).
- **Committed in:** `e197baa` (Task 1 commit)

**2. [Rule 3 - Blocking Issue] Extended `WiringPatchBay.tsx` + `SelectionStrip.tsx` with an `openInLibraryHref` affordance, not in the plan's `files_modified`**
- **Found during:** Task 1
- **Issue:** SC-4's acceptance criteria explicitly requires "the WiringPatchBay focus link builds that URL" — but WiringPatchBay's existing click handlers (`handleLeftClick`/`handleRightClick`, shipped in 32-08) only toggle local focus state for the in-page trace interaction; there was no mechanism to produce a navigable `/admin/sops?departments=<id>`/`?collection=<id>` link without either forking the click behaviour (breaking SC-3's quiet-by-default trace) or adding a new prop.
- **Fix:** Added a `useMemo`-computed `openInLibraryHref` in `WiringPatchBay` (only set when focus is a department or collection id — org/area/person focus has no library query-param equivalent) and an optional `openInLibraryHref` prop on `SelectionStrip` that renders an "Open in library →" link inline with the existing "Visible to N people via M grants" copy. The focus click behaviour itself is completely unchanged.
- **Files modified:** `src/components/admin/wiring/WiringPatchBay.tsx`, `src/components/admin/wiring/SelectionStrip.tsx`, `src/styles/blueprint-theme.css` (`.open-in-library` link styling — avoiding the [2026-07-14] undefined-CSS-token class by reusing the already-declared `--accent-step` token)
- **Verification:** `library-filter-deeplink.spec.ts` grep-confirms `` `/admin/sops?departments=${focus}` `` and `` `/admin/sops?collection=${focus}` `` in `WiringPatchBay.tsx`, and `openInLibraryHref`/`Open in library` in `SelectionStrip.tsx`.
- **Committed in:** `e197baa` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking issues required to satisfy the plan's own stated acceptance criteria; no scope creep beyond making "the WiringPatchBay focus link builds that URL" actually true).
**Impact on plan:** Necessary for SC-4's deep-link affordance to exist at all; WiringPatchBay/SelectionStrip's core 32-08 behaviour (grouping, focus, trace, wire-up connect mode) is otherwise untouched.

## Issues Encountered

None beyond the two documented deviations above. `npm run test`'s 33 pre-existing failures (phase3/11/12.5/15/20/21/26/29 stubs) were investigated and confirmed unrelated to this plan's files — not fixed, not regressed, out of scope per the deviation-rules scope boundary ("only auto-fix issues DIRECTLY caused by the current task's changes").

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 32 (Visual Org Model & Library Permissions) is complete: SC-1 through SC-6 are all satisfied across plans 32-01 through 32-09.
- `/admin/team` (org model, 32-06/07), `/admin/sops?view=access` (wiring surface, 32-08/09), and the publish→wire-up CTA loop are all live and phase-gate green.
- Deferred ideas carried forward per `32-CONTEXT.md`: exclude/inherited-revoke affordance (D-11), per-SOP grant exceptions, bus-routing audit/wall-display mode, sub-trade ↔ dept/role semantics reconciliation, org empty-state/first-run onboarding.

---
*Phase: 32-visual-org-model-library-permissions*
*Completed: 2026-07-18*

## Self-Check: PASSED

- FOUND: src/components/admin/wiring/WiringPatchBayShell.tsx
- FOUND: src/app/(protected)/admin/sops/page.tsx
- FOUND: src/app/(protected)/admin/sops/builder/[sopId]/PublishStage.tsx
- FOUND: e197baa (Task 1 commit)
- FOUND: 182d09e (Task 2 commit)
