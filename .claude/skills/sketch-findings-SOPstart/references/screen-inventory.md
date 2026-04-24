# Screen inventory

8 distinct surfaces in the blueprint sketch. Each is a tab inside the unified interface, except cmdk (modal) and voice input (state overlay). Desktop and mobile variants noted per screen.

## Common top chrome

All tabs share a single header:

```
┌──────────────────────────────────────────────────────────────┐
│  SOPSTART · PROJECT · 3.3 OPERATE                            │
│  [OVERVIEW] [TOOLS] [HAZARDS] [FLOW] [MODEL] [WALKTHROUGH]  │
├──────────────────────────────────────────────────────────────┤
```

- Left: breadcrumb — product name, SOP/project title, current section+step (mono, small, uppercase)
- Right: tab nav (see `references/layout-primitives.md` → Tab buttons)
- Hairline bottom border: `1px solid var(--ink-300)`

Source: `sources/blueprint-sketch.html:449-510`.

## 1. Overview tab (`data-tab="overview"`)

**Purpose:** Landing view — hero diagram + summary table + sign-off chain.

**Layout** (desktop):
- `max-w-4xl mx-auto p-8`
- Hero SVG at top (diagram of machinery with labels)
- Metadata card: SOP ID, revision, last-updated, author, category (2-column grid)
- Sign-off chain card: who signed off when, role-based icons

**Mobile:** Same content, single column, `p-6`. Hero SVG scales to fit.

**Data deps:** `sops` row + `completion_sign_offs` history.

**Interactions:** Read-only. Tap sign-off icon → modal with sign-off detail.

Source: lines 587-660. Screenshots: `sketch-01-overview.png`, `sketch-desktop-overview.png`, `sketch-mobile-overview.png`.

## 2. Tools & PPE tab (`data-tab="tools"`)

**Purpose:** Show all tools and PPE required for the SOP. Toggleable between table and cards view.

**Layout** (desktop):
- View-mode toggle pills: `[TABLE] [CARDS]` at top-right
- **Table view:** 3 columns — name, category, required-for-steps. Mono throughout. Hairline borders.
- **Cards view:** Grid of small tool cards with icon + name + step-count badge.

**Mobile:** Forces cards view (table doesn't fit). Single column. Source lines 792-854 have the mobile-only card markup.

**Data deps:** `sop.applicable_equipment[]` + optional link to `tool_registry` (not in current schema — probably deferred to a later phase or inferred from blocks).

**Interactions:** Tap a tool row/card → modal with description, safety notes, and the step(s) that use it.

Source: lines 662-854. Screenshots: `sketch-02-tools.png`, `sketch-mobile-tools.png`.

## 3. Hazards tab (`data-tab="hazards"`)

**Purpose:** All hazards in the SOP as cards.

**Layout** (desktop): 2-column grid. Each card = one hazard:
- Red border (accent-hazard) + tinted background
- Title + severity pill (CRITICAL / WARNING / NOTICE)
- Body (prose, Inter font)
- Affected-steps pill list at bottom

**Mobile:** Single column. Identical card structure.

**Data deps:** All `HazardCardBlock` instances across all sections, hoisted into one consolidated view.

**Interactions:** Tap "affected steps" pill → jump to that step in walkthrough.

Source: lines 855-966. Screenshots: `sketch-03-hazards.png`.

## 4. Flow tab (`data-tab="flow"`)

**Purpose:** SVG node-graph of the entire SOP as a process flow. This is the most visually distinctive tab — it's the blueprint-engineering-drawing payoff.

**Layout:** Full-height, `bg-grid` canvas. 1200x780 SVG at desktop. Pan + zoom (not implemented in sketch but implied).

**Node types** (positioned on 20px grid):

| Shape | Color | Represents |
|-------|-------|------------|
| Rectangle | `--accent-step` (blue) | Procedural step (StepBlock) |
| Rounded rectangle | `--accent-measure` (orange) | Measurement capture (new MeasurementBlock) |
| Diamond | `--accent-decision` (pink) | Binary decision (new DecisionBlock) |
| Rectangle with red outline | `--accent-hazard` (red) | Hazard acknowledgement / escalate (new EscalateBlock) |
| Rectangle with yellow fill | `--accent-signoff` (yellow) | Sign-off (new SignOffBlock) |
| Rectangle with cyan border | `--accent-mcu` (cyan) | Inspect (new InspectBlock) |
| Zone header (amber band) | `--brand-yellow` | Spatial grouping (new ZoneBlock) |

**Edges:** Arrows drawn via SVG `<marker>` definitions (lines 988-994). Red arrow variant (`#arrow-red`) used for escalation paths. Default arrows are black.

**Legend:** Small inline legend at top-right of canvas mapping color → node type.

**Mobile:** Zoom to fit. Pinch-zoom + pan. Tap a node → jump to that step in walkthrough.

**Data deps:** New `flow_graph` field on `sops` row (or derived from `sop_sections` + `sop_steps` topology). See `references/new-block-types.md` section 8 (Mapping to Phase 12) for the data shape.

Source: lines 966-1200. Screenshots: `sketch-04-flow.png`, `sketch-mobile-flow.png`.

## 5. Model tab (`data-tab="model"`)

**Purpose:** 3D viewer of the machinery involved in the SOP. Visual context for workers who learn better from models than text.

**Layout** (desktop):
- Left sidebar (280px wide): layer controls, transparency sliders, hotspot pins (list of labeled pins that can be toggled on/off).
- Right canvas: the 3D view. Sketch uses CSS 3D transforms to mock this; production would likely use `three.js` / `@react-three/fiber` loading a `.glb` or `.usdz` file.

**Mobile:** Sidebar collapses into a bottom sheet. Canvas takes full width/height.

**Data deps:** 3D asset URL on either `sops.model_url` (new field) or a new `sop_assets` table.

**Interactions:**
- Rotate / pan / zoom the model
- Tap a hotspot pin → opens a side drawer with pin metadata (step reference, notes, photo)
- Toggle layers (e.g. "show wiring", "show mechanical") via sidebar checkboxes

**Open questions** (for spec-phase):
- Who uploads the .glb and when?
- On-device rendering vs. streamed?
- Does this ship in Phase 12.5 or a later phase?

Source: lines 1203-1298. Screenshots: `sketch-05-model.png`.

## 6. Walkthrough tab (`data-tab="walkthrough"`)

**Purpose:** The execution view — where workers actually follow the SOP. Has two distinct modes:

### Desktop walkthrough

List-style, centered, `max-w-4xl`. Shows the full SOP linearly with one section per card:
- Section header card (tools + hazards collapsed)
- Step cards (one per `sop_steps` row), each with:
  - Step number pill
  - Step text (prose)
  - Embedded block previews (measurement box, decision buttons, evidence grid)
- Sign-off card at the bottom

Progress bar across the top. Clicking a section in the flow tab jumps here with that section scrolled into view.

Source: lines 1300-1446. Screenshots: `sketch-06-walkthrough.png`, `sketch-desktop-walkthrough-check.png`, `sketch-desktop-walkthrough-synced.png`.

### Mobile immersive walkthrough

**This is the most important pattern in the redesign.** Full-screen step card per step — no list view. One step visible at a time; PREV/NEXT via sticky footer.

- Top: steel-900 dark strip with breadcrumb (`section / step n`) + `n/total` progress
- Body: `.bg-grid` canvas, scrollable, contains the step's content blocks
- Footer: sticky, PREV (outline) + NEXT (solid dark)
- When the step is a gate (HazardCardBlock with ack_required, SignOffBlock, EscalateBlock), a yellow acknowledgement bar appears above the footer

Evidence capture (photo, voice, measurement) happens inline inside the body — see `references/layout-primitives.md` → Evidence button.

Source: lines 1300-1959. Screenshots: `sketch-mobile-walkthrough.png`, `sketch-mobile-step1.png`, `sketch-mobile-step21-measurement.png`, `sketch-mobile-step32-measurement.png`, `sketch-mobile-step33-decision.png`, `sketch-mobile-voice-measurement.png`.

## 7. Command palette (cmdk, modal overlay — not a tab)

**Purpose:** Keyboard-driven jump-to-step / ask-AI / tool-hazard lookup.

**Trigger:** `Cmd/Ctrl + K` (global hotkey) or a dedicated button in the top chrome.

**Layout:** 640px modal, centered, 24px top offset. Paper-themed (white bg, `border-ink-300`).

**Result groups:**
1. `JUMP TO STEP` — lists all `sop_steps.step_number` + titles, fuzzy-matched
2. `ASK AI` — free-form question → routes to AI rail (open question for spec-phase: scoped to this SOP only, or cross-SOP?)
3. `TOOLS & HAZARDS` — fuzzy-match on tool names + hazard codes

**Mobile:** Full-screen takeover instead of 640px modal. Same result structure.

Source: lines 1449-1477. Screenshots: `sketch-07-cmdk.png`.

## 8. Voice input (overlay on measurement + note blocks — not a tab)

**Purpose:** Hands-free capture of measurements and inline notes.

**States:**

| State | Visual | Trigger |
|-------|--------|---------|
| Idle | Mic icon, `--accent-measure` outlined circle | Default |
| Listening | Red pulse ring around mic | User tapped mic |
| Transcribing | Spinner overlay on mic, live text below | Silence detected (≈2s pause) |
| Captured | Green checkmark + parsed value | Transcription complete, value valid |
| Note state (standalone) | Note card with transcript text + confirm/cancel | Non-measurement voice note |

**Flow** (measurement):
1. Idle. User taps mic.
2. Listening. Red pulse. User speaks ("seventy-two point five").
3. Silence detected → Transcribing. Show "72.5" as draft.
4. Validate against measurement block's tolerance. If valid → Captured (green). Auto-populate the input field.
5. User can tap the input to edit manually if the transcription was wrong.

Source: lines 1680-1806. Screenshots: `sketch-voice-idle.png`, `sketch-voice-listening.png`, `sketch-voice-transcribing.png`, `sketch-voice-captured.png`, `sketch-voice-note.png`.

See `references/interaction-patterns.md` → Voice capture state machine for full implementation notes.

## Preview toggle (meta-primitive)

Not a tab — this is a rendering wrapper that appears on every tab. Lets you flip between desktop (full-width) and mobile (430x932 phone-frame simulation) in the same admin/supervisor session.

Phase 12 already ships a version of this for the admin builder (`BUILDER_VIEWPORTS` using Puck's native `viewports` prop — see `src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx`). The redesign extends the pattern to worker-facing views: supervisors should be able to preview the walkthrough as it will appear on a worker's phone without changing devices.

Source (sketch implementation): lines 84-243, 1499-1506. Phase 12 implementation (React port to Puck): `src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx`.

## Desktop vs mobile summary

| Tab | Desktop | Mobile |
|-----|---------|--------|
| Overview | Hero + 2-col metadata | Single column |
| Tools | Table OR cards (toggle) | Cards only |
| Hazards | 2-col card grid | 1-col cards |
| Flow | 1200x780 SVG, pan+zoom | Pinch-zoom, tap-to-jump |
| Model | Sidebar + canvas | Bottom sheet + full canvas |
| Walkthrough | Centered list | **Full-screen immersive** step card |
| cmdk | 640px modal | Full-screen takeover |
| Voice | Inline in measurement block | Same; tap target sized for thumb |

## Origin

Synthesized from `sources/blueprint-sketch.html:584-1959` (all tab content blocks), tab nav at 485-510, and mobile-specific CSS at 1960-2015. Cross-referenced against every `sketch-*.png` screenshot.
