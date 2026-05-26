---
phase: 21-safety-critical-parsing
verified: 2026-05-26T00:00:00Z
status: passed
score: 23/23 must-haves verified (initial gap closed by Plan 21-05; +7 new Plan 21-05 truths all PASS)
overrides_applied: 0
verdict: PASS-WITH-NOTES
locked_decisions_pass: 13/13
locked_decisions_fail: 0
requirements_pass: 23/23
requirements_fail: 0
re_verification:
  previous_status: gaps_found
  previous_score: 22/23
  closure_plan: 21-05
  closure_commits:
    - 97e2679  # migration 00033
    - daf89cb  # BlockContentSchema +7 kinds
    - cd902e0  # addBlockToSection / createBlock parser-context
    - 5a90dce  # materializeJunctionsForLayout + parse-route wiring
    - 0a0fbf0  # picker filters parsed_inline + preview/wizard extensions
    - c39160c  # SCP-PARSE-05/06/07 contract tests
    - 70dee10  # docs(21-05) summary
  gaps_closed:
    - "D-21-07 no-bulk-verify-ui lint guard now registered + green (closed earlier on master in commit f0d2792 prior to 21-05)"
    - "STRUCTURAL: parser path now creates sop_section_blocks junction rows so the publish gate is no longer a 0===0 no-op for parsed SOPs (discovered post-initial-verification during UAT 2026-05-25)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Parse a fresh DOCX end-to-end (requires `npx supabase db push --include-all` first to apply migration 00033), then cookie-login as admin and open the builder. Verify SourceViewerPane mounts alongside the canvas with no close button, only the chevron-toggle, AND that the Wave 4 VerifyChecklistGate now lists ≥1 row per parsed section (no longer empty)."
    expected: "Side pane mounts; pdfjs canvas renders pages; clicking a block in Puck highlights the matching bbox in the pane within 200ms; chevron-toggle collapses pane to 32px sidebar without unmounting. VerifyChecklistGate displays N rows where N = number of materialized junctions; publish button stays disabled until all rows are verified."
    why_human: "Click→overlay 200ms p95 budget and the visual binding between pane and verify gate can only be measured in a real Chromium against a freshly parsed SOP. Now unblocked by Plan 21-05 — junctions exist."
  - test: "Trigger the AI reviewer on a parsed SOP; verify all 5 jobs run, flags appear in the ReviewerFlagsPanel, AND the new props.junctionId mapping correctly resolves flags to junction rows."
    expected: "POST /api/sops/[sopId]/ai-reviewer returns envelope with jobs_run=['A','B','C','D','E'] and cache_read_tokens > 0 on calls 2-5; UI surfaces flag pills inline under each block, mapped via props.junctionId → sop_section_blocks.id."
    why_human: "Requires a live Anthropic API key and a real DB-seeded parsed SOP; orchestrator unit tests use a stubbed client."
  - test: "Verify defence-in-depth on the publish endpoint by direct POST while at least one parser-created junction is unverified"
    expected: "HTTP 400 { error: 'unverified_blocks', count: N } where N matches the count of parser-created junctions. Pre-21-05 this would have returned 200 because count was always 0."
    why_human: "Bypassing the UI to test the server gate requires a live session cookie and a freshly parsed SOP (post-21-05) with sop_section_blocks rows populated."
  - test: "Edit a verified parser-created block in the builder; confirm only that block's verification clears (not siblings, not the whole SOP)."
    expected: "DB trigger trg_clear_block_verification fires only on the changed row; siblings keep their verified_by_admin_id."
    why_human: "Requires live Postgres + an admin session + a parser-created junction. Migration trigger logic is correct in code (for each row + WHEN clause on snapshot_content / pinned_version_id), but the runtime invariant needs a live touch-and-edit. Now unblocked by Plan 21-05 — junctions exist."
  - test: "Exceed per-day cap (6 reviewer runs in one UTC day on the same SOP) and per-org spend cap (cumulative spend ≥ $5)"
    expected: "6th run returns 429 { error: 'per_day_cap', runs_today, reset_at }; over-cap returns 429 { error: 'per_org_cap', spend_cents, cap_cents }"
    why_human: "Anthropic spend is real-money; rate-limit and cost-guard logic look correct in code but need at least one live integration touch before pilot."
---

# Phase 21 (Safety-Critical Parsing) — Verification Report

**Phase Goal:** Phase 20 contract complete — persistent side-by-side source viewer (Layer 1), AI reviewer running five specialised verification jobs (Layer 2), and mandatory per-block verify checklist at the publish gate (Layer 3). Publish button is hard-disabled until every block carries `verified_by_admin_id`.

**Verified:** 2026-05-25 (initial) → 2026-05-26 (re-verified after Plan 21-05 gap closure)
**Status:** PASS-WITH-NOTES (gap closed; 5 UAT items still need a live human run before pilot)
**Re-verification:** Yes — see "Re-verification 2026-05-26" section appended below.

---

## Verdict summary

| Layer | Status | Notes |
|-------|--------|-------|
| Wave 0 (test stubs) | PASS | 23 SCP-* stubs landed, `phase21-stubs` project regex matches all four files |
| Wave 1 (foundation) | PASS | Migration 00032 + extractors + Job A + cost guard all on master |
| Wave 2 (source viewer) | PASS | SourceViewerPane persistent (no close button), pdfjs/mammoth isolated, legacy review route retired |
| Wave 3 (AI reviewer × 5) | PASS | Single-session A→B→C→D→E with ephemeral cache; D-21-11 Job-C single-call honoured; rate limit + cost guard wired |
| Wave 4 (verify gate) | PASS-WITH-NOTES | UI button hard-disabled + server 400 (defence in depth) confirmed; D-21-07 grep guard now registered + green (commit f0d2792 on master) |
| Wave 5 (Plan 21-05 gap closure) | PASS | Parser materializes junctions per Puck item; publish gate is no longer 0===0 for parsed SOPs; legacy-SOP limit honestly documented |

**Overall verdict: PASS-WITH-NOTES** — all 23 original requirements + 7 new 21-05 must-haves verified; only the 5 human-UAT items remain (now unblocked by junction materialization).

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
| SCP-VERIFY-05 (no bulk-verify UI lock — D-21-07) | ✓ (closed) | ✓ live (1/1 PASS in phase15-stubs) | **D-21-07** | Guard `tests/lint/no-bulk-verify-ui.spec.ts` now registered in `playwright.config.ts` (commit f0d2792 on master); copy hit in PipelineProgressClient.tsx:273 rephrased in same commit. |
| SCP-VERIFY-06 (focus ring + Spike 004 keyboard contract) | ✓ | ✓ live | — | `src/components/admin/verify-checklist/keyboard-bindings.ts:44-48` j/k/a/d/Enter constants; `BlockChecklistRow.tsx` ring-2 ring-yellow-400 |
| SCP-PARSE-01 (block_provenance written by parse pipeline) | ✓ | ✓ live | — | `src/lib/parsers/parsed-sop-to-layout-data.ts` `ProvenanceContext` + `stampProvenance`; `src/app/api/sops/parse/route.ts` wires extractors; Plan 21-05 now forwards `block_provenance` into junction row via `addBlockToSection({ blockProvenance })` (`parsed-sop-to-layout-data.ts:803-813`) |
| SCP-PARSE-02 (extractPdfBlockBboxes — Spike 001 production) | ✓ | ✓ live (unit) | Spike 001 | `src/lib/parsers/source-viewer/extract-pdf-bbox.ts` with fresh `new Uint8Array(buf)` per call (CLAUDE.md 2026-05-15 learning honoured) |
| SCP-PARSE-03 (extractDocxParagraphAnchors) | ✓ | ✓ live | — | `src/lib/parsers/source-viewer/extract-docx-paragraph.ts` |
| SCP-PARSE-04 (fire-and-forget reviewer hook on parse completion) | ✓ | ✓ live | — | Same as SCP-AI-06; `parse-pipeline.ts:44-84` |

**Pass count:** 23/23
**Partial:** 0/23
**Fail:** 0/23

---

## Locked-decision audit (D-21-01..13)

| ID | Decision | Status | Evidence |
|----|----------|--------|----------|
| D-21-01 | Migration number 00032 | ✓ PASS | `supabase/migrations/00032_phase21_verified_by_and_ai_review_results.sql` exists; 00033 (Plan 21-05) is additive seed-only, no FK or schema collision |
| D-21-02 | Reuse verify-sop.ts lazy-singleton + fetch indirection | ✓ PASS | `orchestrator.ts:21` `import { getAnthropic, VERIFY_MODEL } from '@/lib/parsers/verify-sop'` — additive, no parallel infra |
| D-21-03 | All 5 jobs in ONE HTTP session with ephemeral prompt cache | ✓ PASS | `orchestrator.ts:266-270` `cachedSourceBlock` with `cache_control: { type: 'ephemeral' }`; `:272` for-loop dispatches A→B→C→D→E in one function call; orchestrator.test.ts asserts `cache_read_tokens > 0` after all 5 jobs |
| D-21-04 | Reviewer outputs persist to parse_jobs.ai_review_results | ✓ PASS | Migration 00032:69-73 column `parse_jobs.ai_review_results jsonb default '{}'`; `orchestrator.ts:115-133` `persistEnvelope()` |
| D-21-05 | verified_by_admin_id + verified_at NULLABLE | ✓ PASS | Migration 00032:38-42 both columns added without `not null` |
| D-21-06 | Per-org cap at orchestrator boundary; NEW org_anthropic_spend table | ✓ PASS | Migration 00032:79-103 (table + RLS policy); `orchestrator.ts:218` calls `assertOrgCapNotExceeded` BEFORE any dispatch; `:342` calls `recordOrgSpend` AFTER persistence |
| **D-21-07** | **No bulk-verify UI — guard MUST be LIVE** | **✓ PASS (closed)** | Guard `tests/lint/no-bulk-verify-ui.spec.ts` registered in `phase15-stubs` regex; `npx playwright test --project=phase15-stubs lint/no-bulk-verify-ui.spec.ts` → 1 passed. PipelineProgressClient.tsx:273 copy rephrased away from trigger phrase. Both fixed in commit `f0d2792` on master prior to 21-05 work. |
| D-21-08 | Edit clears OWN verification only — DB trigger fires per-row | ✓ PASS | Migration 00032:149-156 `for each row` + WHEN clause on `snapshot_content` / `pinned_version_id` distinct from old; clears only NEW.verified_by_admin_id + NEW.verified_at |
| D-21-09 | Bundle isolation — pdfjs/mammoth NOT in worker bundle | ✓ PASS (live verified) | `npx tsx scripts/check-bundle-size.ts` re-run 2026-05-26: exits 0; output "1104 KB (baseline 1104 KB, Δ 0 KB)"; pdfjs + mammoth still isolated post-21-05 |
| D-21-10 | Wave 0 lands FIRST with test.fixme stubs | ✓ PASS | Commits 79d931c (VIEWER + PARSE) and eb556a8 (AI + VERIFY) precede all Wave 1+ feature commits in `git log` |
| D-21-11 | SCP-AI-02 + SCP-AI-03 served by Job C as a SINGLE LLM call | ✓ PASS | `jobs/job-c-anchoring.ts:108-113` — single `export const JOB_C: ReviewerJob` with one systemPrompt and one parseResponse |
| D-21-12 | Legacy /admin/sops/[sopId]/review deleted + 308 redirect | ✓ PASS | `src/app/(protected)/admin/sops/[sopId]/review/` directory does NOT exist; `next.config.ts:19-22` defines `redirects()` mapping `/admin/sops/:sopId/review` → builder |
| D-21-13 | Per-day cap storage in ai_review_rate_limits table | ✓ PASS | Migration 00032:109-119 table; race window documented (acceptable per T-21-03-04) |

**Decision pass count: 13/13. Fail: 0.**

---

## High-risk invariant audit

*(Original 8 invariants from initial verification remain ✓ PASS — no regression detected. New invariant added below for Plan 21-05 structural gap closure.)*

### 9. Parser → junction materialization (NEW — Plan 21-05 gap closure)

**Status: ✓ PASS (source-verified; live DB needs human UAT).**

The STRUCTURAL gap discovered on 2026-05-25 (verify checklist iterates `sop_section_blocks` but parser only wrote `sop_sections.layout_data` → publish gate was `0 === 0 = true` for every parsed SOP) is now closed by Plan 21-05:

1. **`materializeJunctionsForLayout` exists and is wired into the parse route.** `src/lib/parsers/parsed-sop-to-layout-data.ts:761-827` iterates Puck items sequentially, calls `createBlock({ scope:'org', category:'parsed_inline', serviceRole:{...} })` then `addBlockToSection({ blockProvenance, serviceRole:true })`, then mutates `item.props.junctionId = addRes.junction.id` in place. The parse route wires it in `src/app/api/sops/parse/route.ts:309-315` — section row is inserted FIRST without layout_data, junctions are materialized (mutating Puck items in place), then `layout_data` is written via UPDATE in the same per-section pass (lines 317-330).

2. **`BlockContentSchema.options.length === 19`** — verified live via `npx tsx -e "import { BlockContentSchema } from './src/lib/validators/blocks'; console.log(BlockContentSchema.options.length)"` → output `19`. The 7 new kinds are `text, heading, photo, callout, model, step_with_photos, photo_grid` (matches Plan 21-05 task 2 contract).

3. **Migration 00033 seeds the 7 new section_kinds.** `supabase/migrations/00033_phase21_extend_block_kinds_for_parser.sql:24-41` inserts 7 rows into `public.section_kinds` with `organisation_id = NULL` (global scope) using `ON CONFLICT DO NOTHING` for idempotency. Migration is pure seed data — no schema change because `blocks.kind_slug` is text (not FK).

4. **T-21-05-01 mitigation (library bloat) — `category='parsed_inline'` filter.** `src/actions/blocks.ts:424` defaults `includeParsedInline: false` in `listBlocks`; the picker query at line 463-467 excludes `category='parsed_inline'` rows by default while preserving them in the DB for verify-gate/reviewer-flag mapping.

5. **T-21-05-02 mitigation (partial-failure rollback) — throw-on-first-failure.** `parsed-sop-to-layout-data.ts:797-800` and `:814-817` throw on `createBlock` or `addBlockToSection` failure mid-loop. The parse route's outer try/catch marks the `parse_job` as failed so the SOP never lands with N-of-M junctions.

6. **T-21-05-03 mitigation (Puck props vs BlockContent shape) — strict adapter.** `puckPropsToBlockContent` (`parsed-sop-to-layout-data.ts:421-659`) exhaustively switches on all 17 Puck types, builds the candidate, then `BlockContentSchema.safeParse(candidate)` — throws on shape mismatch at line 653-657 (no silent skip).

### Legacy-SOP limitation — honestly documented

`21-05-SUMMARY.md:152-156` documents the 9 pre-21-05 'uploaded' SOPs on master that have `layout_data` but zero junction rows. Their builder renders fine (layout_data path unchanged) but the verify checklist will be empty and the publish gate will report `total=0, ready=true`. The mitigation (re-parse via admin "re-parse" affordance, otherwise tolerate) is called out plainly. This matches Plan 21-05's explicit non-goal in §"Out of scope" and CONTEXT.md "Bulk migration … out of scope".

---

## Build + test summary (2026-05-26 re-run)

- **`npx tsc --noEmit`** — exit 0 (no output, clean).
- **`npx tsx scripts/check-bundle-size.ts`** — exit 0, `/sops/[sopId]/page` Δ = 0 KB (baseline 1104 KB maintained); pdfjs/mammoth isolation re-confirmed post-21-05.
- **`npx playwright test --project=phase21-unit`** — 20/20 passing (9 Zod schema + 11 adapter/contract). New tests cover discriminated-union size = 19, all 7 new kinds parse, `puckPropsToBlockContent` strict throws, `materializeJunctionsForLayout` wired into parse route, migration 00033 seeds 7 kinds.
- **`npx playwright test --project=phase15-stubs lint/no-bulk-verify-ui.spec.ts`** — 1/1 passing (D-21-07 lint guard live and green).

---

## Anti-patterns scan (re-run 2026-05-26)

| File | Pattern | Severity | Notes |
|------|---------|----------|-------|
| `src/app/api/sops/parse/route.ts:319-324` | `as unknown as object` + `as any` on `layout_data` UPDATE payload | ℹ️ Info | Pre-existing pattern used elsewhere for layout_data writes (LayoutData has typed PuckItem shapes that don't satisfy Supabase's Json type exactly). Auto-fix documented in 21-05-SUMMARY deviation #3. Acceptable per the documented `database.types.ts` regen limit (CLAUDE.md learning). |
| `src/lib/parsers/ai-reviewer/rate-limit.ts:8-12` | Module header still claims atomic UPSERT but implementation is two-step | ⚠️ Warning | Unchanged from initial verification — not regressed by Plan 21-05. Documented in initial Anti-patterns section. Pilot-time follow-up. |

No new blocker anti-patterns introduced by Plan 21-05. The `category='parsed_inline'` filter is a legitimate semantic flag (not a stub), and the throw-on-failure pattern is exactly the T-21-05-02 mitigation.

---

## Gaps Summary

**No outstanding code gaps.** The single initial-verification gap (D-21-07 lint guard not registered in CI) was closed pre-21-05 in commit `f0d2792` on master. The structural gap discovered post-initial-verification during UAT (parser path produced zero junction rows) was closed by Plan 21-05 across 7 commits (`97e2679..70dee10`).

**Remaining items are all human-UAT:**

1. Apply migration 00033 (`npx supabase db push --include-all`) — Simon owns.
2. Parse a fresh DOCX end-to-end and inspect `sop_section_blocks` count for that SOP — confirms the wiring lands in live DB, not just in source.
3. Run the 5 human-verification tests in the frontmatter against a freshly parsed SOP.

---

## Follow-up items

1. **Required before pilot:** Apply migration 00033 and run the 5 human-UAT tests against a freshly parsed SOP (now unblocked because junctions exist).
2. **Post-pilot:** Watch for per-day rate-limit drift (T-21-03-04 race window). Swap read-then-write to `SECURITY DEFINER` atomic RPC if undercount surfaces in spend reports.
3. **Post-pilot:** Decide UX for promoting a `parsed_inline` library block to reusable (admins currently must edit `category` directly in Supabase per `21-05-SUMMARY.md:165`).
4. **Documentation:** Update `rate-limit.ts:8-12` module comment to match the actual two-step implementation OR upgrade implementation.

---

## Re-verification metadata

**Initial verification:** 2026-05-25 — PASS-WITH-NOTES, 22/23, single D-21-07 enforcement gap.
**Re-verification:** 2026-05-26 — PASS-WITH-NOTES, 23/23 + 7 new 21-05 truths, all gaps closed.
**Closure plan:** 21-05 (gap_closure: true, 7 commits `97e2679..70dee10`, dated 2026-05-26).
**Discovered after initial verification:** Structural gap (parser path produced zero junction rows) surfaced during UAT 2026-05-25. Not visible from source-contract review because both the parser file (writes layout_data) and the verify-gate file (reads sop_section_blocks) individually passed unit tests; the gap was between them. Now closed.

---

## Re-verification 2026-05-26 — Plan 21-05 gap closure

**Scope:** Confirm the STRUCTURAL gap discovered during UAT (parser produced zero `sop_section_blocks` junction rows → publish gate was `0 === 0 = true` for every parsed SOP) is closed by Plan 21-05, without regressing the 22/23 PASS items from the initial verification.

### Plan 21-05 must-haves — all PASS

| # | Must-have (from 21-05-PLAN.md frontmatter) | Status | Evidence (path:line) |
|---|--------------------------------------------|--------|----------------------|
| 1 | BlockContentSchema covers all 17 Puck registry kinds (12 existing + 7 new) | ✓ PASS | `BlockContentSchema.options.length === 19` (live-checked via `npx tsx -e ...` → `19`); kinds output: `hazard, ppe, step, emergency, custom, measurement, decision, escalate, signoff, zone, inspect, voice-note, text, heading, photo, callout, model, step_with_photos, photo_grid` |
| 2 | Parser creates one library block + one junction row per Puck item with block_provenance | ✓ PASS | `src/lib/parsers/parsed-sop-to-layout-data.ts:761-827` `materializeJunctionsForLayout` — sequential per-item createBlock+addBlockToSection; `:803-813` forwards `block_provenance` into `addBlockToSection({ blockProvenance: provFromItem })` |
| 3 | Each Puck item in layout_data carries `props.junctionId` | ✓ PASS | `parsed-sop-to-layout-data.ts:822` `item.props.junctionId = addRes.junction.id` (mutation in place); parse route at `route.ts:317-330` writes layout_data AFTER materialization so junctionIds are persisted |
| 4 | Fresh DOCX upload creates N sop_section_blocks rows (≥ 1 per parsed section) | ✓ source-verified, ✗ live-pending | Wiring confirmed in `route.ts:309-315`. Live DB check requires `npx supabase db push --include-all` (Simon owns — see 21-05-SUMMARY Known Limitations); routed to human-UAT #1 |
| 5 | useVerifyChecklist returns rows for freshly parsed SOP (no longer 0===0 no-op) | ✓ source-verified, ✗ live-pending | Hook unchanged from Wave 4 — its iteration over `sop_section_blocks` is correct; the only question was whether junctions existed. Plan 21-05 makes them exist for new parses. Routed to human-UAT #1 (combined with junction-count check). |
| 6 | Library picker offers all 17 kinds with preview cards | ✓ PASS | `src/actions/blocks.ts:424` `includeParsedInline: false` default; `:463-467` PostgREST filter `category.is.null,category.neq.parsed_inline`. `src/components/admin/blocks/BlockPickerPreview.tsx` extended for 7 new kinds (21-05-SUMMARY Task 5, commit `0a0fbf0`). Wizard `LIBRARY_SUPPORTED_SLUG_TO_KIND` extended in `src/app/(protected)/admin/sops/new/blank/WizardClient.tsx`. |
| 7 | Legacy pre-21-05 SOPs documented as out-of-scope | ✓ PASS | `21-05-SUMMARY.md:152-156` documents the 9 'uploaded' SOPs with zero junctions; calls out re-parse mitigation; matches Plan 21-05 §"Out of scope" |

### Threat mitigations — all present

| Threat | Mitigation | Evidence |
|--------|-----------|----------|
| T-21-05-01 (library bloat) | `category='parsed_inline'` filter on picker default | `src/actions/blocks.ts:424` `includeParsedInline: false` default; `:463-467` PostgREST `category.is.null,category.neq.parsed_inline` |
| T-21-05-02 (mid-parse partial failure) | Throw-on-first-failure inside sequential loop | `parsed-sop-to-layout-data.ts:797-800` (createBlock fail throws); `:814-817` (addBlockToSection fail throws). Parse route's outer try/catch marks parse_job failed. |
| T-21-05-03 (Puck props vs BlockContent shape) | Strict `puckPropsToBlockContent` adapter — Zod-validate-or-throw | `parsed-sop-to-layout-data.ts:421-430` (throws on unknown Puck type); `:651-657` `BlockContentSchema.safeParse` throws on shape mismatch; unit-tested via "throws on unknown Puck type" + "throws on shape mismatch (T-21-05-03)" cases in `parser-creates-junctions.test.ts` (both PASS) |

### Regression check — no regression in original 22/23 PASS items

| Check | Pre-21-05 | Post-21-05 | Verdict |
|-------|-----------|------------|---------|
| `npx tsc --noEmit` | clean | clean (no output) | ✓ no regression |
| `npx tsx scripts/check-bundle-size.ts` | 1104 KB, Δ 0 KB, pdfjs/mammoth isolated | 1104 KB, Δ 0 KB, pdfjs/mammoth still isolated | ✓ no regression |
| `playwright --project=phase15-stubs lint/no-bulk-verify-ui` | 1/1 PASS | 1/1 PASS | ✓ D-21-07 still enforced — 7 new kinds did not introduce any banned phrase |
| `playwright --project=phase21-unit` | (project did not exist) | 20/20 PASS | ✓ new project lands clean |
| D-21-09 chunk-existence guard for pdfjs + mammoth | pass | pass (per bundle-size output) | ✓ no regression |
| Legacy publish-gate bypass conditions (`source_type=='ai_prompt'` OR `source_file_path IS NULL`) | mirror UI↔server | unchanged in `route.ts:72` and `BuilderWithSourceViewer.tsx:127` | ✓ no regression — legacy SOPs without source files (incl. the 9 'uploaded' pre-21-05 rows) still bypass cleanly |

### Items unblocked for human UAT

The two previously-blocked UAT items can now run against a freshly parsed SOP because junction rows exist:

- **UAT #1 (SourceViewerPane + VerifyChecklistGate)** — was source-contract-only because no parsed SOP had `sop_section_blocks` rows to render in the gate. Now: parse a DOCX (post-migration-00033 push), confirm VerifyChecklistGate lists ≥1 row per section. Combined the gate-row check into UAT #1 to avoid duplicating the parse step.
- **UAT #4 (edit-clears-verification on parser-created block)** — was source-contract-only because no parsed SOP had a verified junction to edit. Now: verify a parser-created block, edit it, observe trigger fires for that row only.

UAT #2 (AI reviewer), #3 (publish-endpoint defence-in-depth), #5 (rate-limit + spend cap) — same as initial verification, requires live keys/state.

### Re-verification verdict

**PASS-WITH-NOTES.** All 22/23 initial-verification truths still pass. All 7/7 Plan 21-05 must-haves pass at source/test level. All 3 threat mitigations are present. Bundle delta still 0 KB. No regression in D-21-07 lint guard. The 5 human-UAT items are the only remaining work before pilot, and they are now unblocked by Plan 21-05.

---

*Verified: 2026-05-25 (initial) → 2026-05-26 (re-verified after 21-05)*
*Verifier: Claude (gsd-verifier)*
