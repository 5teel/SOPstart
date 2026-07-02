# Phase 26: SOP Builder Redesign - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-02
**Phase:** 26-sop-builder-redesign
**Areas discussed:** Editing engine, Agent-metadata layer scope, Visual/Konva scope, Milestone placement

---

## Editing engine (relative to Puck)

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid (spec recommendation) | Bespoke canvas + inserter + Visual; keep Puck field components behind the structured-field popover | |
| Full bespoke | Replace Puck entirely; rebuild all 16 field editors + overlays + sync. Highest ceiling, high effort/risk | ✓ |
| Keep iterating Puck | Continue 21.6 reconfigure-in-place. Cheapest, low ceiling (already produced "still terrible") | |

**User's choice:** Full bespoke.
**Notes:** Overrides the SPEC's Option-C recommendation. Chosen for the highest interface ceiling + clean end-state; accepts higher effort/risk. Hard line preserved: `layout_data` / junctions / `block_provenance` stay frozen contracts so the parse/review/publish spine is untouched.

---

## Agent-metadata layer scope (R7)

| Option | Description | Selected |
|--------|-------------|----------|
| Split to own phase | Ship builder now; keep only contract hooks; memory/learning/review → Phase 26.5 on X-03 | ✓ |
| Include it all here | Builder + full agent layer in one phase | |
| Contract-only, defer surfacing | Wire read/write + tags/embeddings now, defer memory/learning/review UI | |

**User's choice:** Split to own phase (26.5 / v5.0).
**Notes:** Keeps the builder shippable; agent layer builds on Phase 23 X-03 + graphify.

---

## Visual block / diagram annotation scope (R5)

| Option | Description | Selected |
|--------|-------------|----------|
| Tag & hold now | Visual holds/tags/displays photo·diagram·video; annotation stays Phase 17 | |
| Pull Phase 17 forward | Include full Konva diagram-annotation editor in this phase | ✓ |
| Basic diagram markup only | Light arrow/label markup, stop short of full Konva | |

**User's choice:** Pull Phase 17 forward (full Konva annotation).
**Notes:** Absorb Phase 17's three planned slices (foundation / primitives / bake-on-publish). Hard constraint retained: workers never download Konva (baked PNG for read path). Mark Phase 17 ABSORBED in roadmap.

---

## Milestone placement

| Option | Description | Selected |
|--------|-------------|----------|
| Open a new milestone (v5.0) | Archive v4.0, open v5.0 with Phase 26 as opener → 26.5 agent layer | ✓ |
| Standalone now, milestone later | Build 26 without opening a milestone | |
| v4.0 UX-debt closer | Frame 26 as finishing v4.0 builder-UX debt | |

**User's choice:** Open v5.0.
**Notes:** Complete-milestone v4.0 (21–25 shipped) first, then v5.0 = Phase 26 → 26.5 → conversational/AI-native builds on X-03.

---

## Claude's Discretion

- Wave/slice breakdown of this large phase (planner decides).
- Exact bespoke field-editor UX per block type (inline vs anchored panel), provided no previously-editable field becomes unreachable.
- 3D `ModelBlock` disposition (keep separate vs fold into Visual as `visual:3d`).

## Deferred Ideas

- Phase 26.5 — agent-metadata layer (memory/learning/review + `⚇` surfacing) on X-03 + graphify.
- Remove Puck dependency entirely once all field editors re-implemented + parity-tested.
