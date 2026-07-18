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
result: pass (2026-07-18)

### 2. WiringPatchBay at scale on /admin/sops?view=access
expected: With ~15 departments × ~20 collections, area/department groups collapse to single jacks with count badges; NO wires drawn until search/click; focusing a unit lights only its own wires (others dim); no spaghetti or layout breakage.
result: pass (2026-07-18)

### 3. Library deep-link click-through
expected: Focus a department jack with SOPs → "Open in library →" appears in the selection banner → click navigates to /admin/sops?departments=<id> with correctly filtered list and accurate "Open in library (N)" count.
result: pass (2026-07-18)

### 4. Wiring a SOP up actually saves
How: Go to /admin/sops → open a SOP in the builder → click the "Send to workers" chip in the stepper at the top (greyed out until every block passes Check) → send it to workers → a "Wire up access →" button appears on that screen. Click it. (Easier: skip publishing — open /admin/sops?view=access directly and click any SOP in the right column.) Turn on 2-3 departments — the count of people who'd see the SOP should update as you toggle. Click "✓ Done wiring". Then click the same SOP again.
expected: The departments you picked show as already connected (wires light up). If it still says "NEW · UNWIRED" or your picks are gone, the save failed — report it.
result: [pending]

### 5. The page doesn't jump around
How: On /admin/sops?view=access, click a department, then click a SOP and start wiring, then press Esc / deselect. Watch the banner strip at the top of the diagram as it changes between "nothing selected", "something selected", and "wiring mode".
expected: The stuff below the banner never shifts up or down when the banner content changes. If the diagram visibly jumps, that's a fail.
result: [pending]

### 6. Decision: is slightly broader access OK?
Background: Access is now granted per collection (a folder of SOPs), not per individual SOP. One existing SOP — "Changing Plenum Chamber" (IS Machine Forming Section) — sits in a collection that a second department has access to, so the next time anyone edits access for that collection, that department will start seeing this SOP too.
Question: Is that acceptable? Answer "6: yes, broader is fine" (collection-level access is the model, done) or "6: no, keep it narrow" (I'll tighten that one grant so nothing changes for that SOP).
result: [pending]

## Summary

total: 6
passed: 3
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
