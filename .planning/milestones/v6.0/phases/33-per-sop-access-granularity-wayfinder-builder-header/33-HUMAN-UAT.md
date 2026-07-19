---
status: partial
phase: 33-per-sop-access-granularity-wayfinder-builder-header
source: [33-VERIFICATION.md]
started: 2026-07-19T06:20:00Z
updated: 2026-07-19T06:20:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Teams column shows the full ladder, vacancies are dashed
On sopstart.com, open the SOP Access map (Admin → SOPs → Access) and expand a department all the way down: department → role → person.
expected: The teams column opens one level at a time (site, area, department, role, person). A role with no one assigned shows a dashed, greyed-out chip that does nothing when clicked.
result: [pending]

### 2. Pick who sees one individual SOP
Click a collection in the Access map so it opens to show its SOPs, then click one individual SOP (not the whole collection). Choose one or two named people for that SOP only, and save.
expected: The collection opens to show its SOPs without needing a special link. Clicking a SOP starts "choose who sees this" for that SOP alone. After saving, that SOP shows a "chosen by name" label instead of following the collection.
result: [pending]

### 3. Narrowed SOP disappears for co-workers, reappears when cleared
After granting a SOP to specific named people only, check as a worker who is in the SOP's department but NOT one of the chosen people — the SOP should be gone from their list. Then remove all the named people from that SOP and check it comes back for the whole department.
expected: A department co-worker who isn't named loses access to that one SOP. Once all named people are cleared, the SOP is visible to the department again exactly as before — including for an old SOP that was org-wide before the Access map existed.
result: [pending]

### 4. Builder header reads as a plain wayfinder bar; delete is safe
Open the SOP builder for any SOP and read the header top to bottom, then open the "Tools for this SOP" menu. Try deleting a test SOP of your own.
expected: The header is a plain light bar showing where you came from, what you're editing, and what's next (with a plain-English reason if it's locked). The Tools menu lists all actions (assign, versions, video, QR, flow diagram, delete) with plain labels and no duplicate buttons elsewhere on the page. Delete works for your own org's SOPs.
result: [pending]

### 5. Access panel answers in plain sentences
In the Access map, click on a SOP and read the panel that appears below. Then click on a person or team instead and read what appears.
expected: Selecting a SOP or collection answers "Who can see this?" in plain sentences (e.g. "Only 2 people can see this SOP — Dave and Priya, chosen by name"). Selecting a person or team flips to "What can they see?". No mention of "grants", "wiring", or "UNWIRED" anywhere on screen.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
