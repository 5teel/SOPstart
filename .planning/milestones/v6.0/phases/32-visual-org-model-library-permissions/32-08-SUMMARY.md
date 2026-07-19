---
phase: 32-visual-org-model-library-permissions
plan: 08
subsystem: ui
tags: [react, typescript, svg, permission-wiring, resolveEffectiveAccess, css]

# Dependency graph
requires:
  - phase: 32-04
    provides: "resolveEffectiveAccess() pure resolver, OrgTree/ChainLink/EffectiveAccess/AccessGrant/SubjectType types"
  - phase: 32-05
    provides: "src/actions/grants.ts — createGrant (org-scope self-enforced, funnels through materialization)"
  - phase: 32-06
    provides: "ViewToggle (reused for the ⌇/▦/◉ lens switch), blueprint-theme.css paper/ink tokens"
provides:
  - "src/components/admin/wiring/SelectionStrip.tsx — fixed 48px banner slot (idle/selection/wiring, never mounts/unmounts)"
  - "src/components/admin/wiring/WiringPatchBay.tsx — D-hybrid wiring surface: grouped org-units × flat collections, quiet-by-default focus, trace via resolveEffectiveAccess, wire-up connect mode with people blast-radius, writes via createGrant"
affects: [32-09, wiring-page-arm, publish-cta, library-deeplinks]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "leftEndpoint(unitId) group-collapse redirection: a department's wire endpoint is itself when its area is expanded, else the area's own jack id — generalizes sketch 003's presentational group-collapse to REAL grantable area entities (D-06), so a collapsed area jack is simultaneously a group toggle AND a valid grant subject."
    - "rawEdges flattening: every chain-addressable unit's own resolveEffectiveAccess() result (direct/inherited/personal) is flattened once into {unitId, collectionId, personal} tuples, then filtered by mode (quiet/focus/connecting) and re-aggregated through leftEndpoint for wire drawing — one resolver call site, no per-view recompute (RESEARCH Pattern 2)."
    - "Imperative SVG wire drawing via getBoundingClientRect() + a nodeRefs Map<id, HTMLDivElement>, redrawn in a useEffect keyed on the computed `wires` array + window resize — same idiom as OrgChartCanvas/FlowGraphCanvas."

key-files:
  created:
    - src/components/admin/wiring/SelectionStrip.tsx
    - src/components/admin/wiring/WiringPatchBay.tsx
  modified:
    - src/styles/blueprint-theme.css
    - tests/phase32/banner-slot-stability.spec.ts
    - tests/phase32/wiring-at-scale.spec.ts
    - tests/phase32/wire-up-mode.spec.ts

key-decisions:
  - "Collections render FLAT (no domain/group layer) — D-01 defines `collections` as a flat org-scoped entity (name/colour/sort), no domain/group table exists in the schema. Sketch 003's COL_GROUPS (Safety Core, Production Ops, ...) was presentational demo data, not a real model. At ~20 rows a flat list stays scannable without a fake grouping entity; only the org-unit side groups (by REAL areas, D-04)."
  - "Areas are rendered as always-clickable/focusable/wireable group jacks whether collapsed or expanded — a deliberate extension beyond sketch 003 (whose DEPT_GROUPS were pure UI grouping, never a grant subject). Since D-06 makes areas a real grantable chain level, collapsing the group must not lose the ability to grant/trace/wire-up at the area level."
  - "Person-level jacks are derived from the `grants` prop (subjectType='person', existing personal grants only) — mirrors sketch 003's single hardcoded Priya node. No arbitrary org-member picker/search ships this phase (deferred idea, matches 'translate the reference impl, don't redesign')."
  - "Blast-radius people count is an exact distinct-person union (via a peopleIndex built from OrgTree's role.people, not an approximate sum) — an upgrade over sketch 003's naive per-unit sum, made possible because WiringPatchBay already receives the full OrgTree with named people."
  - "SelectionStrip's selection AND wiring states share one literal copy template ('Visible to N people via M grants') per 32-08-PLAN Task 1's explicit spec, rather than sketch 003's richer per-mode copy ('X can see N SOPs...') — simpler, matches the plan text verbatim."

patterns-established:
  - "Any future left-side wiring unit (role-level grants, deferred this phase) slots into the same chains/accessByUnit/leftEndpoint machinery — add a chain entry + a rendered jack, no new resolver logic."

requirements-completed: [SC-2, SC-3, SC-5, SC-6]

# Metrics
duration: 20min
completed: 2026-07-18
---

# Phase 32 Plan 08: D-Hybrid Wiring Surface (Component Layer) Summary

**`WiringPatchBay` + `SelectionStrip` ship sketch 003's D-hybrid wiring view — grouped area/department jacks with expand-in-place, quiet-by-default trace via the shared `resolveEffectiveAccess()` (direct/inherited=solid, personal=dashed), and wire-up connect mode that toggles org/area/department/person grant subjects with a live distinct-person blast-radius, writing via `createGrant` on ✓ Done.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-18T19:03:31+10:00 (approx, following 32-07)
- **Completed:** 2026-07-18T19:21:47+10:00
- **Tasks:** 2
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- `SelectionStrip.tsx` — the ONE permanently-reserved `h-[48px] overflow-hidden` slot; idle/selection/wiring states swap inner content + a state class only, never mount/unmount (SC-6)
- `WiringPatchBay.tsx` — grouped area/department jacks (expand-in-place, count badges, survives Visy scale by construction — group collapse aggregates any number of departments into one endpoint), quiet-by-default focus (zero wires until click/search), trace-on-click via `resolveEffectiveAccess()` with direct/inherited=solid and personal=dashed wire styling, and wire-up connect mode (click a `NEW · UNWIRED` SOP jack → toggle org/area/department/person grant subjects → live wires + PEOPLE blast-radius banner → ✓ Done calls `createGrant` per toggle)
- D-11 additive-only enforced structurally: the component never imports/calls `revokeGrant` — no in-place inherited-revoke affordance anywhere
- `.bay`/`.jack`/`.strip-slot`/`.searchbar`/`.cols` CSS added to `blueprint-theme.css` (sketch 003's `<style>` block translated verbatim, `--brand-yellow` avoided per the 2026-07-14 undefined-token learning — every `var(--x)` used already resolves)
- All 3 Wave-0 stubs flipped live with source-contract proof (Rule-3 degrade — no chromium binary installed, same precedent as 32-05/32-06/32-07); visual render-at-scale, pixel-identical slot measurement, and the end-to-end publish→wire-up flow (32-09 page-arm scope) kept as documented `test.fixme` runtime smokes
- `npx tsc --noEmit` clean, `npx eslint` clean, `npm run build` clean — `/sops/[sopId]` bundle stays at 1057 KB (Δ0, WiringPatchBay is admin-only and not yet imported by any route)

## Task Commits

Each task was committed atomically:

1. **Task 1: SelectionStrip fixed-slot banner + banner-slot-stability spec** - `e4b0241` (feat)
2. **Task 2: WiringPatchBay grouped/focus/trace + wire-up mode + specs** - `dbe3a7e` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `src/components/admin/wiring/SelectionStrip.tsx` - fixed 48px banner slot (idle/selection/wiring)
- `src/components/admin/wiring/WiringPatchBay.tsx` - D-hybrid wiring surface (grouped, focus, trace, wire-up)
- `src/styles/blueprint-theme.css` - `.bay`/`.jack`/`.strip-slot`/`.searchbar` CSS additions
- `tests/phase32/banner-slot-stability.spec.ts` - flipped live (SC-6)
- `tests/phase32/wiring-at-scale.spec.ts` - flipped live (SC-3)
- `tests/phase32/wire-up-mode.spec.ts` - flipped live (SC-5)

## Decisions Made
See `key-decisions` in frontmatter — collections render flat (no domain table), areas stay grantable group jacks whether collapsed or expanded, person jacks derive from existing personal grants only, blast-radius uses an exact distinct-person union, and SelectionStrip's selection/wiring copy shares one literal template per the plan's Task 1 spec.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added `.bay`/`.jack`/`.strip-slot`/`.searchbar`/`.cols` CSS to blueprint-theme.css**
- **Found during:** Task 2 (WiringPatchBay)
- **Issue:** The plan's `files_modified` list only covered the two component files, but sketch 003's CSS patterns (`.jack`, `.bay`, `.strip-slot`, etc.) were never declared anywhere in the codebase. Without them every rendered jack/wire/strip would be visually broken — the CLAUDE.md [2026-07-14] undefined-CSS-token class of bug, same as 32-06's precedent.
- **Fix:** Translated sketch 003's `<style>` block verbatim into `blueprint-theme.css`, scoped under `body[data-theme="paper"]`, substituting the sketch's raw hex `--accent-decision`-equivalent match colour for the already-declared `--accent-decision` token (avoiding the undefined `--brand-yellow` trap flagged in the same learning).
- **Files modified:** src/styles/blueprint-theme.css
- **Verification:** `grep -oE "var\(--[a-zA-Z0-9-]+" src/components/admin/wiring/*.tsx src/styles/blueprint-theme.css` cross-checked against `:root` declarations — zero undeclared tokens; confirmed visually consistent with the existing `.node`/`.person-chip` idiom from 32-06.
- **Committed in:** `dbe3a7e` (Task 2 commit)

**2. [Rule 4 — extension beyond the sketch, pre-authorized by D-06] Area group jacks stay clickable/focusable/wireable in both collapsed and expanded states**
- **Found during:** Task 2 (WiringPatchBay)
- **Issue:** Sketch 003's `DEPT_GROUPS` were pure presentational groupings with no independent identity — an expanded group rendered only a plain `.group-label` text header, never a clickable jack. But 32-CONTEXT.md's D-06 makes `area` a real grantable chain level (org → area → department → role → person), so a literal translation would make area-level grants unreachable whenever the group is expanded (no jack to click).
- **Fix:** Rendered the area header as an always-clickable `.jack.group-jack` (toggle arrow + jack body) regardless of expand state, so `leftEndpoint`/`accessByUnit`/wire-up connect mode all treat areas as first-class addressable units — collapsed OR expanded.
- **Files modified:** src/components/admin/wiring/WiringPatchBay.tsx
- **Verification:** `accessByUnit` is built from `chains` which includes every area id regardless of `expandedAreas` state; `wiring-at-scale.spec.ts` asserts `leftEndpoint` collapse redirection is wired.
- **Committed in:** `dbe3a7e` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical CSS, 1 D-06-driven extension over the literal sketch translation)
**Impact on plan:** Both changes were necessary for the delivered surface to render and to satisfy the locked D-06 area-grant requirement; no scope creep beyond the plan's own component-layer boundary (library deep-links, the publish CTA, and the `?view=access` page arm remain untouched, deferred to 32-09 as the plan specifies).

## Issues Encountered

None beyond the two documented deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `SelectionStrip` and `WiringPatchBay` are ready for 32-09 to mount at `/admin/sops?view=access` (D-09): 32-09 owns fetching `listOrgTree()` + `listGrants()` + a flat `collections` read, assembling the `newSop` pinned prop from the post-publish "Wire up access" CTA, and wiring `onWireUpComplete` to a refetch.
- `WiringCollection`/`WiringNewSop` are exported from `WiringPatchBay.tsx` for 32-09 to type its server-fetched props against.
- Library deep-link hrefs (`/admin/sops?departments=<id>` / `?collection=<id>`, the "Viz as library filter" pillar) were deliberately NOT wired in this component — 32-09's explicit scope per the plan objective.
- Matrix/Illuminate lenses render a placeholder ("coming soon") behind the `ViewToggle` — Wiring is the shipping default per the locked design; a future plan can flesh them out without touching `WiringPatchBay`'s data layer (accessByUnit/rawEdges are lens-agnostic).
- `tests/phase32/library-filter-deeplink.spec.ts` remains a Wave-0 stub by design — out of this plan's `files_modified` scope, 32-09's job.

---
*Phase: 32-visual-org-model-library-permissions*
*Completed: 2026-07-18*

## Self-Check: PASSED

- FOUND: src/components/admin/wiring/SelectionStrip.tsx
- FOUND: src/components/admin/wiring/WiringPatchBay.tsx
- FOUND: e4b0241 (Task 1 commit)
- FOUND: dbe3a7e (Task 2 commit)
