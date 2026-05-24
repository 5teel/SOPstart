---
phase: 21-safety-critical-parsing
plan: 01
subsystem: ai-reviewer + verify-gate + source-provenance
tags: [migration, server-action, pdfjs, anthropic, cost-guard, foundation]
dependency-graph:
  requires:
    - Phase 13 sop_section_blocks junction (00019)
    - Phase 6 verify-sop.ts (ADVERSARIAL_SYSTEM prompt, getAnthropic singleton)
    - Phase 15 fetch indirection on Anthropic SDK (preserved)
    - Phase 20 extract-docx-structural.ts (commit 7b9151e structural anchor)
    - Spike 001 (PDF image extraction bundle-safe — VALIDATED 2026-05-15)
    - Spike 003 (AI reviewer prompt-cache reuse — VALIDATED 2026-05-15)
  provides:
    - "DB columns sop_section_blocks.{verified_by_admin_id, verified_at, block_provenance}"
    - "DB column parse_jobs.ai_review_results (jsonb)"
    - "DB tables org_anthropic_spend, ai_review_rate_limits"
    - "Server actions verifyBlock(blockId), unverifyBlock(blockId)"
    - "extractPdfBlockBboxes(buf, pageNum) — Spike 001 production-ised"
    - "extractDocxParagraphAnchors(buf) — paragraph-id anchors"
    - "runReviewerJobs(parseJobId, jobs[]) — single-HTTP-session orchestrator"
    - "assertOrgCapNotExceeded(orgId), recordOrgSpend(orgId, usd)"
    - "Zod schemas BlockProvenanceSchema, BlockProvenanceRecordSchema, SourceProvenanceRegionSchema"
    - "TS types SourceProvenanceRegion, ExtractedSourceBlock, ReviewerJobId, ReviewerFlag, ReviewerRunEnvelope"
    - "Exception classes OrgSpendCapExceededError, NotImplementedError"
  affects:
    - Wave 2 (source-viewer UI) consumes extract*BlockBboxes
    - Wave 3 (Jobs B/C/D/E) plugs into JOB_REGISTRY in orchestrator.ts
    - Wave 4 (publish gate) reads verified_by_admin_id on every block
tech-stack:
  added: []
  patterns:
    - "Lazy-Anthropic-singleton with fetch indirection (Phase 15 preserved)"
    - "Single-HTTP-session multi-job dispatch with ephemeral prompt cache (Spike 003)"
    - "Atomic UPSERT for spend ledger (composite PK on org+month)"
    - "DB trigger WHEN clause for loop prevention"
    - "Hand-edited database.types.ts (no supabase CLI in env)"
key-files:
  created:
    - supabase/migrations/00032_phase21_verified_by_and_ai_review_results.sql
    - src/lib/parsers/source-viewer/types.ts
    - src/lib/parsers/source-viewer/extract-pdf-bbox.ts
    - src/lib/parsers/source-viewer/extract-docx-paragraph.ts
    - src/lib/parsers/source-viewer/index.ts
    - src/lib/parsers/source-viewer/__tests__/extract-pdf-bbox.test.ts
    - src/lib/parsers/ai-reviewer/types.ts
    - src/lib/parsers/ai-reviewer/cost-guard.ts
    - src/lib/parsers/ai-reviewer/jobs/types.ts
    - src/lib/parsers/ai-reviewer/jobs/job-a-hallucination.ts
    - src/lib/parsers/ai-reviewer/orchestrator.ts
    - src/lib/parsers/ai-reviewer/index.ts
    - src/lib/parsers/ai-reviewer/__tests__/orchestrator.test.ts
  modified:
    - src/types/database.types.ts          # new columns + 2 new tables (hand-edited)
    - src/lib/validators/sop.ts            # BlockProvenance/Record + SourceProvenanceRegion schemas
    - src/actions/sop-section-blocks.ts    # verifyBlock + unverifyBlock added
    - src/lib/parsers/verify-sop.ts        # export getAnthropic + 3 constants for reviewer reuse
    - playwright.config.ts                  # +phase21-source-viewer +phase21-ai-reviewer projects
decisions:
  - "Did NOT use `npx supabase gen types` — hand-edited types per env constraint; same pattern as Phase 15"
  - "Job B/C/D/E are stubbed via a single makeStubJob() factory rather than 4 stub files — keeps Wave 3 diff small (one file per job to add)"
  - "JOB_ORDER constant locks canonical A→B→C→D→E independent of caller input order — Spike 003 finding #1"
  - "recordOrgSpend uses read-then-upsert rather than SQL atomic increment — accepts microsecond race window; documented in cost-guard.ts header. Wave 3 / pilot can swap in a SECURITY DEFINER RPC if drift surfaces"
  - "Trigger fires on snapshot_content + pinned_version_id changes (the actual content columns; plan's mention of 'content_snapshot' was a generic reference)"
metrics:
  duration: "~19 minutes (executor wall time)"
  completed-date: 2026-05-24
  tasks-completed: 3
  files-created: 13
  files-modified: 5
  tests-added: 5
---

# Phase 21 Plan 01: Safety-Critical Parsing Foundation Summary

**One-liner:** Schema + server actions + source-viewer extraction + AI-reviewer orchestrator skeleton — every Wave 2/3/4 consumer now has a stable interface to build against.

## Migration 00032 — columns, indexes, tables, trigger

| Object | Type | Notes |
|--------|------|-------|
| `sop_section_blocks.verified_by_admin_id` | uuid, nullable, FK auth.users(id) ON DELETE SET NULL | Sparse partial index `idx_sop_section_blocks_verified` for verified-only lookups |
| `sop_section_blocks.verified_at` | timestamptz, nullable | Paired with verified_by_admin_id |
| `sop_section_blocks.block_provenance` | jsonb, nullable | D-CV2-06 ship — finally on master |
| `parse_jobs.ai_review_results` | jsonb, NOT NULL default `'{}'::jsonb` | ReviewerRunEnvelope persists here |
| `org_anthropic_spend` | NEW table | PK `(organisation_id, month_start)`; `cap_cents` per-org override; RLS read-only to platform admins |
| `ai_review_rate_limits` | NEW table | PK `sop_id`; service-role-only access (no policies) |
| `clear_block_verification_on_content_change()` | plpgsql trigger function | Clears verification columns on content mutation |
| `trg_clear_block_verification` | BEFORE UPDATE trigger | WHEN clause filters on `snapshot_content` + `pinned_version_id` changes only — loop-safe |

DOWN block included as SQL comments (matches 00026 / 00028 convention).

## Reviewer Orchestrator — public surface

```typescript
// src/lib/parsers/ai-reviewer/index.ts
export { runReviewerJobs } from './orchestrator'
export { assertOrgCapNotExceeded, recordOrgSpend } from './cost-guard'
export { NotImplementedError, OrgSpendCapExceededError } from './types'

// orchestrator.ts
export async function runReviewerJobs(
  parseJobId: string,
  jobs: ReviewerJobId[],
): Promise<ReviewerRunEnvelope>
```

- Single HTTP session per parse — `cache_control: { type: 'ephemeral' }` on shared source-content block
- Canonical execution order: A → B → C → D → E (Spike 003 finding #1)
- Jobs B/C/D/E are `NotImplementedError` stubs — orchestrator catches and produces a partial envelope with `job_status[X] === 'not_implemented'`
- Cost guard called BEFORE any dispatch; no dispatch + no spend record on cap-exhausted

## Source-Viewer Extractor — public surface

```typescript
// src/lib/parsers/source-viewer/index.ts
export type { SourceProvenanceRegion, ExtractedSourceBlock } from './types'
export { extractPdfBlockBboxes } from './extract-pdf-bbox'
export { extractDocxParagraphAnchors } from './extract-docx-paragraph'

// extract-pdf-bbox.ts
export async function extractPdfBlockBboxes(
  buf: Buffer,
  pageNum: number,
): Promise<ExtractedSourceBlock[]>
```

- `paintImageMaskXObject` ops are SKIPPED (Spike 001 finding #3)
- Fresh `new Uint8Array(buf)` per call (Spike 001 gotcha — comment inlined verbatim from CLAUDE.md learning 2026-05-15)
- bbox is rotation-invariant via min/max over 4 CTM-transformed corners
- DOCX wrapper does NOT modify `extract-docx-structural.ts` — wraps it

## Cost Guard

- Env var: `ANTHROPIC_PER_ORG_MONTHLY_CAP_USD`
- Default: $5.00 → 500 cents per D-21-06
- Per-org override: `org_anthropic_spend.cap_cents` (NULL falls through to env var)
- Throws `OrgSpendCapExceededError(orgId, spendCents, capCents)` when `spend >= cap`

## Phase 6 verify-sop.ts changes

| Symbol | Before | After |
|--------|--------|-------|
| `getAnthropic()` | private | exported |
| `PROMPT_VERIFY_SYSTEM` | private const | exported const |
| `ADVERSARIAL_SYSTEM` | private const | exported const |
| `VERIFY_MODEL` | private const | exported const |

All existing call sites (transcript / prompt / voice_qa) work unchanged — pure additive export refactor.

## Tests

| Project | File | Test count | Result |
|---------|------|------------|--------|
| `phase21-source-viewer` | `extract-pdf-bbox.test.ts` | 2 | ✅ pass (>= 37 bboxes; no DataCloneError on consecutive calls) |
| `phase21-ai-reviewer` | `orchestrator.test.ts` | 3 | ✅ pass (cache_create_tokens reported; stubs surface as `not_implemented`; cap-exceeded blocks dispatch) |
| `phase20-parsers` | (12 existing) | 12 | ✅ pass (no regression) |

## Commits

| Hash | Subject |
|------|---------|
| `5256862` | `feat(phase-21-01): migration 00032 + verifyBlock/unverifyBlock actions` |
| `bbeee10` | `feat(phase-21-01): source-viewer extraction module (Spike 001 prod)` |
| `259b60e` | `feat(phase-21-01): AI-reviewer orchestrator + Job A + cost guard` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] Plan referenced `content_snapshot`; actual column is `snapshot_content`**
- **Found during:** Task 1 migration drafting
- **Issue:** The plan's `<action>` step described the trigger's WHEN clause as watching `content_snapshot`. The real column on `sop_section_blocks` is `snapshot_content` (migration 00019 line 158). Using the plan's name would have silently produced a trigger that NEVER fires.
- **Fix:** Used `snapshot_content` + `pinned_version_id` in the WHEN clause. Noted in migration header comment.
- **Commit:** `5256862`

**2. [Rule 2 - Missing] Added foreign-key relationship entry for verified_by_admin_id in database.types.ts**
- **Found during:** Task 1 type updates
- **Issue:** Without the relationship entry, Supabase JS's typed joins from `sop_section_blocks` → `auth.users` would silently fail to resolve.
- **Fix:** Added `sop_section_blocks_verified_by_admin_id_fkey` Relationships entry pointing to `users`.
- **Commit:** `5256862`

**3. [Rule 3 - Blocker] `@/` path alias unavailable at Playwright's `require()` runtime**
- **Found during:** Task 3 orchestrator test execution
- **Issue:** First test pass attempted `require('@/lib/parsers/...')` for the module-swap pattern. Playwright doesn't resolve the `@/` ts-path alias at runtime — `Cannot find module`.
- **Fix:** Built an absolute `MODULE_PATHS` lookup table resolved via `__dirname + pathResolve`. Tests pass.
- **Commit:** `259b60e`

**4. [Rule 3 - Blocker] orchestrator test required evicting BOTH `orchestrator` AND `cost-guard` from require.cache**
- **Found during:** Task 3 orchestrator test (cap-exceeded variant)
- **Issue:** Swapping the supabase admin client only worked for the first require; the cost-guard module had already cached its own reference to `createAdminClient`, ignoring the swap on subsequent test runs.
- **Fix:** `evictOrchestrator()` now deletes both modules from require.cache before each test re-imports.
- **Commit:** `259b60e`

**5. [Rule 1 - Bug] Test 1 cost rounded to 0 cents → spendUpsert not called**
- **Found during:** Task 3 first test run
- **Issue:** Small token counts produced fractional-dollar cost; `Math.round(usd * 100)` rounded to 0 cents; `recordOrgSpend` early-returns on `cents === 0`, so the assertion `spendUpserts.length === 1` failed.
- **Fix:** Bumped test usage values to 1000 input + 5000 output tokens so cost rounds to ≥ 1 cent.
- **Commit:** `259b60e`

### Authentication gates

None — Task 1/2/3 were all build-time/test-time work. No Anthropic-API live calls in the test path (all mocked). Manual smoke against a real Anthropic key is documented in the plan's `<verification>` block and is deferred to integration-test time.

## Threat Flags

None — no NEW security surface introduced beyond what the plan's `<threat_model>` already covers (T-21-01-01 through T-21-01-07 are all mitigated as planned).

## Self-Check: PASSED

Verified all files exist and all commits are reachable:

```
[FILES]
FOUND: supabase/migrations/00032_phase21_verified_by_and_ai_review_results.sql
FOUND: src/lib/parsers/source-viewer/types.ts
FOUND: src/lib/parsers/source-viewer/extract-pdf-bbox.ts
FOUND: src/lib/parsers/source-viewer/extract-docx-paragraph.ts
FOUND: src/lib/parsers/source-viewer/index.ts
FOUND: src/lib/parsers/source-viewer/__tests__/extract-pdf-bbox.test.ts
FOUND: src/lib/parsers/ai-reviewer/types.ts
FOUND: src/lib/parsers/ai-reviewer/cost-guard.ts
FOUND: src/lib/parsers/ai-reviewer/jobs/types.ts
FOUND: src/lib/parsers/ai-reviewer/jobs/job-a-hallucination.ts
FOUND: src/lib/parsers/ai-reviewer/orchestrator.ts
FOUND: src/lib/parsers/ai-reviewer/index.ts
FOUND: src/lib/parsers/ai-reviewer/__tests__/orchestrator.test.ts

[COMMITS]
FOUND: 5256862 (migration 00032 + verifyBlock/unverifyBlock)
FOUND: bbeee10 (source-viewer extraction module)
FOUND: 259b60e (AI-reviewer orchestrator + Job A + cost guard)

[VERIFICATION]
- tsc --noEmit: clean
- eslint on Plan 21-01 files only: clean (0 errors, 0 new warnings)
- phase21-source-viewer tests: 2/2 passing
- phase21-ai-reviewer tests: 3/3 passing
- phase20-parsers tests: 12/12 still passing (no regression)
```
