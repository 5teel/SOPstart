---
status: partial
phase: 11-section-schema-block-foundation
source: [11-VERIFICATION.md]
started: 2026-04-15T00:00:00Z
updated: 2026-04-15T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. SB-SECT-01 — Add two Hazards sections to one SOP and confirm both render in worker walkthrough
expected: On a draft SOP in `/admin/sops/[sopId]/review`, click "Add section" → pick "Hazards" → title "Hot surface — melter 1" → Add. Click "Add section" again → pick "Hazards" → title "Hot surface — melter 2" → Add. Approve + publish. Open the worker walkthrough and confirm both Hazards tabs appear with red AlertTriangle icon, distinct titles, and content/steps render correctly.
result: [pending]

### 2. SB-SECT-02 — Custom section with admin-provided title renders in worker walkthrough
expected: On a draft SOP, click "Add section" → pick "Custom" → title "Pre-flight check" → Add. Approve + publish. In worker walkthrough, the Pre-flight check tab appears using the `custom` render family fallback (Sparkles icon, steel-100 color), title shown verbatim, content renders via DefaultContent.
result: [pending]

### 3. SB-SECT-03 / SB-SECT-04 — v1/v2 SOP regression: legacy SOPs render pixel-identical
expected: Open any pre-Phase-11 published SOP (`section_kind_id IS NULL` on all sections) in worker walkthrough. Confirm: (a) tabs in same left-to-right order as pre-merge build, (b) hazards/emergency tabs red+AlertTriangle/Siren, PPE blue+ShieldCheck, steps brand-yellow+ListChecks, (c) a section with `section_type='procedure'` and zero extracted steps renders as DefaultContent (NOT empty StepsContent), (d) sections with both content text AND extracted steps render preamble + StepsContent stacked.
result: [pending]

### 4. Apply migration 00019 against dev/staging Supabase and regenerate types
expected: Run `supabase db push` (or equivalent). Confirm: (1) `select count(*) from public.section_kinds where organisation_id is null` = 7, (2) `select count(*) from pg_policies where tablename in ('section_kinds','blocks','block_versions','sop_section_blocks')` >= 12, (3) `select column_name from information_schema.columns where table_name='sop_sections' and column_name='section_kind_id'` returns 1 row, (4) attempting an INSERT on `section_kinds` with NULL `organisation_id` from a non-service-role user fails with RLS error. Then run `npx supabase gen types typescript --local > src/types/database.types.ts` and confirm the hand-written block is replaced with generator output (no diff in new types).
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
