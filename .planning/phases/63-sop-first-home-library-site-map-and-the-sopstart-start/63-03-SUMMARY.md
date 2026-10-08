---
phase: 63-sop-first-home-library-site-map-and-the-sopstart-start
plan: 03
subsystem: ui
tags: [isometric, geometry, layout, pure-modules, playwright]
requires: [63-01]
provides:
  - src/lib/library/iso.ts (TILE, project, boxFaces, cylinder, glyph, FOOTPRINT, HEIGHT, Shape types)
  - src/lib/library/iso-layout.ts (layoutSite, viewFor, byDepth)
affects: [63-10]
key-files:
  created:
    - src/lib/library/iso.ts
    - src/lib/library/iso-layout.ts
    - tests/phase63/iso-layout.spec.ts
key-decisions:
  - "Descriptors are { k: 'poly' | 'ellipse' | 'rect' | 'line', ..., role }; polys and lines carry pts, edges are drawn by the renderer (role 'edge' only for cylinder side lines)"
  - "Roles are plain strings resolved to tokens in 63-10; tones are steel, iron, coal, paper, card, hazard, accent, accent-soft, each as -top / -side / -dark; singles: tank-side, tank-top, iron-line, ruling, edge, accent-dark (tank band)"
  - "Plate roles (plate-top / plate-right / plate-left) and the ground role are supplied by the map component via boxFaces; plate height is 0.3 (the sketch's)"
  - "Plate size from the object grid: cols = ceil(sqrt(count x 2.4 / 2.8)); cell 2.8 x 2.4 plus 0.8 margin each side; minimum 5 x 4; gap between plates 1.5"
  - "viewFor whole-site uses all eight plate corners and all four ground corners (the sketch used seven plate corners)"
requirements-completed: []
duration: 20min
completed: 2026-10-08
---

# Phase 63 Plan 03: isometric geometry and site layout Summary

**The sketch's isometric engine as two plain modules: shape descriptors with token-role colours, and a shelf-packed automatic layout that lays out 1 to 12 areas of 1 to 40 objects with no overlap.**

## Commits

- RED: `de5429f8` (projection and glyph cases), `4121368c` (layout, view box, depth cases)
- GREEN: `2ca5812f` (`iso.ts`), `12c1295d` (`iso-layout.ts`)

## Roles used

steel / iron / coal / paper / card / hazard / accent / accent-soft tones (each `-top`, `-side`, `-dark`), plus `tank-side`, `tank-top`, `accent-dark`, `iron-line`, `ruling`, `edge`. 63-10 maps these to tokens; `accent-*` take the area colour.

## Packing ceiling

Shelf packing by descending footprint, target row width sqrt(total area x 1.5). Very uneven plate sizes leave gaps at the end of rows; upgrade path is a skyline packer (ponytail comment in the code).

## Verification

- `npx playwright test --project=phase63 -g "iso layout"`: 9 passed (the 4 x 4 matrix case takes about 11 s).
- `npx tsc --noEmit`: exit 0.
- No hex / rgb, no directive, React or DOM in either module.

## Deviations from Plan

None. Notes: the spec's second half imports `iso-layout` and `ObjectKind` at the top; `bench` and `rack` glyphs use only role tones (sketch's per-object mixes collapse to `accent` / `accent-soft`).

## Known Stubs

None.

## Self-Check: PASSED

Files exist; commits `de5429f8`, `2ca5812f`, `4121368c`, `12c1295d` present; `.bundle-baseline.json` untouched.
