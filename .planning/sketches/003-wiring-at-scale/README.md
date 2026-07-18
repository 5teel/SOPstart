---
sketch: 003
name: wiring-at-scale
question: "Does the Patch Bay survive real Visy scale (~15 depts × ~20 collections), and what collapse/filter/focus behaviour keeps it legible?"
winner: "D"
tags: [permissions, library-access, scale, patch-bay]
---

> **Decision (2026-07-18):** the D hybrid ships — A's grouped structure + B's
> focus interaction + viz-as-library-filter + wire-up mode. A/B/C stand as the
> strategy exploration that produced it; C (always-on bus routing) rejected as
> most build effort for least added clarity, though it proves an always-on
> audit/wall-display mode is possible if ever wanted.

# Sketch 003: Wiring at Scale

## Design Question
Sketch 002's winning Patch Bay was validated at 4 departments × 6 collections. Real Visy scale is ~15 × ~20 with ~34 grants. This sketch stress-tests three survival strategies. All variants render from ONE shared data model (15 depts in 5 areas, 20 collections in 6 domains, 34 grants incl. 2 site-wide) — the strategies differ only in how they tame density.

## How to View
open .planning/sketches/003-wiring-at-scale/index.html

## Variants
- **A: Collapse to Groups** — areas/domains collapse the graph to 6×6 with aggregated wires + count badges; groups expand in place; trace works at any granularity
- **B: Focus Mode** — nothing drawn until asked; search filters, click focuses one unit and draws only its wires; "Show all 34 wires" button demonstrates the spaghetti the default avoids
- **C: Bus Routing** — everything always drawn, orthogonally routed down per-department bus lanes (engineering-schematic look); count badges both sides; click raises one circuit
- **D: Hybrid + Wire-Up** *(synthesis, built after review)* — A's grouped structure + B's focus interaction, plus the two capabilities that make this a working surface, not just a viewer:
  - **Viz-as-library-filter:** focusing any unit shows a selection strip — "Engineering can see **37 SOPs** across 8 collections, e.g. IS Machine Bearing Change…" — with an **→ Open in library (37)** deep-link (URL contract: `/admin/sops?departments=…` / `?collection=…`)
  - **Wire-up mode (permission CREATION):** a just-published SOP arrives pinned top-right as `NEW · UNWIRED · 0 grants`. Clicking it enters connect mode: clicking org units (Org / area / department / person) draws live green wires, a banner keeps a running blast radius ("Visible to **104 people** via 3 grants"), Done exits and the SOP shows its grant count. Same mechanics work for roles once the roles layer exists.

## What to Look For
- **A collapsed** is the best overview (6×6 reads instantly) — but expanded-mixed-granularity gets busy; do the count badges + trace hold it?
- **B focused** is the cleanest single-unit answer at full scale — but the default state shows NO relationships; is an empty bay acceptable as the landing state?
- **C** proves always-on density is possible without spaghetti — but is ambient wiring worth the visual weight vs. B's on-demand clarity?
- **D** is the direction (per review 2026-07-18): does the wire-up flow feel like "connecting" rather than "configuring"? Does the blast-radius count (people reached) give enough confidence to press Done? Is the rest state (only fresh wiring visible) the right landing?
