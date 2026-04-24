---
phase: 12
slug: builder-shell-blank-page-authoring
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-24
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Populated by gsd-planner during wave 0 planning; refined during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright @latest (integration + E2E) |
| **Config file** | `playwright.config.ts` |
| **Quick run command** | `npx playwright test --project=phase11-stubs -g "@phase-12\|SB-"` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~90 seconds (quick), ~10 min (full) |

Note: `phase11-stubs` project already matches Phase 12 test files (`sb-auth-builder|sb-layout-editor|sb-builder-infrastructure` via the existing regex at `playwright.config.ts:47`). No new project needed — shared per PATTERNS.md decision.

---

## Sampling Rate

- **After every task commit:** Run quick suite filtered to the flipped SB-XX tests for that task
- **After every plan wave:** Run full `phase11-stubs` project
- **Before `/gsd-verify-work`:** Full `npm run test` must be green
- **Max feedback latency:** 120 seconds per task commit

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01-T1 | 12-01 | 1 | SB-LAYOUT-04 | T-12-01-01 | Additive schema, no RLS change | grep + tsc | `grep -q "layout_data jsonb" supabase/migrations/00020_section_layout_data.sql && grep -q "reorder_sections" supabase/migrations/00020_section_layout_data.sql && grep -q "check (source_type in ('uploaded','blank','ai','template'))" supabase/migrations/00020_section_layout_data.sql && npx tsc --noEmit` | ✅ new file | ⬜ |
| 12-01-T2 | 12-01 | 1 | SB-LAYOUT-04 | T-12-01-01 | Migration idempotent | supabase CLI | `npx supabase db push --dry-run 2>&1 \| grep -qiE "(no changes\|already applied\|up.to.date\|nothing to push)"` | ✅ | ⬜ |
| 12-01-T3 | 12-01 | 1 | SB-LAYOUT-06 | T-12-01-03, T-12-01-04, T-12-01-05 | LayoutRenderer Zod-parse guard + version check + auth guard on route | Playwright + grep | `grep -q "ssr: false" "src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx" && grep -q "LayoutRenderer" src/components/sop/SectionContent.tsx && grep -q "function LegacyRenderer" src/components/sop/SectionContent.tsx && npx playwright test --project=phase11-stubs -g "SB-LAYOUT-06\|builder.*route"` | ✅ stubs exist | ⬜ |
| 12-02-T1 | 12-02 | 2 | SB-LAYOUT-02, SB-LAYOUT-03 | T-12-02-01, T-12-02-02 | No className prop (HTML parity); no JS viewport branching | grep + tsc | `grep -rE "export (function\|const) (Text\|Heading\|Photo\|Callout\|Step\|HazardCard\|PPECard)Block" src/components/sop/blocks/ \| wc -l \| grep -q "^14$" && ! grep -rE "isMobile\|useMediaQuery\|navigator\\.userAgent" src/components/sop/blocks/ && ! grep -rE "@puckeditor/core" src/components/sop/blocks/ && npx tsc --noEmit` | ✅ new files | ⬜ |
| 12-02-T2 | 12-02 | 2 | SB-LAYOUT-01, SB-LAYOUT-02, SB-LAYOUT-03 | T-12-02-01 | SafeRender Zod guard around every block | Playwright | `grep -q "puckConfig" src/lib/builder/puck-config.ts && ! grep -q "DiagramHotspot" src/lib/builder/puck-config.ts && npx playwright test --project=phase11-stubs -g "SB-LAYOUT-01\|SB-LAYOUT-02\|SB-LAYOUT-03"` | ✅ stubs exist | ⬜ |
| 12-04-T1 | 12-04 | 2 | SB-LAYOUT-04 | T-12-04-04, T-12-04-07 | Dexie v4 preserves v3 data; debounce prevents DoS | grep + tsc | `grep -q "db.version(4)" src/lib/offline/db.ts && grep -q "draftLayouts: 'section_id, sop_id, syncState, _cachedAt'" src/lib/offline/db.ts && grep -q "flushDraftLayouts" src/lib/offline/sync-engine.ts && test -f src/hooks/useDraftLayoutSync.ts && test -f src/hooks/useBuilderAutosave.ts && npx tsc --noEmit` | ✅ new files | ⬜ |
| 12-04-T2 | 12-04 | 2 | SB-LAYOUT-04, SB-SECT-05 | T-12-04-01, T-12-04-02, T-12-04-03 | 128KB cap, LWW, admin role guard, RPC runs as caller (RLS applies) | Playwright | `grep -q "supabase.rpc('reorder_sections'" src/actions/sections.ts && grep -q "MAX_LAYOUT_BYTES" src/actions/sections.ts && test -f "src/app/(protected)/admin/sops/builder/[sopId]/SectionListSidebar.tsx" && npx playwright test --project=phase11-stubs -g "SB-LAYOUT-04\|SB-SECT-05"` | ✅ stubs exist | ⬜ |
| 12-03-T1 | 12-03 | 3 | SB-AUTH-05 | T-12-03-02, T-12-03-04 | Compensating cleanup + RLS-scoped kind SELECT | grep + tsc | `grep -q "export async function createSopFromWizard" src/actions/sops.ts && grep -q "source_type: 'blank'" src/actions/sops.ts && grep -q "AUTHORED IN BUILDER" "src/app/(protected)/admin/sops/page.tsx" && grep -q "source_type" "src/app/(protected)/admin/sops/page.tsx" && npx tsc --noEmit` | ✅ files exist | ⬜ |
| 12-03-T2 | 12-03 | 3 | SB-AUTH-01, SB-AUTH-04, SB-AUTH-05 | T-12-03-01, T-12-03-03 | Admin role guard, Zod length caps | Playwright + find | `test -f "src/app/(protected)/admin/sops/new/blank/page.tsx" && test -f "src/app/(protected)/admin/sops/new/blank/WizardClient.tsx" && find src/app -path "*admin/sops*builder*" -type d \| wc -l \| grep -q "^1$" && npx playwright test --project=phase11-stubs -g "SB-AUTH-01\|SB-AUTH-04\|SB-AUTH-05"` | ✅ stubs exist | ⬜ |
| 12-03-T3 | 12-03 | 3 | SB-LAYOUT-04 | T-12-04-04, T-12-04-09 | D-08 draftLayouts purge-on-publish; idempotent; wired via both sync hook (draft->published transition) AND ReviewClient explicit call | Playwright + grep | `test -f src/lib/offline/draftLayouts-purge.ts && grep -q "purgeDraftLayoutsOnPublish" src/hooks/useSopSync.ts && grep -rq "purgeDraftLayoutsOnPublish" "src/app/(protected)/admin/sops/[sopId]/review/" && npx playwright test --project=phase11-stubs -g "SB-LAYOUT-D08-purge"` | ✅ new file | ⬜ |
| 12-02-T2a | 12-02 | 2 | SB-LAYOUT-01, SB-LAYOUT-02, D-13 | T-12-02-05 | Unknown block type -> UnsupportedBlockPlaceholder; warn-once per page load | Playwright + grep | `grep -q "UnsupportedBlockPlaceholder" src/lib/builder/puck-config.ts && grep -q "sanitizeLayoutContent" src/components/sop/LayoutRenderer.tsx && grep -q "sanitizeLayoutContent" "src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx" && npx playwright test --project=phase11-stubs -g "SB-LAYOUT-13-unknown"` | ✅ new test | ⬜ |
| 12-02-T2b | 12-02 | 2 | D-16 | T-12-02-01 | Admin red-outline + Missing-field hint on Zod-failed block; worker plain empty-state; section-level toast on corrupt layout_data | Playwright + grep | `grep -q "data-layout-error" src/lib/builder/puck-config.ts && grep -q "layoutErrorToast" "src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx" && npx playwright test --project=phase11-stubs -g "SB-LAYOUT-16-red-outline"` | ✅ new test | ⬜ |
| 12-04-T3 | 12-04 | 2 | SB-LAYOUT-03 (preserved), D-01 | T-12-04-08 | Desktop/mobile preview pills toggle `body[data-view]`; 430px phone-frame CSS on mobile; cleanup on unmount; zero JS-viewport-branching in blocks/ | Playwright + grep | `test -f "src/app/(protected)/admin/sops/builder/[sopId]/PreviewToggle.tsx" && test -f "src/app/(protected)/admin/sops/builder/[sopId]/builder-preview.css" && grep -q "430px" "src/app/(protected)/admin/sops/builder/[sopId]/builder-preview.css" && ! grep -rE "isMobile\|useMediaQuery\|navigator\.userAgent" src/components/sop/blocks/ && npx playwright test --project=phase11-stubs -g "SB-LAYOUT-D01-preview"` | ✅ new test | ⬜ |
| 12-04-T1a | 12-04 | 2 | D-07 | T-12-04-09 | flushDraftLayouts returns overwrittenByServer[]; BuilderClient surfaces quiet toast on cross-admin overwrite | grep + Playwright | `grep -q "overwrittenByServer" src/lib/offline/sync-engine.ts && grep -q "overwriteToast\|overwrittenByServer" "src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx" && npx tsc --noEmit` | ✅ new | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/sb-layout-editor.test.ts` — SB-LAYOUT-01..06 exist as `test.fixme`; plans flip to live across Plans 01/02/04. SB-LAYOUT-05 stays fixme (Phase 16)
- [x] `tests/sb-builder-infrastructure.test.ts` — builder + Puck integration `test.fixme` stubs exist; Plan 01 flips the route-load test
- [x] `tests/sb-auth-builder.test.ts` — `test.fixme` stubs for SB-AUTH-01/04/05 exist; Plan 03 flips all three to live
- [x] `tests/sb-section-schema.test.ts` — SB-SECT-01..04 passing for Phase 11 scope; Plan 04 flips SB-SECT-05 from fixme to live
- [x] `playwright.config.ts` — `phase11-stubs` project already matches `sb-*.test.ts`; reused as Phase 12 test project (no new project needed per PATTERNS.md)
- [x] `@puckeditor/core@0.21.2` install (Plan 01 Task 1) — package renamed from `@measured/puck` per research

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mobile preview device frame visual accuracy | SB-LAYOUT-03 | Subjective device-frame fidelity | Load `/admin/sops/builder/{id}`, toggle MOBILE (if Plan 04 ships the toggle; Phase 12 may defer), eyeball against iPhone 15 Pro reference |
| Puck editor drag-and-drop smoothness | SB-LAYOUT-01 | Browser-specific DnD timing variance | Manual drag test on Chrome + Firefox + Safari |
| Dexie offline-queue UX + save-state pill copy | SB-LAYOUT-04 (constraint), D-03 | Requires airplane-mode toggle | Disconnect network, edit in builder, confirm pill shows `OFFLINE · QUEUED`, reconnect, verify pill returns to `SAVED Ns AGO` + Supabase row updates |
| AUTHORED IN BUILDER chip visual/copy | SB-AUTH-05, D-chip-copy | Product copy subject to review | Load `/admin/sops` with mixed wizard + upload rows, confirm chip reads `AUTHORED IN BUILDER` in uppercase tracking-wider mono style |
| Section drag handles feel (HTML5 DnD) | SB-SECT-05 | Native DnD ergonomics vary by browser | Manual drag test in sidebar on Chrome + Firefox + Safari |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (stubs exist + flips planned per task)
- [x] No watch-mode flags
- [x] Feedback latency < 120s per task
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending execution
