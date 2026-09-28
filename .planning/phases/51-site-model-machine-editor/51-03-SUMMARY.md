---
phase: 51-site-model-machine-editor
plan: 03
subsystem: api
tags: [server-actions, gemini, supabase-storage, sharp, zod, playwright]

requires:
  - phase: 51-site-model-machine-editor (plan 01)
    provides: src/lib/validators/site.ts (schemas, SiteData/SiteLayout/SiteMachine types), src/lib/site/scene.ts (scenePath, polygonWithinScene, newMachineCode, Gemini prompt/request/response helpers), phase51 Playwright project, site-actions-contract.spec.ts stub
  - phase: 51-site-model-machine-editor (plan 02)
    provides: site_layouts/site_machines/sop_machines tables live on Supabase with admin-write RLS, site-scenes storage bucket
provides:
  - src/actions/site.ts — seven admin-gated, org-scoped server actions (listSiteForOrg, createSceneUploadUrl, upsertSiteLayout, upsertSiteMachine, deleteSiteMachine, setSopMachines, listSopMachines)
  - POST /api/admin/site/generate — Gemini image-model scene generation, guarded key-absent-then-org-already-has-layout-then-one-paid-call
  - src/components/admin/site/SiteEmptyState.tsx — Generate (key-gated) + Upload (always) on-ramps, both recording the scene through upsertSiteLayout
  - .env.local.example GEMINI_API_KEY / GEMINI_IMAGE_MODEL entries
  - tests/phase51/site-actions-contract.spec.ts fully live (0 test.fixme remaining)
affects: [51-04, 51-05, 51-06, 51-07]

tech-stack:
  added: []
  patterns:
    - "Session-client-only server actions on tables carrying an admin write RLS policy — no service-role client, explicit .eq('organisation_id', sessionOrg) on every query as belt-and-braces over RLS"
    - "Insert-before-prune junction write for SOP<->machine linking — a partial failure leaves a superset of links, never a lost one"
    - "Single-write-path invariant for a derived/probed column: upsertSiteLayout is the only place scene_width/scene_height are written, called identically by the upload flow and the generate route"
    - "Paid external-API route (not a server action) so a multi-second call isn't bound by the Next.js action timeout; org-already-has-layout checked before the paid call to cap spend"

key-files:
  created:
    - src/actions/site.ts
    - src/app/api/admin/site/generate/route.ts
    - src/components/admin/site/SiteEmptyState.tsx
  modified:
    - tests/phase51/site-actions-contract.spec.ts
    - .env.local.example

key-decisions:
  - "requireAdminContext() error message distinguishes 401 ('Not authenticated') from 403 (any other error, including 'Admin access required' and missing organisationId) in the generate route, mirroring the ai-prompt route idiom"
  - "upsertSiteLayout re-downloads and re-probes the stored object with sharp even when the generate route already probed the decoded bytes once — kept exactly as the plan specified so the natural-size record has exactly one write path regardless of caller (D-07)"
  - "setSopMachines upsert uses onConflict: 'sop_id,machine_id', ignoreDuplicates: true so a re-submitted id set is a no-op rather than a constraint error, before the .not('machine_id', 'in', ...) prune"

patterns-established:
  - "Source-contract spec splits src/actions/site.ts into per-export bodies at each `export async function` boundary and asserts requireAdminContext() precedes the first .from(/.storage within each body — positional, catches a guard added after a query rather than before it"

requirements-completed: [SIT-02, SIT-03, SIT-04]

duration: 10min
completed: 2026-09-28
---

# Phase 51 Plan 03: Site Server Actions, Gemini Generate Route & Empty State Summary

**Seven admin-gated org-scoped server actions in `src/actions/site.ts` (session client only, no service-role import), a guarded Gemini image-generation API route, and the two-choice `SiteEmptyState` on-ramp — both scene paths converge on a single `upsertSiteLayout` write that probes the stored object with sharp before any polygon can be drawn.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-09-28T20:00:00+10:00
- **Completed:** 2026-09-28T20:10:00+10:00
- **Tasks:** 2 completed
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments

- `src/actions/site.ts`: `listSiteForOrg`, `createSceneUploadUrl`, `upsertSiteLayout`, `upsertSiteMachine`, `deleteSiteMachine`, `setSopMachines`, `listSopMachines` — every export opens with `requireAdminContext()`, uses the session client cast through `SupabaseClient` (tables aren't in `database.types.ts` yet), and adds an explicit `.eq('organisation_id', orgId)` on every query using the session org, never a fetched row's org
- `upsertSiteMachine` rejects any polygon with a vertex outside the layout's recorded `scene_width`/`scene_height` (D-02) and rejects an unknown `departmentId`
- `setSopMachines` inserts the new link set (`upsert` with `ignoreDuplicates`) before pruning stale links (`.not('machine_id', 'in', ...)`) — a partial failure leaves a superset, never a lost link (T-51-01-E)
- `upsertSiteLayout` downloads the stored object, probes it with `sharp`, deletes it on a non-jpeg/png or oversized result, and is the sole path that writes `scene_width`/`scene_height` — called identically by the upload flow (via `SiteEmptyState`) and `POST /api/admin/site/generate`
- The generate route: `requireAdminContext()` → `GEMINI_API_KEY` presence (503, not a broken 200) → `generateSceneSchema` validation → 409 if the org already has a layout (checked before the paid call) → one `fetch` to the Gemini endpoint with the key in the `x-goog-api-key` header → sharp probe of the decoded image → upload → `upsertSiteLayout`
- `SiteEmptyState`: the Generate card is wrapped in `{canGenerate && (...)}` so the control doesn't exist in the DOM without a key; the Upload card always renders and drives `createSceneUploadUrl` → `uploadToSignedUrl` → `upsertSiteLayout` → `router.refresh()`
- Activated both describe blocks in `site-actions-contract.spec.ts` (0 `test.fixme` remaining in the file): positional `requireAdminContext()`-before-`.from()`/`.storage` per export body, `setSopMachines` write-order assertions, per-export content assertions, generate-route guard-order + status-code + no-`?key=`-leak + no-`process.env`-in-response assertions, and the empty-state `canGenerate`-gates-before-controls assertion

## Task Commits

Each task was committed atomically:

1. **Task 1: src/actions/site.ts — seven admin-gated, org-scoped server actions** - `a8c311f` (feat)
2. **Task 2: Gemini generate route, SiteEmptyState, env example** - `9bdb1ea` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `src/actions/site.ts` - the seven site server actions
- `src/app/api/admin/site/generate/route.ts` - `POST` (Gemini scene generation), `maxDuration = 120`
- `src/components/admin/site/SiteEmptyState.tsx` - Generate (key-gated) + Upload (always) empty-state UI
- `.env.local.example` - `GEMINI_API_KEY` / `GEMINI_IMAGE_MODEL` entries
- `tests/phase51/site-actions-contract.spec.ts` - both describe blocks activated (7 live tests, 0 fixme)

## Decisions Made

- Kept the double sharp-probe in the generate-route → `upsertSiteLayout` path exactly as specified (probe once to pick the upload extension, probe again inside the single write path) rather than optimizing it away, to preserve the "natural size recorded by exactly one function regardless of caller" invariant the plan calls out as load-bearing for 51-04/51-05
- Used a one-off `z.string().uuid()` check (imported `z` directly) for the two bare-string-id inputs (`deleteSiteMachine`, `listSopMachines`) rather than adding new named schemas to the validators module, since the plan didn't ask for an exported schema for either

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Own source-contract comment tripped its own `?key=` leak guard**
- **Found during:** Task 2 verification run
- **Issue:** The route's inline comment explaining why the key goes in the header ("a `?key=` param lands in logs") contained the literal substring `?key=` that both the task's acceptance criterion and the activated contract-spec test scan for — the comment was correct in intent but defeated its own guard, identical in class to the 51-02 migration-comment self-defeat.
- **Fix:** Reworded the comment to describe the same constraint without the literal query-param spelling.
- **Files modified:** `src/app/api/admin/site/generate/route.ts`
- **Verification:** `grep -c '?key=' src/app/api/admin/site/generate/route.ts` is 0; contract spec passes.
- **Committed in:** `9bdb1ea` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Cosmetic-only fix to a comment; no functional change. No scope creep.

## Issues Encountered

None.

## User Setup Required

**External service requires manual configuration to enable scene generation** (not required to use the phase — Upload always works without it):
- `GEMINI_API_KEY` — Google AI Studio → Get API key; add to Railway service Variables and `.env.local`
- `GEMINI_IMAGE_MODEL` — optional override, defaults to `gemini-3.1-flash-image-preview`

Without the key, `/admin/site` (built in 51-05) shows Upload only — nothing breaks.

## Next Phase Readiness

- 51-04 (Konva editor) can call `upsertSiteMachine`/`deleteSiteMachine` directly against a live layout
- 51-05 (workspace/route) can call `listSiteForOrg()` for the full page payload (signed scene URL, machines, links, departments, SOPs, `canGenerate`) and render `SiteEmptyState` when `layout` is null
- 51-06 (builder modal) can call `listSopMachines`/`setSopMachines` — the exact same `setSopMachines` the editor will use (D-12)
- No blockers for 51-04/51-05/51-06

---
*Phase: 51-site-model-machine-editor*
*Completed: 2026-09-28*

## Self-Check: PASSED

- `src/actions/site.ts` — FOUND
- `src/app/api/admin/site/generate/route.ts` — FOUND
- `src/components/admin/site/SiteEmptyState.tsx` — FOUND
- `.env.local.example` contains `GEMINI_API_KEY=` — FOUND
- Commit `a8c311f` — FOUND in `git log --oneline`
- Commit `9bdb1ea` — FOUND in `git log --oneline`
- `grep -c "^export async function" src/actions/site.ts` = 7 — CONFIRMED
- `grep -cE "^export (const|let|var|class|type|interface|function|default)" src/actions/site.ts` = 0 — CONFIRMED
- `grep -c "createAdminClient" src/actions/site.ts` = 0 — CONFIRMED
- `grep -c "requireAdminContext()" src/actions/site.ts` = 8 (>= 7) — CONFIRMED
- `grep -c "x-goog-api-key" src/app/api/admin/site/generate/route.ts` = 1, `grep -c '?key='` = 0 — CONFIRMED
- `grep -c "test.fixme" tests/phase51/site-actions-contract.spec.ts` = 0 — CONFIRMED
- `npx playwright test --project=phase51 tests/phase51/site-actions-contract.spec.ts` — 7/7 passed — CONFIRMED
- `npx playwright test --project=phase51` (full project) — 57 passed, 20 skipped (fixme reserved for 51-04..51-06), 0 failed — CONFIRMED
- `npx playwright test --project=phase15-stubs tests/lint/design-tokens.spec.ts tests/lint/no-undefined-css-tokens.spec.ts` — 9/9 passed — CONFIRMED
- `npx playwright test --project=phase26` — 103/103 passed (Konva isolation gate unaffected) — CONFIRMED
- `npx tsc --noEmit` exits 0 — CONFIRMED
- `npx eslint` on all four new/modified source files — 0 errors, 0 warnings — CONFIRMED
