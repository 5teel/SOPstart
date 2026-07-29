---
phase: 40-shared-creation-foundation
plan: 12
subsystem: security / SOP creation pipeline API routes
tags: [auth, org-scoping, rls-bypass-guard, gap-closure, DUP-01]
dependency-graph:
  requires: [src/lib/auth/session-context.ts, src/lib/auth/guards.ts, src/lib/supabase/admin.ts]
  provides: [session+org guard on /api/sops/parse, /api/sops/transcribe, /api/sops/restructure]
  affects: [src/app/api/sops/ai-prompt/route.ts]
tech-stack:
  added: []
  patterns: ["getSessionContext() + admin/safety_manager role check + session-org comparison ahead of every admin-client op"]
key-files:
  created:
    - tests/phase40/route-auth-org-scope.spec.ts
  modified:
    - src/app/api/sops/parse/route.ts
    - src/app/api/sops/transcribe/route.ts
    - src/app/api/sops/restructure/route.ts
    - src/app/api/sops/ai-prompt/route.ts
decisions:
  - "Org mismatch returns 404 (never 403) so the endpoint never confirms the existence of another org's SOP"
  - "Downstream org usage in all three routes reads the session organisationId directly (never re-derived from the fetched sops row) — closes the CLAUDE.md 2026-07-28 CR-01 class"
  - "Admin-client route census scoped to route.ts files only (not every file importing createAdminClient) — the test's own name is 'route census'; a shared helper like [sopId]/ai-reviewer/rate-limit.ts is exercised only via its owning route"
metrics:
  duration: "~35 min"
  completed: "2026-07-29"
---

# Phase 40 Plan 12: Session + Org Guard on Parse/Transcribe/Restructure/AI-Prompt Routes Summary

Closed 40-REVIEW.md CR-02: `/api/sops/parse`, `/api/sops/transcribe` and `/api/sops/restructure` took `sopId` from the request body and ran destructive `createAdminClient()` (RLS-bypass) operations — including two hard deletes in `parse/route.ts` — with zero auth, role, or org check, reachable by any authenticated user including workers.

## What Was Built

### Task 1 — Session + role + session-org guard on three routes, Zod validation on a fourth

Confirmed caller inventory before editing (`grep -rn "api/sops/parse\|api/sops/transcribe\|api/sops/restructure" src/`): all callers are browser fetches from authenticated admin surfaces — `UploadDropzone.tsx`, `VideoFormatSelectionModal.tsx`, `VideoPreviewPanel.tsx`, `ParseJobStatus.tsx`, `versions/page.tsx`, `src/actions/versioning.ts`, `src/lib/upload/start-video-sop-upload.ts`, `src/actions/sops.ts`. No server-to-server or cron caller exists, and none of the three paths is exempted in `src/lib/supabase/middleware.ts`'s cookie-less allow-list — confirmed a session-cookie guard breaks nothing.

Added to each of `parse/route.ts`, `transcribe/route.ts`, `restructure/route.ts`, immediately after the `sopId` presence check and before `createAdminClient()`/any admin-client call:
1. `getSessionContext()` → 401 if no `userId`
2. Role check (`admin` / `safety_manager`) → 403 if absent
3. `organisationId` presence → 403 if absent
4. Admin-client fetch of `sops.organisation_id` for the target `sopId`, compared against the **session** `organisationId` → 404 (not 403) on mismatch or missing row

In `parse/route.ts` the guard sits before the `sop_images`/`sop_sections` deletes and before the `parse_jobs` status update. In `transcribe`/`restructure` it sits before the first `parse_jobs`/`sops` status update and before any model call.

Downstream, each route previously re-fetched `sops.organisation_id` a second time for use in image uploads / `materializeJunctionsForLayout` — all three now use the session `organisationId` directly (CLAUDE.md [2026-07-28] CR-01 rule: never feed an org predicate a value derived from a client-supplied id). `parse/route.ts`'s second `sops` select is narrowed to just `source_file_name` (still needed for the title-guard fallback); `transcribe`/`restructure` dropped their now-redundant second `sops` select entirely.

`ai-prompt/route.ts` (WR-03): `departmentIds`/`allDepartments` previously read via `Array.isArray(body.departmentIds)` off the raw body. Replaced with a local Zod schema (`z.array(z.string().uuid()).max(20)` + `z.boolean()`), `safeParse`'d against the same body, 400 on failure. `src/lib/validators/sop.ts` (owned by plan 40-10 in this wave) was left untouched, per plan instruction; folding these two fields into `aiPromptSchema` proper is a one-line follow-up once that plan lands.

### Task 2 — Positional spec + admin-client route census

New `tests/phase40/route-auth-org-scope.spec.ts`, discovered automatically under the existing broad `phase40` `testMatch` (verified: `npx playwright test --list --project=phase40 | grep route-auth-org-scope` — 4 tests listed).

- **Guard presence** (per route): `getSessionContext(`, both `'admin'` and `'safety_manager'` role-check literals, an `!== organisationId` comparison, and a negative assertion that no comparison pits two row-derived values against each other (regex `\w+\.organisation_id\s*!==\s*\w+\.\w+`, which would catch a `sopOrg.organisation_id !== sop.organisation_id` style mistake but does not match our actual `sopOrg.organisation_id !== organisationId`).
- **Positional**: searches only inside each file's `POST` handler body (`indexInPost` helper) rather than the whole file — `transcribe/route.ts` defines an `updateStage` helper *before* `POST` whose own body legitimately contains `.update(`; a whole-file `indexOf` would have found that literal and produced a false "guard precedes it" pass/fail regardless of the real ordering inside `POST`. Confirms `parse/route.ts`'s guard index precedes both the `sop_images` and `sop_sections` delete indices; confirms `transcribe`/`restructure`'s guard index precedes the first `.update(` inside `POST`.
- **ai-prompt Zod fix**: asserts `Array.isArray(body.departmentIds)` is gone and `z.array(z.string().uuid())` + `safeParse(body)` are present.
- **Admin-client route census**: walks `src/app/api/sops/**/route.ts` for `createAdminClient` usage, asserts the discovered set equals a pinned, classified `ADMIN_CLIENT_ROUTES` array (12 entries: `session+org` for `ai-prompt`, `youtube`, `generate-video`, `parse`, `transcribe`, `restructure`, `pipeline/[pipelineId]/snapshot`, `recover-renders`, `[sopId]/ai-reviewer`; `machine-secret` for `generate-video/callback` and `generate-video/finalize`; `session-client-write, admin used only for storage cleanup of an RLS-verified row` for `[sopId]/route.ts`). A new `route.ts` reaching for `createAdminClient` fails this test until classified.

**Manual verification of the positional test's teeth (per acceptance criteria):** temporarily moved `parse/route.ts`'s guard block below the `sop_images`/`sop_sections` deletes via the Edit tool, re-ran the positional test in isolation — it failed with `Error: parse/route.ts: sop_images delete (index 3202) precedes the guard (index 4097)`. Restored the file via `git checkout --` (the committed guarded version), re-ran the full `phase40` project — 52 passed, 1 fixme-skipped, 0 failures. Neither the temporary move nor the restore was committed as a separate step; the committed state is the correctly-guarded version from Task 1.

## Verification

- `npx tsc --noEmit` — clean
- `npm run build` — clean, bundle gate unchanged (`/sops/[sopId]/page` = 1059 KB, Δ0 KB)
- `npx playwright test --project=phase40 --reporter=line` — 52 passed, 1 skipped (pre-existing `test.fixme`), 0 failed
- `npx playwright test --list --project=phase40 | grep route-auth-org-scope` — 4 tests discovered

## Deviations from Plan

None — plan executed as written. The only judgment call was scoping the admin-client census walk to files named `route.ts` (not every file importing `createAdminClient`, which would also have picked up `src/app/api/sops/[sopId]/ai-reviewer/rate-limit.ts`, a shared helper module exercised only via its owning route) — consistent with the plan's own read_first inventory of 12 route.ts entries and the test's name ("admin-client **route** census").

## Known Stubs

None introduced by this plan.

## Threat Flags

None — this plan closes existing threat-register items (T-40-12-01..06 in the plan's own `<threat_model>`); it introduces no new trust boundary.

## Self-Check: PASSED

- FOUND: `src/app/api/sops/parse/route.ts` (modified, guard present)
- FOUND: `src/app/api/sops/transcribe/route.ts` (modified, guard present)
- FOUND: `src/app/api/sops/restructure/route.ts` (modified, guard present)
- FOUND: `src/app/api/sops/ai-prompt/route.ts` (modified, Zod dept-field validation present)
- FOUND: `tests/phase40/route-auth-org-scope.spec.ts` (created)
- FOUND commit `aeeea40`: fix(40-12): session+org guard on parse/transcribe/restructure, validate ai-prompt dept fields
- FOUND commit `8242ba9`: test(40-12): pin session+org guard positionally + census admin-client routes
