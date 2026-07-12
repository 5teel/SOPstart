---
status: testing
phase: 29-approval-chains
source: [29-01-SUMMARY.md, 29-02-SUMMARY.md, 29-03-SUMMARY.md, 29-04-SUMMARY.md, 29-05-SUMMARY.md, 29-06-SUMMARY.md]
started: 2026-07-12T12:10:00Z
updated: 2026-07-12T12:10:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: Deploy Cold Start Smoke Test
expected: |
  sopstart.com loads normally after the Railway deploy of the Phase 29 push (27 commits incl. migration 00045, already applied to prod DB). Log in as admin, open /admin/governance — page renders the queue plus a new "Approval chains" config panel below it. No errors.
awaiting: user response

## Tests

### 1. Deploy Cold Start Smoke Test
expected: sopstart.com loads after the Railway deploy; /admin/governance renders the governance queue plus a new approval-chains config panel below it, with no errors.
result: [pending]

### 2. Define an Approval Chain
expected: In the approval-chains panel on /admin/governance, pick a SOP category from the dropdown. Add 1-4 approval steps; each step can be a role (Admin / Safety Manager only) or a named member (list only shows admins/safety managers). Drag to reorder steps. Save shows no error, and re-selecting the category reloads the saved chain.
result: [pending]

### 3. Publish Diverts to Pending Approval (chained category)
expected: In the builder, publish an SOP whose category has a chain. Instead of going live, the SOP enters "pending approval" — the Publish stage refreshes and shows the approval chain panel: ordered step list with approved/current/waiting chips and who's next. The SOP is NOT published yet.
result: [pending]

### 4. No-Chain Category Publishes Exactly As Before
expected: Publish an SOP in a category WITHOUT a chain. It publishes immediately, exactly like before Phase 29 — no approval panel, no pending state, workers can see it.
result: [pending]

### 5. Approve Steps → Final Approval Auto-Publishes
expected: As the next approver, the builder Publish stage shows a one-click Approve button. Approving a mid-chain step advances "who's next" to the following step. Approving the FINAL step publishes the SOP automatically (status flips to published). A non-matching admin sees the chain but no Approve controls.
result: [pending]

### 6. Request Changes Requires a Comment
expected: On a pending-approval SOP, the Request-changes button is disabled until a comment is typed. Submitting it returns the SOP out of pending-approval (back to draft/unpublished); the chain panel no longer shows it as pending.
result: [pending]

### 7. Governance Queue Awaiting-Approval Flag + One-Click Approve
expected: /admin/governance queue shows an "Awaiting approval" flag on pending SOPs, an awaiting-approval filter chip with a count, and the dashboard governance widget shows an awaiting-approval count that deep-links to the filtered queue. If you are the next approver, the queue row shows a top-priority Approve button that works in one click.
result: [pending]

### 8. Version History Shows Read-Only Approval Log
expected: /admin/sops/[sopId]/versions shows, under each version, a read-only approval history: approver name, action (approved / changes requested), step label, NZ-format date, and any comment. No approve/action buttons in the history itself.
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0

## Gaps

[none yet]
