---
status: partial
phase: 30-ux-consolidation
source: [30-VERIFICATION.md]
started: 2026-07-13T00:00:00Z
updated: 2026-07-13T00:00:00Z
---

## Current Test

[awaiting human testing — live sopstart.com after the Railway deploy of waves 1-8]

## Tests

### 1. Role landing
expected: Each role lands on its real home after login — worker → /sops, supervisor and safety manager → /activity, admin → /admin/sops, pending user → /pending. No "Dashboard" item anywhere in the nav; visiting /dashboard directly forwards to your role home.
result: [pending]

### 2. QR deep-links on phone
expected: Scanning an existing printed QR sticker lands on the SOP detail. Old ?tab=walkthrough URLs land on the "Walk it" tab; old ?tab=tools / ?tab=hazards URLs land on the merged "Read" tab. Only 3 tabs visible (Read / Walk it / Flow) — no Model tab.
result: [pending]

### 3. Approve from both surfaces
expected: As the next approver, the "Needs attention" view on /admin/sops shows the awaiting-approval row with a one-click Approve that works; the builder "Send to workers" stage shows the same chain panel and Approve. A legacy /admin/governance?filter=awaiting_approval bookmark redirects to the filtered needs-attention view.
result: [pending]

### 4. Offline pill on device
expected: Going offline in the builder shows the plain-language pill "No internet — your work is saved on this device" (no OFFLINE · QUEUED jargon); work syncs on reconnect.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
