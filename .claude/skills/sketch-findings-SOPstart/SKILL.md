---
name: sketch-findings-SOPstart
description: Validated design decisions, tokens, CSS patterns, new block types, and interaction flows from the SOPstart blueprint-redesign sketch exploration. Auto-loads when building UI for SafeStart / sopstart.com.
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
- `sources/blueprint-sketch.html` directly only if a reference doc points to a line range and you need the exact HTML/CSS

## When NOT to use this skill

- Phase 12 admin builder work — that's shipped; use the existing code in `src/components/sop/blocks/` and `src/lib/builder/puck-config.tsx` as the source of truth.
- Backend / API work — this skill is UI-only.
- If the user explicitly asks for a different visual direction (e.g. "make it look like Notion"), this skill should be ignored.
</routing>

<metadata>
## Processed sketches

- `sketches/sop-blueprint/index.html` (single-file sketch built iteratively across 4 commits)
- 20 PNG screenshots at repo root

## Related planning docs

- `.planning/sketches/WRAP-UP-FINDINGS.md` — the raw analysis doc that seeded this skill
- `.planning/sketches/WRAP-UP-SUMMARY.md` — wrap-up summary for project history

## Wrap-up

2026-04-24
</metadata>
