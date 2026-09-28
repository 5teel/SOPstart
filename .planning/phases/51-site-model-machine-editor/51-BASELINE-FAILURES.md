# Phase 51 — Pre-Phase Full-Suite Failure Baseline

**Recorded:** 2026-09-28T09:36:03Z
**Commit SHA:** 736f44a5a21611d6c66d754bab3d7963d31a084b
**Command:** `npx playwright test --reporter=line`
**Result:** 20 failed, 228 skipped, 1496 passed (51.4s)

Purpose: this is the list 51-07's final phase gate compares against. A phase-51
change is "no new failures" only if every NEW red test is NOT already listed here.
Do not fix or interpret these — they pre-date this phase.

## Failing spec files + test titles (verbatim)

1. `[phase11-stubs] tests\sb-layout-editor.test.ts:5:7` — Layout editor (SB-LAYOUT) › SB-LAYOUT-01 admin palette exposes exactly 7 block components (no DiagramHotspotBlock)
2. `[phase11-stubs] tests\sb-auth-builder.test.ts:4:7` — SOP Builder authoring entry points (SB-AUTH) › SB-AUTH-01 admin can start a new SOP from a blank-page wizard (title → sections → review → draft save) with no source document
3. `[phase11-stubs] tests\sb-section-schema.test.ts:8:7` — Extensible section schema (SB-SECT) › SB-SECT-05 admin can reorder sections via drag-and-drop and sort_order persists
4. `[phase12.5-stubs] tests\sb-ux-blocks.test.ts:14:5` — SB-UX-04: /api/schema lists the 8 new blocks
5. `[phase11-stubs] tests\sb-layout-editor.test.ts:49:7` — Layout editor (SB-LAYOUT) › SB-LAYOUT-02 each block component is shared between admin editor and worker walkthrough (single component tree)
6. `[phase12.5-stubs] tests\sb-ux-blocks.test.ts:26:5` — SB-UX-04: each new block has non-empty props_schema and example_props
7. `[phase11-stubs] tests\sb-layout-editor.test.ts:135:7` — Layout editor (SB-LAYOUT) › SB-LAYOUT-04 layout persists as JSONB on sop_sections.layout_data with layout_version pin
8. `[phase12.5-stubs] tests\sb-ux-blocks.test.ts:51:5` — SB-UX-05: EscalateBlock default escalationMode is "form"
9. `[phase12.5-stubs] tests\sb-ux-blueprint.test.ts:3:5` — SB-UX-01: public landing body has data-theme="paper"
10. `[phase11-stubs] tests\sb-layout-editor.test.ts:227:7` — Layout editor (SB-LAYOUT) › SB-LAYOUT-D01-preview Puck native viewports clamp only the canvas, palette + fields stay full width
11. `[phase12.5-stubs] tests\sb-ux-blocks.test.ts:67:5` — SB-UX-11: three.js not installed; ModelBlock registered in schema
12. `[phase11-stubs] tests\sb-layout-editor.test.ts:276:7` — Layout editor (SB-LAYOUT) › SB-LAYOUT-06 worker walkthrough falls back to linear step-list renderer for SOPs with no layout_data or unsupported layout_version
13. `[phase11-stubs] tests\sb-layout-editor.test.ts:309:7` — Layout editor (SB-LAYOUT) › SB-LAYOUT-13-unknown unsupported block type renders UnsupportedBlockPlaceholder + warn-once (D-13)
14. `[phase25-integration] tests\integration\wizard-sop-dept.spec.ts:61:5` — DepartmentPicker in wizard mode uses sopId sentinel __new__ (A4)
15. `[phase11-stubs] tests\sb-layout-editor.test.ts:343:7` — Layout editor (SB-LAYOUT) › SB-LAYOUT-16-red-outline admin red-outline on Zod failure + worker plain empty-state (D-16)
16. `[phase11-stubs] tests\sb-layout-editor.test.ts:375:7` — Layout editor (SB-LAYOUT) › SB-LAYOUT-D08-purge draftLayouts Dexie rows are purged when the SOP transitions to published
17. `[phase46] tests\phase46\sop-edit-owner-access.spec.ts:440:7` — CAP-02 -- approver-edit runtime probes (real ephemeral org, real RLS, A1 = chain approvers) › JUNCTION POSITIVE -- a userId-step approver (role worker) can insert, update pin_mode, and delete a sop_section_blocks row
18. `[phase46] tests\phase46\sop-edit-owner-access.spec.ts:481:7` — CAP-02 -- approver-edit runtime probes (real ephemeral org, real RLS, A1 = chain approvers) › JUNCTION POSITIVE -- the approver can reorder junctions via the reorder_sop_section_blocks RPC (NOT SECURITY DEFINER -- runs under the extended policy)
19. `[phase46] tests\phase46\sop-edit-owner-access.spec.ts:550:7` — CAP-02 -- approver-edit runtime probes (real ephemeral org, real RLS, A1 = chain approvers) › IMAGES POSITIVE -- a userId-step approver (role worker) can insert a sop_images row
20. `[phase46] tests\phase46\sop-edit-owner-access.spec.ts:573:7` — CAP-02 -- approver-edit runtime probes (real ephemeral org, real RLS, A1 = chain approvers) › IMAGES NEGATIVE -- a same-org worker in no chain step cannot insert a sop_images row (verified by service re-read)

## Notes

- Failures 1-16 (`phase11-stubs`, `phase12.5-stubs`, `phase25-integration`) are
  long-standing pre-existing red stubs/fixtures unrelated to this phase.
- Failures 17-20 (`phase46 sop-edit-owner-access.spec.ts`) all share the same
  root cause: `Error: verifyOtp failed: Request rate limit reached` — a Supabase
  auth rate limit hit during this specific run (transient infra, not a code
  regression). A re-run may show a different pass/fail split on these four.
- `evals` project tests self-skip (no `EVAL_BASE_URL`) and are not counted above.
