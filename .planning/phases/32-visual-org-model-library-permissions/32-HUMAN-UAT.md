---
status: partial
phase: 32-visual-org-model-library-permissions
source: [32-VERIFICATION.md]
started: 2026-07-18T09:00:00Z
updated: 2026-07-18T09:00:00Z
---

## Current Test

[awaiting human testing — all tests run on sopstart.com after Railway deploy]

## Tests

### 1. Node Chart renders on /admin/team
expected: Chart (areas → departments → roles → people) renders by default with bezier connectors; vacancy chips dashed, not error-styled; role capacity shows filled/budgeted; ⊞/▤ toggle swaps to Columns board (one column per department, role cards, person/vacancy chips) without a page reload; AdminNav still exactly 5 tabs.
result: [pending]

### 2. WiringPatchBay at scale on /admin/sops?view=access
expected: With ~15 departments × ~20 collections, area/department groups collapse to single jacks with count badges; NO wires drawn until search/click; focusing a unit lights only its own wires (others dim); no spaghetti or layout breakage.
result: [pending]

### 3. Library deep-link click-through
expected: Focus a department jack with SOPs → "Open in library →" appears in the selection banner → click navigates to /admin/sops?departments=<id> with correctly filtered list and accurate "Open in library (N)" count.
result: [pending]

### 4. Wire-up mode end-to-end (CR-01 fix exercised in real UI)
expected: Publish a SOP → "Wire up access" CTA lands on /admin/sops?view=access&sop=<id> pinned NEW·UNWIRED → connect mode: toggle 2-3 org units, SelectionStrip people count updates live per toggle → ✓ Done writes REAL access_grants rows (re-open wiring: grants show as existing, not NEW·UNWIRED).
result: [pending]

### 5. SelectionStrip pixel stability
expected: idle → selection → wiring transitions keep the strip's bounding-box top pixel-identical; page content below never jumps.
result: [pending]

### 6. Product decision: WR-02 materialization divergence
expected: Review `npx tsx scripts/assert-phase32-day-one-equivalence.ts --diff-materialization` (1 of 15 SOPs — "Changing Plenum Chamber — IS Machine Forming Section" gains dept 4587a6ed on next re-materialization). Decide: accept collection-granularity access, or narrow the seeded Step-C grant first. Record the decision.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
