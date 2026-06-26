---
status: partial
phase: 23-ai-field-layer-version-supersede
source: [23-VERIFICATION.md]
started: 2026-06-26
updated: 2026-06-26
---

## Current Test

[awaiting human testing]

## Tests

### 1. Version supersede flows (AFL-VER-01/02/03)
expected: On a published SOP → Versions page → "Edit into new version" lands you in the builder on a NEW draft copying the published content; publishing it marks the prior version "Superseded". "Compare" opens the side-by-side diff at `/admin/sops/[sopId]/versions/diff?a=…&b=…` with changed blocks highlighted amber. "Restore" on an older version creates a NEW draft (old version NOT reactivated — history append-only). Existing "Upload New Version" still works.
result: [pending]

### 2. Roster login (shared device) + sign-off chain + RLS isolation (AFL-VER-05 / D-11)
expected: One-time shared-device account setup (create `roster+<org>@safestart.internal` auth user, add as `organisation_members` worker). `/login/roster?org=<code>` is a standard browser login page showing the org worker roster as large tappable buttons, no password. Picking a name → complete an SOP → `sop_completions` row has `worker_id` = shared-device uid and `roster_worker_id` = selected worker. One `worker` row in `sop_completion_signatures`. Supervisor approves at `/activity/<id>` → second `supervisor` row appears with the supervisor's own roster_user_id. The shared device sees only this org's SOPs. Admin signing into `/login/roster` is redirected to `/dashboard`.
result: [pending]

### 3. Phase smoke — pathways + UAT + AI-field backbone (X-03 / D-04)
expected: `/pathways` shows the roster-login and "Publish a new version" journeys and 0 not-mapped for `/login/roster` and `/admin/sops/[sopId]/versions/diff`. `/uat` renders 3 Phase-23 entries (roster login, inline AI proposal accept/reject, updated-since badge). `GET /api/ai-fields/read?fieldId=sop.title&sopId=<id>` returns the current SOP title (org-scoped). NO user-facing AI command surface exists (Cmd+K stays removed — backbone only).
result: [pending]

### 4. "Updated since last completion" badge timing (AFL-VER-04 / D-08)
expected: As a worker, complete an SOP. As admin, publish a new version of it. Re-open the worker library `/sops` → the "Updated" badge appears on that SOP's card. (Note: by design the badge does NOT show for SOPs the worker has never completed — IN-04, informational.)
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
