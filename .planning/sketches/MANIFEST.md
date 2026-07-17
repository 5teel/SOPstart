# Sketch Manifest

## Design Direction

Paper/ink engineering-drawing system (established in the blueprint-redesign exploration, wrapped 2026-04-24 into the `sketch-findings-SOPstart` skill): white/paper canvas, ink-black text, JetBrains Mono for technical content, Inter for prose, 20px grid-paper backgrounds on canvases, semantic accent colors only (never decorative). New sketches extend this system to the **org-model + library-permissions surface** — a business (Visy first) draws its org structure and wires SOP-library access onto it, with every arity (1:N, N:1, N:M) legible at a glance.

## Reference Points

- blueprint.am (original aesthetic seed)
- The shipped SOP Flow tab (spatial node graph on grid paper — Variant 001-B speaks its language)
- Prior root-level sketches: `sketches/departments/`, `sketches/team-departments/`, `sketches/unified-block-library/` (Phase 25 inputs)

## Sketches

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 001 | org-model-canvas | How does a business draw departments → roles → people quickly (named or unnamed)? | B (Node Chart default · Columns alt view) | org-model, departments, roles |
| 002 | permission-wiring | How do SOP-access connections read at a glance across 1:N, N:1, N:M? | A (Patch Bay default · Matrix + Illuminate alt views) | permissions, library-access |

## Decisions

- **2026-07-17 — Multi-view, not either/or.** Both surfaces ship as ONE page with an in-page view toggle (pattern validated in the sketches themselves): org model = ⊞ Chart (default) / ▤ Columns; library access = ⌇ Wiring (default) / ▦ Matrix / ◉ Illuminate. All views are lenses over the same underlying model — no view has private state.
