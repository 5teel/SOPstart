# Codebase Concerns

**Analysis Date:** 2026-06-01

## Tech Debt

### Incomplete AI Reviewer Jobs (Wave 3 Stubs)

**Area:** AI-powered parsing review pipeline

- Issue: Jobs B (omission), C (anchoring), D (table fidelity), and E (terminology) are stubbed as `NotImplementedError`. They exist as placeholders but throw when invoked.
- Files: `src/lib/parsers/ai-reviewer/jobs/job-b-omission.ts`, `job-c-anchoring.ts`, `job-d-table-fidelity.ts`, `job-e-terminology.ts`, `src/lib/parsers/ai-reviewer/types.ts` (line 6-9, 77, 80-84), `src/lib/parsers/ai-reviewer/orchestrator.ts`
- Impact: Phase 21 Wave 3 cannot proceed until these jobs are implemented. Reviewers fail silently if requested; envelope surfaces `NotImplementedError` in job_status. Tests mock these with stubs (`orchestrator.test.ts` lines 7, 25, 190).
- Fix approach: Implement each job as a separate Claude Opus task, following Job A (hallucination) as the template. Each job needs its own system prompt, cost tracking via `recordOrgSpend()`, and rate-limit checks. Jobs B-E require their own RPC calls or SQL logic in the database.

### Incomplete SignoffContent Component (Phase 12)

**Area:** SOP section rendering

- Issue: `SignoffContent` is not yet dedicated; currently reuses `DefaultContent` as placeholder.
- Files: `src/components/sop/SectionContent.tsx` (line 170)
- Impact: Sign-off sections (e.g., supervisor approval workflows) render identically to default narrative sections. No visual distinction or role-specific UI.
- Fix approach: Create `src/components/sop/content/SignoffContent.tsx` with role-aware UI (show sign-off button for supervisors only, lock for workers). Gate behind org role check.

### Cost-Guard UPSERT Race Condition

**Area:** Org Anthropic spend tracking

- Issue: `recordOrgSpend()` in `src/lib/parsers/ai-reviewer/cost-guard.ts` (lines 99-134) uses a two-step read-then-upsert pattern. Between the SELECT and UPSERT, a concurrent caller may INSERT the same (organisation_id, month_start) row, causing the second caller's upsert to replace (not increment) the spend total.
- Files: `src/lib/parsers/ai-reviewer/cost-guard.ts` (lines 99-134)
- Impact: Under high concurrency (multiple reviewers running simultaneously on the same SOP), spend undercount is possible. The asserts-before-dispatch gate in `assertOrgCapNotExceeded()` mitigates by pre-checking, but the final recorded spend may be off by the cost of concurrent runs.
- Fix approach: Replace the two-step pattern with an atomic SQL `SECURITY DEFINER` RPC: `atomic_increment_anthropic_spend(orgId, cents)` that UPSERTs and increments in a single transaction. Or pin the call path to never allow concurrent reviewer runs on the same org (queue in the orchestrator). Notes in cost-guard.ts lines 105-107 already flag this as Wave 3 / Plan 21-03 work.

## Known Bugs

### PDF Image Extraction Requires Fresh Uint8Array Per Call

**Bug description:** Reusing the same `Uint8Array` view across successive `unpdf.extractImages()` calls crashes with `DataCloneError: Cannot transfer object of unsupported type` at `LoopbackPort.postMessage`.

- Symptoms: PDF parsing with image extraction fails on second/subsequent calls to `extractImages()` or when calling both `getDocumentProxy()` and `extractImages()` on the same buffer.
- Files: `src/lib/parsers/extract-pdf.ts`, any caller looping over pages (e.g., source-viewer image extraction)
- Trigger: Parse a multi-page PDF twice, or call `getDocumentProxy()` then `extractImages()` on the same input.
- Workaround: Already applied in Phase 20 Spike 001 — construct a fresh `new Uint8Array(buf)` inside the per-page loop. See `.planning/spikes/001-pdf-image-extraction-bundle-safe/README.md`.

### Windows Next.js 16 `.next` File-Lock Races

**Bug description:** On Windows 11, `next dev --webpack` intermittently emits `UNKNOWN: open '.next/dev/static/chunks/app/layout.js'` (errno -4094 / UV_UNKNOWN) after small edits or rapid navigation, returning 500s to the browser.

- Symptoms: Browser receives 500 errors sporadically during development; the same request works minutes later. Cleaning `.next` helps temporarily.
- Files: Build system (Next.js, not user code).
- Trigger: Local development on Windows 11; rapid navigation or frequent file changes trigger the race.
- Workaround: During UAT, use `npm run build && npm run start` (production mode, no HMR chunks). No hot reload but stable. Root cause is likely antivirus file-lock race on `.next/dev`. This is documented in CLAUDE.md learnings.

### Router.push on Search-Param Changes Triggers RSC Fetch

**Bug description:** In Next.js App Router, `router.push('?step=X', { scroll: false })` triggers an RSC payload fetch even though only the search param changed. The Serwist service worker intercepts that fetch, adding latency.

- Symptoms: Phase 15 walkthrough "I've done this — Next" button felt unresponsive on sopstart.com. User perceived slow click→next-step transition despite no backend delay.
- Files: `src/app/(protected)/sops/[sopId]/walkthrough/` (any use of `router.push` with search-param-only URL changes)
- Trigger: Rapid step-to-step navigation in the walkthrough with `router.push('?step=...')`.
- Workaround: Already applied (commit `3b541b6`) — drive frequently-changing step state from `useState` (seeded from `useSearchParams()` on mount), then sync URL via `window.history.replaceState` as a side-effect in useEffect. No fetch, instant UI. Watch `searchParams.toString()` so external nav (back/forward, deep-link) still syncs local state.

### RLS Recursion Between sops and sops_sub_trades (FIXED)

**Bug description:** Phase 15 migration 00030 created two policies that recursed through each other: `sops.sops_visible_by_sub_trade` checked `not exists (… from sops_sub_trades)` AND `sops_sub_trades.sops_sub_trades_read_for_org` checked `exists (… from sops)`. Postgres detected infinite recursion (`42P17`) and returned 500 on ANY query touching `sops`.

- Symptoms: All SOP queries (even unrelated joins) failed 500 immediately after migration 00030 deployed.
- Files: `supabase/migrations/00031_fix_sops_sub_trades_rls_recursion.sql` (the fix)
- Impact: Site-wide outage during Phase 15.
- Status: FIXED in migration 00031 — dropped the recursive policy and replaced it with `using (true)` on sops_sub_trades since junction-table tags are non-sensitive metadata.

## Security Considerations

### Service-Role Admin Client Exposure

**Area:** Elevated database access

- Risk: `src/lib/supabase/admin.ts` creates an admin (service-role) client that bypasses all RLS policies. If misused, it grants full database access without org/user scoping.
- Files: `src/lib/supabase/admin.ts`, uses in `src/app/api/sops/parse/route.ts` (line 42), `src/lib/parsers/image-uploader.ts` (line 21), `src/lib/parsers/ai-reviewer/cost-guard.ts` (line 50), and server actions in `src/actions/`.
- Current mitigation: Admin client is only instantiated in server-side code (API routes and server actions). No exposure to browser. Calls are gated by route auth middleware (`src/lib/supabase/middleware.ts`).
- Recommendations: 
  1. Audit all uses of `createAdminClient()` to ensure they enforce org-scoping manually (e.g., in `src/app/api/sops/parse/route.ts`, verify the sopId belongs to the authenticated user's org before proceeding).
  2. Consider wrapping admin operations in helper functions that add an organisation_id filter (e.g., `adminSelectSop(sopId, orgId)`).
  3. Add a comment block near each admin-client call explaining why RLS bypass is safe (org-scoped check upstream).

### Image Upload Without Content-Type Validation

**Area:** File upload parsing

- Risk: `src/lib/parsers/image-uploader.ts` (line 25) assumes `image.contentType` is either `image/png` or `image/jpg` without validating. If a malformed or non-image blob is uploaded, the extension defaults to `jpg`.
- Files: `src/lib/parsers/image-uploader.ts` (lines 14-55)
- Current mitigation: Content-type comes from `extract-docx.ts` or `extract-pdf.ts` which validate MIME types during parsing. However, the uploader does not re-validate.
- Recommendations:
  1. Add a MIME type whitelist check in `uploadExtractedImages()` before constructing the path.
  2. Consider using `file-type` library to sniff the actual file contents as a second check.
  3. Log a warning if the content-type is unexpected.

### JWT Claim Extraction Without Error Handling

**Area:** Auth token parsing

- Risk: `src/lib/offline/voice-queue.ts` (lines 58-65) decodes the JWT manually without try-catch for base64url or JSON parse errors. If the token is malformed, `atob()` or `JSON.parse()` will throw uncaught.
- Files: `src/lib/offline/voice-queue.ts` (lines 58-65)
- Current mitigation: The token comes from `session.access_token` which is set by Supabase; token format is under Supabase's contract. However, manual decode is fragile.
- Recommendations:
  1. Wrap the JWT decode in try-catch and throw a descriptive error (e.g., `invalid_token_format`).
  2. Consider using a JWT library (e.g., `jsonwebtoken`) instead of manual atob/parse.
  3. Add a fallback if claim extraction fails, or require the org ID to be passed explicitly from the Supabase session.

## Performance Bottlenecks

### Large Components (1000+ LOC)

**Slow operation:** Component render cycles / state mutations

- Problem: `src/lib/builder/puck-config.tsx` (1061 LOC) is a monolithic Puck editor configuration. Large render trees or frequent re-renders may cause jank.
- Files: `src/lib/builder/puck-config.tsx` (1061 lines)
- Cause: All block-type definitions, validators, and field configs are collocated in a single file. Every block mutation triggers a re-render of the config object.
- Improvement path: 
  1. Extract block definitions into separate `src/lib/builder/blocks/*.ts` files (one per block type).
  2. Memoize block definitions to prevent re-renders on parent state changes.
  3. Consider lazy-loading block configs (load only the types needed for the current section).

### Dexie Transaction Overhead in Offline Sync

**Slow operation:** `flushCompletions()` and `syncAssignedSops()` use multiple Dexie transactions

- Problem: `src/lib/offline/sync-engine.ts` wraps related Dexie operations in transactions (lines 66-76, 104-122, 128-139). Multiple sequential transactions add latency, especially on slow devices.
- Files: `src/lib/offline/sync-engine.ts` (lines 160-220, 229-291, 310-359)
- Cause: Each flush operation (photos, completions, drafts) opens its own transaction scope. No batching across flushes.
- Improvement path:
  1. Consolidate the orphan-removal logic (lines 62-78 and 124-139 are identical) into a single helper called once per sync.
  2. Consider combining photo + completion flushes into a single umbrella transaction if the operations don't conflict.
  3. Profile actual sync times on a low-end device to quantify whether the overhead matters; may be premature optimization.

### AI Parsing Triage + Dual-Model Route

**Slow operation:** Every parse calls Haiku for complexity triage before routing to Haiku or Sonnet

- Problem: `src/lib/parsers/gpt-parser.ts` (lines 230-241) always makes two Anthropic API calls: (1) Haiku triage, (2) Haiku or Sonnet parse. For simple documents, the first call is overhead.
- Files: `src/lib/parsers/gpt-parser.ts` (lines 208-298)
- Cause: Triage ensures cost-effective routing (simple → cheaper Haiku, complex → more capable Sonnet). But the triage call itself costs money and adds ~0.5s latency.
- Improvement path:
  1. Cache triage results by document hash so repeated parses of the same source skip triage.
  2. Allow admins to pre-specify complexity in the UI (`detailLevel` param already exists; add `forceModel: 'haiku' | 'sonnet'`).
  3. For small files (< 1000 chars), always use Haiku without triage.

## Fragile Areas

### Magic-Link Session Install for UAT

**Component/Module:** Auth flow during Playwright tests

- Files: `CLAUDE.md` learnings (line 113)
- Why fragile: `sb.auth.admin.generateLink({type:'magiclink'})` returns a hash-fragment token that `@supabase/ssr` doesn't auto-exchange. Playwright UAT against a local dev server requires manually constructing a session cookie with base64-encoded JWT structure. The cookie format is not documented and may change with Supabase SDK updates.
- Safe modification: Only touch auth session setup in Playwright specs if Supabase's SDK breaks the pattern. Log the exact base64 format in a test fixture so future maintainers know the contract.
- Test coverage: `tests/integration/` and `tests/e2e/` rely on this pattern. Any Supabase SDK bump should include re-verification of the magic-link flow.

### Postgres SQL Function Bodies Don't Rename With Tables

**Component/Module:** Database migrations (any that rename a table referenced in SQL functions)

- Files: `supabase/migrations/00026_rename_summit_to_platform.sql`, `00028_fix_is_platform_admin_body.sql` (the fix)
- Why fragile: When renaming a table referenced inside a `LANGUAGE sql` function, the function body keeps the OLD table name as text. `ALTER FUNCTION ... RENAME` does not rewrite function bodies. The function silently breaks at runtime with `42P01 relation does not exist`. RLS policies survive (they resolve via OID), but SQL functions don't.
- Safe modification: After any `ALTER TABLE ... RENAME` involving an object referenced by a SQL function, immediately follow up with `CREATE OR REPLACE FUNCTION` using the new identifiers. Test the RPC end-to-end in a migration test before merging. See CLAUDE.md learning (line 114-115) for the Phase 13 incident.
- Test coverage: Migration tests should call any affected RPCs to verify they still work.

### Offline-First IndexedDB + Service Worker Cache Sync

**Component/Module:** Offline infrastructure (`src/lib/offline/`, `public/sw.ts`)

- Files: `src/lib/offline/sync-engine.ts`, `src/lib/offline/db.ts`, `public/sw.ts`
- Why fragile: When a user is offline, Serwist serves assets from cache, Dexie serves data, and photos/completions are queued locally. When the user reconnects, `flushPhotoQueue()` + `flushCompletions()` must execute in the right order: photos first (to generate storagePaths), then completions (which reference photo storagePaths). If a photo upload fails and is retried later, a completion may reference a storagePath that hasn't been uploaded yet.
- Safe modification: Enforce a strict ordering: (1) flush photos, (2) wait for all photos to resolve (or collect failed IDs), (3) filter completions to exclude those referencing failed photos, (4) flush completions. Current code does not explicitly enforce this order in the reconnect handler. See `src/hooks/useOnlineStatus.ts` to see how flushes are triggered.
- Test coverage: No E2E tests for the offline→online transition with partial photo failures. Add a Playwright test that (a) goes offline, (b) queues a completion with photos, (c) comes back online, (d) simulates one photo upload failure, (e) verifies the completion is not submitted until the photo is retried.

### Section Layout Data Overwrites in Builder (Last-Write-Wins)

**Component/Module:** SOP editing and layout persistence

- Files: `src/lib/offline/sync-engine.ts` (lines 310-359, `flushDraftLayouts`), `src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx` (layout mutations), `src/lib/offline/db.ts` (draftLayouts schema)
- Why fragile: Multiple admins can edit the same SOP section simultaneously. The builder uses a last-write-wins (LWW) reconciliation: if the server's `updated_at` is newer than the client's local row, the client's change is dropped (line 337, `server_newer` case). But there's no conflict resolution — no warning to the client admin that their change was overwritten. A toast appears ("Updated by another admin") but only surfaces the section_id, not the content diff.
- Safe modification: Before allowing multi-admin editing, consider:
  1. Add version vectors or operational-transform-style conflict resolution.
  2. Surface a detailed conflict modal showing both versions and allowing the admin to choose/merge.
  3. Lock sections during edit (optimistic or explicit).
   4. Broadcast updates in real-time via WebSocket so admins know a section is being edited elsewhere.
- Test coverage: No tests for concurrent section-edit conflicts. Add a Playwright test with two browsers editing the same section simultaneously.

## Scaling Limits

### Anthropic Spend Cap Enforcement (Fail-Safe Behavior)

**Resource/System:** API cost control

- Current capacity: Per-org monthly cap is $5.00 USD default (500 cents in `cost-guard.ts` line 22), configurable via `ANTHROPIC_PER_ORG_MONTHLY_CAP_USD` env var.
- Limit: When an org's rolling-month spend reaches the cap, `assertOrgCapNotExceeded()` throws `OrgSpendCapExceededError`.
- Concern: If the cost-guard DB query fails (network error, Supabase down), the code intentionally fails safe by returning without throwing (line 64: `// Fail-safe: do NOT block on infra errors`). This means the cap is NOT enforced during Supabase outages. An attacker (or accidental runaway parse) could incur unbounded cost.
- Scaling path: 
  1. Add a local in-memory rate limit (e.g., max 10 reviewer runs per minute per org) as a secondary guard while the DB is unavailable.
  2. Log failed cap-check attempts so ops can alert on a threshold (e.g., 3 consecutive failures).
  3. Consider a hard per-request cost estimate before dispatch: if estimated cost exceeds remaining monthly budget, refuse upfront.

### Photo Queue Compression and Batch Upload

**Resource/System:** Offline photo storage and upload

- Current capacity: Photos are stored in IndexedDB with client-side compression via `compressPhoto()` (`src/lib/offline/photo-compress.ts`). Target quality is `0.8` JPEG. Each photo is uploaded individually via `flushPhotoQueue()` (no batching).
- Limit: Uploading hundreds of photos one-by-one over a slow connection could take hours. IndexedDB quota on most browsers is 50MB; exceeding it will cause writes to fail silently.
- Scaling path:
  1. Batch uploads: Group photos into bundles of 5-10 and upload in parallel (currently sequential).
  2. Pause and resume: Allow the user to pause/resume a large photo queue instead of forcing a single `flushPhotoQueue()` call to complete.
  3. Monitor IndexedDB quota (use `navigator.storage.estimate()`) and warn the user if nearing limit.
  4. Consider pre-compressing to WebP (smaller than JPEG) if the browser supports it.

## Dependencies at Risk

### Mammoth DOCX Parser Maintenance Risk

**Package:** `mammoth` (DOCX text extraction)

- Risk: `mammoth` is a stable but aging library (last major update ~2021). OOXML spec evolves; newer Word documents with complex tables, embedded charts, or macros may not extract cleanly.
- Impact: DOCX parsing for SOPs could fail silently or produce garbled text on newer Word files. The fallback `extractDocxStructural()` (Phase 20) mitigates by using a different extraction strategy, but if both fail, the user gets "Could not extract meaningful text" error.
- Files: `src/lib/parsers/extract-docx.ts`, `src/lib/parsers/extract-docx-structural.ts`
- Migration plan: 
  1. Monitor mammoth issues on GitHub for compatibility reports.
  2. Consider `docx` (JavaScript implementation) or `docxtemplater` as alternatives if mammoth falls behind.
  3. Add a user-facing upload warning: "Newer Word documents with complex formatting may not extract perfectly; if the parse fails, try saving as PDF."

### Deepgram Voice Transcription API

**Package:** Deepgram REST API (via `src/lib/offline/voice-queue.ts`)

- Risk: Deepgram is a third-party SaaS; if the service goes down or the free tier is terminated, voice transcription halts. No local fallback (tesseract.js was tried for OCR but not audio).
- Impact: Phase 12.5 voice Q&A feature will fail silently if Deepgram is unavailable. Workers will see "Transcription failed" or similar.
- Files: `src/lib/offline/voice-queue.ts`, `src/app/api/voice/token` (Deepgram token grant endpoint, not shown but likely in `src/app/api/`)
- Migration plan:
  1. Add a feature flag to disable voice capture if Deepgram is down.
  2. Implement a local browser-based transcription fallback using `whisper.cpp` or similar if budget allows.
  3. Monitor Deepgram API status and log failures for ops alerting.

## Missing Critical Features

### No Bulk-Edit or Undo/Redo in Builder

**Feature gap:** Section block editing lacks multi-level undo, bulk operations, and content versioning

- Problem: The builder (`BuilderClient.tsx`, `puck-config.tsx`) allows editing individual blocks but offers no:
  - Undo/redo stack (if a user edits 10 blocks then realizes a mistake, they must redo manually).
  - Bulk edit (select multiple blocks and change a common property like font size).
  - Block history/revert (if a block is corrupted, no easy way to revert to a prior snapshot).
- Blocks: `src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx`, `src/lib/builder/puck-config.tsx`
- Workaround: Version control is at the SOP level (migration 00008 `sop_versions`), but not at the block level.
- Recommendation: Implement a block-level change log in Postgres (e.g., `sop_section_block_history` table) and add undo/redo UI to the builder. This aligns with Phase 23 G-01 versioning roadmap.

### No Real-Time Collaboration Signaling

**Feature gap:** No indication to admins when another admin is editing the same SOP

- Problem: The LWW conflict resolution in `flushDraftLayouts()` silently overwrites one admin's changes if another admin saves first. The overwritten admin sees a quiet toast but has no live awareness.
- Blocks: `src/lib/offline/sync-engine.ts`, `src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx`
- Recommendation: Broadcast edit events via WebSocket (or Supabase Realtime) so admins see live cursors, locks, or conflict warnings before a save attempt.

## Test Coverage Gaps

### Offline Sync Edge Cases Not Fully Tested

**Untested area:** Offline→online transitions with partial failures

- What's not tested: 
  - Photo upload failures mid-flush (some succeed, some fail, retry behavior).
  - Completion submission when referenced photos are missing or failed.
  - Dexie transaction rollback on network error.
  - Orphan SOP cleanup (stale local SOPs removed from manifest).
- Files: `src/lib/offline/sync-engine.ts`, `tests/integration/` (check if offline sync tests exist)
- Risk: Users going offline, doing work, coming back online with incomplete data could corrupt their local state or lose work.
- Priority: **HIGH** — offline is a core feature for blue-collar workers on construction sites. Sync reliability is critical.

### API Route Permission Boundaries

**Untested area:** API routes do not verify org ownership before processing requests

- What's not tested: 
  - Can a user from Org A request `/api/sops/[sopId]/publish` for a SOP owned by Org B?
  - Are query parameters (e.g., `?sopId=...`) validated against the authenticated user's org?
- Files: `src/app/api/sops/parse/route.ts`, `src/app/api/sops/[sopId]/ai-reviewer/route.ts`, and other routes in `src/app/api/sops/`
- Risk: Horizontal privilege escalation — a user could access or modify SOPs outside their org.
- Priority: **HIGH** — security boundary. Each API route should verify org membership before proceeding.

### Builder Conflict Resolution Scenarios

**Untested area:** Concurrent edits and LWW conflict resolution

- What's not tested:
  - Two admins edit the same section simultaneously, both save within seconds. Does the second save correctly detect `server_newer`?
  - A section is edited while a reviewer job is running. Does the verification-clear trigger fire correctly?
- Files: `src/lib/offline/sync-engine.ts`, `src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx`, migration 00032 trigger `clear_block_verification_on_content_change`
- Risk: Data corruption or loss under concurrent edit load.
- Priority: **MEDIUM** — concurrent editing is rare, but if it happens, silently losing work is bad.

---

*Concerns audit: 2026-06-01*
