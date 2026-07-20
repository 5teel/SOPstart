---
phase: 34-supervisor-observations
plan: 05
subsystem: frontend
tags: [react, client-component, blueprint-ui, observations]

requires:
  - phase: 34-supervisor-observations (34-04)
    provides: "src/actions/observations.ts — recordObservation, getObservationLabels, listWorkerSopsForPicker"
  - phase: 34-supervisor-observations (34-02)
    provides: "Verdict type / RecordObservationSchema (src/lib/validators/observations.ts)"
provides:
  - "src/components/observations/RecordObservationModal.tsx — shared recording modal (both entry points)"
  - "src/components/observations/VerdictButtons.tsx — binary verdict picker"
  - "src/components/observations/ObservationRow.tsx — single-observation list row"
affects: [34-06, 34-07, 34-08]

tech-stack:
  added: []
  patterns:
    - "React 'adjusting state when a prop changes' render-time pattern (useState-tracked prevOpen, setState called conditionally during render, not inside useEffect) — required to satisfy the new react-hooks/set-state-in-effect ESLint rule shipped with this project's eslint-config-next; all async fetch results still land inside a .then() callback in a separate useEffect with zero synchronous top-level setState calls"
    - "Declared-tokens-only CSS: --accent-ok / --accent-decision / --accent-escalate / --ink-900 / --paper / --paper-1, confirmed present in src/styles/blueprint-theme.css before use (CLAUDE.md 2026-07-14 undefined-token learning)"

key-files:
  created:
    - src/components/observations/VerdictButtons.tsx
    - src/components/observations/ObservationRow.tsx
    - src/components/observations/RecordObservationModal.tsx
  modified: []

key-decisions:
  - "Discovered mid-plan that this codebase's ESLint config (eslint-config-next, React Compiler rule set) flags any synchronous setState call at the top level of a useEffect body with react-hooks/set-state-in-effect — even though an existing file (BlockPicker.tsx) has the identical shape and passes clean (confirmed via isolated probes: the compiler's analysis appears to silently bail out on some components and not others, so its absence there isn't a reliable precedent). Fixed by moving all reset-on-open/close state writes into a render-time 'adjusting state when a prop changes' block (tracked via a prevOpen useState, not a ref — refs cannot be read/written during render under this rule either) and keeping the data-fetching useEffect's only setState calls inside its async .then() callback."

requirements-completed: [OBS-01]

duration: ~15min
completed: 2026-07-20
---

# Phase 34 Plan 05: RecordObservationModal + Shared Primitives Summary

**Shipped the shared 30-second observation-recording modal (worker chip -> required-SOPs-first picker -> binary verdict buttons -> optional note -> save) plus the two small presentational primitives (`VerdictButtons`, `ObservationRow`) that both entry points and the read surfaces will reuse, all on declared paper/ink tokens with zero `--brand-yellow` risk.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-20
- **Tasks:** 2 completed
- **Files modified:** 3 (all new)

## Accomplishments

- `VerdictButtons` renders the two canonical verdicts (`performed_to_sop` green `--accent-ok`, `needs_support` amber `--accent-decision` — a coaching flag, never a red/disciplinary tone per D-01) with org-renamable labels from `getObservationLabels()`, a tinted `color-mix` selected state, and the sketch's exact subtitles.
- `ObservationRow` renders one observation as a plain `<div>` list item (verdict dot, SOP title + verdict label, "Observed by {name} · {date} · SOP v{n}" subline, and the note rendered as plain escaped JSX — no `dangerouslySetInnerHTML`, no `<Link>` wrapper since there's nothing to navigate to).
- `RecordObservationModal` is the single shared modal both entry points (person panel, /activity) will mount: locked/pre-filled worker chip, a searchable SOP picker sourced from `listWorkerSopsForPicker(worker.id)` (already assigned/required-first sorted server-side per D-06), `VerdictButtons`, an optional 2000-char note, and an ink-900 primary "Save observation" CTA (matching the 30-07 publish-CTA precedent, never `.btn.yellow`/`--brand-yellow`). The on-face footer states verbatim: "🔒 Permanent record — cannot be edited or deleted after saving. Visible to {worker.name}." (D-06). Save stays disabled until both a SOP and a verdict are chosen, and `completionId` passes through when the caller supplies `presetCompletionId`.

## Task Commits

1. **Task 1: VerdictButtons + ObservationRow primitives** — `f23a484`
2. **Task 2: RecordObservationModal (shared, both entry points)** — `28f342c`

## Files Created/Modified

- `src/components/observations/VerdictButtons.tsx` — binary verdict picker
- `src/components/observations/ObservationRow.tsx` — single-observation row renderer
- `src/components/observations/RecordObservationModal.tsx` — shared recording modal

## Decisions Made

- See `key-decisions` in frontmatter — the ESLint `react-hooks/set-state-in-effect` fix.
- Kept the SOP picker as a plain filtered list (client-side `.filter` on title/code over the already-sorted server payload) rather than importing `SopSearchInput` — that component is coupled to `CachedSop`/offline Dexie data, a different shape than `WorkerSopOption`; a dependency-free filter is the smaller, correct diff (ladder rung 2/6: no existing helper actually fits, one line of filtering covers it).
- `ObservationRow` skips the `getInitials`/avatar-chip idiom from `CompletionSummaryCard` — the plan's own task action for this component only calls for dot + title + subline + note, and no avatar appears in the approved sketch's `.obs-row` markup for this row shape.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] `react-hooks/set-state-in-effect` ESLint error on the modal's reset-on-open effect**
- **Found during:** Task 2, `npx eslint` verification pass (not explicitly listed in the plan's `<verify>` block, but required by CLAUDE.md project conventions / standard build gate).
- **Issue:** The initial implementation reset form state (`sopId`, `verdict`, `note`, `search`, `error`) and set `loadingSops(true)` synchronously at the top of a `useEffect` keyed on `open`. ESLint's `react-hooks/set-state-in-effect` rule (shipped in this project's `eslint-config-next`) flags any synchronous top-level `setState` call inside an effect body as a potential cascading-render risk.
- **Fix:** Moved all reset writes into React's documented "adjusting state when a prop changes" render-time pattern (a `useState`-tracked `prevOpen` compared during render, with `setState` calls made conditionally in the render body rather than inside `useEffect` — a `useRef` was tried first but is also disallowed for reads/writes during render under this rule set). The data-fetching effect now contains zero synchronous `setState` calls — `setLabels`/`setSops`/`setLoadingSops(false)` fire only inside the `Promise.all(...).then()` callback.
- **Files modified:** `src/components/observations/RecordObservationModal.tsx` (single file, part of Task 2's normal work — no separate commit).
- **Commit:** `28f342c` (included in the Task 2 commit; no prior commit existed to amend).

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking lint error, not a scope change)
**Impact on plan:** None on scope or behavior — the modal's field contract, save gating, and permanent-record footer copy are exactly as specified. Only the internal effect structure changed to satisfy the project's lint gate.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None.

## Next Phase Readiness

- `npx tsc --noEmit` clean for `src/components/observations/*`.
- `npx eslint` clean for all three new files.
- `grep -rn -- "--brand-yellow" src/components/observations/` returns zero hits.
- `RecordObservationModal`, `VerdictButtons`, and `ObservationRow` are ready for 34-06 (PersonPanel — entry point A), 34-07 (activity row action — entry point B), and 34-08 (worker profile "Observations about you" section, which will reuse `ObservationRow`).
- No blockers for downstream plans.

---
*Phase: 34-supervisor-observations*
*Completed: 2026-07-20*

## Self-Check: PASSED

- FOUND: src/components/observations/VerdictButtons.tsx
- FOUND: src/components/observations/ObservationRow.tsx
- FOUND: src/components/observations/RecordObservationModal.tsx
- FOUND commit: f23a484
- FOUND commit: 28f342c
