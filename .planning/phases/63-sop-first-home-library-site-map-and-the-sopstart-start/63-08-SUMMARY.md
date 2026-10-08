---
phase: 63-sop-first-home-library-site-map-and-the-sopstart-start
plan: 08
subsystem: ui
tags: [manage, site-editor, objectives, admin-gate]
requires: [63-02]
provides:
  - src/actions/manage.ts (listManageDrafts)
  - src/components/admin/site/SiteEditSurface.tsx (SiteEditSurface)
  - src/components/home/sections/ManageSection.tsx (ManageSection)
  - src/components/home/sections/ObjectivesList.tsx (ObjectivesList)
affects: [63-11, 63-19, 63-20]
key-files:
  created:
    - src/actions/manage.ts
    - src/components/admin/site/SiteEditSurface.tsx
    - src/components/home/sections/ManageSection.tsx
    - src/components/home/sections/ObjectivesList.tsx
    - tests/phase63/manage-section.spec.ts
  modified: []
key-decisions:
  - "listManageDrafts is parameterless, calls requireAdminContext before loadInbox, and imports neither reconcileMachineRequests nor ensureReviewDueNotifications"
  - "SiteEditSurface is a copy, not a move: AdminShell keeps its inline copy until 63-20 deletes the file, so AdminShell is untouched"
  - "Any change in Site & departments invalidates site-org, library-areas and manage-drafts, so a new department shows as a library area at once"
requirements-completed: []
duration: 15min
completed: 2026-10-08
---

# Phase 63 Plan 08: Manage SOPs Summary

**Manage SOPs section built unmounted: New SOP, the drafts list from a side-effect-free admin read, and Site & departments (the site editor, now its own module) followed by an objectives list covering the site, every department and every machine.**

## Action

`listManageDrafts()` returns `{ drafts }` using getAdminShell's exact draft mapping (non-published rows from `loadInbox`, owner label, review due). Admin gate first (T-63-22).

## Section views

- `view = null`: heading "Manage SOPs", sub line, New SOP (`/admin/sops/new`), Site & departments (`manage-site`), "Your drafts" (each with a "Carry on" link to the editor, `from` = `homeFrom({ ...HOME, s: 'manage' })`), "No drafts." empty line, error line. No count; change requests are not listed (they stay in Sign-offs).
- `view = 'site'`: `SiteEditSurface` (Done returns to the main view) then `ObjectivesList`.

## Objective subjects covered

Site (`prefix="Site"`), each department (`prefix={d.name}`), each machine (`prefix={m.name}`), all `emptyLabel="Set an objective"` `emptyStyle="dashed"`, reading the `['site-org']` query shared with the editor.

## Notes

`focusHref` still passes `from` through the old place whitelist, so the editor's Back from a draft returns to the overview until 63-11 rewires focus-path through `homeFromToken` (planned there).

## Verification

- `npx tsc --noEmit` clean; phase63 72/72 (manage section 4/4); `tests/lint` 42/42 (design-tokens, no-dead-internal-hrefs included).
- `npm run build` postbuild gate green: `/page` 837 KB (baseline 837, delta 0), `/sops/[sopId]/page` 795 KB (baseline 795, delta 0). `.bundle-baseline.json` untouched.
- No pinned spec reads any file touched (AdminShell unchanged).

## Deviations from Plan

None - plan executed exactly as written. Capability gates unchanged.

## Known Stubs

None. The section is intentionally unmounted until 63-11.

## Self-Check: PASSED
