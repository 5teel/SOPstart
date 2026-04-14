---
status: partial
phase: 10-video-version-management
source: [10-VERIFICATION.md]
started: 2026-04-13T00:00:00Z
updated: 2026-04-13T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Migration 00018 pushed to live database
expected: `video_generation_jobs` table in the live Supabase DB has `version_number`, `label`, and `archived` columns, and the partial unique index `video_generation_jobs_one_published_per_sop` exists. Easiest check: run `npx supabase db pull` or query `information_schema.columns` in the dashboard.
result: [pending]

### 2. End-to-end admin version management walkthrough
expected: As an admin on a published SOP video page, can (a) generate a new version, (b) see it appear in the descending list with the next version number, (c) edit its label inline, (d) publish it and see the previously published version unpublish, (e) archive an unpublished version, (f) restore it from the archived section, (g) permanently delete an archived version with file removal from storage.
result: [pending]

### 3. Worker-facing video tab shows only the published version
expected: When logged in as a worker in a second session, the SOP video tab shows exactly one video — the currently published version — and updates when the admin publishes a different version.
result: [pending]

### 4. REQUIREMENTS.md backfill — VVM-01..VVM-08
expected: VVM-01 through VVM-08 are referenced in ROADMAP.md, all four Phase 10 PLAN frontmatters, and `tests/video-version-management.test.ts`, but are NOT defined in `.planning/REQUIREMENTS.md` and have no entries in the Traceability table. Add a `### Video Version Management` subsection under v2.0 Requirements and add Phase 10 rows to the Traceability table.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
