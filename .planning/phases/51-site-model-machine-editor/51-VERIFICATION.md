---
phase: 51-site-model-machine-editor
verified: 2026-09-28T13:05:26Z
status: passed
score: 5/5 roadmap success criteria verified, 4/4 requirements satisfied
overrides_applied: 0
---

# Phase 51: Site Model & Machine Editor Verification Report

**Phase Goal:** An organisation can describe its site once — a scene image and the machines on it — and every SOP can say which machine it belongs to.
**Verified:** 2026-09-28T13:05:26Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Tables `site_layouts`, `site_machines`, `sop_machines` exist with org-scoped RLS, admin-only writes, `WITH CHECK` restating `USING`, pinned by `rls-org-scope.spec.ts` unchanged | ✓ VERIFIED | `supabase/migrations/00067_site_model.sql:96-145` — every policy conjoins `organisation_id = public.current_organisation_id()`; all three `WITH CHECK` blocks (lines 108-111, 125-128, 142-145) are byte-identical to their `USING`. `git diff 736f44a HEAD -- tests/lint/rls-org-scope.spec.ts` → empty (file unchanged). `npx playwright test tests/lint/rls-org-scope.spec.ts --project=phase15-stubs` → 3/3 passed. Live runtime probes (`tests/phase51/site-model-rls-runtime.spec.ts`, run against real Supabase) → 11/11 passed: same-org read, cross-org zero-read, cross-org write-denied, composite-FK cross-org link rejection, org-id-rewrite rejection, cascade shapes, storage path scoping. |
| 2 | Admin at `/admin/site` can generate a scene from a description (server-side Gemini, validated prompt, stored in Storage) **or** upload JPG/PNG, rendered at natural size with pan/zoom | ✓ VERIFIED | `src/app/api/admin/site/generate/route.ts` — admin gate → key gate (503 without `GEMINI_API_KEY`) → `generateSceneSchema` (20-1200 char cap) → 409 if org already has a layout → single Gemini fetch (key in `x-goog-api-key` header, never a query param) → sharp-verified jpeg/png → uploaded to `site-scenes/<org>/<layout>/scene.<ext>` → `upsertSiteLayout()`. `SiteEmptyState.tsx` gates the Generate panel on `canGenerate` (server-computed, key never returned to client — `src/actions/site.ts:145`). `SiteEditor.tsx` renders the scene at natural pixel size (`width={sceneWidth} height={sceneHeight}` on `KonvaImage`) inside a Konva `Stage` with wheel zoom-to-cursor (`zoomAt`) and drag-to-pan (`handleStageDragEnd`). Deployed eval screenshot `.planning/evals/latest/site-empty.png` confirms Generate panel correctly hidden (key not set on Railway) and Upload always present; `site-editor.png` confirms a rendered scene with two machines. |
| 3 | Admin can draw a polygon, name it, pick department, move a vertex, delete it — all persisted, polygons in scene-pixel space | ✓ VERIFIED | `SiteEditor.tsx` draw mode (`handleStageClick`/`handleStageDblClick`) places vertices via `layer.getRelativePointerPosition()` (scene-px, transform-aware — never raw pointer arithmetic, confirmed by `site-editor-canvas.spec.ts:89`). `SiteWorkspace.tsx handleCreate` → `upsertSiteMachine()` (real call, not a stub). Rename (`handleRenameChange`, debounced) → `upsertSiteMachine`. Department select (`handleDepartmentChange`) → `upsertSiteMachine`. Vertex drag (`handleVertexDragEnd` in `SiteEditor.tsx`) → `onPolygonChange` → `SiteWorkspace.handlePolygonChange` → `upsertSiteMachine`. Delete (`deleteSelected`, wired to button + window keydown listener ignoring typing targets) → `deleteSiteMachine`. Server action `upsertSiteMachine` (`src/actions/site.ts:257-...`) validates polygon lies within the layout's `scene_width`/`scene_height` via `polygonWithinScene()` before writing — confirms scene-pixel storage, not viewport coordinates. Deployed eval screenshot `site-editor.png` shows two distinct named/tinted polygons ("EVAL Press" tagged Forming, "EVAL Oven" untagged) persisted after reload. |
| 4 | Builder metadata panel offers a machine picker (multi-select, org-scoped); machine editor panel lists linked SOPs; both write `sop_machines` | ✓ VERIFIED | `BuilderMachinesButton.tsx` — Tools-menu row → portaled modal → `listSopMachines(sopId)` loads org machines/departments/linked ids → checkbox `onChange` → `toggleMachine()` → `setSopMachines()` (same action editor uses). `BuilderStageShell.tsx:145` renders `<BuilderMachinesButton sopId={sopId} />`. `SiteWorkspace.tsx` right panel lists each machine's linked-SOP count + "Show SOPs" → `linkSop`/`unlinkSop` → `setSopMachines()`. Both surfaces share one action, so they cannot drift (per D-12). `setSopMachines` (`src/actions/site.ts`) validates the SOP id and every machine id against `orgId` before writing (`.eq('organisation_id', orgId)` on both lookups), insert-before-prune (T-51-01-E). Deployed eval screenshot `builder-machines.png` shows the modal grouped by department with a checked "EVAL Press" and "Saved ✓". |
| 5 | Deployed eval covers generate-or-upload → draw two polygons → link a SOP → reload shows all three | ✓ VERIFIED | `tests/evals/site-editor.eval.ts` (isolated `eval-site-admin` org, never the shared eval org) — uploads a fixture scene, draws two polygons (second after zoom+pan), names/tags them, drags a corner, links/unlinks a SOP from both the editor panel and the builder Tools menu, reloads, and asserts via a service-role DB read that stored polygons are scene-pixel and zoom/pan-independent — plus a worker-redirect test. `.planning/phases/51-site-model-machine-editor/51-EVAL.md`: 12/12 passed against `https://sopstart.com` at commit `cf9d1e1` (an ancestor of current `HEAD` `316eb49`, confirmed by `git log`). Both site-editor eval tests pass. `npx playwright test --list --project=evals` lists `tests/evals/site-editor.eval.ts` (2 tests). |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/00067_site_model.sql` | 3 tables + RLS + storage bucket | ✓ VERIFIED | 184 lines; every policy org-scoped; no SECURITY DEFINER function (`site-migration-shape.spec.ts` asserts this and passes); FK cascades match D-13 (`site_machines.site_layout_id` FK cascade, `department_id` FK set null, `sop_machines.sop_id`/`machine_id` FK cascade) |
| `src/actions/site.ts` | 7 server actions, admin-gated, org-filtered | ✓ VERIFIED (524 lines) | Every export begins `const ctx = await requireAdminContext(); if ('error' in ctx) return { error: ctx.error }`; every query adds `.eq('organisation_id', orgId)` from session context (never a fetched-row value, per 2026-07-28 learning); no service-role client imported |
| `src/app/api/admin/site/generate/route.ts` | admin gate → key gate → validation → 409 dedupe → 1 fetch | ✓ VERIFIED (147 lines) | Guard order matches plan exactly; key read only inside the route from `process.env`; key sent in header not URL; 503 without key; description capped 20-1200 chars server-side via Zod before any network call |
| `src/components/admin/site/SiteEditor.tsx` | Konva canvas, isolated | ✓ VERIFIED | Imported only from `SiteEditorLoader.tsx` (`next/dynamic({ ssr:false })`); no other importer found (`grep -rln "SiteEditor" src --include=*.tsx` → only Loader + Workspace, and Workspace imports the Loader, not SiteEditor directly) |
| `src/components/admin/site/SiteWorkspace.tsx` | Draw/Delete/rename/dept/link/unlink wired | ✓ VERIFIED (400 lines) | Every handler traced to a real `src/actions/site.ts` call — no stub `onClick`s |
| `src/app/(protected)/admin/sops/builder/[sopId]/BuilderMachinesButton.tsx` | Machine picker modal | ✓ VERIFIED | Checkbox `onChange` → `toggleMachine()` → `setSopMachines()`; rendered by `BuilderStageShell.tsx:145` |
| `src/app/(protected)/admin/site/page.tsx` | admin-gated route | ✓ VERIFIED | `requireAdminContext()` runs and redirects before `listSiteForOrg()` is ever called |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `SiteWorkspace.tsx` Draw button | `src/actions/site.ts upsertSiteMachine` | `handleCreate` | WIRED | Confirmed by reading the handler chain; also asserted by `site-workspace-wiring.spec.ts` |
| `SiteWorkspace.tsx` Delete | `deleteSiteMachine` | `deleteSelected` (button + window keydown) | WIRED | Coverage split intentionally: canvas has no delete path (fixme in `site-editor-canvas.spec.ts` points here), workspace owns delete |
| `SiteWorkspace.tsx` rename/department/vertex-drag | `upsertSiteMachine` | debounced handlers | WIRED | All three paths call the same action with updated fields |
| `SiteWorkspace.tsx` link/unlink | `setSopMachines` | `linkSop`/`unlinkSop` | WIRED | |
| `BuilderMachinesButton.tsx` checkbox | `setSopMachines` | `toggleMachine` | WIRED | Same action as the editor — cannot drift (D-12) |
| `BuilderStageShell.tsx` | `BuilderMachinesButton` | JSX render | WIRED | `grep -n "BuilderMachinesButton"` → imported line 43, rendered line 145 |
| `SiteEmptyState.tsx` Generate | `POST /api/admin/site/generate` | `fetch` + `router.refresh()` | WIRED | |
| `SiteEmptyState.tsx` Upload | `createSceneUploadUrl` → signed upload → `upsertSiteLayout` | `handleUpload` | WIRED | |
| `TopHeader.tsx` ADMIN_LINKS | `/admin/site` | nav entry | WIRED | line 150 |
| `journeys.ts` | `/admin/site` | 3 journey steps | WIRED | lines 301, 608, 615 |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|--------------|--------|----------|
| SIT-01 | 51-01, 51-02 | Org has site layouts + machines, org-scoped RLS, admin-only writes | ✓ SATISFIED | Migration 00067 + live RLS runtime probes (11/11 passed) |
| SIT-02 | 51-01, 51-03, 51-04, 51-05, 51-07 | Admin generates or uploads a scene | ✓ SATISFIED | generate route + upload flow, both verified above, eval-proven live |
| SIT-03 | 51-01, 51-03, 51-04, 51-05, 51-07 | Draw/move/delete polygon hotspots, named + departmented | ✓ SATISFIED | SiteEditor + SiteWorkspace wiring, eval-proven live |
| SIT-04 | 51-01, 51-02, 51-03, 51-05, 51-06, 51-07 | SOP↔machine N:M linking from builder and editor | ✓ SATISFIED | `setSopMachines` shared by both surfaces, eval-proven live |

No orphaned requirements — every SIT-01..04 ID declared by a plan matches an ID in REQUIREMENTS.md's Phase 51 mapping (`.planning/REQUIREMENTS.md:952`).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | Swept `src/actions/site.ts`, `src/app/api/admin/site/generate/route.ts`, `src/lib/validators/site.ts`, `src/lib/site/scene.ts`, `src/components/admin/site/*.tsx`, `BuilderMachinesButton.tsx`, `admin/site/page.tsx` for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`, "coming soon"/"not yet implemented", `as any`, hardcoded department lists — none found. `placeholder=` hits are HTML input placeholder attributes, not stub markers. |

One deliberate `test.fixme` remains in `tests/phase51/site-editor-canvas.spec.ts:138` ("Delete key and a delete button both remove the selected machine") — this is intentional per its own comment: `SiteEditor` itself has no delete path by design (delete is a `SiteWorkspace` concern), and the real coverage lives in `site-workspace-wiring.spec.ts`'s "workspace" describe, which was read directly and does assert the Delete button `onClick` + window keydown listener + `deleteSiteMachine(` call — confirmed not a gap.

### Gates Run

| Gate | Command | Result |
|------|---------|--------|
| RLS lint (unchanged file) | `git diff 736f44a HEAD -- tests/lint/rls-org-scope.spec.ts` | empty diff |
| RLS lint (passes) | `npx playwright test tests/lint/rls-org-scope.spec.ts --project=phase15-stubs` | 3/3 passed |
| Konva isolation | `npx playwright test --project=phase26 tests/phase26/konva-worker-isolation.spec.ts` | 4/4 passed |
| Pathways coverage | `npx playwright test --project=phase30 tests/phase30/governance-fold.spec.ts` | 7/7 passed (includes "0 not-mapped") |
| Phase51 full project | `npx playwright test --project=phase51` | 80 passed, 1 intentional fixme |
| Phase51 spec registration | `npx playwright test --list --project=phase51` | 81 tests across 7 files, all discovered |
| Eval registration | `npx playwright test --list --project=evals` | `tests/evals/site-editor.eval.ts` listed (2 tests) |
| TypeScript | `npx tsc --noEmit` | clean, no output |
| Bundle baseline | `git diff 736f44a HEAD -- .bundle-baseline.json` | empty diff (unchanged) |
| Deployed eval | `.planning/phases/51-site-model-machine-editor/51-EVAL.md` | 12/12 passed at commit `cf9d1e1` (ancestor of HEAD `316eb49`) |

Live-Supabase specs (`site-model-rls-runtime.spec.ts`) were run once as part of the full `--project=phase51` run above and all passed (no rate-limiting encountered on this run).

### Human Verification Required

None. All success criteria are backed by source evidence, passing automated gates, and deployed-eval screenshots inspected directly (`site-empty.png`, `site-editor.png`, `builder-machines.png` — no visual defects, correct token colours, correct Generate-panel gating).

### Gaps Summary

No gaps found. All 5 ROADMAP success criteria and all 4 SIT requirements are verified against the actual codebase (not SUMMARY claims): migration RLS shape is correct and lint-pinned, server actions are admin-gated and org-scoped throughout, the Gemini generate route follows the exact guard order the plan specified with the key never leaving the server, Konva is isolated to the admin bundle via the sanctioned loader, every interactive control in the workspace and builder-picker traces to a real server-action call (not a stub), the route/nav/pathways/capability-matrix wiring is complete, and the deployed eval proves the full generate-or-upload → draw → link → reload flow live on production with screenshots confirming no visual defects.

---

*Verified: 2026-09-28T13:05:26Z*
*Verifier: Claude (gsd-verifier)*
