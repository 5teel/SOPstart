# ADR-0010: A tiered site map, packed by the org's choice

- **Status:** Accepted
- **Date:** 2026-10-12
- **Decided by:** Simon ("tiered system where clicking on one site area expands to show a sub area ... important for large organisations of many sites with hundreds of SOPs"; packing "as an option for the visual site layout config")
- **Supersedes:** —
- **Enforced by:** `tests/phase63/site-tiers.spec.ts`

## Context
ADR-0005 draws the home map from the library: one flat plate per area (a department with a SOP).
A large organisation has several sites, halls inside a site and lines inside a hall, with hundreds of
SOPs; one flat row of plates is unreadable at that size. The shelf packing also left a lone area on
the last row, stretched into a long strip.

## Decision
1. **Areas nest.** `departments.parent_id` (migration 00077) puts a department inside another, any
   depth. A SOP's area is unchanged (ADR-0005 rule 2); every ancestor of a used area is drawn too.
   Archived or missing parents and cycles fall back to the top level (`deptPath` in `areas.ts`);
   `updateDepartment` refuses a parent outside the session org or inside the department itself.
2. **A parent is a plate holding its sub-areas.** It stands one plate higher than its parent, with
   walkways on its floor; its own SOPs stand in a block beside its sub-areas. The whole tree is
   drawn at once (`layoutSite` in `iso-layout.ts`).
3. **One level at a time.** The areas one level in from where the reader stands carry signs
   ("Name · N areas · N SOPs"), the phone key and the clicks. Clicking zooms in; the crumbs and Esc go
   back up one level. A leaf shows its SOPs' titles and opens Read. The list filters to the open
   area and everything inside it, and groups by area in tree order.
4. **Packing is an org setting**, `organisations.site_map_packing`: `balanced` (default; the row
   count whose even split is nearest square, so no lone area on a row) or `rows` (shelf rows, biggest
   first). Both fill every row to the full width and depth. Admins set it in Site & departments
   (`setSiteMapPacking`, ledger kind `site_change`); the home reads it on the server.

## Consequences
- A big organisation reads as a few sites, then halls, then lines; each zoom shows a readable number of signs.
- The org-model `areas` table (Phase 32) stays unused by the map; tiers are departments only.
- Every SOP's object is still drawn at the whole-site view. ponytail: fine to a few hundred; draw
  sub-area contents only below the open level if a site outgrows it.

## How to comply
- A new tier is a department with "Sits inside" set in Site & departments; nothing else is added.
- Never compute area containment outside `areas.ts` (`areaPath`, `inArea`); never lay out plates outside `iso-layout.ts`.
- A new packing is a value in `PACKINGS`, the `organisations_site_map_packing_check` constraint (new migration) and the Site & departments control.
