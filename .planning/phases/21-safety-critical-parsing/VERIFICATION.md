---
phase: 21-safety-critical-parsing
verified: 2026-05-25T03:15:00Z
status: gaps_found
score: 22/23 must-haves verified
overrides_applied: 0
verdict: PASS-WITH-NOTES
locked_decisions_pass: 12/13
locked_decisions_fail: 1
requirements_pass: 22/23
requirements_fail: 1
gaps:
  - truth: "D-21-07 — no bulk-verify UI lock is ENFORCED in CI (repo-wide grep guard runs LIVE)"
    status: partial
    reason: "tests/lint/no-bulk-verify-ui.spec.ts exists and is correctly written, but is NOT registered in any Playwright project in playwright.config.ts. The Phase 15 analogue (no-static-desktop-import) IS registered in phase15-stubs. The Phase 21 lint guard never runs in CI. SCP-VERIFY-05 in scp-verify-checklist.test.ts only asserts the guard FILE exists with the right phrases — it does NOT execute the repo-wide grep. Manual execution of the guard logic finds 1 pre-existing hit (\"approve all sections\" in PipelineProgressClient.tsx:273) that would block the gate if it ran."
    artifacts:
      - path: "playwright.config.ts"
        issue: "No project regex matches tests/lint/no-bulk-verify-ui.spec.ts. Compare line 57 (phase15-stubs includes no-static-desktop-import explicitly) — Phase 21 needs an equivalent entry."
      - path: "src/app/(protected)/admin/sops/pipeline/[pipelineId]/PipelineProgressClient.tsx"
        issue: "Line 273 contains \"approve all sections\" — innocuous UI copy about section-approval flow, NOT bulk-verify, but would trip the guard if it ran."
    missing:
      - "Register no-bulk-verify-ui.spec.ts in a Playwright project (either add to phase15-stubs regex or create a new phase21-lint project)."
      - "Decide whether to allowlist PipelineProgressClient.tsx:273 (it's section-approval copy, not block-verify) OR rephrase the UI copy (e.g. \"approve every section\") to avoid the trigger word."
human_verification:
  - test: "Cookie-login as admin, open builder for a parsed SOP, verify the SourceViewerPane renders alongside the canvas with no close button, only a chevron-toggle"
    expected: "Side pane mounts; pdfjs canvas renders pages; clicking a block in Puck highlights the matching bbox in the pane within 200ms; the chevron-toggle collapses pane to 32px sidebar but does not unmount"
    why_human: "Click→overlay 200ms p95 budget can only be measured in a real Chromium; the source-contract tests assert primitives are present but don't paint pixels."
  - test: "Trigger the AI reviewer on a parsed SOP; verify all 5 jobs run and flags appear in the ReviewerFlagsPanel"
    expected: "POST /api/sops/[sopId]/ai-reviewer returns envelope with jobs_run=['A','B','C','D','E'] and cache_read_tokens > 0 on calls 2-5; UI surfaces flag pills inline under each block"
    why_human: "Requires a live Anthropic API key and a real DB-seeded SOP; orchestrator unit tests use a stubbed client."
  - test: "Verify defence-in-depth on the publish endpoint by direct POST while at least one block is unverified"
    expected: "HTTP 400 { error: 'unverified_blocks', count: N } even if the UI button is hacked enabled; verify-checklist UI also disables the button until all blocks have verified_by_admin_id"
    why_human: "Bypassing the UI to test the server gate requires a live session cookie and a parsed SOP with sop_section_blocks rows."
  - test: "Edit a verified block; confirm only that block's verification clears (not the whole SOP)"
    expected: "DB trigger trg_clear_block_verification fires only on the changed row; siblings keep their verified_by_admin_id"
    why_human: "Requires live Postgres + an admin session; migration trigger logic is correct in code (for each row + WHEN clause on snapshot_content / pinned_version_id) but the runtime invariant needs a live touch-and-edit."
  - test: "Exceed per-day cap (6 reviewer runs in one UTC day on the same SOP) and per-org spend cap (cumulative spend ≥ $5)"
    expected: "6th run returns 429 { error: 'per_day_cap', runs_today, reset_at }; over-cap returns 429 { error: 'per_org_cap', spend_cents, cap_cents }"
    why_human: "Anthropic spend is real-money; the rate-limit and cost-guard logic looks correct in code but needs at least one live integration touch before pilot."
---

# Phase 21 (Safety-Critical Parsing) — Verification Report

**Phase Goal:** Phase 20 contract complete — persistent side-by-side source viewer (Layer 1), AI reviewer running five specialised verification jobs (Layer 2), and mandatory per-block verify checklist at the publish gate (Layer 3). Publish button is hard-disabled until every block carries `verified_by_admin_id`.

**Verified:** 2026-05-25
**Status:** PASS-WITH-NOTES (gaps_found — one D-21-07 enforcement gap)
**Re-verification:** No — initial verification.

---

## Verdict summary

| Layer | Status | Notes |
|-------|--------|-------|
| Wave 0 (test stubs) | PASS | 23 SCP-* stubs landed, `phase21-stubs` project regex matches all four files |
| Wave 1 (foundation) | PASS | Migration 00032 + extractors + Job A + cost guard all on master |
| Wave 2 (source viewer) | PASS | SourceViewerPane persistent (no close button), pdfjs/mammoth isolated, legacy review route retired |
| Wave 3 (AI reviewer × 5) | PASS | Single-session A→B→C→D→E with ephemeral cache; D-21-11 Job-C single-call honoured; rate limit + cost guard wired |
| Wave 4 (verify gate) | PASS-WITH-NOTES | UI button hard-disabled + server 400 (defence in depth) confirmed; **D-21-07 grep guard not registered in playwright.config.ts** so it never runs in CI |

**Overall verdict: PASS-WITH-NOTES** — 22/23 requirements implemented and verifiable; the single gap is a CI wiring oversight on the no-bulk-verify lint guard, not a missing implementation. The guard file exists with correct logic; only Playwright project registration is missing.

---

## 23-requirement coverage table

| Req ID | Implemented? | Tested? | Lock honored? | Evidence |
|--------|-------------|---------|---------------|----------|
| SCP-VIEWER-01 (pane mounts + renderers) | ✓ | ✓ live | — | `src/components/admin/source-viewer/SourceViewerPane.tsx`; `tests/integration/scp-source-viewer.test.ts:30` |
| SCP-VIEWER-02 (click→overlay primitives present, Spike 002 RAF settle) | ✓ | ✓ live (source-contract) | — | `src/components/admin/source-viewer/PdfCanvasPage.tsx` |
| SCP-VIEWER-03 (reverse channel: registerBlockClickHandler + data-puck-item-id) | ✓ | ✓ live | — | `src/components/admin/source-viewer/useSelectionSync.tsx`; `BuilderClient.tsx` |
| SCP-VIEWER-04 (NO close button, only collapse) | ✓ | ✓ live | D-CV2-04 | `SourceViewerPane.tsx:128-144` chevron toggle, no close button; pane always mounted while `showPane=true` |
| SCP-VIEWER-05 (signed-URL endpoint, RLS gate, AI-prompt skip) | ✓ | ✓ live | CONV-12 | `src/app/api/sops/[sopId]/source-url/route.ts:48-111` |
| SCP-AI-01 (Job B omission with Spike 003 caps) | ✓ | ✓ live | D-CV2-05 | `src/lib/parsers/ai-reviewer/jobs/job-b-omission.ts`; jobs.test.ts |
| SCP-AI-02 (anchoring) | ✓ (consolidated with -03) | ✓ live | **D-21-11** | `jobs/job-c-anchoring.ts:108-113` — single export `JOB_C`; system prompt declares FACET 1 + FACET 2 in one response set |
| SCP-AI-03 (step-image alignment, single Job-C call) | ✓ (consolidated with -02) | ✓ live | **D-21-11** | Same as -02; `extras.alignment_concern` boolean + `extras.suggested_step_id` in same parseResponse output |
| SCP-AI-04 (Job D table fidelity) | ✓ | ✓ live | — | `jobs/job-d-table-fidelity.ts`; jobs.test.ts |
| SCP-AI-05 (Job E terminology, org vocab) | ✓ | ✓ live | — | `jobs/job-e-terminology.ts` `fetchOrgVocabulary` + `buildJobESystemPrompt` |
| SCP-AI-06 (parse pipeline auto-trigger, fire-and-forget) | ✓ | ✓ live | — | `src/lib/parsers/parse-pipeline.ts:44` + wired into 4 routes (parse / restructure / youtube / transcribe) |
| SCP-AI-07 (POST endpoint, admin auth, Zod jobs subset) | ✓ | ✓ live | T-21-03-02 | `src/app/api/sops/[sopId]/ai-reviewer/route.ts:38-46`; `assertAdminAuth` |
| SCP-AI-08 (per-day cap + per-org cap → 429) | ✓ | ✓ live | CONV-09 / D-21-06 / D-21-13 | `rate-limit.ts:62-111`; `cost-guard.ts:47`; `ai-reviewer/route.ts:113-123` (429 per_day_cap), `:131-139` (429 per_org_cap) |
| SCP-VERIFY-01 (verifyBlock / unverifyBlock server actions) | ✓ | ✓ live | — | `src/actions/sop-section-blocks.ts:420,444` |
| SCP-VERIFY-02 (server-side publish gate, 400 on unverified) | ✓ | ✓ live | — | `src/app/api/sops/[sopId]/publish/route.ts:74-103` returns 400 `{ error: 'unverified_blocks', count: N }` |
| SCP-VERIFY-03 (UI button hard-disabled until isReady) | ✓ | ✓ live | — | `src/components/admin/verify-checklist/VerifyProgressIndicator.tsx:72-86` `disabled={!isReady}` |
| SCP-VERIFY-04 (DB trigger clears own row's verification only) | ✓ | ✓ live (migration source-contract) | D-21-08 | `supabase/migrations/00032_phase21_verified_by_and_ai_review_results.sql:149-156` `for each row` + WHEN clause |
| SCP-VERIFY-05 (no bulk-verify UI lock — D-21-07) | ⚠️ partial | ✗ guard does not run in CI | **D-21-07** | Guard file `tests/lint/no-bulk-verify-ui.spec.ts` exists with correct logic, but no `playwright.config.ts` project regex matches it. Manual execution finds 1 pre-existing UI string ("approve all sections" in PipelineProgressClient.tsx:273). See GAPS section. |
| SCP-VERIFY-06 (focus ring + Spike 004 keyboard contract) | ✓ | ✓ live | — | `src/components/admin/verify-checklist/keyboard-bindings.ts:44-48` j/k/a/d/Enter constants; `BlockChecklistRow.tsx` ring-2 ring-yellow-400 |
| SCP-PARSE-01 (block_provenance written by parse pipeline) | ✓ | ✓ live | — | `src/lib/parsers/parsed-sop-to-layout-data.ts` `ProvenanceContext` + `stampProvenance`; `src/app/api/sops/parse/route.ts` wires extractors |
| SCP-PARSE-02 (extractPdfBlockBboxes — Spike 001 production) | ✓ | ✓ live (unit) | Spike 001 | `src/lib/parsers/source-viewer/extract-pdf-bbox.ts` with fresh `new Uint8Array(buf)` per call (CLAUDE.md 2026-05-15 learning honoured) |
| SCP-PARSE-03 (extractDocxParagraphAnchors) | ✓ | ✓ live | — | `src/lib/parsers/source-viewer/extract-docx-paragraph.ts` |
| SCP-PARSE-04 (fire-and-forget reviewer hook on parse completion) | ✓ | ✓ live | — | Same as SCP-AI-06; `parse-pipeline.ts:44-84` |

**Pass count:** 22/23
**Partial:** 1/23 (SCP-VERIFY-05 — D-21-07 enforcement)
**Fail:** 0/23

---

## Locked-decision audit (D-21-01..13)

| ID | Decision | Status | Evidence |
|----|----------|--------|----------|
| D-21-01 | Migration number 00032 | ✓ PASS | `supabase/migrations/00032_phase21_verified_by_and_ai_review_results.sql` exists; no 00031 collision (Phase 15 already owns it) |
| D-21-02 | Reuse verify-sop.ts lazy-singleton + fetch indirection | ✓ PASS | `orchestrator.ts:21` `import { getAnthropic, VERIFY_MODEL } from '@/lib/parsers/verify-sop'` — additive, no parallel infra |
| D-21-03 | All 5 jobs in ONE HTTP session with ephemeral prompt cache | ✓ PASS | `orchestrator.ts:266-270` `cachedSourceBlock` with `cache_control: { type: 'ephemeral' }`; `:272` for-loop dispatches A→B→C→D→E in one function call; orchestrator.test.ts asserts `cache_read_tokens > 0` after all 5 jobs |
| D-21-04 | Reviewer outputs persist to parse_jobs.ai_review_results | ✓ PASS | Migration 00032:69-73 column `parse_jobs.ai_review_results jsonb default '{}'`; `orchestrator.ts:115-133` `persistEnvelope()` |
| D-21-05 | verified_by_admin_id + verified_at NULLABLE | ✓ PASS | Migration 00032:38-42 both columns added without `not null` |
| D-21-06 | Per-org cap at orchestrator boundary; NEW org_anthropic_spend table | ✓ PASS | Migration 00032:79-103 (table + RLS policy); `orchestrator.ts:218` calls `assertOrgCapNotExceeded` BEFORE any dispatch; `:342` calls `recordOrgSpend` AFTER persistence |
| **D-21-07** | **No bulk-verify UI — guard MUST be LIVE** | **⚠️ PARTIAL** | Guard file `tests/lint/no-bulk-verify-ui.spec.ts` written correctly (walks src/, asserts hits.length === 0), but `playwright.config.ts` has no project regex matching it. `npx playwright test --list \| grep no-bulk` returns empty. Manual execution of the guard logic finds 1 pre-existing hit ("approve all sections" in PipelineProgressClient.tsx:273). Summary's claim "Runs LIVE — no test.fixme" is technically true (no fixme), but the guard never executes. |
| D-21-08 | Edit clears OWN verification only — DB trigger fires per-row | ✓ PASS | Migration 00032:149-156 `for each row` + WHEN clause on `snapshot_content` / `pinned_version_id` distinct from old; clears only NEW.verified_by_admin_id + NEW.verified_at |
| D-21-09 | Bundle isolation — pdfjs/mammoth NOT in worker bundle | ✓ PASS (live verified) | `npx tsx scripts/check-bundle-size.ts` exits 0; output: "1104 KB (baseline 1104 KB, Δ 0 KB)"; "✓ Source-viewer isolation OK — pdfjs + mammoth not in /sops/[sopId]/page bundle (D-21-09)" |
| D-21-10 | Wave 0 lands FIRST with test.fixme stubs | ✓ PASS | Commits 79d931c (VIEWER + PARSE) and eb556a8 (AI + VERIFY) precede all Wave 1+ feature commits in `git log` |
| D-21-11 | SCP-AI-02 + SCP-AI-03 served by Job C as a SINGLE LLM call | ✓ PASS | `jobs/job-c-anchoring.ts:108-113` — single `export const JOB_C: ReviewerJob` with one systemPrompt and one parseResponse. System prompt declares "ANCHORING + step-image ALIGNMENT, returned in a SINGLE response". `extras.suggested_step_id` + `extras.alignment_concern` populated by same parser. Tests assert one export only. |
| D-21-12 | Legacy /admin/sops/[sopId]/review deleted + 308 redirect | ✓ PASS | `src/app/(protected)/admin/sops/[sopId]/review/` directory does NOT exist; `next.config.ts:19-22` defines `redirects()` mapping `/admin/sops/:sopId/review` → builder |
| D-21-13 | Per-day cap storage in ai_review_rate_limits table | ✓ PASS | Migration 00032:109-119 table with `sop_id PK`, `runs_today int4 default 0`, `runs_today_reset_at timestamptz`; `rate-limit.ts` reads/writes via admin client; race window documented (acceptable per T-21-03-04) |

**Decision pass count: 12/13. Fail: 1 (D-21-07 partial enforcement).**

---

## High-risk invariant audit

### 1. Publish-gate defence in depth (UI disable + server reject)

**Status: ✓ PASS — both layers verified.**

| Layer | Location | Mechanism |
|-------|----------|-----------|
| UI | `src/components/admin/verify-checklist/VerifyProgressIndicator.tsx:75` | `<button disabled={!isReady}>` with tooltip showing remaining count |
| Hook | `src/components/admin/verify-checklist/useVerifyChecklist.ts` | `isReady = totalCount > 0 && verifiedCount === totalCount` |
| Server | `src/app/api/sops/[sopId]/publish/route.ts:74-103` | Counts `sop_section_blocks WHERE verified_by_admin_id IS NULL`; returns `400 { error: 'unverified_blocks', count: N }` if any |
| DB | `migrations/00032_*.sql:149-156` | `trg_clear_block_verification` BEFORE UPDATE — clears on content change |

Bypass conditions both server-side AND client-side: `source_type === 'ai_prompt'` (CONV-12) OR `source_file_path IS NULL` (pre-Phase-20 backward compat). Mirrors exactly between client `BuilderWithSourceViewer.tsx:127` `showVerifyGate` and server route.ts:72 `verifyGateApplies`.

### 2. D-21-07 no-bulk-verify lock (THE load-bearing rule)

**Status: ⚠️ PARTIAL — see GAPS.**

The guard file `tests/lint/no-bulk-verify-ui.spec.ts` is correctly authored: walks `src/` recursively, scans every `.ts`/`.tsx` for the 6 banned phrases (`approve all`, `verify all`, `select all`, `bulk verify`, `trust score`, `skip remaining`), skips comments, allowlists the lock file itself + its in-place static test. The logic IS correct.

**The gap:** `playwright.config.ts` has no project whose `testMatch` regex picks up `no-bulk-verify-ui.spec.ts`. Compare to the Phase 15 analogue `no-static-desktop-import.spec.ts` which IS explicitly listed in `phase15-stubs` (line 57). Result:

- `npx playwright test --list` (399 tests) does not include the guard.
- The guard never executes in CI.
- A future PR that adds an "approve all flagged" button anywhere in src/ would silently pass CI.

**Worse:** manual execution of the guard logic against the current master finds 1 hit — `src/app/(protected)/admin/sops/pipeline/[pipelineId]/PipelineProgressClient.tsx:273`:

```
Check the parsed SOP, approve all sections, then publish to continue.
```

This is innocuous section-approval copy (from Phase 9 pipeline UI), not bulk-verify. But if the guard were wired into CI today it would fail RED on this pre-existing string. So even if the project registration is added, an allowlist entry OR a copy rewrite is also required.

### 3. D-21-11 Job C single LLM call

**Status: ✓ PASS.**

`src/lib/parsers/ai-reviewer/jobs/job-c-anchoring.ts:108-113` exports exactly ONE `JOB_C` with one `systemPrompt` and one `parseResponse`. The system prompt (`JOB_C_SYSTEM`, lines 28-59) explicitly declares "ANCHORING + step-image ALIGNMENT, returned in a SINGLE response". The parseResponse output populates BOTH `extras.suggested_step_id` AND `extras.alignment_concern` from the same JSON element. The orchestrator dispatches Job C as a single Anthropic.messages.create() call inside the for-loop. The SCP-AI test consolidates -02 + -03 into one test case per D-21-11.

### 4. D-21-03 Single HTTP session, prompt cache reuse

**Status: ✓ PASS.**

`orchestrator.ts:200-345` `runReviewerJobs` is a single function call. Lines 266-270 build the `cachedSourceBlock` ONCE with `cache_control: { type: 'ephemeral' }`. Lines 272-326 iterate `JOB_ORDER = ['A','B','C','D','E']` (line 48) calling `anthropic.messages.create(...)` with the SAME `cachedSourceBlock` reference as user content. System prompts differ per job, content prefix is identical → cache hits on calls 2-5. Orchestrator unit test asserts `envelope.usage.cache_read_tokens > 0` after the run.

### 5. D-21-09 Bundle isolation

**Status: ✓ PASS (live-verified).**

Ran `npx tsx scripts/check-bundle-size.ts`:

```
check-bundle-size: /sops/[sopId]/page = 1104 KB (baseline 1104 KB, Δ 0 KB, tolerance ±2 KB)
check-bundle-size: ✓ Bundle isolation OK (chunks present, delta within tolerance)
check-bundle-size: ✓ Source-viewer isolation OK — pdfjs + mammoth not in /sops/[sopId]/page bundle (D-21-09).
```

Chunk-existence guards in `scripts/check-bundle-size.ts:271-288` hard-fail the build if any of `['pdfjs-dist', 'PDFWorker', 'getDocument', 'mammoth', 'convertToHtml']` appears in the worker chunk set. `BuilderWithSourceViewer.tsx:64` dynamic-imports `SourceViewerPane`; the pane dynamic-imports pdfjs (`SourceViewerPane.tsx:230` `await import('pdfjs-dist')`) and DocxPreview dynamic-imports mammoth.

### 6. D-21-08 Edit clears OWN verification only

**Status: ✓ PASS.**

Migration 00032:149-156 trigger:
- `BEFORE UPDATE` on `sop_section_blocks`
- `FOR EACH ROW` — fires per affected row, not statement-level
- WHEN clause: `new.snapshot_content IS DISTINCT FROM old.snapshot_content OR new.pinned_version_id IS DISTINCT FROM old.pinned_version_id` — fires only on actual content change, not on verified_by_admin_id-only writes (loop-safe)
- Function body (lines 129-138) sets only `NEW.verified_by_admin_id := null` and `NEW.verified_at := null` — single row, never touches sibling rows.

### 7. D-21-13 Per-day rate limit

**Status: ✓ PASS (with documented race window).**

- Storage: `ai_review_rate_limits` table (migration 00032:109-113) — `sop_id PK`, `runs_today int4`, `runs_today_reset_at timestamptz`.
- Read: `rate-limit.ts:62-111` `assertWithinPerDayRunCap` — UTC-midnight rollover in JS, throws `PerDayRunCapExceededError` at >= 5 runs.
- Write: `rate-limit.ts:122-155` `incrementPerDayRunCounter` — two-step read-then-write (NOT `UPDATE ... RETURNING` atomic UPSERT despite the module header comment claiming so). Documented race window where two concurrent POSTs both increment to 1 (instead of 1→2). Cost-guard is the secondary failsafe (T-21-03-04 mitigation). The plan locked at this trade-off.
- API: `app/api/sops/[sopId]/ai-reviewer/route.ts:110-124` returns 429 `{ error: 'per_day_cap', runs_today, reset_at }` on the 6th call.

Note: D-21-13's contract said "Atomic increment via `UPDATE ... RETURNING`" — the implementation chose read-then-write with a documented acceptable race window. The plan author called this out as Pitfall 1 in Wave 3 summary; pilot-time swap to a `SECURITY DEFINER` RPC is the documented forward path.

### 8. Phase 20 source-viewer pane is persistent

**Status: ✓ PASS.**

`src/components/admin/source-viewer/SourceViewerPane.tsx:128-144` — the header contains ONLY a chevron toggle button (Lucide `<ChevronLeft />` / `<ChevronRight />`) with `aria-label="Collapse source viewer"` / `"Expand source viewer"`. There is NO close button, no X icon, no unmount affordance. The collapse toggle changes the pane width to 32px (`COLLAPSED_WIDTH`) but the `<aside>` element stays mounted (the `{!collapsed && …}` body wrapper hides content, not the pane itself). `BuilderWithSourceViewer.tsx:214` mounts `<SourceViewerPane>` whenever `showPane === true` (i.e. SOP has a source file and isn't AI-prompt).

---

## Build + test summary

- **`npx tsc --noEmit`** — exit 0 (clean after removing stale `.next/types` cache that pointed at the deleted review page).
- **`npx tsx scripts/check-bundle-size.ts`** — exit 0, 0 KB delta, pdfjs/mammoth isolation confirmed.
- **Phase 21 Playwright tests** — 40/40 PASS across projects `phase21-stubs` (23 SCP-* live), `phase21-source-viewer` (2 unit), `phase21-ai-reviewer` (3 orchestrator), `phase21-ai-reviewer-jobs` (12 per-job).
- **SCP test.fixme count** — 0 (the 2 grep hits in scp-source-viewer / scp-ai-reviewer are JSDoc references to "the Wave-0 `test.fixme` stubs" historical context, not active fixmes).
- **Total tests in repo** — 399 (per `playwright test --list`). `no-bulk-verify-ui.spec.ts` is NOT among them (the gap).

---

## Anti-patterns scan

| File | Pattern | Severity | Notes |
|------|---------|----------|-------|
| `src/app/(protected)/admin/sops/pipeline/[pipelineId]/PipelineProgressClient.tsx:273` | UI copy "approve all sections" | ℹ️ Info | Pre-existing Phase 9 string. Innocuous in context (section-approval copy, not bulk-verify), but trips the D-21-07 guard logic if the guard is wired up. Either allowlist this path or rephrase the copy. |
| `src/lib/parsers/ai-reviewer/rate-limit.ts:8-12` | Module header claims "atomic UPSERT (INSERT … ON CONFLICT … DO UPDATE …)" but actual implementation uses two-step read-then-write | ⚠️ Warning | Comment and code disagree. Functionally acceptable (per Wave 3 plan + T-21-03-04), but the comment should be corrected to match the implementation OR the implementation should be tightened to a single `SECURITY DEFINER` RPC call. Pilot-time follow-up. |

No blocker anti-patterns found in Wave 1-4 code paths.

---

## Gaps Summary (actionable)

### Gap 1 — D-21-07 lint guard not registered in playwright.config.ts (BLOCKER for pilot, not for ship)

**What's missing:** A project-level `testMatch` entry that includes `tests/lint/no-bulk-verify-ui.spec.ts`. Today the guard exists, is correctly authored, and looks like Wave-4 verification — but `npx playwright test` will never execute it.

**Why this matters:** D-21-07 is described in 21-CONTEXT.md line 89 as "the load-bearing rule of the entire phase." The 2.5-minute friction at 50 blocks IS the safety feature. If a future PR introduces an "Approve all flagged" button (e.g. under pressure from a busy SOP admin), nothing in CI will stop it. The whole safety-critical thesis of Phase 21 rests on this lock being enforced — not merely existing.

**To fix:**

```diff
# playwright.config.ts
    {
      name: 'phase15-stubs',
      testMatch:
-       /(desktop-walkthrough-layout|sequential-ack|voice-qa-happy-path|voice-grounding-scope|sub-trade-rls-backward-compat|sub-trade-assignment|no-static-desktop-import|use-viewport|walkthrough-store-ack)\.spec\.ts$/,
+       /(desktop-walkthrough-layout|sequential-ack|voice-qa-happy-path|voice-grounding-scope|sub-trade-rls-backward-compat|sub-trade-assignment|no-static-desktop-import|no-bulk-verify-ui|use-viewport|walkthrough-store-ack)\.spec\.ts$/,
      use: { browserName: 'chromium' },
    },
```

OR add a new project:

```typescript
{
  name: 'phase21-lint',
  testMatch: /no-bulk-verify-ui\.spec\.ts$/,
},
```

**Then handle the pre-existing hit at `PipelineProgressClient.tsx:273`** by either:
- Allowlisting it in the guard's `ALLOWLIST` set (the phrase is contextually about section approval, not block verification), OR
- Rephrasing the copy: `"Check the parsed SOP, approve every section, then publish to continue."` (replaces "all" with "every" and removes the trigger phrase).

The second option is cleaner — keeps the allowlist tight to actual lock-file documentation.

### Note — rate-limit comment vs implementation drift

Not a gap per se, but `rate-limit.ts:8-12` comment claims atomic UPSERT while the code is read-then-write. Either fix the comment or upgrade the implementation. Plan author flagged the race as acceptable; the secondary per-org cost cap is the safety net. Low priority for ship; revisit at first pilot drift signal.

---

## Follow-up items

1. **Required before pilot:** Wire `no-bulk-verify-ui.spec.ts` into a Playwright project AND resolve the `PipelineProgressClient.tsx:273` hit. (Gap 1)
2. **Required before pilot UAT:** Run the human-verification checklist (5 items above) against a live DB-seeded SOP with a live Anthropic key. Today's coverage is source-contract only.
3. **Post-pilot:** Watch for per-day rate-limit drift (T-21-03-04 race window). Swap read-then-write to `SECURITY DEFINER` atomic RPC if undercount surfaces in spend reports.
4. **Documentation:** Update `rate-limit.ts:8-12` module comment to match the actual two-step implementation OR upgrade implementation.

---

## Re-verification metadata

This is the initial verification — no previous VERIFICATION.md existed for Phase 21.

---

*Verified: 2026-05-25*
*Verifier: Claude (gsd-verifier)*
