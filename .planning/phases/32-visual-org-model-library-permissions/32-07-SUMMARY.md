---
phase: 32-visual-org-model-library-permissions
plan: 07
subsystem: ui
tags: [react, typescript, nextjs, org-chart, admin-page, css]

# Dependency graph
requires:
  - phase: 32-06
    provides: "OrgChartCanvas.tsx, ViewToggle.tsx, layoutOrgTree (Node Chart + shared toggle)"
  - phase: 32-04
    provides: "listOrgTree/createRole/createArea/assignRoleMembers server actions + OrgTree types"
provides:
  - "src/components/admin/org-model/OrgColumnsBoard.tsx — Columns alt view, absorbs the member roster"
  - "src/components/admin/org-model/TeamViewShell.tsx — client shell mounting the Chart/Columns toggle"
  - "src/app/(protected)/admin/team/page.tsx — /admin/team is now the org model (D-08)"
affects: [32-08, org-model-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server page fetches (listOrgTree/listDepartments/org) stay in the async page.tsx; a small 'use client' shell (TeamViewShell) owns ONLY the view-toggle useState — Server Components cannot hold client state or pass client callbacks across the RSC boundary, so any stateful client toggle needs its own file"
    - "Mutation refresh pattern: onChange callbacks from OrgChartCanvas/OrgColumnsBoard call router.refresh() (native Next.js re-fetch), not bespoke client-side refetch logic"
    - "Columns reuses OrgChartCanvas's .node/.person-chip/.pill CSS verbatim by overriding position:absolute -> static inline per usage, rather than forking new card styles"

key-files:
  created:
    - src/components/admin/org-model/OrgColumnsBoard.tsx
    - src/components/admin/org-model/TeamViewShell.tsx
  modified:
    - src/app/(protected)/admin/team/page.tsx
    - src/lib/journeys/journeys.ts
    - src/lib/uat/tests.ts
    - tests/phase32/org-chart-build.spec.ts

key-decisions:
  - "Added TeamViewShell.tsx (not in plan's files_modified) — team/page.tsx is an async Server Component; it can fetch listOrgTree() server-side but cannot hold the ⊞/▤ toggle's useState nor pass a client onChange callback to ViewToggle across the RSC boundary. This thin client wrapper is the minimum extra file required to mount a stateful client toggle from a server page (Rule 3 — blocking issue, same class as 32-06's CSS-token auto-add)."
  - "OrgColumnsBoard absorbs the old RoleAssignmentTable member roster as a collapsible <details> sub-panel rather than reimplementing invite/org-role/department-picker UI — plan Task 1 explicitly allowed 'a sub-panel'; this is the lazy, zero-duplication reading of that instruction and keeps org-privilege-role editing on the exact same battle-tested component."
  - "'+ person' ghost resolves an entered email against the org's member roster (fetched via the existing getTeamMembersWithEmails() action) then calls assignRoleMembers(roleId, [...currentIds, matchedId]) — window.prompt-based UX, consistent with OrgChartCanvas's existing prompt pattern for + Add role / + ADD DEPARTMENT (32-06); no new UI component built for a one-shot lookup."
  - "org-chart-build.spec.ts (SC-1) flipped live as source-contract assertions, not full browser rendering — no chromium binary + live app + magic-link session available in this environment, exactly the same Rule-3 trade-off as tests/e2e/admin-departments.spec.ts (Phase 25). The true browser render (Node Chart visible, toggle click switches to Columns, 5 AdminNav tabs) is kept as a documented test.fixme runtime smoke with the same prerequisites list as that precedent."

patterns-established:
  - "Any future stateful client control that needs to live on a server-fetched admin page gets its own thin '<Name>Shell.tsx' 'use client' wrapper — never try to hoist state into the async page component."

requirements-completed: [SC-1]

# Metrics
duration: 20min
completed: 2026-07-18
---

# Phase 32 Plan 07: /admin/team Becomes the Org Model Summary

**`/admin/team` now server-fetches `listOrgTree()` and renders the Node Chart (default) with an in-page ⊞ Chart / ▤ Columns toggle; the new `OrgColumnsBoard` absorbs the Phase 15/25 member roster as a reachable sub-panel, and `journeys.ts`/`uat/tests.ts` were updated in the same change.**

## Performance

- **Duration:** 20 min
- **Tasks:** 2
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- `src/components/admin/org-model/OrgColumnsBoard.tsx` (`'use client'`) — horizontal `overflow-x` flex board, one `flex: 0 0 250px` column per department, role cards with named/vacancy `.person-chip` chips + `.pill` capacity counts (reused verbatim from `OrgChartCanvas`, position overridden to `static`); dashed `+ Add role` / `+ person` / `+ ADD DEPARTMENT` ghosts wired to `createRole` / `assignRoleMembers` / `createDepartment`; absorbs `RoleAssignmentTable` (invite, org-privilege role, department picker) as a collapsible `<details>` sub-panel — nothing deleted, everything reachable
- `src/components/admin/org-model/TeamViewShell.tsx` (new, `'use client'`) — thin client wrapper mounting `ViewToggle` over `OrgChartCanvas` ↔ `OrgColumnsBoard`; `onChange` refresh is `router.refresh()`
- `src/app/(protected)/admin/team/page.tsx` rewritten: keeps the `getSessionContext()` admin/safety_manager guard and `AdminNav active="team"` verbatim; independent `organisations`/`listDepartments()`/`listOrgTree()` reads run in `Promise.all` ([2026-07-13] no serial waterfall); renders `TeamViewShell`
- `journeys.ts` — the `manage-team` journey's `team` step and the admin-dashboard journey's `team` step both now describe the org-model surface (Node Chart default + Columns toggle absorbing the roster); route stays `/admin/team`, no new not-mapped screen
- `uat/tests.ts` — added `p32-org-model-team-view` review entry (chart clarity, Columns speed, vacancy-chip clarity, member-management parity)
- `tests/phase32/org-chart-build.spec.ts` (SC-1) flipped live: 12 real source-contract assertions across `OrgChartCanvas`, `ViewToggle`, `OrgColumnsBoard`, `TeamViewShell`, and `page.tsx` (all passing); the true browser-render scenario is a documented `test.fixme` runtime smoke (chromium + live app + magic-link session prerequisites, mirrors `tests/e2e/admin-departments.spec.ts`)

## Task Commits

1. **Task 1: OrgColumnsBoard (Columns alt view)** — `4393349`
2. **Task 2: Rewrite /admin/team + journeys + uat** — `8c4df6f`

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `src/components/admin/org-model/OrgColumnsBoard.tsx` - Columns alt view + absorbed roster sub-panel
- `src/components/admin/org-model/TeamViewShell.tsx` - client shell mounting the Chart/Columns toggle (deviation, see below)
- `src/app/(protected)/admin/team/page.tsx` - rewritten to fetch listOrgTree() and mount TeamViewShell
- `src/lib/journeys/journeys.ts` - `team` step details updated to describe the org-model surface
- `src/lib/uat/tests.ts` - new `p32-org-model-team-view` UAT entry
- `tests/phase32/org-chart-build.spec.ts` - SC-1 flipped live (source-contract) + documented runtime smoke

## Decisions Made

See `key-decisions` in frontmatter — the two load-bearing ones are the `TeamViewShell.tsx` auto-add (RSC boundary requires a client-state wrapper) and absorbing `RoleAssignmentTable` as a sub-panel rather than reimplementing invite/org-role UI.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] Added `TeamViewShell.tsx`, not in the plan's `files_modified`**
- **Found during:** Task 2
- **Issue:** `team/page.tsx` is an async Server Component (needed to `await getSessionContext()` / `listOrgTree()`). It cannot hold the `⊞ Chart / ▤ Columns` toggle's `useState`, and cannot pass a client `onChange` callback to the client `ViewToggle` component across the Server/Client boundary — Next.js only allows serializable props across that boundary.
- **Fix:** Added a minimal `'use client'` wrapper (`TeamViewShell.tsx`) that receives the server-fetched `OrgTree`/departments/org data as plain serializable props and owns the toggle state + `OrgChartCanvas`/`OrgColumnsBoard` switch itself.
- **Files modified:** `src/components/admin/org-model/TeamViewShell.tsx` (new)
- **Verification:** `npx tsc --noEmit` clean; `npm run build` clean; `page.tsx` verify grep shows `listOrgTree` wired (2 matches: import + call).
- **Committed in:** `8c4df6f` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — RSC client-boundary requirement)
**Impact on plan:** Necessary for the toggle to function at all; no scope creep beyond making the plan's own described behaviour ("mounts a ViewToggle switching OrgChartCanvas ↔ OrgColumnsBoard") actually work under Next.js's Server/Client Component rules.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `TeamViewShell`, `OrgColumnsBoard`, and the rewritten `/admin/team` page are ready for 32-08's wiring-mode work — `ViewToggle` remains a pure controlled component reusable for the ⌇/▦/◉ wiring-view switcher with no changes needed.
- `npx tsc --noEmit` clean; `npx eslint` clean on all new/modified files; `npm run build` clean (bundle gate: `/sops/[sopId]/page` Δ +1 KB, within ±2 KB tolerance, unrelated to this admin-only route).
- `phase32` (34/34, 6 fixme-skipped, 0 failed) and `phase32-unit` (6/6) Playwright projects both green, including all 12 newly-live SC-1 assertions.

---
*Phase: 32-visual-org-model-library-permissions*
*Completed: 2026-07-18*

## Self-Check: PASSED

- FOUND: src/components/admin/org-model/OrgColumnsBoard.tsx
- FOUND: src/components/admin/org-model/TeamViewShell.tsx
- FOUND: src/app/(protected)/admin/team/page.tsx
- FOUND: 4393349 (Task 1 commit)
- FOUND: 8c4df6f (Task 2 commit)
