# Sketch Wrap-Up Summary

**Date:** 2026-04-24
**Sketches processed:** 1 (single-file prototype; 4 commits of iteration)
**Design areas:** 5 (design tokens, layout primitives, screen inventory, new block types, interaction patterns)
**Skill output:** `./.claude/skills/sketch-findings-SOPstart/`

## Included sketches

| Path | Winner | Design area |
|---|---|---|
| `sketches/sop-blueprint/index.html` (2015 lines; built via 4 commits) | Whole sketch | All areas |
| 20 screenshot PNGs at repo root (`sketch-*.png`, `blueprint-*.png`) | Reference material | All areas |

The sketch was **not** produced via `/gsd-sketch` so the standard `.planning/sketches/NNN-name/README.md` structure does not apply. Wrap-up adapted to a single-file sketch with iteration visible in git history:

- `1311d53` initial blueprint interface (inspired by blueprint.am)
- `64f1bec` desktop/mobile preview toggle
- `3a713b3` immersive one-step-at-a-time mobile walkthrough
- `f66840b` voice input for measurements and notes

## Excluded sketches

None — this was a single comprehensive sketch; no alternate variants to exclude.

## Design direction

Engineering-drawing aesthetic inspired by blueprint.am. Paper/ink palette (`#fafafa` bg, `#09090b` text) replaces the current steel-900/brand-yellow dark theme for worker-facing surfaces. JetBrains Mono for technical content, Inter for prose. 20px grid-paper backgrounds on canvas screens (flow, model, some walkthrough states). Six semantic accent colors — each mapped to exactly one role: measurements (orange), decisions (pink), hazards (red), steps (blue), completion (green), sign-off (yellow).

The redesign is **worker-first** — it is not a visual refresh of the admin builder (which stays dark-theme via Phase 12's existing styling). It consolidates information across 6 tabs (overview / tools / hazards / flow / model / walkthrough) plus global cmdk and voice-input overlays into a unified interface that a worker, supervisor, or admin can all use on the same URL.

## Key decisions

### Palette + typography
- Canonical tokens in `.claude/skills/sketch-findings-SOPstart/references/design-tokens.md`
- Worker-facing surfaces use paper/ink palette
- Admin builder keeps existing steel-900/brand-yellow
- `steel-*` tokens remain in `tailwind.config` — redesign is additive

### Layout
- Unified tab nav at the top of every tab
- `max-w-4xl` content width for prose tabs (overview, walkthrough-desktop)
- Full-viewport canvas for flow and model tabs (grid-paper background)
- Full-screen immersive step card on mobile walkthrough (breakthrough UX change)

### Block types — 8 new ones identified
Enumerated in `.claude/skills/sketch-findings-SOPstart/references/new-block-types.md`:

1. **MeasurementBlock** — orange, voice-enabled numeric capture
2. **DecisionBlock** — pink YES/NO with branching
3. **EscalateBlock** — red, triggers supervisor alert
4. **SignOffBlock** — yellow, role-based sign-off
5. **ZoneBlock** — amber, spatial grouping
6. **InspectBlock** — cyan, inspection checklist + photo
7. **VoiceNoteBlock** — mic-triggered transcript capture
8. **ModelBlock** — 3D viewer (candidate to defer to later phase behind feature flag)

Each MUST satisfy the three-place contract from `src/lib/builder/puck-config.tsx:399-418`:
- Registered in `puckConfig.components`
- Registered in `src/actions/introspection.ts:BLOCK_REGISTRY` (exposes to `/api/schema`)
- Added to `BlockContentSchema` discriminated union if stored as reusable library block

Once Phase 12.5 ships, `/api/schema` will surface 15 block types instead of 7.

### Interaction patterns
- Voice capture state machine (idle → listening → transcribing → captured → persisted) — same for measurements and notes
- Command palette (cmdk) triggered via `Cmd/Ctrl+K` or top-chrome icon
- Mobile walkthrough is immersive-only (no list fallback on phones)
- Preview toggle (desktop ↔ 430×932 mobile frame) extended from Phase 12 admin builder to all worker-facing tabs

### Data model additions implied
- `sops.model_url` or new `sop_assets` table for .glb files
- `sops.flow_graph` JSONB or derivation from sections/steps (open question)
- `sop_voice_notes` table or `sop_completions.notes` JSONB extension
- `StepDataSchema` extended from `z.record(z.string(), z.number())` to preserve units on measurements

### Anti-patterns (what the sketch actively rules out)
- No skeuomorphic device frame around worker walkthrough
- No dark theme on worker-facing tabs
- No JS viewport branching inside block components
- No mixed mono/prose fonts in a single field
- No modal stepping for measurements (measurements are inline)
- No "are you sure?" confirmation on decisions (the decision itself is the confirmation)

## Skill contents

```
.claude/skills/sketch-findings-SOPstart/
├── SKILL.md                              # Auto-load routing + design direction
├── references/
│   ├── design-tokens.md                  # Palette, typography, grid-paper, Tailwind config
│   ├── layout-primitives.md              # Pills, tabs, cards, evidence btn, measurement box
│   ├── screen-inventory.md               # All 8 screens + common chrome + desktop/mobile
│   ├── new-block-types.md                # 8 blocks + AI three-place contract + flow graph
│   └── interaction-patterns.md           # Voice state machine, cmdk, mobile immersive, preview toggle
└── sources/
    └── blueprint-sketch.html             # Verbatim copy of sketches/sop-blueprint/index.html
```

## CLAUDE.md

Auto-load routing line added to the project `CLAUDE.md` so the skill is loaded automatically when future Claude Code sessions build UI.

## Next step

Run `/gsd-spec-phase 12.5` with the SOPstart sketch-findings skill in context. The spec interview will resolve the 10 open questions captured in `references/new-block-types.md` and `references/interaction-patterns.md` (phasing, voice on-device vs server, 3D upload flow, ModelBlock deferral, etc.), then produce `12.5-SPEC.md` locking what ships in this phase.

---

# Sketch Wrap-Up Summary — Session 2

**Date:** 2026-07-18
**Sketches processed:** 2 (001-org-model-canvas, 002-permission-wiring)
**Design areas:** 2 (org model views, permission wiring views)
**Skill output:** `./.claude/skills/sketch-findings-SOPstart/` (appended)

## Included Sketches

| # | Name | Winner | Design Area |
|---|------|--------|-------------|
| 001 | org-model-canvas | B: Node Chart (default) + A: Column Builder as alt view | org-model-views |
| 002 | permission-wiring | A: Patch Bay (default) + B: Matrix + C: Illuminate as alt views | permission-wiring-views |

## Excluded Sketches

| # | Name | Reason |
|---|------|--------|
| 001-C | Outline Tree variant | Reads as a roster table, not a visual model — interaction ideas retained as potential keyboard shortcuts only |

## Design Direction

Extends the paper/ink blueprint system to the org-model + library-permissions
surfaces. Core decision: **multi-view over one shared model** — each surface is
one page with an in-page segmented view toggle (org: ⊞ Chart / ▤ Columns;
permissions: ⌇ Wiring / ▦ Matrix / ◉ Illuminate), and no view has private state.

## Key Decisions

- Roles become an entity between departments and people; vacancies (unnamed
  role-holders) are first-class dashed chips with capacity counts (3/4)
- Access vocabulary shared across all permission views: direct (solid green),
  inherited (dashed green + "VIA <source>"), personal grant (dashed wire),
  no-access (muted, never red)
- Collections (not individual SOPs) are the wiring unit
- Trace-on-click is the at-a-glance move: select anything, related lights up,
  the rest dims
- Open: inherited-revoke ("exclude") affordance; wire behaviour at Visy scale
  (~15 depts × ~20 collections) needs a stress sketch before build

### Session 2 addendum (2026-07-18)

Sketch 003-wiring-at-scale (winner D) folded into the skill's
permission-wiring-views reference: the shipping wiring view is the D hybrid —
grouped structure + focus interaction + viz-as-library-filter
(`/admin/sops?departments=|collection=` deep-links) + wire-up mode for new
SOPs with a live people blast-radius count. Strategy C (always-on bus routing)
rejected. New cross-cutting rule captured: contextual banners live in
permanently-reserved fixed-height slots so canvases never move on selection.

---

# Sketch Wrap-Up Summary — Session 3

**Date:** 2026-07-28
**Sketches processed:** 9 (3 included, 6 excluded)
**Design areas:** 1 new (authoring & creation flow)
**Skill output:** `./.claude/skills/sketch-findings-SOPstart/` (appended)

All three `.planning/sketches/` numbered sketches (001–003) were already wrapped
in session 2. This session covered the **root-level `sketches/` directory**, which
had accumulated 9 unprocessed explorations — the previous wrap-ups had only ever
processed `sketches/sop-blueprint/` from that location.

## Included Sketches

| Sketch | Variants | Design Area |
|---|---|---|
| `sketches/sop-builder-redesign` (885 lines) | 3 on-ramp flows, one shared builder | authoring-flow |
| `sketches/unified-sop-surface` (376 lines) | Read / Walk / Edit modes, one URL | authoring-flow |
| `sketches/admin-sop-new-wizard` (450 lines) | 4-step wizard, 5 on-ramps | authoring-flow |

None carried a README — decisions were read from the markup, inline copy, and JS
state machines. All three date from 2026-07-14 and are **untracked in git**.

## Excluded Sketches

Excluded because the design decision **already shipped** — the code is the source
of truth and a second description in the skill would only drift. Marked processed
so they never resurface in a future wrap-up.

| Sketch | Shipped in | Note |
|---|---|---|
| `sketches/departments` | Phase 25 | single-concept mockup, no variants |
| `sketches/team-departments` | Phase 25 | single-concept mockup |
| `sketches/unified-block-library` | Phase 25 | m2m dept↔block library |
| `sketches/access-hierarchy` | Phase 33 | winner A "Access map"; README has full A/B/C trade-off table + data-model implications — kept in place as historical record |
| `sketches/builder-header-orientation` | Phase 33 | winner A "Wayfinder bar"; README has full A/B/C trade-off table — kept in place |
| `sketches/supervisor-observations` | Phase 34 | single-concept mockup |

## Design Direction

Extends the paper/ink blueprint system into the **authoring** path — the one part
of the product a safety manager uses most and the one the sketches judged most
fragmented. The through-line across all three: **collapse surfaces rather than add
them.** Five on-ramps become one wizard; four creation screens become one funnel;
three URLs (read / walkthrough / builder) become three modes of one page; the
block palette, outline panel, and field inspector collapse into the document
itself.

Introduces one new token — `--ai: #8b5cf6` (violet) — marking AI-generated and
AI-suggested content wherever it appears.

## Key Decisions

- **Every on-ramp lands in the identical builder.** No per-method editor, no import-review screen distinct from the authoring screen.
- **The canvas IS the worker document.** No block palette, no outline, no field rail — `contenteditable` on the same cards a worker reads, tools on hover only. The mobile preview proves the worker's view rather than authoring separately.
- **Four-tier context-aware inserter**: smart-next prediction (`Tab`) → "fits here" per section → full catalog → department-scoped reuse library + multi-block snippets.
- **Self-expiring AI ghosts.** Suppressed when the prediction already follows; only the viewport-nearest ghost is live; scrolled-past ghosts never return; `Tab` accepts and never opens a menu. The restraint rules *are* the design.
- **Read / Walk / Edit are three modes of one URL**, sharing one DOM pane for read+edit so "you edit what the worker reads" is structurally true. Role gating **hides** the Edit control rather than disabling it.
- **The agent-metadata layer is visible and toggleable** — SOP-level (summary, entities, hazard rollup, cross-SOP links, memory, agent proposals) plus a per-block machine-readable twin. Bet: inspectability makes AI behaviour auditable to the safety manager.
- **Conversion provenance is per-block** (`✦ from source · page 1 ¶2`) and cleared block-by-block; no bulk verify.
- **Placement (department / trade / site) is an authoring-time input**, feeding the Phase 32/33 access model, with site framed as an overlay on the org template.

## Relationship to the Roadmap

Wrapped the same day Phases 38/39 were deferred to backlog and v7.0 closed at
Phase 37 — precisely because the SOP creation/conversion pipeline is still
pre-alpha. This reference file is therefore the **design input for the next
milestone**, and `references/authoring-flow.md` carries an explicit NOT-SHIPPED
caveat plus a carried list of open questions (wizard default selection conflict,
wizard length, agent-layer scope, section colour derivation, approval-chain
placement, `--ai` accessibility pass) to resolve at spec time.
