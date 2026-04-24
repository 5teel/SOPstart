# Blueprint Redesign — Findings

## 1. Design direction

The sketch applies an engineering-drawing aesthetic inspired by blueprint.am (a SOP platform). The visual language centers on grid-paper backgrounds (white or dark with 20px grids), JetBrains Mono for technical content, and a steel/paper/ink palette. This aesthetic signals precision and trust appropriate for safety-critical SOPs where workers depend on exact guidance. Unlike the current yellow/steel PWA (worker walkthrough), the blueprint redesign is designed for every audience—worker, supervisor, admin—across a single unified interface. The paper-ink palette (white canvas, black text, minimal color) keeps cognitive load low while bright accents (orange for measurement, pink for decision, red for hazards) mark critical decision points.

## 2. Design tokens

Extracted from sketch HTML :root and inlined styles (lines 12-31, 36-49, 50-82).

| Token | Value | Used for |
|-------|-------|----------|
| --brand-yellow | #fbbf24 | Brand accent, yellow buttons, sign-off nodes |
| --steel-900 | #0a0a0b | Darkest UI (chrome, buttons, modals) |
| --paper | #fafafa | Light UI background, card bodies |
| --ink-900 | #09090b | Text, darkest ink |
| --accent-measure | #f97316 | Orange; measurement node |
| --accent-decision | #ec4899 | Pink; decision node |
| --accent-hazard | #ef4444 | Red; hazard/escalate nodes |
| --accent-step | #3b82f6 | Blue; step nodes |
| --accent-ok | #10b981 | Green; completion checkmarks |

Typography: JetBrains Mono (body/mono); Inter (prose).

## 3. Layout primitives

Pills (.pill): 1px border, 2px/8px padding, 10px font, uppercase.

Tab buttons (.tab): inline-flex, 6px/12px padding, 11px font, uppercase, 2px radius.

Card patterns: 1.5px border, semantic colors.

Evidence buttons (.evidence-btn): 1px dashed, 80px min-height. Captured: solid green.

Measurement box (.measurement-box): orange border, target label, 20px mono input, mic button.

Decision buttons (.decision-btn): 1px border, 14px padding, 12px mono. YES (green); NO (red).

## 4. Screen inventory

Overview: Hero SVG, summary table, sign-off chain. Max-w-4xl, white bg.

Tools & PPE: Tabbed table; toggle TABLE/CARDS view.

Hazards: HazardCard grid (2 columns desktop, 1 mobile).

Flow: SVG node-graph 1200x780px. 7 node types.

Model (3D): Left sidebar (layers, sliders, pins). Right canvas (CSS 3D transforms).

Walkthrough: Desktop (centered list). Mobile immersive (full-screen step card).

Command palette (cmdk): 640px modal. JUMP TO STEP, ASK AI, TOOLS & HAZARDS.

Voice input: Idle -> Listening (red pulse) -> Transcribing -> Captured (green, confirm row) -> Persist.

Preview toggle: DESKTOP fills viewport; MOBILE clamped to 430x932px phone frame.

## 5. New block types implied by the sketch

Eight block types NOT in Phase 12:

MeasurementBlock: Orange node. Voice capture, validation.

DecisionBlock: Pink diamond. Binary choice, branching.

EscalateBlock: Red node. Escalation reason, supervisor alert.

SignOffBlock: Yellow node. Role-based sign-off.

ZoneBlock: Amber header. Spatial/procedural context.

InspectBlock: Cyan node. Photo validation.

VoiceNoteBlock: Step body mic button. Transcription.

ModelBlock: NEW 3D viewer. Layer context.

## 6. Interaction patterns

Voice capture (lines 1680-1806): Tap mic -> Listening (red pulse). Speaking -> Transcribing. 2s silence -> Captured (numbers parsed, input populated, green confirm). Persist to evidence[].

Command palette: Scope step IDs, tool names, hazards. Keyboard: arrow select, Enter jump.

Preview toggle: Body[data-view] attribute. DESKTOP -> full. MOBILE -> 430x932px frame.

Mobile immersive walkthrough (lines 1300-1959): Step card replaces list. Header (crumb, progress), body (content), nav (sticky). Tap NEXT/PREV. Tap crumb dropdown -> section jump. Evidence: tap to capture; green when done.

## 7. Anti-patterns (what sketch avoids)

No skeuomorphic device frame in worker interface.

No dark theme for worker-facing tabs. White/paper only.

No inline JS viewport branching. All CSS-based.

No mixed mono/prose in single field.

No modal stepping for measurements.

No "are you sure?" dialogs on decisions.

## 8. Mapping to existing Phase 12

LayoutRenderer + puck-config: Reuse SafeRender(). Extend with 8 new block types. ModelBlock renders in "model" tab only.

SectionContent: If section.layout_data exists, render via Puck.

Dexie: Same schema. Index voice for cmdk. ModelBlock state is session-only.

sop_sections.layout_data: Add flow_graph to SOP level.

## 9. Open questions

(1) Phasing - all tabs at once or waves? Recommend: 12.5 delivers flow + walkthrough. 12.6 adds model/3D.

(2) Voice - on-device (Whisper WASM) or server? On-device: 3-5MB, 2s latency, private. Server: instant, privacy risk.

(3) 3D upload - who, where stored? Impact: File storage.

(4) Decision escalation - alert, lock, or form? Impact: Flow control.

(5) Flow editing - in Puck or separate tool? Impact: Architecture.

(6) Block types - 12.5 or separate? Recommend: MeasurementBlock + VoiceNoteBlock first.

(7) Mobile walkthrough - required or optional? Recommend: Immersive-only.

(8) AI rail - this SOP or multi-SOP? Impact: Indexing.

(9) Offline-first or cloud-first? Impact: Sync, storage.

(10) cmdk search - metadata or prose? Recommend: Metadata only.

## 10. Source references

Full sketch: /c/Development/SOPstart/sketches/sop-blueprint/index.html (2015 lines)
CSS tokens: lines 12-31, 36-49, 50-82
Tab nav: lines 485-510, 1481-1496
Flow graph: lines 988-1200
Mobile step: lines 1300-1959
Voice logic: lines 1680-1806
Preview: lines 84-243, 1499-1506
Command palette: lines 1449-1477
Screenshots: sketch-01-overview.png through sketch-07-cmdk.png; sketch-mobile-*.png; sketch-voice-*.png
Blueprint.am: Inspiration (commit 1311d53)
Phase 12: src/components/sop/blocks/, src/lib/builder/puck-config.tsx, src/types/sop.ts

Key insight: Blueprint redesign is worker-first UX overhaul, not just visual refresh. Tabbed interface consolidates Phase 12 information. Voice input, immersive mobile step view, and procedural flow visualization make SOPs more accessible and executable on factory floors. New block types (Measurement, Decision, Escalate) explicitly model decision points and escalations, enabling SOPs to enforce safety workflows, not just document them.
