---
phase: 26-sop-builder-redesign
plan: 10
subsystem: ui
tags: [react, hooks, requestAnimationFrame, builder, ghosts, prediction]

# Dependency graph
requires:
  - phase: 26-08
    provides: "SMART prediction map (inserter-model.ts) + EditableDocument ＋ dividers + content-ops insertBlock"
  - phase: 26-04
    provides: "EditableDocument bespoke edit canvas + useBuilderAutosave content effect"
provides:
  - "useSmartGhosts — pure ghost prediction/visibility state machine (computeGhosts / resolveGhostVisibility / ghostsGoneOnTyping) + rAF/ref React hook"
  - "GhostRow — inline dashed-purple --ai ghost affordance (Tab/click accept)"
  - "Smart ghosts injected into EditableDocument between blocks; accept → content-ops insertBlock → autosave"
affects: [26.5-agent-metadata, sop-builder-redesign]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure state-machine + thin React shell (mirrors inserter-model.ts): all ghost rules in Node-testable functions, hook only wires DOM"
    - "rAF-throttled classList toggles on refs for scroll-driven visual state — zero React render-state on the scroll path (RESEARCH Pattern 4)"

key-files:
  created:
    - src/components/admin/builder-v2/ghosts/useSmartGhosts.ts
    - src/components/admin/builder-v2/ghosts/GhostRow.tsx
    - tests/phase26/ghosts.spec.ts
  modified:
    - src/components/admin/builder-v2/EditableDocument.tsx

key-decisions:
  - "Split the ghost logic into a PURE model (computeGhosts/resolveGhostVisibility/ghostsGoneOnTyping) so the 5-scenario sketch matrix is provable in Node without a DOM — same pattern as 26-08's inserter-model"
  - "Hook holds NO React render-state: gone/hovered/live live in refs, visuals applied via classList toggles inside rAF; the document never re-renders on scroll"
  - "Tab-accept is disabled while an inserter menu is open (opts.disabled) so it never collides with the menu's keyboard nav"
  - "Ghost identity keyed by afterIndex; gone/live state resets when the ghost set changes (insert/delete/reorder)"

patterns-established:
  - "Scroll-reactive UI: read rects → pure resolver → classList toggle on refs; no setState per frame"
  - "Block wrappers tagged data-block-index so document-level input handlers can target the sibling ghost for typing-dismiss"

requirements-completed: [R4]

# Metrics
duration: 18min
completed: 2026-07-03
---

# Phase 26 Plan 10: Smart-Next Ghosts Summary

**Auto-dismissing smart ghosts (R4) — confident, non-redundant next-block predictions from the shared SMART map render as an inline dashed-purple ghost that accepts on Tab/click and self-manages live/dim/gone via rAF ref-toggles, never re-rendering the document on scroll.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-07-03T18:12:00Z
- **Completed:** 2026-07-03T18:30:00Z
- **Tasks:** 2 (TDD: test → feat → feat)
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- `useSmartGhosts` pure state machine encodes all 5 sketch scenarios: appear (a), self-suppress (b), one-live/dim (c), scroll-past-gone (d), typing-dismiss (e).
- React hook wires the model to the live DOM with an rAF-throttled scroll listener, `classList` toggles on refs, a global Tab-accept (inert while the inserter is open), and a document-level typing-dismiss — with zero render-state on the scroll path.
- `GhostRow` inline affordance in `--ai` purple per UI-SPEC (dashed border, `Tab` chip, `✦ add {Block} — {why}`, `or ＋`).
- Injected into `EditableDocument` between blocks; accepting dispatches the SAME `insertBlock(content, type, i, BLOCK_DEFAULTS[type])` path as the inserter → autosave via the existing content effect. No reducer or `layout_data` change.
- `ghosts.spec.ts` proves the full matrix behaviourally against the pure model (9 tests) plus a source-contract guard that the scroll path uses rAF + refs and no React state.

## Task Commits

1. **Task 1 (RED): failing ghost model spec** - `651a6d8` (test)
2. **Task 1 (GREEN): useSmartGhosts model + GhostRow** - `f435c1e` (feat)
3. **Task 2: inject ghosts into EditableDocument + accept matrix** - `c3116ac` (feat)

_TDD: RED (test) → GREEN (feat) → integration (feat)._

## Files Created/Modified
- `src/components/admin/builder-v2/ghosts/useSmartGhosts.ts` - Pure prediction/visibility/dismiss model + rAF/ref React hook.
- `src/components/admin/builder-v2/ghosts/GhostRow.tsx` - Inline dashed-purple `--ai` ghost affordance.
- `src/components/admin/builder-v2/EditableDocument.tsx` - Wires the hook, renders `GhostRow` between blocks, tags wrappers `data-block-index`.
- `tests/phase26/ghosts.spec.ts` - 5-scenario behavioural matrix + accept→insert + injection + no-scroll-re-render guard.

## Decisions Made
- Pure-model / thin-shell split (mirrors 26-08 inserter-model) — the behaviour is Node-testable; the hook is just DOM plumbing.
- No React render-state in the hook — refs + `classList` inside rAF satisfy the RESEARCH Pattern 4 performance rule and the 2026-05-13 hot-path learning.
- Tab-accept gated by `opts.disabled` (inserter open) to avoid keyboard-nav collision with the menu.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
- The no-`useState` source-contract assertion initially tripped on the word "useState" in the hook's own docstring; reworded the comment (behaviour unchanged). Not a code issue.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- R4 complete. Ghosts share the SMART map with the inserter (26-08), so a single source drives both the smart inserter row and the ghosts.
- No route/flow changes → `journeys.ts` unaffected (ghosts are an in-canvas affordance, not a new screen).
- Remaining 26 plans (provenance-sync / AI-overlays / verify-UI / convert-golden regression) unblocked.

---
*Phase: 26-sop-builder-redesign*
*Completed: 2026-07-03*

## Self-Check: PASSED

All created files exist; all task + metadata commits present (651a6d8, f435c1e, c3116ac, 4a68d7c).
