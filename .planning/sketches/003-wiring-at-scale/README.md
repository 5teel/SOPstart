---
sketch: 003
name: wiring-at-scale
question: "Does the Patch Bay survive real Visy scale (~15 depts × ~20 collections), and what collapse/filter/focus behaviour keeps it legible?"
winner: null
tags: [permissions, library-access, scale, patch-bay]
---

# Sketch 003: Wiring at Scale

## Design Question
Sketch 002's winning Patch Bay was validated at 4 departments × 6 collections. Real Visy scale is ~15 × ~20 with ~34 grants. This sketch stress-tests three survival strategies. All variants render from ONE shared data model (15 depts in 5 areas, 20 collections in 6 domains, 34 grants incl. 2 site-wide) — the strategies differ only in how they tame density.

## How to View
open .planning/sketches/003-wiring-at-scale/index.html

## Variants
- **A: Collapse to Groups** — areas/domains collapse the graph to 6×6 with aggregated wires + count badges; groups expand in place; trace works at any granularity
- **B: Focus Mode** — nothing drawn until asked; search filters, click focuses one unit and draws only its wires; "Show all 34 wires" button demonstrates the spaghetti the default avoids
- **C: Bus Routing** — everything always drawn, orthogonally routed down per-department bus lanes (engineering-schematic look); count badges both sides; click raises one circuit

## What to Look For
- **A collapsed** is the best overview (6×6 reads instantly) — but expanded-mixed-granularity gets busy; do the count badges + trace hold it?
- **B focused** is the cleanest single-unit answer at full scale — but the default state shows NO relationships; is an empty bay acceptable as the landing state?
- **C** proves always-on density is possible without spaghetti — but is ambient wiring worth the visual weight vs. B's on-demand clarity?
- Likely outcome is a hybrid: A's grouping as the list structure + B's focus behaviour as the interaction, with C's count badges. Judge whether any single variant stands alone before assuming the hybrid.
