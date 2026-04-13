---
phase: 09-streamlined-file-video-pipeline
plan: "04"
subsystem: admin-ui
tags: [pipeline, realtime, polling, stepper, path-04, path-05, d-04, d-05]
dependency_graph:
  requires:
    - sop_pipeline_runs-table
    - pipeline_run_id-FK-parse_jobs
    - pipeline_run_id-FK-sops
    - pipeline_run_id-FK-video_generation_jobs
  provides:
    - PipelineStepper-component
    - /admin/sops/pipeline/[pipelineId]-route
    - /api/sops/pipeline/[pipelineId]/snapshot-route
    - review-back-to-pipeline-breadcrumb
  affects:
    - src/components/admin/PipelineStepper.tsx
    - src/app/(protected)/admin/sops/pipeline/[pipelineId]/page.tsx
    - src/app/(protected)/admin/sops/pipeline/[pipelineId]/PipelineProgressClient.tsx
    - src/app/api/sops/pipeline/[pipelineId]/snapshot/route.ts
    - src/app/(protected)/admin/sops/[sopId]/review/ReviewClient.tsx
    - src/app/(protected)/admin/sops/[sopId]/review/page.tsx
tech_stack:
  added: []
  patterns:
    - realtime + 5s polling hybrid for status sync
    - server component JWT org scoping via Buffer base64 decode
    - admin client snapshot route bypassing RLS with manual org check
    - Suspense boundary for useSearchParams in App Router client component
key_files:
  created:
    - src/components/admin/PipelineStepper.tsx
    - src/app/(protected)/admin/sops/pipeline/[pipelineId]/page.tsx
    - src/app/(protected)/admin/sops/pipeline/[pipelineId]/PipelineProgressClient.tsx
    - src/app/api/sops/pipeline/[pipelineId]/snapshot/route.ts
  modified:
    - src/app/(protected)/admin/sops/[sopId]/review/ReviewClient.tsx
    - src/app/(protected)/admin/sops/[sopId]/review/page.tsx
decisions:
  - "Snapshot fetch is a thin JSON API route (not an RSC revalidation) — lets the client's realtime + polling loop refresh without triggering full-tree server renders"
  - "Buffer.from(..., 'base64') preferred over atob() for server-side JWT decode — avoids deprecation warnings and is the established pattern in Node runtimes"
  - "ReviewClient wrapped in Suspense at page.tsx — useSearchParams requires a Suspense boundary in Next.js 16 App Router (established pattern from Phase 01 InviteAcceptForm)"
  - "deriveStage() prioritises failure detection first, then sops.status as authoritative source, with parse_jobs.status only as a tiebreaker for the parsing stage"
  - "Polling fallback only activates if receivedRealtimeRef.current is still false at the 5s mark — matches ParseJobStatus pattern exactly, never both firing simultaneously"
metrics:
  completed: "2026-04-13"
  tasks_completed: 3
  files_created: 4
  files_modified: 2
commits:
  - 7f29fba — feat(09-04): add PipelineStepper presentational component
  - 113c119 — feat(09-04): unified pipeline progress page with realtime + polling
  - d600a34 — feat(09-04): add Back to pipeline breadcrumb to ReviewClient
requirements: [PATH-04, PATH-05]
---

# Phase 09 Plan 04: Unified Pipeline Progress Page Summary

**One-liner:** New `/admin/sops/pipeline/[pipelineId]` route renders a 5-stage stepper with realtime + polling and deep-links admins to the review and video panels when human action is required.

## What was built

`PipelineStepper.tsx` is a presentational client component that renders five horizontal stages — Uploading, Parsing, Review, Generating video, Ready — with the Phase 2/6 stepper visual language. The active stage uses `text-brand-yellow font-semibold` + `aria-current="step"`, completed stages are `text-green-400` with `bg-brand-yellow` connectors, pending stages are `text-steel-600`, and an explicit error state renders the failed stage in `text-red-400 font-semibold`. The component accepts a `currentStage` discriminated union and an `errorAtStage` escape hatch.

The new route at `src/app/(protected)/admin/sops/pipeline/[pipelineId]/` is split into a server component (`page.tsx`) that authenticates the user, extracts `organisation_id` from the JWT claims, verifies the pipeline run belongs to the caller's organisation via the admin client, and redirects to `/admin/sops` on any mismatch or missing record. The server pre-fetches the initial snapshot of the four related tables (`sop_pipeline_runs`, `sops`, `parse_jobs`, `video_generation_jobs`) and hands them to the client component.

`PipelineProgressClient.tsx` subscribes to `postgres_changes` on all four tables with filters scoped to the current `pipelineId` (and `pipeline_run_id` for the joined tables). A `receivedRealtimeRef` is flipped on the first realtime callback, and a `setTimeout` arms polling only if no realtime event has fired within 5 seconds — exactly matching the Phase 2-03 ParseJobStatus pattern. The client calls a thin `/api/sops/pipeline/[pipelineId]/snapshot` JSON route for each refresh (both polling and realtime), which performs the same org scoping check the server component does.

The `deriveStage(snapshot)` helper maps raw database state to the 5 stages. Failures are checked first (`parse_jobs.status='failed'` → error/parsing, `video_generation_jobs.status='failed'` → error/generating), then SOP status is the authoritative source for uploading → parsing → review/draft. Once published, `video_generation_jobs.status='ready'` flips to the Ready stage; anything else counts as generating.

Stage bodies:

- **Uploading / Parsing**: blue spinner loader with the Phase 6 copy ("Crunching your SOP…", "Grab a coffee — this can take a few minutes.")
- **Review (paused human gate)**: `bg-brand-orange/20 border-brand-orange/50` panel with a ClipboardCheck icon and a 72px-tall Review SOP now → CTA linking to `/admin/sops/{sopId}/review?from=pipeline&pipelineId={pipelineId}`.
- **Generating video**: blue spinner + current_stage label ("Generating video", "Stage: analyzing"/"rendering"/etc.)
- **Ready**: `bg-green-500/20` panel with CheckCircle icon and a 72px-tall "Preview and publish video →" CTA deep-linking to `/admin/sops/{sopId}/video`.
- **Video failure**: `bg-steel-800` panel with AlertTriangle icon, error message (2-line clamp), and a 72px-tall "Go to video panel" CTA to the existing video page for retry (PATH-05, D-05 reuse of `regenerateVideo`).
- **Parse failure**: inline alert with error message and a text link to the review page to retry.

`ReviewClient.tsx` gains a small additive breadcrumb: it reads `useSearchParams`, and if `from=pipeline` + `pipelineId` are present, renders a `← Back to pipeline` link in `text-brand-yellow text-sm font-medium hover:text-amber-400` above the existing sticky header. `page.tsx` now wraps ReviewClient in a `<Suspense fallback={null}>` boundary because `useSearchParams` requires one in the Next.js 16 App Router (established from Phase 01 `InviteAcceptForm`).

## Why it matters

This plan closes PATH-04 (unified progress surface) and PATH-05 (video failure recovery) — the only net-new UI surface in Phase 09. Until now, admins had to mentally juggle the upload page, parse job status, review page, and video panel as four disconnected tabs. One URL now presents all five stages as one continuous pipeline, auto-updates via realtime, and hands the admin back to the existing review/video pages exactly when their decision is required. Everything plans 01–03 built is now reachable through a single progress page, and failure recovery loops back into the existing `regenerateVideo` path without reinventing retry UI.

## Verification

**TypeScript:** `npx tsc --noEmit` exits 0 against the full tree after each commit.

**ESLint:** All four new files pass clean. Pre-existing ReviewClient issues (`react-hooks/set-state-in-effect` error + unused imports) are out of scope for this plan and logged in `deferred-items.md`.

**Acceptance greps:**

```
grep -c "role=\"group\"|aria-label=\"Pipeline stages\"|aria-current=\"step\"|bg-brand-yellow|text-brand-yellow" src/components/admin/PipelineStepper.tsx → 6 (≥5)
grep -c "postgres_changes|setInterval|Review SOP now|Preview and publish video|Go to video panel" src/app/(protected)/admin/sops/pipeline/[pipelineId]/PipelineProgressClient.tsx → 9 (≥5)
grep -c "Back to pipeline|fromPipeline|useSearchParams" src/app/(protected)/admin/sops/[sopId]/review/ReviewClient.tsx → 6 (≥3)
```

**Runtime verification (deferred to manual UAT):**
- Visit `/admin/sops/pipeline/{own-org-pipelineId}` → page renders with stepper and the correct stage panel for current state.
- Visit a pipelineId from another org → redirected to `/admin/sops`.
- Review CTA → lands on `/admin/sops/[sopId]/review?from=pipeline&pipelineId=...` with the breadcrumb visible.
- After publish, progress page auto-updates to generating → ready.
- Force a video failure → page shows failure panel with "Go to video panel" CTA.

## Deviations from Plan

### Minor, in-scope tweaks

**1. [Rule 3 - Blocking] Column name: `requested_video_format` not `video_format`**
- **Found during:** Task 2 page.tsx implementation
- **Issue:** Plan source showed both `requested_video_format` (in `<interfaces>` block) and `video_format` (in 09-01 SUMMARY.md narrative). Database types confirm `requested_video_format` is the actual column name per migration 00016.
- **Fix:** Used `requested_video_format` in the server component SELECT and in the `pipelineRun.requested_video_format` prop assignment.
- **Files modified:** `src/app/(protected)/admin/sops/pipeline/[pipelineId]/page.tsx`
- **Commit:** 113c119

**2. [Rule 2 - Missing critical functionality] Suspense boundary for useSearchParams**
- **Found during:** Task 3 typecheck / Next.js App Router requirement
- **Issue:** `useSearchParams` in a client component that's rendered from an async server page throws in Next.js 16 unless wrapped in a Suspense boundary.
- **Fix:** Added `<Suspense fallback={null}>` wrapper in `review/page.tsx` around the ReviewClient rendering. Mirrors the Phase 01 InviteAcceptForm pattern.
- **Files modified:** `src/app/(protected)/admin/sops/[sopId]/review/page.tsx`
- **Commit:** d600a34

**3. [Rule 2 - Missing critical functionality] Server-side JWT decode via Buffer**
- **Found during:** Task 2 page.tsx implementation
- **Issue:** Plan snippet used `atob()` for JWT payload decoding, but `atob` on Node 20+ prints deprecation warnings and can fail on padding edge cases. The established pattern in Phase 08 `generate-video/route.ts` also uses `JSON.parse(atob(...))` so there's a codebase inconsistency to pick.
- **Fix:** Used `Buffer.from(token, 'base64').toString('utf-8')` in both the server page and the snapshot route. Future refactor could consolidate the JWT helper, but out of scope.
- **Files modified:** `src/app/(protected)/admin/sops/pipeline/[pipelineId]/page.tsx`, `src/app/api/sops/pipeline/[pipelineId]/snapshot/route.ts`
- **Commit:** 113c119

## Deferred Issues (out of scope)

Logged to `.planning/phases/09-streamlined-file-video-pipeline/deferred-items.md`:

- ReviewClient.tsx pre-existing ESLint error: `react-hooks/set-state-in-effect` at line 43 (Phase 02-03 legacy).
- ReviewClient.tsx pre-existing unused imports: `MoreVertical`, `menuOpen`, `setMenuOpen`.

These are not introduced or reproduced by this plan. They pre-date it and are out of scope for 09-04's purpose (add pipeline breadcrumb).

## Known Stubs

None — all new UI components render live data from the realtime snapshot. No hardcoded empty arrays, placeholder text, or unwired props.

## Threat Flags

None — all three trust boundaries declared in the plan's `<threat_model>` are mitigated:

- **T-09-04-01, T-09-04-05 (Info disclosure / Spoofing via pipelineId):** Both the server page and the snapshot API route verify `pipelineRun.organisation_id === JWT organisation_id` before returning data. Mismatch triggers `redirect('/admin/sops')` or HTTP 404.
- **T-09-04-02 (Realtime leak):** `postgres_changes` subscriptions are filtered by `id=eq.{pipelineId}` and `pipeline_run_id=eq.{pipelineId}`. RLS on the three source tables (Phase 09-01) enforces org isolation at Postgres regardless of client filter.
- **T-09-04-03 (Signed video URL exposure):** Progress page never embeds `video_url` — it only deep-links to the existing video panel, which is the sole UI surface that renders signed URLs.

No new security-relevant surface was introduced beyond what 09-01 already registered. The snapshot API route is a read-only wrapper around existing RLS-safe tables with an explicit admin-client-with-manual-org-check pattern consistent with Phase 02-01 and 05-01.

## Self-Check: PASSED

**Files created:**
- FOUND: src/components/admin/PipelineStepper.tsx
- FOUND: src/app/(protected)/admin/sops/pipeline/[pipelineId]/page.tsx
- FOUND: src/app/(protected)/admin/sops/pipeline/[pipelineId]/PipelineProgressClient.tsx
- FOUND: src/app/api/sops/pipeline/[pipelineId]/snapshot/route.ts

**Files modified:**
- FOUND: src/app/(protected)/admin/sops/[sopId]/review/ReviewClient.tsx (useSearchParams + breadcrumb)
- FOUND: src/app/(protected)/admin/sops/[sopId]/review/page.tsx (Suspense wrapper)

**Commits in git log:**
- FOUND: 7f29fba — feat(09-04): add PipelineStepper presentational component
- FOUND: 113c119 — feat(09-04): unified pipeline progress page with realtime + polling
- FOUND: d600a34 — feat(09-04): add Back to pipeline breadcrumb to ReviewClient
