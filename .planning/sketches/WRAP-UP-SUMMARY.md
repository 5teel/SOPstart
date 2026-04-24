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
