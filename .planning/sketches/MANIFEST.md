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
| 003 | wiring-at-scale | Does the Patch Bay survive ~15 depts × ~20 collections, and what keeps it legible? | D (hybrid: groups + focus + library-filter + wire-up mode) | permissions, scale |
| 004 | admin-sop-hub-hierarchy | How do the four stacked /admin/sops control tiers collapse into one comprehensible hierarchy? | A (one rail, no page header, grouped attention queue) | admin, information-architecture, governance |
| 005 | sop-library-altitude | How does /admin/sops funnel from a high-level decision down to one SOP, instead of showing every SOP and attribute at one altitude? | C (Miller columns — scope · list · editable detail) | admin, information-architecture, library, progressive-disclosure |
| 006 | sop-navigation-model | How does /sops answer "which procedure do I need?" for a worker AND stay useful to an admin, without a scope column that mixes role, obligation, catalogue and facet? | superseded by 007 | navigation, information-architecture, library, governance, worker, admin, phone |
| 007 | plant-floor-navigation | What if the plant itself is the navigation — an isometric site with tappable machines, pins for what is due (worker) or what is sick (admin) — and the library is never the home? | Plant (scene as worker home + phone QR + admin inbox; shared terminal dropped) | navigation, spatial, isometric, worker, kiosk, phone, admin, generated-assets |
| 008 | one-screen-site | If the whole app is one screen (isometric site + sidebar), where does the real work render — docked panel, sheet over the map, or step inside the room? | A (three panes; an open SOP takes the whole screen — map and list removed) | mvp, simplification, navigation, isometric, one-screen, data-model |
| 009 | sop-first-home | If safe SOP use is the whole point, what is the home, and how does starting a SOP feel? | pending | home, navigation, brand, motion, worker, phone |

## Decisions

- **2026-10-07 — Attention follows the objectives (Simon).** Ranked: safe, competent SOP use > sign-off/training records > SOP creation (rare, quiet, frictionless once started). The room metaphor is dropped as a fuzzy semantic; machines and places stop organising SOPs (processes and orders of operation have no place); no Next-for-you card and no due queues -- the app manages SOPs, safety, training and records, not workflows or time. Home = search, Recent, Most used, All SOPs. "Walk" is replaced by Read / Start / Done. Starting fuses the SOP chip and the Start button into the SOPstart wordmark. Sketch 009 explores it.

- **2026-10-03 — Sketch 008: A wins, with a focus rule.** Three panes (list · map · detail) is the whole app. Opening a SOP to walk or edit it removes the list and the map entirely; the SOP, its sections and its steps own the screen, and nothing else from the site shares it. Back/Esc returns to the three panes at the place you came from. B (sheets over the map) and C (step inside) kept in the file, not chosen.

- **2026-10-02 — MVP simplification (Simon).** Phase 42 discussion parked. The app collapses to ONE screen: the isometric site + a detail sidebar + a list sidebar. Office = governance, Smoko room = training, Workshop = write/edit SOPs, Noticeboard = site-wide SOPs, machines carry their SOPs. Data model re-founded on eight types: decisions (append-only ledger), objectives (metadata readable/settable by people and agents), requests, notifications, SOP, steps, standards (labels at SOP/section/step level — the reusable-content library retires), users (+ roles under governance). Single org (Visy). Dropped: offline, voice, phone/QR plates, video generation, flow diagram, image annotation, refresher cadence, CSV export, shared-device login. Kept: walkthrough, completion record, sign-off, photos, four on-ramps (document, AI typed, record video, blank), AI check + verify-before-publish, versions, AI extras, owners/review dates, approval chains (as decisions), floor health, the current access wiring, assignments, training matrix, observations, my record, team/roles, map editor. Pathways map and UAT page get rebuilt after the simplification build. Sketch 008 explores the shell.

- **2026-09-28 — Sketch 006 kept the Miller frame; Simon asked for the frame questioned, not the column.** 007 restarts from floor-product idioms (SwipeGuide / Poka / Tulip: scan the machine, today feed, station terminal) instead of desk-catalogue idioms (Finder / Linear). First use of generated image assets in a sketch (Nano Banana 2, 5 first-shot generations, `007/assets/`). **Decided 2026-09-28: 007 wins, 006 superseded, shared-terminal tab dropped.**

- **2026-09-28 — The 005 scope column outgrew its meaning.** Four groups (Admin / Your SOPs / Library / By department) rendered as one row style read as sub-menus; two same-day bugs (double-lit rows, attention lens replacing the frame) were symptoms. Sketch 006 restarts from the two user questions (worker: which procedure do I need; admin: is the library healthy) and proposes `/sops` as one library (place tree or search-first) + `/governance` as its own page. Decision pending.

- **2026-07-17 — Multi-view, not either/or.** Both surfaces ship as ONE page with an in-page view toggle (pattern validated in the sketches themselves): org model = ⊞ Chart (default) / ▤ Columns; library access = ⌇ Wiring (default) / ▦ Matrix / ◉ Illuminate. All views are lenses over the same underlying model — no view has private state.
- **2026-07-28 — Root-level `sketches/` wrapped (session 3).** The 9 unprocessed explorations in the repo-root `sketches/` directory were curated: the three authoring sketches (`sop-builder-redesign`, `unified-sop-surface`, `admin-sop-new-wizard`) became the skill's new `authoring-flow` reference — the design contract for the next milestone; the six whose decisions already shipped (Phase 25 org/team/block-library, Phase 33 access-hierarchy + builder-header, Phase 34 observations) were marked processed and deliberately excluded, since the shipped code is the source of truth. See `WRAP-UP-SUMMARY.md` § Session 3.
- **2026-07-18 — The wiring view at scale is the D hybrid.** Grouped structure (areas/domains, expand in place) + focus interaction (quiet by default, click draws one unit's wires). The visualization doubles as a LIBRARY FILTER (selection strip deep-links `/admin/sops?departments=…|collection=…`) and as the permission CREATION surface (wire-up mode for a new unwired SOP, live blast-radius count). Contextual banners live in a permanently-reserved fixed-height slot so the graph never moves on selection.
