---
name: sketch-findings-SOPstart
description: Validated design decisions, tokens, CSS patterns, new block types, and interaction flows from the SOPstart sketch explorations — blueprint redesign, org model + library permissions, and the SOP authoring/creation flow (new-SOP wizard, inline builder canvas, block inserter, AI ghosts, read/walk/edit modes). Auto-loads when building UI for SafeStart / sopstart.com.
---

<context>
## Project: SOPstart (SafeStart)

Multi-tenant SaaS PWA helping NZ blue-collar workers follow SOPs on-site. Existing app is a steel-900 / brand-yellow dark theme with minimal mobile-first worker walkthrough. Phase 12 (shipped 2026-04-24) delivered the admin SOP builder with 7 Puck-based block types (Text, Heading, Photo, Callout, Step, HazardCard, PPECard).

The blueprint redesign is a **worker-first UX overhaul** (not just a visual refresh). It introduces an engineering-drawing aesthetic inspired by blueprint.am — paper/ink palette, grid-paper backgrounds, JetBrains Mono for technical content, Inter for prose — with a unified tabbed interface (Overview / Tools / Hazards / Flow / Model / Walkthrough) that consolidates information currently scattered across separate Phase-12 surfaces.

Sketched across 4 commits on `sketch/sop-blueprint-redesign` branch (Feb 2026):
- `1311d53` initial blueprint interface (inspired by blueprint.am)
- `64f1bec` desktop/mobile preview toggle
- `3a713b3` immersive one-step-at-a-time mobile walkthrough
- `f66840b` voice input for measurements and notes

Wrapped up 2026-04-24.

**Second wrap-up 2026-07-18** — org-model + library-permissions exploration
(`.planning/sketches/001-org-model-canvas`, `002-permission-wiring`, Visy-seeded
content): a business draws departments → roles → people (named or vacancy),
then wires SOP-library access onto the org model across every arity (1:N, N:1,
N:M) with site-wide inheritance and person-level overrides. Both surfaces ship
as ONE page with an in-page segmented view toggle — multiple lenses over one
shared model, no view-private state.

**Third wrap-up 2026-07-28** — SOP authoring & creation flow
(`sketches/sop-builder-redesign`, `unified-sop-surface`, `admin-sop-new-wizard`):
one wizard funnels five on-ramps (upload · template · video · AI · blank) into a
single inline builder where the canvas IS the worker document; Read/Walk/Edit
become three modes of one URL. **This area is NOT shipped** — it is the design
contract for the SOP creation/conversion milestone (see
`references/authoring-flow.md` for the not-shipped caveat).
</context>

<design_direction>
## Overall direction

**Aesthetic:** Engineering drawing. White/paper canvas (`#fafafa`), ink-black text (`#09090b`), JetBrains Mono typography for anything technical (step IDs, measurements, timestamps), Inter for prose descriptions. 20px-grid-paper backgrounds on canvases (flow/model/walkthrough screens). Minimal color — the palette reserves saturated hues for semantic signalling only.

**Semantic color system** — one color per role, never decorative:
- Orange `#f97316` → measurements
- Pink `#ec4899` → decisions / branching
- Red `#ef4444` → hazards / escalation
- Blue `#3b82f6` → procedural steps
- Green `#10b981` → completion / OK state
- Yellow `#fbbf24` → sign-off / brand accent

**Layout approach:** Tabbed unified interface, not separate pages. All tabs render inside a shared header + viewport frame. The mobile preview toggle (430x932 phone frame inside desktop viewport) is a first-class design primitive — it lets any audience (admin, supervisor, worker) validate the mobile experience without switching devices.

**Interaction primitives:**
- Voice capture for measurements and notes (state machine: idle → listening → transcribing → captured → persisted)
- Command palette (cmdk) for jump-to-step, ask-AI, tool/hazard lookup
- Immersive mobile walkthrough — full-screen step cards with sticky nav, no list view on phone
- Evidence grid (dashed buttons for photo/note capture; solid green when captured)

**Why this aesthetic fits safety-critical SOPs:** The engineering-drawing language signals precision and trust. Workers following a SOP need zero ambiguity — the blueprint metaphor communicates "this is the authoritative spec" in a way that a generic consumer app style doesn't. Bright accents only on decision points reduces visual noise so attention lands where action is required.
</design_direction>

<findings_index>
## Design areas

| Area | Reference | Key decision |
|------|-----------|--------------|
| Design tokens | references/design-tokens.md | Paper/ink palette + JetBrains Mono + 20px grid-paper bg; 6 semantic accent colors |
| Layout primitives | references/layout-primitives.md | Pills, tabs, grid-paper bg, card frames, evidence buttons, measurement box, decision buttons |
| Screen inventory | references/screen-inventory.md | 8 tabs: overview, tools, hazards, flow, model, walkthrough (desktop + mobile), cmdk, voice |
| New block types | references/new-block-types.md | 8 new block types beyond Phase 12: Measurement, Decision, Escalate, SignOff, Zone, Inspect, VoiceNote, Model |
| Interaction patterns | references/interaction-patterns.md | Voice state machine, cmdk, preview toggle, mobile immersive walkthrough |
| Org model views | references/org-model-views.md | Node Chart default + Column Builder alt view; roles layer between depts and people; vacancies as dashed first-class chips |
| Permission wiring views | references/permission-wiring-views.md | Patch Bay default + Matrix/Illuminate alt views; direct/inherited/personal access vocabulary; trace-on-click. At scale (15×20): the D hybrid — groups + focus + viz-as-library-filter + wire-up mode with live blast-radius; fixed-height banner slot so the graph never moves |
| Authoring & creation flow ⚠ **not shipped** | references/authoring-flow.md | Five on-ramps → one wizard → one inline builder; canvas IS the worker document (no palette/inspector); 4-tier context-aware inserter + self-expiring AI ghosts; Read/Walk/Edit as three modes of one URL; visible agent-metadata layer |

## Theme

No separate `theme.css` — all tokens inline in `sources/blueprint-sketch.html` `<style>` block at lines 11-82. If the theme is extracted into a standalone file during Phase 12.5 execution, it should live at `src/styles/blueprint-theme.css` and be imported from `src/app/layout.tsx`.

## Source files

Original sketch HTML preserved at `sources/blueprint-sketch.html` (2015 lines, all 4 iterations merged into a single document). 20 screenshot PNGs live at the SafeStart repo root (`sketch-*.png`, `blueprint-*.png`) — not duplicated into the skill.
</findings_index>

<routing>
## When reading this skill, also read

- `references/design-tokens.md` if implementing palette, typography, or globals
- `references/layout-primitives.md` if building reusable components (pills, tabs, cards)
- `references/screen-inventory.md` if implementing a specific tab / screen
- `references/new-block-types.md` **always when adding or extending block types** — includes the AI-accessibility three-place contract that every new block MUST satisfy (Puck config + introspection registry + BlockContentSchema)
- `references/interaction-patterns.md` if building voice input, cmdk, or the mobile immersive walkthrough
- `references/org-model-views.md` if building the org-chart / departments / roles / team surfaces
- `references/permission-wiring-views.md` if building SOP-library access assignment, department↔SOP visibility, or any permissions UI
- `references/authoring-flow.md` if building **anything in the SOP creation / conversion / authoring path** — the new-SOP wizard, upload/parse review, the inline builder canvas, block insertion, AI suggestions in the editor, or the read/walk/edit surface. Read its "NOT SHIPPED" caveat first: it is a design contract, not a description of current code.
- `sources/blueprint-sketch.html` directly only if a reference doc points to a line range and you need the exact HTML/CSS
- `sources/authoring-flow/*.html` for the exact builder/wizard/mode-switch markup and JS (picker tiers, ghost lifecycle, mode state machine)

## When NOT to use this skill

- Phase 12 admin builder work — that's shipped; use the existing code in `src/components/sop/blocks/` and `src/lib/builder/puck-config.tsx` as the source of truth.
- Surfaces whose sketches already shipped — org/departments/team (Phase 25), library access hierarchy + builder wayfinder header (Phase 33), supervisor observations (Phase 34). Those sketches are marked processed below but have no reference file: the shipped code is the source of truth, and a second description would only drift.
- Backend / API work — this skill is UI-only.
- If the user explicitly asks for a different visual direction (e.g. "make it look like Notion"), this skill should be ignored.
</routing>

<metadata>
## Processed sketches

- `sketches/sop-blueprint/index.html` (single-file sketch built iteratively across 4 commits)
- 20 PNG screenshots at repo root
- `001-org-model-canvas` (winner B, Node Chart — wrapped 2026-07-18)
- `002-permission-wiring` (winner A, Patch Bay — wrapped 2026-07-18)
- `003-wiring-at-scale` (winner D, hybrid + wire-up — wrapped 2026-07-18)

### Wrapped 2026-07-28 — included

- `sketches/sop-builder-redesign` → references/authoring-flow.md
- `sketches/unified-sop-surface` → references/authoring-flow.md
- `sketches/admin-sop-new-wizard` → references/authoring-flow.md

### Wrapped 2026-07-28 — processed, deliberately excluded (shipped; code is source of truth)

- `sketches/departments`, `sketches/team-departments`, `sketches/unified-block-library` — Phase 25
- `sketches/access-hierarchy` (winner A, Access map), `sketches/builder-header-orientation` (winner A, Wayfinder bar) — Phase 33; both have READMEs with full trade-off tables and decisions, kept in place as historical record
- `sketches/supervisor-observations` — Phase 34

## Related planning docs

- `.planning/sketches/WRAP-UP-FINDINGS.md` — the raw analysis doc that seeded this skill
- `.planning/sketches/WRAP-UP-SUMMARY.md` — wrap-up summary for project history

## Wrap-up

2026-04-24 (blueprint redesign) · 2026-07-18 (org model + permissions) · 2026-07-28 (authoring & creation flow)
</metadata>
