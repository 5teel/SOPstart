---
phase: 63-sop-first-home-library-site-map-and-the-sopstart-start
plan: 10
subsystem: ui
tags: [site-map, svg, isometric, accessibility, visual-review]
requires: [63-02, 63-03]
provides:
  - src/components/home/map/SiteMap.tsx (SiteMap, SiteMapProps, MapRow)
  - src/components/home/map/MapShapes.tsx (Shape, Plate, MapObject, roleStyle, ROLE_STYLE, PLATE_H)
  - src/components/home/map/MapKey.tsx (MapKey, MapKeyItem)
  - scripts/render-map-samples.ts
affects: [63-11, 63-12, 63-17]
key-files:
  created:
    - src/components/home/map/SiteMap.tsx
    - src/components/home/map/MapShapes.tsx
    - src/components/home/map/MapKey.tsx
    - scripts/render-map-samples.ts
    - tests/phase63/site-map.spec.ts
    - .planning/phases/63-sop-first-home-library-site-map-and-the-sopstart-start/map-samples/*.png (20)
  modified:
    - src/styles/blueprint-theme.css
key-decisions:
  - "Text is sized in CSS pixels, not sketch units: a ResizeObserver measures the svg and u = user units per CSS px at the current zoom drives every sign, label and halo. The sketch's fixed 12.5 made zoomed labels about 6 px on a phone"
  - "Zoomed labels are decluttered, not truncated harder: kept greedily in list order, a label that would overlap a kept one is hidden and appears (on a paper backing) while its object is hovered or focused. An area of 15 SOPs read as a pile of overlapping titles before this"
  - "The open plate is role=group, not role=button: nested interactive objects inside a button are invalid, and clicking the open plate did nothing in the sketch either"
  - "Hover lift is translateY(-6px) (the sketch's value), not the plan's -3px, so it reads at the drawing's scale"
  - "Phone markers sit at the plate centre at height 1.2 as in the sketch; they cover the objects on 1-3 SOP plates, accepted because the key and the plate colour carry the identity"
  - "The empty library renders its own message instead of the svg; MapKey ships in the same lazy chunk (rendered by SiteMap)"
requirements-completed: []
duration: 55min
completed: 2026-10-08
---

# Phase 63 Plan 10: The library site map Summary

**The library drawn as an isometric SVG site (plates with name signs, one object per SOP), with click-to-zoom, dim-and-switch, keyboard buttons, a phone marker + key layer and a label declutter, all token-only, built unmounted for 63-11.**

## Component API

```ts
SiteMap({ areas: LibraryArea[]; rows: MapRow[]; area: string | null; onArea(id | null); onOpenSop(id);
          orgName: string; renderObjective?(areaId | null): ReactNode; initialSize?: { w; h } })
MapRow = { id; title; areaId; kind: ObjectKind; status: RowStatus | null }   // a LibraryRow satisfies it
MapKey({ items: MapKeyItem[]; area; onArea })                                  // rendered by SiteMap, lg:hidden, hidden while an area is open
```

- Test ids: `map-header`, `map-crumb`, `site-map`, `map-area` (`data-area-id`, `data-state` cur / dim / empty), `map-object` (`data-sop-id`), `map-key`, `map-key-item`, `map-empty`.
- `rows` are the only source of objects (the list's rows), so the drawing cannot show a SOP the list does not. Rows whose `areaId` is not in `areas` are not drawn.
- Esc handling stays in HomeShell (63-11 plan); SiteMap carries the hint text `Esc for the whole site` (bundle marker). The hint is hidden below `lg` (no Esc on a phone).
- `initialSize` is the drawing size before the first measure (default 660 x 700); the sample script passes the measured size.
- Zoom: the viewBox lives on the element (`setAttribute('viewBox'`), tweened in `requestAnimationFrame` over the parsed `--dur-map-zoom`, a direct cut under reduced motion and on first draw; React only ever sees the first value.

## CSS added (blueprint-theme.css, global, not imported by the lazy module)

`.map-svg` (select none, round joins) · `.map-plate` transition on transform / opacity from `--dur-hover-lift` and `--ease-fuse` · `[role="button"]` pointer cursor and lift (hover, focus-visible) · `[data-state="dim"]` opacity .32, .6 on hover · `:focus-visible` outline for plate and object (`--accent-step`) · `.map-object` hover brightness and shadow · `.map-sign`, `.map-label` pointer-events none · label paper halo · `prefers-reduced-motion` drops the plate transition. Colours are tokens only (steel / iron / coal / paper come from the ink ramp, card and forklift from `--accent-decision` mixed into paper, area-tinted roles from the plate's area token).

## Sample renders (all read; `map-samples/`)

Run `npx tsx scripts/render-map-samples.ts` (7 s; compiles the real Tailwind CSS, renders `SiteMap` to markup, screenshots in Chromium; pass 1 measures the drawing area, pass 2 sizes the text from it). Desktop is 1280 x 800 with the map in a 660 px pane (the reader pane's real width), phone is 390 x 844 at 2x.

| PNG | Reading | Fixed |
|---|---|---|
| `real-org-3-areas-whole-desktop` | Engineering (tank), Forming (2 conveyors), General (board) read as three clear plates with signs and counts | none |
| `real-org-3-areas-whole-phone` | numbered markers 1-3 on plates, two-column key (3 items) | none |
| `real-org-3-areas-zoom-desktop` | Forming opened; both conveyors titled with status, others dim | label raised clear of the object tops |
| `real-org-3-areas-zoom-phone` | Forming opened; labels legible | label size (see below) |
| `1-area-1-sop-whole-desktop` | one plate, one board, one sign | none |
| `1-area-1-sop-whole-phone` | one marker, one key item | none |
| `1-area-1-sop-zoom-desktop` | board with its title above | none |
| `1-area-1-sop-zoom-phone` | board and title, lots of ground | none (width-fit letterbox is inherent) |
| `3-areas-6-sops-whole-desktop` | three plates of six mixed objects, signs clear of each other | none |
| `3-areas-6-sops-whole-phone` | markers 1-3, key | none |
| `3-areas-6-sops-zoom-desktop` | six objects, titles and status; the colliding ones now hidden until hover | declutter added |
| `3-areas-6-sops-zoom-phone` | three of six titles kept, readable | declutter added |
| `8-areas-mixed-whole-desktop` | 1 to 15 objects, every kind; eight signs, none overlapping each other | none |
| `8-areas-mixed-whole-phone` | eight markers, 2 x 4 key | none |
| `8-areas-mixed-zoom-desktop` | 15-object Quality area, titles kept without overlap | declutter added |
| `8-areas-mixed-zoom-phone` | same on a phone, labels at readable size | label size, declutter |
| `12-areas-15-sops-whole-desktop` | all twelve name signs shown, none overlapping another; signs sit over neighbouring plates' objects (same as the sketch) | sign scale tied to measured pixels |
| `12-areas-15-sops-whole-phone` | twelve markers, 2 x 6 key (capped at 40% height, scrolls) | none |
| `12-areas-15-sops-zoom-desktop` | 15 SOPs: about 7 titles kept, the rest on hover | was a pile of 15 overlapping titles before declutter |
| `12-areas-15-sops-zoom-phone` | 3 titles kept; the rest unlabelled on touch | see known limit |

Defects found by looking, and fixed: (1) zoomed labels were about 10 px on desktop and about 6 px on a phone because they scaled with the sketch's 800-unit width, now sized from the measured svg; (2) a 6 to 15 SOP area printed its titles on top of one another, now greedy declutter with hover / focus reveal; (3) labels sat on the object tops, raised from height + 0.55 to + 0.9; (4) first spec run of the lint caught my own comment quoting the area-token pattern (the 2026-09-28 comment-quoting learning), reworded.

## Known limits

- On a touch screen a decluttered label cannot be revealed by hover, so in a crowded area (more than about six SOPs on a phone, more than about eight on desktop) some objects have no visible title until tapped (a tap opens Read). The list holds every title; a "tap shows title first" step or zooming further on dense areas is the upgrade if the eval shows people lost.
- Sign and label box widths are estimated from character counts (ponytail comment); area names are clipped at 22 characters, titles at 28.
- The whole-site view is width-fit, so a phone shows the site in about a third of the pane height, centred.

## Verification

- `npx tsc --noEmit` exit 0; eslint on the map folder, script and spec clean.
- `npx playwright test --project=phase63 -g "site map"` 8 passed (includes a real tsx render: one plate per area, no objects until open, exactly the open area's objects, a hostile title rendered as escaped text, empty state); whole phase63 project 85 passed.
- `design-tokens` and `no-undefined-css-tokens` (phase15-stubs) 9 passed.
- `npm run build` green; bundle gate `/page` 837 KB (baseline 837, delta 0), `/sops/[sopId]/page` 795 KB (baseline 795, delta 0). The map is not imported anywhere yet, so the gate is untouched; 63-11 measures the seam when it mounts the lazy module. `.bundle-baseline.json` untouched.
- grep acceptance: no `dangerouslySetInnerHTML`, no hex, no `.css'` import in `src/components/home/map/`; `Esc for the whole site` present.

## Deviations from Plan

1. **[Rule 2 - correctness] Open plate is `role="group"`**: nested buttons inside a button group are invalid; non-open plates are buttons as planned.
2. **Hover lift -6px** instead of -3px (sketch value; user units scale with zoom).
3. **Added** `initialSize` prop and a ResizeObserver, the label declutter and the hover / focus reveal (state `hot`), none in the plan, all needed after reading the renders (see defects). Plate hover itself remains CSS; the one `useState` change is per hovered object, never per frame.
4. The spec adds a real server render (tsx subprocess) beyond the planned source-contract checks, to cover T-63-27 behaviourally.

## Known Stubs

None. SiteMap is intentionally unmounted until 63-11.

## Threat Flags

None. Titles and area names are React text nodes and `<title>` only (T-63-27); objects come only from the `rows` the caller passes (T-63-28); layout and shapes are memoised, hover is CSS, the tween writes to a ref (T-63-29).

## Self-Check: PASSED

Files exist (three components, script, spec, 20 PNGs); commits `1b0f5368`, `2c000b5e` present; `.bundle-baseline.json` untouched.
