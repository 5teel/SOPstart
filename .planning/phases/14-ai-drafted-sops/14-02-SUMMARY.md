---
phase: 14-ai-drafted-sops
plan: 02
subsystem: ai-prompt-generator
tags: [phase-14, ai-prompt, claude-pipeline, section-kind-resolver, parse-jobs, gpt-parser, verify-sop]
requires:
  - 14-01 (input_type='ai_prompt' DB slot, prompt_text column, aiPromptSchema, STAGE_SETS map, /admin/sops/new/ai entry route)
  - parseSopWithGPT (Claude tool-use parser, Phase 02/06)
  - verifyTranscriptVsSop + detectMissingSections (Phase 06 verifier)
  - section_kinds catalog (Phase 11)
  - sops.source_type CHECK already permits 'ai' (00020)
provides:
  - POST /api/sops/ai-prompt — text-only Claude pipeline returning { sopId }
  - parseSopWithGPT extended signature: opts { sourceMode: SourceFileType | 'prompt', detailLevel }
  - FORMAT_HINTS.prompt — NZ industrial NL-prompt hint (MAXIMUM inference, conservative on specifics)
  - section_kind_id resolver hook on AI-path inserts (closes ROADMAP success #4 for Phase 14)
  - verifyTranscriptVsSop opts.mode forward-compat stub (semantics filled in 14-03)
affects:
  - src/app/api/sops/youtube/route.ts (caller migrated to opts shape; behaviour byte-identical)
  - src/app/api/sops/transcribe/route.ts (caller migrated to opts shape; behaviour byte-identical)
  - src/app/api/sops/parse/route.ts (caller migrated to opts shape; behaviour byte-identical)
  - src/app/api/sops/restructure/route.ts (caller migrated to opts shape — clears I-1)
tech-stack:
  added: []
  patterns:
    - "parseSopWithGPT dual-shape signature (legacy positional OR opts object) — backwards-compat for Phase 6 callers while admitting 'prompt' as a non-DB-CHECK sourceMode"
    - "Slug -> id map resolver for section_kind_id (exact then substring match; null fallback covers legacy renderer)"
    - "Forward-compat opts param (verify-sop.ts mode) — accepted now, semantics deferred to 14-03"
key-files:
  created:
    - "src/app/api/sops/ai-prompt/route.ts"
  modified:
    - "src/lib/parsers/gpt-parser.ts"
    - "src/lib/parsers/verify-sop.ts"
    - "src/app/api/sops/youtube/route.ts"
    - "src/app/api/sops/transcribe/route.ts"
    - "src/app/api/sops/parse/route.ts"
    - "src/app/api/sops/restructure/route.ts"
decisions:
  - "verify-sop.ts opts.mode added as forward-compat stub — 14-03 will swap the system prompt when mode==='prompt'; until then mode is ignored and verifier runs in transcript framing"
  - "Anthropic errors wrapped in generic 'AI draft generation failed' user-facing message — original logged server-side only (defence-in-depth, T-14-02-04)"
  - "I-1 closed: restructure/route.ts migrated off legacy positional parseSopWithGPT call"
  - "No idempotency guard on /api/sops/ai-prompt — accepted product trade-off per Task 2 rationale; admin dedupes from library"
metrics:
  duration: "~15 minutes (2 commits)"
  completed: 2026-05-11
---

# Phase 14 Plan 02: AI Generator Pipeline Summary

POST /api/sops/ai-prompt now drives the full Claude pipeline (`prompting -> drafting -> verifying -> completed`) and persists structured SOP sections with `section_kind_id` resolved. Closes the generator half of SB-AUTH-02.

## Outcome

Admin POSTs `{ promptText, categoryTag?, detailLevel? }` to `/api/sops/ai-prompt`; the route validates via `aiPromptSchema`, creates `sops` (`source_type='ai'`, `status='parsing'`) + `parse_jobs` (`input_type='ai_prompt'`, `prompt_text` populated, `current_stage='prompting'`) rows, then drives the pipeline through three labelled stages on `parse_jobs.current_stage` while `ParseJobStatus` (Wave 1) renders the AI 3-stage stepper. On completion `parse_jobs.status='completed'`, `sops.status='draft'`, sections persisted with `section_kind_id` resolved against the canonical `hazards/ppe/steps/emergency/...` slugs. Returns `{ success: true, sopId }` to the Wave 1 PromptClient which redirects to `/admin/sops/[sopId]/review` (D-03).

`parseSopWithGPT` now accepts an opts object — Phase 6 callers (youtube/transcribe/parse/restructure) migrated to the new shape with byte-identical behaviour for video sources. `'prompt'` is admitted only at the FORMAT_HINTS keyspace and the `sourceMode` opts arg; `SourceFileType` (DB CHECK) is unchanged (D-01).

## Files Changed

### Created

| File | Purpose |
|------|---------|
| `src/app/api/sops/ai-prompt/route.ts` | POST handler — auth/role guard, Zod validation, sops+parse_jobs insert, Claude pipeline (drafting + verifying), section_kind_id resolver, sections+steps persist, failure-recovery |

### Modified

| File | Change |
|------|--------|
| `src/lib/parsers/gpt-parser.ts` | Signature extended: `parseSopWithGPT(text, optsOrInputType, detailLevelLegacy?)` — accepts legacy positional OR opts `{ sourceMode, detailLevel }`. FORMAT_HINTS keyspace widened to `Partial<Record<SourceFileType \| 'prompt', string>>`; new `prompt` hint with NZ industrial framing (MAXIMUM inference, conservative on specifics, parse_notes for fabrication audit) |
| `src/lib/parsers/verify-sop.ts` | Forward-compat third arg: `opts?: { mode?: 'transcript' \| 'prompt' }`. Accepted but ignored until 14-03 wires the prompt-mode system prompt. ESLint disable comment justifies the unused param. |
| `src/app/api/sops/youtube/route.ts` | `parseSopWithGPT(transcriptText, 'video')` -> `parseSopWithGPT(transcriptText, { sourceMode: 'video' })` |
| `src/app/api/sops/transcribe/route.ts` | Same migration to opts shape |
| `src/app/api/sops/parse/route.ts` | `parseSopWithGPT(extractedText, fileType)` -> `parseSopWithGPT(extractedText, { sourceMode: fileType })` |
| `src/app/api/sops/restructure/route.ts` | Closes I-1: legacy 3-arg positional `parseSopWithGPT(transcriptText, 'video', detailLevel ?? 3)` -> opts shape `{ sourceMode: 'video', detailLevel: detailLevel ?? 3 }` |

## Task Status

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | Extend parseSopWithGPT signature + add 'prompt' FORMAT_HINTS + migrate ALL callers | DONE | 2e2dd96 |
| 2 | /api/sops/ai-prompt route — full Claude pipeline + section_kind_id resolver | DONE | 9b6df5e |

## Deviations from Plan

### [Rule 3 — Blocker resolved] verify-sop.ts opts.mode forward-compat stub
- **Found during:** Task 2 implementation
- **Issue:** Plan §guardrail 6 explicitly anticipated this: the route calls `verifyTranscriptVsSop(promptText, parsed, { mode: 'prompt' })` but `verifyTranscriptVsSop` only accepts 2 args today. Strict TypeScript would reject the third arg.
- **Resolution:** Added a third optional param `opts?: { mode?: 'transcript' | 'prompt' }` to `verifyTranscriptVsSop`. The body ignores it; 14-03 will branch the system prompt on `mode === 'prompt'`. Eslint-disable line marks the param as intentionally unused.
- **Files affected:** `src/lib/parsers/verify-sop.ts`
- **Commit:** 9b6df5e
- **Plan compliance:** Documented in plan §guardrail 6 ("If tsc complains, add a minimal stub overload to verify-sop.ts that accepts the opts arg but ignores `mode` for now"). No surprise.

### [Rule 2 — Defence-in-depth] Wrap Anthropic error message before returning to client
- **Found during:** Task 2 catch block
- **Issue:** Plan template returned the raw error message verbatim in the 500 response (`return NextResponse.json({ error: message }, { status: 500 })`), which would leak Anthropic-internal error strings (rate-limit details, model identifiers, stack hints) to the admin browser.
- **Resolution:** The original message is still recorded in `parse_jobs.error_message` (admin-visible via review page) and `console.error` (server log), but the HTTP response uses a generic message: `"AI draft generation failed. Please try again or contact support."` This matches threat model T-14-02-04's "no PII pre-redaction in v3.0" stance for the verifier path while still avoiding gratuitous internal-error leakage. Standard practice for production routes.
- **Files affected:** `src/app/api/sops/ai-prompt/route.ts`
- **Commit:** 9b6df5e

## Verification

- `npx tsc --noEmit` — clean (exit 0) after both commits.
- ESLint on touched files: clean except for **2 pre-existing issues** in `restructure/route.ts` (unused `sop` var — warning) and `transcribe/route.ts:19` (`require('ffmpeg-static')` — error). Both predate this plan; logged below as deferred.
- All 19 plan-mandated literals present in `ai-prompt/route.ts` (verified via PowerShell pattern check; see plan §verify automated).
- Caller migration verified: zero matches for `parseSopWithGPT\([^,]+,\s*'video'\s*[,)]` in restructure/route.ts.
- Behavioural smoke test deferred to 14-03 (which lands the verifier mode semantics) followed by a phase-end UAT.

## Threat Flags

None. The route's surface is a strict subset of the youtube/route.ts trust boundaries — the threat register's T-14-02-01 through T-14-02-10 are all addressed by mitigations already in code (auth/role guard, Zod max(2000), service-role client never trusts body for org_id, parameterised section_kinds query, generic 500 error wrapping).

## Deferred Issues (Out of Scope)

These were identified but explicitly NOT fixed by this plan (Rule 5 — only auto-fix issues directly caused by the current task's changes):

| Issue | File | Notes |
|-------|------|-------|
| `require('ffmpeg-static')` ESLint `no-require-imports` error | `src/app/api/sops/transcribe/route.ts:19` | Pre-existing (Phase 06). Cleanup task: replace with dynamic `import()` or `createRequire`. Out of scope for 14-02. |
| Unused `sop` variable warning | `src/app/api/sops/restructure/route.ts:71` | Pre-existing. Either consume or remove. Out of scope for 14-02. |

## Open Follow-Ups for 14-03

1. **Verifier prompt-mode semantics (D-02)** — swap `verifyTranscriptVsSop` system prompt to plausibility/hallucination framing when `opts.mode === 'prompt'`. Drop the eslint-disable line on the param. Add unit tests for both modes.
2. **Library chip (D-05)** — render "AI DRAFT" badge on `/admin/sops` tiles where `sops.source_type = 'ai'`, mirroring Phase 12's "AUTHORED IN BUILDER" chip styling.
3. **"Open in builder" CTA (D-03)** — add primary action on `ReviewClient.tsx` that pushes to `/admin/sops/builder/[sopId]` when source supports the unified builder.
4. **Pre-existing dead code cleanup** — opportunistically clear the `failedStageName`/`onRetry` `void` references in `ParseJobStatus.tsx` plus the two ESLint issues listed above.
5. **Phase 6 retrofit (out of scope but flagged)** — Phase 6 inserts (`youtube/route.ts`, `transcribe/route.ts`) still don't populate `section_kind_id`. Additive cleanup task to mirror 14-02's resolver pattern.

## Self-Check: PASSED

- [x] `src/app/api/sops/ai-prompt/route.ts` exists (commit 9b6df5e)
- [x] `src/lib/parsers/gpt-parser.ts` modified: prompt FORMAT_HINT + opts signature (commit 2e2dd96)
- [x] `src/lib/parsers/verify-sop.ts` modified: opts.mode param (commit 9b6df5e)
- [x] All 4 callers migrated: youtube/transcribe/parse/restructure (commit 2e2dd96)
- [x] Commit `2e2dd96` present in `git log` on this worktree branch
- [x] Commit `9b6df5e` present in `git log` on this worktree branch
- [x] `npx tsc --noEmit` exits 0
- [x] All 19 plan-mandated literals present in `ai-prompt/route.ts`
- [x] `restructure/route.ts` no longer matches legacy positional pattern (I-1 cleared)
