# Phase 55 — Baseline (before any src change)

**Recorded:** 2026-10-03 · **Commit:** `81c6764` (Wave 0 test-only commits on top of `0f3e89f`; no `src/` file changed) · **Command:** `npx playwright test --reporter=list`, run ONCE.

**Result:** 1911 passed · 24 failed · 339 skipped (of 2274). No live-Supabase OTP flake outside phase46.

## Bundle before the phase (D-07)

Measured by `npm run build` on the unchanged tree (exit 0). 55-13 compares against these, not the baseline file:

```
check-bundle-size: /sops/[sopId]/page = 1045 KB (baseline 1048 KB, Δ -3 KB, tolerance ±2 KB)
check-bundle-size: /sops/page = 936 KB (baseline 940 KB, Δ -4 KB, tolerance ±2 KB)
```

`.bundle-baseline.json` (1048 / 940, captured 2026-09-12) is untouched; a copy is held in the gitignored `.bundle-baseline.old.json` for the move-down-only check.

## Live-Supabase probes (OTP rate limit / environment) — 8

All `verifyOtp failed`; environment, not code (CLAUDE.md 2026-09-28).

| Project | File | Tests |
|---|---|---|
| phase46 | `tests/phase46/sop-edit-owner-access.spec.ts` | NEGATIVE (l.333), NO-CHAIN (356), REGRESSION (374), SCOPE CONTAINMENT (415), JUNCTION POSITIVE x2 (440, 481), JUNCTION NEGATIVE (516), IMAGES POSITIVE (550) |

## Non-live (real baseline failures) — 16

Later plans compare their non-live failures against THIS list only. All 16 fail identically before the phase; none is caused by it.

| # | Project › file › title | First error |
|---|---|---|
| 1 | phase11-stubs › `tests/sb-auth-builder.test.ts` › SB-AUTH-01 blank-page wizard | expected substring `useForm` |
| 2 | phase11-stubs › `tests/sb-layout-editor.test.ts` › SB-LAYOUT-01 palette exposes 7 blocks | ENOENT `src/lib/builder/puck-config.tsx` |
| 3 | phase11-stubs › `tests/sb-layout-editor.test.ts` › SB-LAYOUT-02 shared component tree | expected `from '@/lib/builder/puck-config'` |
| 4 | phase11-stubs › `tests/sb-layout-editor.test.ts` › SB-LAYOUT-04 layout_data JSONB pin | expected `['admin', 'safety_manager']` |
| 5 | phase11-stubs › `tests/sb-layout-editor.test.ts` › SB-LAYOUT-D01-preview Puck viewports | expected `BUILDER_VIEWPORTS` |
| 6 | phase11-stubs › `tests/sb-layout-editor.test.ts` › SB-LAYOUT-06 linear fallback | expected `@puckeditor/core` |
| 7 | phase11-stubs › `tests/sb-layout-editor.test.ts` › SB-LAYOUT-13-unknown placeholder | ENOENT `puck-config.tsx` |
| 8 | phase11-stubs › `tests/sb-layout-editor.test.ts` › SB-LAYOUT-16-red-outline | ENOENT `puck-config.tsx` |
| 9 | phase11-stubs › `tests/sb-layout-editor.test.ts` › SB-LAYOUT-D08-purge draftLayouts Dexie rows | ENOENT `admin/sops/[sopId]/review/ReviewClient.tsx` |
| 10 | phase11-stubs › `tests/sb-section-schema.test.ts` › SB-SECT-05 reorder sections | expected `['admin', 'safety_manager']` |
| 11-14 | phase12.5-stubs › `tests/sb-ux-blocks.test.ts` › SB-UX-04 (x2), SB-UX-05, SB-UX-11 | ECONNREFUSED `::1:3000` (needs a running server) |
| 15 | phase12.5-stubs › `tests/sb-ux-blueprint.test.ts` › SB-UX-01 landing paper theme | ERR_CONNECTION_REFUSED `localhost:3000` |
| 16 | phase25-integration › `tests/integration/wizard-sop-dept.spec.ts` › wizard DepartmentPicker sentinel | expected `__new__` |

Phase 55 notes: #2-#9 and the `sb-layout-editor` / `sb-auth-builder` files already read paths the Puck-to-bespoke-editor swap deleted, so they are stale before this phase starts. 55-02 and 55-09 will touch `sb-layout-editor.test.ts` (it reads `useDraftLayoutSync`) — leave the already-red tests red, do not delete them under this phase.
